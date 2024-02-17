"use strict";

const assert = require("node:assert");
const fromMem = require("../index.js");
const { join } = require("node:path");
const test = require("node:test");

test("options", async() => {
  assert.equal(typeof fromMem, "function");
  await assert.rejects(() => fromMem(""), /filename is required/);
  await assert.rejects(() => fromMem("", {
    filename: "foo",
    format: "fake",
  }), /Unsupported output format/);
});

test("commonjs", async() => {
  const cjs = await fromMem("module.exports = 4", {
    filename: "test1.js",
  });
  assert.equal(cjs, 4);
  await assert.rejects(() => fromMem("throw new Error('foo')", {
    filename: join(__dirname, "test2.js"),
    format: "bare",
  }), (/** @type {Error} */ err) => {
    assert(/test2\.js/.test(err.stack), err.stack);
    return true;
  });
});

test("esm", async() => {
  const mjs4 = await fromMem("export default 5", {
    filename: join(__dirname, "test4.js"),
    format: "es",
  });
  assert.equal(mjs4.default, 5);

  const mjs5 = await fromMem(`
import {foo} from './fixtures/example.mjs';
export default foo();`, {
    filename: join(__dirname, "test5.js"),
    format: "es",
  });
  assert.equal(mjs5.default, 6);

  const mjs6 = await fromMem(`
export default import.meta.url`, {
    filename: join(__dirname, "test6.js"),
    format: "es",
  });
  assert.match(mjs6.default, /test6\.js$/);

  const mjs7 = await fromMem(`
const {foo} = await import('./fixtures/example.mjs');
export default foo();`, {
    filename: join(__dirname, "test7.js"),
    format: "es",
  });
  assert.equal(mjs7.default, 6);
});
