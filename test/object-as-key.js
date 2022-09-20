const test = require('brittle')
const { createDrive, streamToString } = require('./helpers/index.js')

test('entry(object)', async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/README.md')

  t.alike(await drive.entry(entry), entry)
})

test('get(object)', async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/README.md')
  const buffer = await drive.get('/README.md')

  t.alike(await drive.get(entry), buffer)
})

test('createReadStream(object)', async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/README.md')
  const buffer = await drive.get('/README.md')

  const rs = drive.createReadStream(entry)
  t.is(await streamToString(rs), buffer.toString())
})
