"use strict";

/**
 * @typedef {"amd"
 * | "bare"
 * | "cjs"
 * | "commonjs"
 * | "es"
 * | "es6"
 * | "esm"
 * | "globals"
 * | "guess"
 * | "mjs"
 * | "module"
 * | "umd" } SourceFormat
 */

/**
 * Options for how to process code.
 *
 * @typedef {object} FromMemOptions
 * @property {SourceFormat} [format="guess"] What format does the code
 *   have?  "guess" means to read the closest package.json file looking for
 *   the "type" key.  "globals", "amd", and "bare" are not actually supported.
 * @property {Record<string, any>} [env] If specified, use this instead of the
 *   current values in process.env.  Works if includeGlobals is false by
 *   creating an otherwise-empty process instance.
 * @property {string} filename What is the fully-qualified synthetic filename
 *   for the code?  Most important is the directory, which is used to find
 *   modules that the code import's or require's.
 * @property {Record<string, any>} [context={}] Variables to make availble in
 *   the global scope while code is being evaluated.  Overwrites global
 *   properties as needed.
 * @property {boolean} [includeGlobals=true] Include the typical global
 *   properties that node gives to all modules.  (e.g. Buffer, process).
 * @property {number} [lineOffset=0] Specifies the line number offset that is
 *   displayed in stack traces produced by this script.
 * @property {number} [columnOffset=0] Specifies the first-line column number
 *   offset that is displayed in stack traces produced by this script.
 */
