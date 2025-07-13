"use strict";

/** @type {import('typedoc').TypeDocOptions} */
const config = {
  entryPoints: [
    "lib/index.js",
  ],
  out: "docs",
  cleanOutputDir: true,
  includeVersion: true,
  sidebarLinks: {
    Peggy: "https://peggyjs.org/",
    GitHub: "https://github.com/peggyjs/from-mem",
    Documentation: "http://peggyjs.github.io/from-mem/",
  },
  navigation: {
    includeCategories: false,
    includeGroups: false,
  },
  categorizeByGroup: false,
  sort: ["static-first", "alphabetical"],
};
module.exports = config;
