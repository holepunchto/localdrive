const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('del(key) basic', async function (t) {
  const drive = createDrive(t)

  t.ok(await drive.entry('/LICENSE'))
  await drive.del('/LICENSE')
  t.absent(await drive.entry('/LICENSE'))
})

test('del(key) not found', async function (t) {
  const drive = createDrive(t)

  const key = '/this-does-not-exists.txt'
  t.absent(await drive.entry(key))
  await drive.del(key)
  t.absent(await drive.entry(key))
})

test('del(key) folder', async function (t) {
  const drive = createDrive(t)

  try {
    await drive.del('/examples')
    t.fail('should have given error')
  } catch (error) {
    t.is(error.code, 'EISDIR')
  }
})
