const test = require('brittle')
const Localdrive = require('../index.js')
const { createTmpDir } = require('./helpers/index.js')

test('new Localdrive()', async function (t) {
  const root = createTmpDir(t)
  const drive = new Localdrive(root)
  t.is(drive.root, root)
  t.is(drive.supportsMetadata, false)
})

test('supportsMetadata', async function (t) {
  const root = createTmpDir(t)
  const drive = new Localdrive(root, { supportsMetadata: true })
  t.is(drive.supportsMetadata, true)
})
