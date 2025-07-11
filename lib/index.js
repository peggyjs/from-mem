"use strict";

// Import or require module text from memory, rather than disk.  Runs
// in a node vm, very similar to how node loads modules.
//
// Ideas taken from the "module-from-string" and "eval" modules, neither of
// which were situated correctly to be used as-is.

const { Module } = require("node:module");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const globalContext = require("./global.js");
const isImportSupported = require("./supported.js");
const importString = require("./importString.js");

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
  const script = new vm.Script(code, {
    filename: options.filename,
    lineOffset: options.lineOffset,
    columnOffset: options.columnOffset,
  });
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
 * @typedef {"commonjs"|"es"} ModuleType
 */

/**
 * @type Record<string, ModuleType>
 */
let cache = {};

/**
 * Figure out the module type for the given file.  If no package.json is
 * found, default to "commonjs".
 *
 * @param {string} filename Fully-qualified filename to start from.
 * @returns {Promise<ModuleType>}
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

  /** @type {ModuleType} */
  let res = "commonjs";
  let dir = fp.dir;
  let prev = undefined;
  const pending = [];
  while (dir !== prev) {
    const cached = cache[dir];
    if (cached) {
      return cached;
    }
    pending.push(dir);
    try {
      const pkg = await fs.readFile(path.join(dir, "package.json"), "utf8");
      const pkgj = JSON.parse(pkg);
      res = (pkgj.type === "module") ? "es" : "commonjs";
      break;
    } catch(err) {
      // If the file just didn't exist, keep going.
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") {
        throw err;
      }
    }
    prev = dir;
    dir = path.dirname(dir);
  }
  for (const p of pending) {
    cache[p] = res;
  }
  return res;
}

guessModuleType.clearCache = function clearCache() {
  cache = {};
};

/**
 * Import or require the given code from memory.  Knows about the different
 * Peggy output formats.  Returns the exports of the module.
 *
 * @param {string} code Code to import
 * @param {FromMemOptions} options Options.  Most important is filename.
 * @returns {Promise<unknown>} The evaluated code.
 */
async function fromMem(code, options) {
  options = {
    format: "guess",
    env: undefined,
    includeGlobals: true,
    lineOffset: 0,
    columnOffset: 0,
    ...options,
  };

  if (options.includeGlobals) {
    options.context = {
      ...globalContext,
      ...options.context,
    };
  } else {
    // Put this here instead of in the defaults above so that typescript
    // can see it.
    options.context = options.context || {};
  }

  // Make sure env changes don't stick.  This isn't a security measure, it's
  // to prevent mistakes.  There are probably a few other places where
  // mistakes are likely, and the same treatment should be given.
  if (options.context.process) {
    if (options.context.process === process) {
      options.context.process = { ...process };
    }
    options.context.process.env = options.env || {
      ...options.context.process.env,
    };
  } else if (options.env) {
    options.context.process = {
      version: process.version,
      env: { ...options.env },
    };
  }

  options.context.global = options.context;
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
    case "cjs":
    case "commonjs":
    case "umd":
      return requireString(code, dirname, options);
    case "es":
    case "es6":
    case "esm":
    case "module":
    case "mjs":
      // Returns promise
      return importString(code, dirname, options);
    // I don't care enough about amd and globals to figure out how to load them.
    default:
      throw new Error(`Unsupported output format: "${options.format}"`);
  }
}

fromMem.guessModuleType = guessModuleType;
fromMem.isImportSupported = isImportSupported;

module.exports = fromMem;
