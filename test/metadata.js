const test = require('brittle')
const { createDrive, bufferToStream } = require('./helpers/index.js')

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

  const ws = drive.createWriteStream('/ANOTHER-LICENSE', { metadata: [1, 2, 3] })
  await bufferToStream(Buffer.from('ISC'), ws)
  t.alike((await drive.entry('/ANOTHER-LICENSE')).value.metadata, [1, 2, 3])
})
