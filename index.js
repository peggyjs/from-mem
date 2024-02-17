"use strict";

// Import or require module text from memory, rather than disk.  Runs
// in a node vm, very similar to how node loads modules.
//
// Ideas taken from the "module-from-string" and "eval" modules, neither of
// which were situated correctly to be used as-is.

const fs = require("node:fs/promises");
const vm = require("node:vm");
const { Module } = require("node:module");
const path = require("node:path");
const url = require("node:url");
const semver = require("semver");

// These already exist in a new, blank VM.  Date, JSON, NaN, etc.
// Things from the core language.
const vmGlobals = new vm
  .Script("Object.getOwnPropertyNames(globalThis)")
  .runInNewContext()
  .sort();
vmGlobals.push("global", "globalThis", "sys");

// These are the things that are normally in the environment, that vm doesn't
// make available.  This that you expect to be available in a node environment
// that aren't in the laguage itself.
const neededKeys = Object
  .getOwnPropertyNames(global)
  .filter(k => !vmGlobals.includes(k))
  .sort();
const globalContext = Object.fromEntries(
  neededKeys.map(k => [k, global[
    /** @type {keyof typeof global} */ (k)
  ]])
);

// In node <15, console is in vmGlobals.
globalContext.console = console;

/**
 * Options for how to process code.
 *
 * @typedef {object} FromMemOptions
 * @property {"amd"|"bare"|"commonjs"|"es"|"globals"|"guess"|"umd"} [format="commonjs"]
 *   What format does the code have?  "guess" means to read the closest
 *   package.json file looking for the "type" key.
 * @property {string} filename What is the fully-qualified synthetic
 *   filename for the code?  Most important is the directory, which is used to
 *   find modules that the code import's or require's.
 * @property {object} [context={}] Variables to make availble in the global
 *   scope while code is being evaluated.
 * @property {boolean} [includeGlobals=true] Include the typical global
 *   properties that node gives to all modules.  (e.g. Buffer, process).
 * @property {string} [globalExport=null] For type "globals", what name is
 *   exported from the module?
 */

/**
 * Treat the given code as a node module as if require() had been called
 * on a file containing the code.
 *
 * @param {string} code Source code in commonjs format.
 * @param {string} dirname Used for __dirname.
 * @param {FromMemOptions} options
 * @returns {object} The module exports from code
 */
function requireString(code, dirname, options) {
  // @ts-expect-error This isn't correct.
  const m = new Module(options.filename, module); // Current module is parent.
  // This is the function that will be called by `require()` in the parser.
  m.require = Module.createRequire(options.filename);
  const script = new vm.Script(code, { filename: options.filename });
  return script.runInNewContext({
    module: m,
    exports: m.exports,
    require: m.require,
    __dirname: dirname,
    __filename: options.filename,
    ...options.context,
  });
}

/**
 * If the given specifier starts with a ".", path.resolve it to the given
 * directory.  Otherwise, it's a fully-qualified path, a node internal
 * module name, an npm-provided module name, or a URL.
 *
 * @param {string} dirname Owning directory
 * @param {string} specifier String from the rightmost side of an import statement
 * @returns {string} Resolved path name or original string
 */
function resolveIfNeeded(dirname, specifier) {
  if (specifier.startsWith(".")) {
    specifier = new URL(specifier, dirname).toString();
  }
  return specifier;
}

/**
 * Treat the given code as a node module as if import had been called
 * on a file containing the code.
 *
 * @param {string} code Source code in es6 format.
 * @param {string} dirname Where the synthetic file would have lived.
 * @param {FromMemOptions} options
 * @returns {Promise<unknown>} The module exports from code
 */
async function importString(code, dirname, options) {
  if (!vm.SourceTextModule) {
    throw new Error("Start node with --experimental-vm-modules for this to work");
  }

  if (!semver.satisfies(process.version, ">=20.8")) {
    throw new Error("Requires node.js 20.8+ or 21.");
  }

  const fileUrl = options.filename.startsWith("file:")
    ? options.filename
    : url.pathToFileURL(options.filename).toString();
  const dirUrl = dirname.startsWith("file:")
    ? dirname + "/"
    : url.pathToFileURL(dirname).toString() + "/";

  const mod = new vm.SourceTextModule(code, {
    identifier: fileUrl,
    context: vm.createContext(options.context),
    initializeImportMeta(meta) {
      meta.url = fileUrl;
    },
    // @ts-expect-error Types in @types/node are wrong.
    importModuleDynamically(specifier) {
      return import(resolveIfNeeded(dirUrl, specifier));
    },
  });

  await mod.link(async(specifier, referencingModule) => {
    const resolvedSpecifier = resolveIfNeeded(dirUrl, specifier);
    const targetModule = await import(resolvedSpecifier);
    const exports = Object.keys(targetModule);

    // DO NOT change function to () =>, or `this` will be wrong.
    return new vm.SyntheticModule(exports, function() {
      for (const e of exports) {
        this.setExport(e, targetModule[e]);
      }
    }, {
      context: referencingModule.context,
    });
  });
  await mod.evaluate();
  return mod.namespace;
}

/**
 * Figure out the module type for the given file.  If no package.json is
 * found, default to "commonjs".
 *
 * @param {string} filename Fully-qualified filename to start from.
 * @returns {Promise<"commonjs"|"es">}
 * @throws On invalid package.json
 */
async function guessModuleType(filename) {
  const fp = path.parse(filename);
  switch (fp.ext) {
    case ".cjs": return "commonjs";
    case ".mjs": return "es";
    default:
      // Fall-through
  }
  let dir = fp.dir;
  let prev = undefined;
  while (dir !== prev) {
    try {
      const pkg = await fs.readFile(path.join(dir, "package.json"), "utf8");
      const pkgj = JSON.parse(pkg);
      return (pkgj.type === "module") ? "es" : "commonjs";
    } catch (err) {
      // If the file just didn't exist, keep going.
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") {
        throw err;
      }
    }
    prev = dir;
    dir = path.dirname(dir);
  }
  return "commonjs";
}

/**
 * Import or require the given code from memory.  Knows about the different
 * Peggy output formats.  Returns the exports of the module.
 *
 * @param {string} code Code to import
 * @param {FromMemOptions} options Options.  Most important is filename.
 * @returns {Promise<unknown>} The evaluated code.
 */
module.exports = async function fromMem(code, options) {
  options = {
    format: "commonjs",
    context: {},
    includeGlobals: true,
    globalExport: undefined,
    ...options,
  };

  if (options.includeGlobals) {
    options.context = {
      ...globalContext,
      ...options.context,
    };
  }

  // @ts-expect-error Context is always non-null
  options.context.global = options.context;
  // @ts-expect-error Context is always non-null
  options.context.globalThis = options.context;

  if (!options.filename) {
    throw new TypeError("filename is required");
  }
  if (!options.filename.startsWith("file:")) {
    // File URLs must be already resolved.
    options.filename = path.resolve(options.filename);
  }
  const dirname = path.dirname(options.filename);

  if (options.format === "guess") {
    options.format = await guessModuleType(options.filename);
  }
  switch (options.format) {
    case "bare":
    case "commonjs":
    case "umd":
      return requireString(code, dirname, options);
    case "es":
      // Returns promise
      return importString(code, dirname, options);
    // I don't care enough about amd and globals to figure out how to load them.
    default:
      throw new Error(`Unsupported output format: "${options.format}"`);
  }
};
