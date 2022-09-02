const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('put(key, buffer) basic', async function (t) {
  const drive = createDrive(t)

  const key = '/new-thing.txt'

  t.is(await drive.get(key), null)
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

test('put(key, buffer) replace', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.get('/LICENSE'), Buffer.from('MIT'))
  await drive.put('/LICENSE', Buffer.from('ISC'))
  t.alike(await drive.get('/LICENSE'), Buffer.from('ISC'))
})

test('put(key, buffer) folder', async function (t) {
  const drive = createDrive(t)

  try {
    await drive.put('/examples', Buffer.from('text'))
    t.fail('should have given error')
  } catch (error) {
    t.is(error.code, 'EISDIR')
  }
})

test('put(key, buffer) automatic folders creation', async function (t) {
  const drive = createDrive(t)

  const key = '/new/folder/files/name.txt'
  const buffer = Buffer.from('text')

  await drive.put(key, buffer)
  t.alike(await drive.get(key), buffer)
})

test('put(key, buffer) empty file', async function (t) {
  const drive = createDrive(t)

  await drive.put('/new-empty.txt', Buffer.from(''))
  t.alike(await drive.get('/new-empty.txt'), Buffer.from(''))
})

test('put(key, buffer) resolve key path', async function (t) {
  const drive = createDrive(t)

  const putAndEntry = async (key, expectedKey) => {
    t.absent(await drive.entry(expectedKey))
    await drive.put(key, Buffer.from(''))
    t.ok(await drive.entry(expectedKey))
  }

  await putAndEntry('b.txt', '/b.txt')
  await putAndEntry('/examples/more/../f.txt', '/examples/f.txt')
  await putAndEntry('\\examples\\more\\h.txt', '/examples/more/h.txt')
})
