const { createTmpDir } = require('./helpers/index.js')
const fs = require('fs')
const path = require('path')
const Localdrive = require('..')
const test = require('brittle')

test('recursive symlink', async function (t) {
  const tmpdir = createTmpDir(t)
  fs.symlinkSync(tmpdir, path.join(tmpdir, 'symlink'), 'junction')
  fs.writeFileSync(path.join(tmpdir, 'file.txt'), 'file-content')
  const drive = new Localdrive(tmpdir)
  let entries = 0
  for await (const entry of drive.list()) {  // eslint-disable-line
    entries++
  }
  t.is(entries, 2)
})
