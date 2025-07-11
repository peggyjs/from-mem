"use strict";

const vm = require("node:vm");

/**
 * Is importing from an ES6 module supported in the current environment?
 *
 * @returns {boolean}
 */
function isImportSupported() {
  return Boolean(vm.SourceTextModule);
}

module.exports = isImportSupported;
