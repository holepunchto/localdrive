const test = require('brittle')
const Filedrive = require('../index.js')
const { createDrive, createTmpDir } = require('./helpers/index.js')

test('new Filedrive()', async function (t) {
  const root = createTmpDir()
  const drive = new Filedrive(root)
  t.is(drive.root, root)
})

test('new Filedrive() ignore', async function (t) {
  const drive = createDrive(t, {
    ignore: new Set(['LICENSE', 'examples'])
  })

  const actualKeys = []
  const expectedKeys = ['/README.md', '/script.sh', '/key.secret', 'empty.txt', '/LICENSE.shortcut']

  for await (const { key } of drive.list('/')) {
    actualKeys.push(key)
  }

  t.alike(actualKeys.sort(), expectedKeys.sort())
})
