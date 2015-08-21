const tapeTest = require('tape-catch');

export default (label, factory, chunks) => {
  function test(description, testFn) {
    tapeTest(`${label}: ${description}`, testFn);
  }

  test('third read(), without waiting, should give { value: undefined, done: true }', t => {
    t.plan(3);

    const { reader } = factory();

    reader.read().then(r => t.deepEqual(r, { value: chunks[0], done: false }, 'first result should be correct'));
    reader.read().then(r => t.deepEqual(r, { value: chunks[1], done: false }, 'second result should be correct'));
    reader.read().then(r => t.deepEqual(r, { value: undefined, done: true }, 'third result should be correct'));
  });

  test('third read, with waiting, should give { value: undefined, done: true }', t => {
    t.plan(3);

    const { reader } = factory();

    reader.read().then(r => {
      t.deepEqual(r, { value: chunks[0], done: false }, 'first result should be correct');

      return reader.read().then(r => {
        t.deepEqual(r, { value: chunks[1], done: false }, 'second result should be correct');

        return reader.read().then(r => {
          t.deepEqual(r, { value: undefined, done: true }, 'third result should be correct');
        });
      });
    })
    .catch(e => t.error(e));
  });

  test('draining the stream via read() should cause the reader closed promise to fulfill, but locked stays true', t => {
    t.plan(3);

    const { stream, reader } = factory();

    t.equal(stream.locked, true, 'stream should start locked');

    reader.closed.then(
      v => {
        t.equal(v, undefined, 'reader closed should fulfill with undefined');
        t.equal(stream.locked, true, 'stream should remain locked');
      },
      () => t.fail('reader closed should not reject')
    );

    reader.read();
    reader.read();
  });

  test('releasing the lock after the stream is closed should cause locked to become false', t => {
    t.plan(3);
    const { stream, reader } = factory();

    reader.closed.then(() => {
      t.equal(stream.locked, true, 'the stream should start locked');
      t.doesNotThrow(() => reader.releaseLock(), 'releasing the lock after reader closed should not throw');
      t.equal(stream.locked, false, 'the stream should end unlocked');
    });

    reader.read();
    reader.read();
  });

  test('releasing the lock should cause further read() calls to reject with a TypeError', t => {
    t.plan(3);
    const { reader } = factory();

    reader.releaseLock();

    reader.read().catch(e => t.equal(e.constructor, TypeError, 'first read() should reject with a TypeError'));
    reader.read().catch(e => t.equal(e.constructor, TypeError, 'second read() should reject with a TypeError'));
    reader.read().catch(e => t.equal(e.constructor, TypeError, 'third read() should reject with a TypeError'));
  });

  test('reader\'s closed property always returns the same promise', t => {
    t.plan(4);
    const { stream, reader } = factory();

    const readerClosed = reader.closed;

    t.equal(reader.closed, readerClosed, 'accessing reader.closed twice in succession gives the same value');

    reader.read().then(() => {
      t.equal(reader.closed, readerClosed, 'reader.closed is the same after read() fulfills');

      reader.releaseLock();

      t.equal(reader.closed, readerClosed, 'reader.closed is the same after releasing the lock');

      const newReader = stream.getReader();
      newReader.read();

      t.equal(reader.closed, readerClosed, 'reader.closed is the same after calling read()');
    });
  });
};
