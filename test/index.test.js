"use strict";

const assert = require("node:assert");
const fromMem = require("../lib/index.js");
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

  const cjs3 = await fromMem("exports.foo = 4; 1", {
    filename: "test5.cjs",
    exec: "return IMPORTED.foo + arg",
    arg: 12,
  });
  assert.equal(cjs3, 16);

  const consoleOutput = {};
  await assert.rejects(fromMem("console.log(1); throw Error('after console')", {
    filename: "test6.cjs",
    exec: "return IMPORTED",
    consoleOutput,
    colorMode: false,
  }), /after console/);
  assert.equal(consoleOutput.out, "1\n");

  const consoleOutput2 = {};
  await assert.rejects(fromMem("console.log(1)", {
    filename: "test7.cjs",
    exec: "console.log(2); throw Error('after console2')",
    consoleOutput: consoleOutput2,
    colorMode: false,
  }), /after console2/);
  assert.equal(consoleOutput2.out, "1\n2\n");

  await fromMem("console.log('expected output')", {
    filename: "test8.cjs",
    exec: "1;",
    includeGlobals: false,
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
      exec: "return IMPORTED.default",
    });
    assert.equal(mjs, 4);

    const mjs2 = await fromMem("export default 4", {
      filename: join(__dirname, "fixtures", "mjs", "test_guess4.js"),
      format: "guess",
      exec: "return IMPORTED.default",
    });
    assert.equal(mjs2, 4);

    // Hit the cache
    const mjs3 = await fromMem("export default 4", {
      filename: join(__dirname, "fixtures", "mjs", "test_guess4.js"),
      format: "guess",
      exec: "return IMPORTED.default",
    });
    assert.equal(mjs3, 4);
  }

  await assert.rejects(() => fromMem("export default 4", {
    filename: join(__dirname, "fixtures", "bad", "test_guess5.js"),
    format: "guess",
    exec: "return IMPORTED",
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
    exec: "return IMPORTED.default + arg",
    arg: 2,
  });
  assert.equal(mjs4, 7);

  const mjs5 = await fromMem(`
import {foo} from './fixtures/example.mjs';
export default foo();`, {
    filename: join(__dirname, "test5.js"),
    format: "es",
    exec: "return IMPORTED.default",
  });
  assert.equal(mjs5, 6);

  const mjs6 = await fromMem(`
export default import.meta.url`, {
    filename: join(__dirname, "test6.js"),
    format: "es",
    exec: "return IMPORTED.default",
  });
  assert.match(mjs6, /test6\.js$/);

  const mjs7 = await fromMem(`
const {foo} = await import('./fixtures/example.mjs');
export default foo();`, {
    filename: join(__dirname, "test7.js"),
    format: "es",
    exec: "return IMPORTED.default",
  });
  assert.equal(mjs7, 6);

  const mjs8 = await fromMem(`
export default 8`, {
    filename: pathToFileURL(join(__dirname, "test8.js")).toString(),
    format: "es",
    exec: "return IMPORTED.default",
  });
  assert.equal(mjs8, 8);

  await assert.rejects(() => fromMem("throw new Error('foo')", {
    filename: join(__dirname, "test9.js"),
    format: "mjs",
    lineOffset: 13,
    columnOffset: 43,
    exec: "return IMPORTED.default",
  }), (/** @type {Error} */ err) => {
    assert.match(err.stack, /test9\.js:14:50/);
    return true;
  });

  if (process.execArgv.includes("--experimental-vm-modules")) {
    const mjs9 = await fromMem(`
export default 9`, {
      filename: pathToFileURL(join(__dirname, "test9.js")).toString(),
      format: "es",
    });
    assert.equal(mjs9.default, 9);
  }

  const consoleOutput = {};
  await fromMem("console.log(1)", {
    filename: join(__dirname, "test10.mjs"),
    exec: "console.log(2)",
    consoleOutput,
    colorMode: false,
  });
  assert.equal(consoleOutput.out, "1\n2\n");

  const consoleOutput2 = {};
  await assert.rejects(() => fromMem("console.error(1); throw new Error('after console');", {
    filename: join(__dirname, "test11.mjs"),
    exec: "console.error(2)",
    consoleOutput: consoleOutput2,
    colorMode: false,
  }), /after console/);
  assert.equal(consoleOutput2.err, "1\n");

  const consoleOutput3 = {};
  await assert.rejects(() => fromMem("console.log(1)", {
    filename: join(__dirname, "test12.mjs"),
    exec: "console.log(2); throw new Error('after console2');",
    consoleOutput: consoleOutput3,
    colorMode: false,
  }), /after console2/);
  assert.equal(consoleOutput3.out, "1\n2\n");
});

test("version", async() => {
  const ver = process.version;
  Object.defineProperty(process, "version", {
    value: "v18.0.0",
  });
  await assert.rejects(() => fromMem("43", {
    filename: join(__dirname, "test10.js"),
    format: "es6",
    exec: "return IMPORTED.default",
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
  }), /Start node with `node --experimental-vm-modules` in order to import ES6 modules/);

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
