"use strict";

const semver = require("semver");
const url = require("node:url");
const vm = require("node:vm");
const isImportSupported = require("./supported.js");

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
  if (!isImportSupported()) {
    throw new Error("Start node with `node --experimental-vm-modules` in order to import ES6 modules");
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
    lineOffset: options.lineOffset,
    columnOffset: options.columnOffset,
    context: vm.createContext(options.context),
    initializeImportMeta(meta) {
      meta.url = fileUrl;
    },
    importModuleDynamically(specifier) {
      return import(
        /* webpackIgnore: true */ resolveIfNeeded(dirUrl, specifier)
      );
    },
  });

  await mod.link(async(specifier, referencingModule) => {
    const resolvedSpecifier = resolveIfNeeded(dirUrl, specifier);
    const targetModule = await import(
      /* webpackIgnore: true */ resolvedSpecifier
    );
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

module.exports = importString;
