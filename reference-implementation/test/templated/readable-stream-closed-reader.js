const tapeTest = require('tape-catch');

export default (label, factory) => {
  function test(description, testFn) {
    tapeTest(`${label}: ${description}`, testFn);
  }

  test('read() should fulfill with { value: undefined, done: true }', t => {
    t.plan(1);
    const { reader } = factory();

    reader.read().then(
      v => t.deepEqual(v, { value: undefined, done: true }, 'read() should fulfill correctly'),
      () => t.fail('read() should not return a rejected promise')
    );
  });

  test('read() multiple times should fulfill with { value: undefined, done: true }', t => {
    t.plan(2);
    const { reader } = factory();

    reader.read().then(
      v => t.deepEqual(v, { value: undefined, done: true }, 'read() should fulfill correctly'),
      () => t.fail('read() should not return a rejected promise')
    );
    reader.read().then(
      v => t.deepEqual(v, { value: undefined, done: true }, 'read() should fulfill correctly'),
      () => t.fail('read() should not return a rejected promise')
    );
  });

  test('read() should work when used within another read() fulfill callback', t => {
    t.plan(1);
    const { reader } = factory();

    reader.read().then(() => reader.read().then(() => t.pass('read() should fulfill')));
  });

  test('closed should fulfill with undefined', t => {
    t.plan(1);
    const { reader } = factory();

    reader.closed.then(
      v => t.equal(v, undefined, 'reader closed should fulfill with undefined'),
      () => t.fail('reader closed should not reject')
    );
  });

  test('releasing the lock should cause closed to reject and change identity', t => {
    t.plan(3);
    const { reader } = factory();

    const closedBefore = reader.closed;
    reader.releaseLock();
    const closedAfter = reader.closed;

    t.notEqual(closedBefore, closedAfter, 'the closed promise should change identity')
    closedBefore.then(v => t.equal(v, undefined, 'reader.closed acquired before release should fulfill'));
    closedAfter.catch(
      e => t.equal(e.constructor, TypeError, 'reader.closed acquired after release should reject with a TypeError'));
  });

  test('cancel() should return a distinct fulfilled promise each time', t => {
    t.plan(5);
    const { reader } = factory();

    const cancelPromise1 = reader.cancel();
    const cancelPromise2 = reader.cancel();
    const closedReaderPromise = reader.closed;

    cancelPromise1.then(v => t.equal(v, undefined, 'first cancel() call should fulfill with undefined'));
    cancelPromise2.then(v => t.equal(v, undefined, 'second cancel() call should fulfill with undefined'));
    t.notEqual(cancelPromise1, cancelPromise2, 'cancel() calls should return distinct promises');
    t.notEqual(cancelPromise1, closedReaderPromise, 'cancel() promise 1 should be distinct from reader.closed');
    t.notEqual(cancelPromise2, closedReaderPromise, 'cancel() promise 2 should be distinct from reader.closed');
  });
};
