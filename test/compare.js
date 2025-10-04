const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('compare(a, b) basic', async function (t) {
  const drive = createDrive(t)

  await drive.put('/file.txt', 'hi')
  const a = await drive.entry('/file.txt')

  await new Promise((resolve) => setTimeout(resolve, 200))

  await drive.put('/file.txt', 'hi')
  const b = await drive.entry('/file.txt')

  t.is(drive.compare(a, b), -1)
  t.is(drive.compare(a, a), 0)
  t.is(drive.compare(b, b), 0)
  t.is(drive.compare(b, a), 1)
})
