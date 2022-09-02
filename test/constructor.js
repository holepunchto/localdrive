const test = require('brittle')
const Filedrive = require('../index.js')
const { createTmpDir } = require('./helpers/index.js')

test('new Filedrive()', async function (t) {
  const root = createTmpDir(t)
  const drive = new Filedrive(root)
  t.is(drive.root, root)
})
