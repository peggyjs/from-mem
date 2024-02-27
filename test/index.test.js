"use strict";

const assert = require("node:assert");
const fromMem = require("../index.js");
const { join, parse } = require("node:path");
const { pathToFileURL } = require("node:url");
const semver = require("semver");
const test = require("node:test");
const vm = require("node:vm");

const is20 = semver.satisfies(process.version, ">=20.8");

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
    assert.match(err.stack, /test3\.js/);
    return true;
  });

  await assert.rejects(() => fromMem("throw new Error('foo')", {
    filename: join(__dirname, "test4.js"),
    format: "cjs",
    lineOffset: 13,
    columnOffset: 43,
  }), (/** @type {Error} */ err) => {
    assert.match(err.stack, /test4\.js:14:50/);
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

  if (is20) {
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

    // Hit the cache
    const mjs3 = await fromMem("export default 4", {
      filename: join(__dirname, "fixtures", "mjs", "test_guess4.js"),
      format: "guess",
    });
    assert.equal(mjs3.default, 4);
  }

  await assert.rejects(() => fromMem("export default 4", {
    filename: join(__dirname, "fixtures", "bad", "test_guess5.js"),
    format: "guess",
  }));

  fromMem.guessModuleType.clearCache();
});

test("esm", async t => {
  if (!is20) {
    t.skip(`Skipping esm tests on ${process.version}`);
    return;
  }
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

  await assert.rejects(() => fromMem("throw new Error('foo')", {
    filename: join(__dirname, "test9.js"),
    format: "mjs",
    lineOffset: 13,
    columnOffset: 43,
  }), (/** @type {Error} */ err) => {
    assert.match(err.stack, /test9\.js:14:50/);
    return true;
  });
});

test("version", async() => {
  const ver = process.version;
  Object.defineProperty(process, "version", {
    value: "v18.0.0",
  });
  await assert.rejects(() => fromMem("43", {
    filename: join(__dirname, "test10.js"),
    format: "es6",
  }), /Requires node.js 20.8\+ or 21\./);

  // Reset
  Object.defineProperty(process, "version", {
    value: ver,
  });
});

test("no SourceTextModule", async() => {
  const stm = vm.SourceTextModule;
  delete vm.SourceTextModule;

  await assert.rejects(() => fromMem("44", {
    filename: join(__dirname, "test11.js"),
    format: "module",
  }), /Start node with --experimental-vm-modules for this to work/);

  // Reset
  vm.SourceTextModule = stm;
});

test("process.env", async() => {
  // No process gives the right error
  await assert.rejects(() => fromMem("module.exports = process", {
    filename: join(__dirname, "test11.js"),
    format: "cjs",
    includeGlobals: false,
  }), /process is not defined/);

  // Pick up current value
  process.env.___TEST1___ = "12";
  assert.equal((await fromMem("module.exports = process.env.___TEST1___", {
    filename: join(__dirname, "test12.js"),
    format: "cjs",
  })), "12");
  delete process.env.___TEST1___;

  // Anti-pollution
  assert.equal((await fromMem(`
process.env.___TEST2___ = "13";
module.exports = process.env.___TEST2___`, {
    filename: join(__dirname, "test13.js"),
    format: "cjs",
  })), "13");
  assert.equal(typeof process.env.___TEST2___, "undefined");

  // Fake process
  assert.equal((await fromMem("module.exports = process.env.___TEST3___", {
    filename: join(__dirname, "test14.js"),
    format: "cjs",
    includeGlobals: false,
    env: {
      ___TEST3___: "14",
    },
  })), "14");
});
