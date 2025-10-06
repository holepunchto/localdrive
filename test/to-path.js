const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const path = require('path')

test('toPath(key) basic', async function (t) {
  const drive = createDrive(t)

  t.is(drive.toPath('/README.md'), path.join(drive.root, 'README.md'))
})

test('toPath(key) resolve', async function (t) {
  const drive = createDrive(t)

  t.is(drive.toPath('README.md'), path.join(drive.root, 'README.md'))
  t.is(drive.toPath('./README.md'), path.join(drive.root, 'README.md'))
  t.is(drive.toPath('/examples/more/../a.txt'), path.join(drive.root, 'examples', 'a.txt'))
  t.is(drive.toPath('\\examples\\more\\c.txt'), path.join(drive.root, 'examples', 'more', 'c.txt'))
})
