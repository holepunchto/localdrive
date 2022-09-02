const test = require('brittle')
const Localdrive = require('../index.js')
const { createTmpDir } = require('./helpers/index.js')

test('new Localdrive()', async function (t) {
  const root = createTmpDir(t)
  const drive = new Localdrive(root)
  t.is(drive.root, root)
})
