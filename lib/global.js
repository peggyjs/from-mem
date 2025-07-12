"use strict";

const vm = require("node:vm");
const ConsoleOutput = require("./console.js");

// These already exist in a new, blank VM.  Date, JSON, NaN, etc.
// Things from the core language.
const vmGlobals = new Set(new vm
  .Script("Object.getOwnPropertyNames(globalThis)")
  .runInNewContext());
vmGlobals.add("global");
vmGlobals.add("globalThis");
vmGlobals.add("sys");

// These are the things that are normally in the environment, that vm doesn't
// make available.  This that you expect to be available in a node environment
// that aren't in the laguage itself.  There are a lot more things in this list
// than you expect, like setTimeout and structuredClone.
const neededKeys = Object
  .getOwnPropertyNames(global)
  .filter(k => !vmGlobals.has(k))
  .sort();
const globalContext = Object.fromEntries(
  neededKeys.map(k => [k, global[
    /** @type {keyof typeof global} */ (k)
  ]])
);

globalContext.console = console;

/**
 * @typedef {object} NormalizedOptions
 * @property {Record<string, any>} [originalContext]
 * @property {ConsoleOutput} [console]
 */

/**
 * Fix up context as needed.
 *
 * @param {FromMemOptions & NormalizedOptions} options
 */
function normalizeContext(options) {
  options.originalContext = options.context;

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

  if (options.consoleOutput) {
    const co = options.consoleOutput;
    options.console = new ConsoleOutput();
    options.consoleOutput.capture = () => {
      co.out = (co.out ?? "") + options.console?.stdout;
      co.err = (co.err ?? "") + options.console?.stderr;
    };
    options.context.console = options.console.console;
  }

  options.context.global = options.context;
  options.context.globalThis = options.context;
}

/**
 * Revert normalizeOptions.
 *
 * @param {FromMemOptions & NormalizedOptions} options
 */
function denormalizeContext(options) {
  options.context = options.originalContext;
  delete options.originalContext;
  delete options.console;
  delete options.consoleOutput?.capture;
}

module.exports = {
  normalizeContext,
  denormalizeContext,
  globalContext,
};
