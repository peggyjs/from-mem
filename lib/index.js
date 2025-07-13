"use strict";

// Import or require module text from memory, rather than disk.  Runs
// in a node vm, very similar to how node loads modules.
//
// Ideas taken from the "module-from-string" and "eval" modules, neither of
// which were situated correctly to be used as-is.

const path = require("node:path");
const { guessModuleType, isImportSupported } = require("./utils.js");
const importString = require("./importString.js");
const requireString = require("./requireString.js");
const { normalizeContext } = require("./global.js");

/** @typedef {import("./global.js").FromMemOptions} FromMemOptions */
/** @typedef {import("./global.js").ConsoleOutErr} ConsoleOutErr */

/**
 * Import or require the given code from memory.  Knows about the different
 * Peggy output formats.  Returns the exports of the module.
 *
 * @param {string} code Code to import
 * @param {FromMemOptions} options Options.  Most important is filename.
 * @returns {Promise<unknown>} The evaluated code.
 * @example
 *
 * ```js
 * const mjsResult = await fromMem(
 *   "export default 42",
 *   {
 *     filename: "foo.mjs",
 *     exec: "return IMPORTED.default + arg",
 *     arg: 3,
 *   }
 * ); // 45
 * const cjsResult = await fromMem(
 *   "module.exports = 42;",
 *   {
 *     filename: "foo.cjs",
 *     exec: "return IMPORTED + arg",
 *     arg: 3,
 *   }
 * ); // 45
 * ```
 */
async function fromMem(code, options) {
  options = {
    format: "guess",
    env: undefined,
    includeGlobals: true,
    lineOffset: 0,
    columnOffset: 0,
    consoleOutput: undefined,
    colorMode: "auto",
    ...options,
  };

  normalizeContext(options);

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

fromMem.isImportSupported = isImportSupported;
fromMem.guessModuleType = guessModuleType;

module.exports = fromMem;
