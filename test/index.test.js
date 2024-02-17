"use strict";

const assert = require("node:assert");
const fromMem = require("../index.js");
const { join, parse } = require("node:path");
const { pathToFileURL } = require("node:url");
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

  const cjs2 = await fromMem(`
const {foo} = require('./fixtures/example.cjs');
module.exports = foo() + 2`, {
    filename: join(__dirname, "test2.js"),
  });
  assert.equal(cjs2, 9);

  await assert.rejects(() => fromMem("throw new Error('foo')", {
    filename: join(__dirname, "test3.js"),
    format: "bare",
  }), (/** @type {Error} */ err) => {
    assert(/test3\.js/.test(err.stack), err.stack);
    return true;
  });
});

test("guess", async() => {
  const cjs = await fromMem("module.exports = 4", {
    filename: join(__dirname, "test_guess1.cjs"),
    format: "guess",
  });
  assert.equal(cjs, 4);

  const cjs2 = await fromMem("module.exports = 4", {
    filename: join(__dirname, "test_guess2.js"),
    format: "guess",
  });
  assert.equal(cjs2, 4);

  // Hope there is not package.json in your root directory.  If there is,
  // it better be commonjs. :)
  const cjs3 = await fromMem("module.exports = 4", {
    filename: join(parse(__dirname).root, "test_guess2.js"),
    format: "guess",
  });
  assert.equal(cjs3, 4);

  const mjs = await fromMem("export default 4", {
    filename: join(__dirname, "test_guess3.mjs"),
    format: "guess",
  });
  assert.equal(mjs.default, 4);

  const mjs2 = await fromMem("export default 4", {
    filename: join(__dirname, "fixtures", "mjs", "test_guess4.js"),
    format: "guess",
  });
  assert.equal(mjs2.default, 4);

  await assert.rejects(() => fromMem("export default 4", {
    filename: join(__dirname, "fixtures", "bad", "test_guess5.js"),
    format: "guess",
  }));
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

  const mjs8 = await fromMem(`
export default 8`, {
    filename: pathToFileURL(join(__dirname, "test8.js")).toString(),
    format: "es",
  });
  assert.equal(mjs8.default, 8);
});
