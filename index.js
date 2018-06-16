const { ReadableStream } = require('./lib/readable-stream.js');
const { WritableStream } = require('./lib/writable-stream.js');
const { TransformStream } = require('./lib/transform-stream.js');
const ByteLengthQueuingStrategy = require('./lib/byte-length-queuing-strategy.js');
const CountQueuingStrategy = require('./lib/count-queuing-strategy.js');

class UnderlyingNodeSource {
  constructor(nodeStream) {
    this.nodeStream = nodeStream;
    this.destroyed = false;
  }

  start (controller) {
    this.nodeStream.pause();

    const onData = this._onData.bind(this, controller);
    const onDestroy = this._onDestroy.bind(this, controller);

    this.listeners = [
      ['data', onData],
      ['end', onData],
      ['end', onDestroy],
      ['close', onDestroy],
      ['error', onDestroy],
    ];

    this._addListeners();
  }

  pull () {
    if (this.destroyed) return;
    this.nodeStream.resume();
  }

  cancel () {
    this.destroyed = true;

    this._removeListeners();

    this.nodeStream.push(null); // TODO: what is this?
    this.nodeStream.pause();
    if (this.nodeStream.destroy) this.nodeStream.destroy();
    else if (this.nodeStream.close) this.nodeStream.close();
  }

  _addListeners() {
    for (const [name, listener] of this.listeners) {
      this.nodeStream.on(name, listener);
    }
  }

  _removeListeners() {
    for (const [name, listener] of this.listeners) {
      this.nodeStream.removeListener(name, listener);
    }
  }

  _onData(controller, chunk) {
    if (this.destroyed) return;
    if (chunk !== undefined) controller.enqueue(chunk); // FIXME
    this.nodeStream.pause();
  }

  _onDestroy(controller, err) {
    if (this.destroyed) return;
    this.destroyed = true;

    this._removeListeners();

    if (err) controller.error(err);
    else controller.close();
  }
}

class UnderlyingNodeSink {
  constructor(nodeStream) {
    this.nodeStream = nodeStream;
  }

  start(/*controller*/) {
    // TODO: anything to do here?
  }

  write(chunk) {
    return new Promise((res, rej) => this.nodeStream.write(chunk, x => {
      if (x == null) res();
      else rej(x);
    }));
  }

  close() {
    return new Promise((res, rej) => this.nodeStream.end(x => {
      if (x == null) res();
      else rej(x);
    }));
  }

  abort(reason) {
    // TODO: is ths right?
    // TODO: return promise?
    this.nodeStream.destroy(reason);
  }
}

function readableStreamFromNode(nodeStream) {
  return new ReadableStream(new UnderlyingNodeSource(nodeStream));
}

function writableStreamFromNode(nodeStream) {
  return new WritableStream(new UnderlyingNodeSink(nodeStream));
}

module.exports = {
  ReadableStream,
  WritableStream,
  TransformStream,
  ByteLengthQueuingStrategy,
  CountQueuingStrategy,
  readableStreamFromNode,
  writableStreamFromNode,
};
