const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('put(key, buffer) basic', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.fromPath('key'), null)
  t.is(await drive.entry(key), null)

  const buffer = Buffer.from('new thing')
  await drive.put(key, buffer)

  t.alike(await drive.get(key), buffer)
  t.alike(await drive.entry(key), {
    key: '/new-thing.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 9 },
      metadata: null
    }
  })
})
