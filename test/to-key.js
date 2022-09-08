const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const path = require('path')

test('toKey(filename) basic', async function (t) {
  const drive = createDrive(t)

  t.is(drive.toKey(path.join(drive.root, 'README.md')), '/README.md')
})

test('toKey(filename) resolve', async function (t) {
  const drive = createDrive(t)

  t.is(drive.toKey('README.md'), '/README.md')
  t.is(drive.toKey('./README.md'), '/README.md')
  t.is(drive.toKey('/examples/more/../a.txt'), '/examples/a.txt')
  t.is(drive.toKey('\\examples\\more\\c.txt'), '/examples/more/c.txt')
})
