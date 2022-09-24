const test = require('brittle')
const Localdrive = require('../index.js')
const { createDrive, createTmpDir } = require('./helpers/index.js')

test('new Localdrive()', function (t) {
  const root = createTmpDir(t)
  const drive = new Localdrive(root)
  t.is(drive.root, root)
  t.is(drive.supportsMetadata, false)
})

test('supportsMetadata', function (t) {
  const root = createTmpDir(t)
  const drive = new Localdrive(root, { metadata: { get (k) {}, put (k, v) {}, del (k) {} } })
  t.is(drive.supportsMetadata, true)
})

test('ready()', async function (t) {
  const drive = createDrive(t)

  const promise = drive.ready()
  t.ok(promise.then)
  t.ok(promise.catch)
  t.ok(promise.finally)
  await promise
})

test('close()', async function (t) {
  const drive = createDrive(t)

  const promise = drive.close()
  t.ok(promise.then)
  t.ok(promise.catch)
  t.ok(promise.finally)
  await promise
})

test('flush()', async function (t) {
  const drive = createDrive(t)

  const promise = drive.flush()
  t.ok(promise.then)
  t.ok(promise.catch)
  t.ok(promise.finally)
  await promise
})

test('batch()', function (t) {
  const drive = createDrive(t)

  const batch = drive.batch()
  t.ok(batch.flush)
  t.ok(batch.close)
})
