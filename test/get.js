const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('get(key) basic', async function (t) {
  const drive = createDrive(t)

  t.alike((await drive.get('LICENSE')).toString(), 'MIT')
})

test('get(key) not found', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.get('not-exists.txt'), null)
  t.is(await drive.get('not/exists.txt'), null)
})

test('get(key) folder', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.get('examples'), null)
  t.is(await drive.get('examples/more'), null)
})
