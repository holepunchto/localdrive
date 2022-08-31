const test = require('brittle')
const { createDrive, streamToString } = require('./helpers/index.js')

test('createReadStream(key)', async function (t) {
  const drive = createDrive(t)

  const readStream = drive.createReadStream('/LICENSE')
  t.is(await streamToString(readStream), 'MIT')
})

test('createReadStream(key) with options', async function (t) {
  const drive = createDrive(t)

  const stream1 = drive.createReadStream('/LICENSE', { start: 0, end: 0 })
  t.is(await streamToString(stream1), 'M')

  const stream2 = drive.createReadStream('/LICENSE', { start: 1, end: 1 })
  t.is(await streamToString(stream2), 'I')

  const stream3 = drive.createReadStream('/LICENSE', { start: 1 })
  t.is(await streamToString(stream3), 'IT')

  const stream4 = drive.createReadStream('/LICENSE', { end: 1 })
  t.is(await streamToString(stream4), 'MI')

  const stream5 = drive.createReadStream('/LICENSE', { length: 1 })
  t.is(await streamToString(stream5), 'M')

  const stream6 = drive.createReadStream('/LICENSE', { length: 2 })
  t.is(await streamToString(stream6), 'MI')

  const stream7 = drive.createReadStream('/LICENSE', { start: 1, length: 2 })
  t.is(await streamToString(stream7), 'IT')
})
