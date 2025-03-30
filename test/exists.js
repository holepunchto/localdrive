const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('exists(name) basic', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.exists('/doesnt-exists'), false)
  await drive.put('/doesnt-exists', Buffer.from('test'))
  t.alike(await drive.exists('/doesnt-exists'), true)
  await drive.del('/doesnt-exists')
  t.alike(await drive.exists('/doesnt-exists'), false)
})