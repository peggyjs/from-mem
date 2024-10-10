import commonjs from "@peggyjs/eslint-config/commonjs.js";
import modern from "@peggyjs/eslint-config/modern.js";

export default [
  {
    ignores: [
      "**/*.d.ts",
      "test/fixtures/bad/package.json",
    ],
  },
  ...commonjs,
  ...modern,
];
