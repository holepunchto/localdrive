const fsp = require('fs/promises')
const test = require('brittle')
const { createDrive, isWin } = require('./helpers/index.js')
const { createTmpDir } = require('./helpers/index.js')
const path = require('path')
const Localdrive = require('..')

test('list(folder) keys', async function (t) {
  const drive = createDrive(t)

  const actualKeys = []
  const expectedKeys = [
    '/README.md', '/script.sh', '/LICENSE', '/LICENSE-V2', '/key.secret', '/empty.txt',
    '/examples/a.txt', '/examples/b.txt',
    '/examples/more/c.txt', '/examples/more/d.txt',
    '/solo/one.txt'
  ]

  if (!isWin) {
    expectedKeys.push('/external.shortcut')
    expectedKeys.push('/LICENSE.shortcut')
  }

  for await (const { key } of drive.list('/')) {
    actualKeys.push(key)
  }

  t.alike(actualKeys.sort(), expectedKeys.sort())
})

test('list(folder) entries', async function (t) {
  const drive = createDrive(t)

  for await (const { key, value } of drive.list('/')) {
    t.is(typeof value.executable, 'boolean')
    t.ok(value.linkname === null || typeof value.linkname === 'string')
    t.ok(value.blob === null || typeof value.blob === 'object')
    t.ok(value.metadata === null || typeof value.metadata === 'object')

    if (value.linkname) {
      t.ok(key.endsWith('.shortcut'))
    }

    if (value.blob) {
      t.is(typeof value.blob.byteOffset, 'number')
      t.is(typeof value.blob.blockOffset, 'number')
      t.is(typeof value.blob.blockLength, 'number')
      t.is(typeof value.blob.byteLength, 'number')
    }
  }
})

test('list(folder) root does not exists', async function (t) {
  const drive = createDrive(t)

  await fsp.rm(drive.root, { recursive: true })

  for await (const { key } of drive.list()) {
    t.fail('should not have given entry: ' + key)
  }
})

test('ignore recursive symlink', async function (t) {
  const tmpdir = createTmpDir(t)
  await fsp.symlink(tmpdir, path.join(tmpdir, 'symlink'), 'junction')
  await fsp.writeFile(path.join(tmpdir, 'file.txt'), 'file-content')
  const drive = new Localdrive(tmpdir)
  let entries = 0
  for await (const entry of drive.list({ ignore: 'symlink' })) {  // eslint-disable-line
    entries++
  }
  t.is(entries, 1)
})

test('ignore everything', async function (t) {
  const tmpdir = createTmpDir(t)
  await fsp.symlink(tmpdir, path.join(tmpdir, 'symlink'), 'junction')
  await fsp.writeFile(path.join(tmpdir, 'file.txt'), 'file-content')
  const drive = new Localdrive(tmpdir)
  let entries = 0
  for await (const entry of drive.list({ ignore: ['symlink', 'file.txt'] })) {  // eslint-disable-line
    entries++
  }
  t.is(entries, 0)
})

test('ignore only symlinks', async function (t) {
  const tmpdir = createTmpDir(t)
  await fsp.symlink(tmpdir, path.join(tmpdir, 'symlink-a'), 'junction')
  await fsp.symlink(tmpdir, path.join(tmpdir, 'symlink-b'), 'junction')
  await fsp.writeFile(path.join(tmpdir, 'file.txt'), 'file-content')
  const drive = new Localdrive(tmpdir)
  let entries = 0
  for await (const entry of drive.list({ ignore: ['symlink-a', 'symlink-b'] })) {  // eslint-disable-line
    entries++
  }
  t.is(entries, 1)
})

test('ignore files in folder', async function (t) {
  const tmpdir = createTmpDir(t)
  await fsp.mkdir(path.join(tmpdir, 'folder'))
  await fsp.writeFile(path.join(tmpdir, 'folder', 'file_a.txt'), 'file-content')
  await fsp.writeFile(path.join(tmpdir, 'folder', 'file_b.txt'), 'file-content')
  const drive = new Localdrive(tmpdir)
  let entries = 0
  for await (const entry of drive.list({ ignore: ['folder'] })) {  // eslint-disable-line
    entries++
  }
  t.is(entries, 0)
})

test('ignore one file in folder', async function (t) {
  const tmpdir = createTmpDir(t)
  await fsp.mkdir(path.join(tmpdir, 'folder'))
  await fsp.mkdir(path.join(tmpdir, 'folder', 'subfolder'))
  await fsp.writeFile(path.join(tmpdir, 'folder', 'file_a.txt'), 'file-content')
  await fsp.writeFile(path.join(tmpdir, 'folder', 'subfolder', 'file_b.txt'), 'file-content')
  const drive = new Localdrive(tmpdir)
  let entries = 0
  for await (const entry of drive.list({ ignore: ['folder/file_a.txt'] })) {  // eslint-disable-line
    entries++
  }
  t.is(entries, 1)
})
