const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const path = require('path')

test('entry(key) basic', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('README.md'), {
    executable: false,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 9 },
    metadata: null
  })
})

test('entry(key) not found', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.entry('not-exists.txt'), null)
  t.is(await drive.entry('not/exists.txt'), null)
})

test('entry(key) executable', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('script.sh'), {
    executable: true,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
    metadata: null
  })
})

test('entry(key) symbolic link', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('LICENSE.shortcut'), {
    executable: true,
    linkname: path.join(drive.root, 'LICENSE'),
    blob: null,
    metadata: null
  })
})

test('entry(key) folder', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.entry('examples'), null)
  t.is(await drive.entry('examples/more'), null)
})

test('entry(key) file inside a folder', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('examples/a.txt'), {
    executable: false,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 3 },
    metadata: null
  })
})
