const test = require('brittle')
const { createDrive, bufferToStream } = require('./helpers/index.js')

test('metadata.get() hook call', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  drive.metadata.get = () => t.pass()
  drive.metadata.put = () => t.fail('metadata.put() was called')
  drive.metadata.del = () => t.fail('metadata.del() was called')

  await drive.entry('/LICENSE')
})

test('metadata.put() hook call', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  drive.metadata.get = () => t.fail('metadata.get() was called')
  drive.metadata.put = () => t.pass()
  drive.metadata.del = () => t.fail('metadata.del() was called')

  await drive.put('/A-NEW-LICENSE', Buffer.from('ISC'), { metadata: 1337 })
})

test('metadata.del() hook call', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  drive.metadata.get = () => t.fail('metadata.get() was called')
  drive.metadata.put = () => t.fail('metadata.put() was called')
  drive.metadata.del = () => t.pass()

  await drive.del('/LICENSE')
})

test('metadata.del() hook call', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  drive.metadata.get = () => t.fail('metadata.get() was called')
  drive.metadata.put = () => t.fail('metadata.put() was called')
  drive.metadata.del = () => t.pass()

  await drive.put('/LICENSE', Buffer.from('ISC'))
})

test('metadata basic', async function (t) {
  const drive = createDrive(t)

  drive.metadata.get = function (key) {
    if (key === '/LICENSE') return 'custom'
    return null
  }

  t.is((await drive.entry('/README.md')).value.metadata, null)
  t.is((await drive.entry('/LICENSE')).value.metadata, 'custom')
})

test('metadata backed by map', async function (t) {
  const drive = createDrive(t)

  const meta = new Map()
  drive.metadata.get = (key) => meta.has(key) ? meta.get(key) : null
  drive.metadata.put = (key, value) => meta.set(key, value)
  drive.metadata.del = (key) => meta.delete(key)

  t.is((await drive.entry('/LICENSE')).value.metadata, null)

  await drive.put('/LICENSE', Buffer.from('MIT'), { metadata: 'Typical license' })

  t.is((await drive.entry('/LICENSE')).value.metadata, 'Typical license')

  t.ok(meta.has('/LICENSE'))
  await drive.del('/LICENSE')
  t.absent(meta.has('/LICENSE'))

  const ws = drive.createWriteStream('/A-NEW-LICENSE', { metadata: [1, 2, 3] })
  await bufferToStream(Buffer.from('ISC'), ws)
  t.alike((await drive.entry('/A-NEW-LICENSE')).value.metadata, [1, 2, 3])
})

test('metadata automatic map', async function (t) {
  const meta = new Map()
  const drive = createDrive(t, { metadata: meta })

  t.is((await drive.entry('/LICENSE')).value.metadata, null)

  await drive.put('/LICENSE', Buffer.from('MIT'), { metadata: 'Typical license' })

  t.is((await drive.entry('/LICENSE')).value.metadata, 'Typical license')

  t.ok(meta.has('/LICENSE'))
  await drive.del('/LICENSE')
  t.absent(meta.has('/LICENSE'))

  const ws = drive.createWriteStream('/A-NEW-LICENSE', { metadata: [1, 2, 3] })
  await bufferToStream(Buffer.from('ISC'), ws)
  t.alike((await drive.entry('/A-NEW-LICENSE')).value.metadata, [1, 2, 3])
})

test('metadata hooks defined in constructor', async function (t) {
  const drive = createDrive(t, {
    metadata: { get, put, del }
  })

  function get () {}
  function put () {}
  function del () {}

  t.is(drive.metadata.get, get)
  t.is(drive.metadata.put, put)
  t.is(drive.metadata.del, del)
})
