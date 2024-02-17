"use strict";

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "**/*.d.ts",
    ],
  },
  require("@peggyjs/eslint-config/flat/js"),
  require("@peggyjs/eslint-config/flat/mjs"),
  require("@peggyjs/eslint-config/flat/modern"),
];
