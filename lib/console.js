"use strict";
const { Buffer } = require("node:buffer");
const { Console } = require("node:console");
const { Transform } = require("node:stream");

/** @typedef {import("node:stream").TransformCallback} TransformCallback */

class Recorder extends Transform {
  /**
   * @param {any} chunk
   * @param {NodeJS.BufferEncoding} _encoding
   * @param {TransformCallback} callback
   */
  // eslint-disable-next-line class-methods-use-this
  _transform(chunk, _encoding, callback) {
    callback(null, chunk);
  }

  /**
   * @returns {string}
   */
  readAll() {
    const bufs = [];
    let b;
    while ((b = this.read())) {
      bufs.push(b);
    }
    return Buffer.concat(bufs).toString();
  }
}

class ConsoleOutput {
  #stdout = new Recorder();
  #stderr = new Recorder();
  #console;

  /**
   * @param {boolean | "auto" | undefined} [colorMode = "auto"]
   */
  constructor(colorMode = "auto") {
    this.#console = new Console({
      stdout: this.#stdout,
      stderr: this.#stderr,
      colorMode,
    });
  }

  /**
   * @returns {Console}
   */
  get console() {
    return this.#console;
  }

  /**
   * @returns {string}
   */
  get stdout() {
    return this.#stdout.readAll();
  }

  /**
   * @returns {string}
   */
  get stderr() {
    return this.#stderr.readAll();
  }
}

module.exports = ConsoleOutput;
