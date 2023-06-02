const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('compare(a, b) basic', async function (t) {
  const drive = createDrive(t)

  await drive.put('/file.txt', 'hi')
  const a = await drive.entry('/file.txt')

  await new Promise(resolve => setTimeout(resolve, 100))

  await drive.put('/file.txt', 'hi')
  const b = await drive.entry('/file.txt')

  t.ok(drive.compare(a, b) <= -10)
  t.is(drive.compare(a, a), 0)
  t.ok(drive.compare(b, a) >= 10)
})
