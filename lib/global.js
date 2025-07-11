"use strict";

const vm = require("node:vm");

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

module.exports = globalContext;
