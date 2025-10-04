const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const fs = require('fs')
const path = require('path')

// Bare's readlink on Windows resolves relative symlinks to absolute paths
const isBare = typeof Bare !== 'undefined'
const isWin = path.sep === '\\'
const bareWin = isBare && isWin

test('symlink(key, linkname) basic', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/README.shortcut'))

  await drive.symlink('/README.shortcut', '/README.md')
  const entry = await drive.entry('/README.shortcut')

  t.alike(entry, {
    key: '/README.shortcut',
    value: {
      executable: false,
      linkname: '/README.md',
      blob: null,
      metadata: null
    },
    mtime: entry.mtime
  })
  t.is(typeof entry.mtime, 'number')
})

test('symlink(key, linkname) absolute inside a folder', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/examples/README.shortcut'))

  await drive.symlink('/examples/README.shortcut', '/examples/more/c.txt')
  const entry = await drive.entry('/examples/README.shortcut')

  t.is(entry.key, '/examples/README.shortcut')
  t.alike(entry.value, {
    executable: false,
    linkname: '/examples/more/c.txt',
    blob: null,
    metadata: null
  })
})

test('symlink(key, linkname) relative inside a folder', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/examples/README.shortcut'))

  await drive.symlink('/examples/README.shortcut', 'more/c.txt')
  const entry = await drive.entry('/examples/README.shortcut')

  t.is(entry.key, '/examples/README.shortcut')
  t.alike(entry.value, {
    executable: false,
    // Bare's readlink on Windows resolves relative symlinks to absolute paths
    linkname: bareWin ? '/examples/more/c.txt' : 'more/c.txt',
    blob: null,
    metadata: null
  })
})

test('symlink(key, linkname) replace', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.get('/LICENSE'), Buffer.from('MIT'))
  const entry = await drive.entry('/LICENSE')

  t.is(entry.key, '/LICENSE')
  t.alike(entry.value, {
    executable: false,
    linkname: null,
    blob: { byteOffset: 0, blockOffset: 0, blockLength: 8, byteLength: 3 },
    metadata: null
  })

  await drive.symlink('/LICENSE', '/LICENSE-V2')

  t.absent(await drive.get('/LICENSE'))
  const entry2 = await drive.entry('/LICENSE')

  t.is(entry2.key, '/LICENSE')
  t.alike(entry2.value, {
    executable: false,
    linkname: '/LICENSE-V2',
    blob: null,
    metadata: null
  })
})

test('symlink(key, linkname) not found', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/not-exists.txt'))

  await drive.symlink('/not-exists.shortcut', '/not-exists.txt')
  t.ok(await drive.entry('/not-exists.shortcut'))

  t.absent(await drive.entry('/not-exists.txt'))
})

test('symlink(key, linkname) folder', async function (t) {
  const drive = createDrive(t)

  await drive.symlink('/examples.shortcut', '/examples')
  t.ok(await drive.entry('/examples.shortcut'))
})

test('symlink(key, linkname) automatic folders creation', async function (t) {
  const drive = createDrive(t)

  const key = '/new/folder/files/name.txt'
  await drive.symlink(key, '/LICENSE')
  t.ok(await drive.entry(key))
})

test('symlink(key, linkname) resolve key path', async function (t) {
  const drive = createDrive(t)

  const symlinkAndEntry = async (key, linkname, expectedKey) => {
    t.absent(await drive.entry(expectedKey))
    await drive.symlink(key, linkname)
    t.ok(await drive.entry(expectedKey))
  }

  await symlinkAndEntry('b.txt.shortcut', '/b.txt', '/b.txt.shortcut')
  await symlinkAndEntry(
    '/examples/more/../f.txt.shortcut',
    '/examples/f.txt',
    '/examples/f.txt.shortcut'
  )
  await symlinkAndEntry(
    '\\examples\\more\\h.txt.shortcut',
    '/examples/more/h.txt',
    '/examples/more/h.txt.shortcut'
  )
})

test('symlink(key, linkname) mutex', async function (t) {
  const drive = createDrive(t)

  t.ok(fs.existsSync(path.join(drive.root, 'solo')))

  const symlink = drive.symlink('/solo/two.txt', '/LICENSE')
  const del = drive.del('/solo/one.txt')
  await Promise.all([symlink, del])

  t.ok(fs.existsSync(path.join(drive.root, 'solo')))
})

test('get symlinks', async function (t) {
  const drive = createDrive(t)

  t.ok(await drive.get('/examples/a.txt'))

  await drive.symlink('/examples/a.shortcut', '/examples/a.txt')

  const entry = await drive.entry('/examples/a.shortcut')
  t.alike(entry.key, '/examples/a.shortcut')
  t.alike(entry.value, {
    executable: false,
    linkname: '/examples/a.txt',
    blob: null,
    metadata: null
  })

  t.absent(await drive.get('/examples/a.shortcut'))

  t.alike(
    await drive.get('/examples/a.shortcut', { follow: true }),
    Buffer.from('1st')
  )
})
