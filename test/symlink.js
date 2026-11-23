const test = require('brittle')
const { createDrive, createTmpDir } = require('./helpers/index.js')
const fs = require('fs')
const path = require('path')
const os = require('os')
const Localdrive = require('..')

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

test(
  'symlink(key, linkname) rejects a windows drive-absolute linkname',
  { skip: !isWin },
  async function (t) {
    const drive = createDrive(t)

    await t.exception(
      () => drive.symlink('/file.shortcut', 'C:\\Windows\\System32\\file.dll'),
      /escapes root/
    )
    t.absent(await drive.entry('/file.shortcut'))
  }
)

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

  t.alike(await drive.get('/examples/a.shortcut', { follow: true }), Buffer.from('1st'))
})

test('symlink(key, linkname) rejects a relative linkname that escapes root', async function (t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'localdrive-'))
  t.teardown(() => fs.rmSync(base, { recursive: true, force: true }))
  fs.mkdirSync(path.join(base, 'outside'))

  const drive = new Localdrive(path.join(base, 'root'))

  await t.exception(() => drive.symlink('/link', '../outside'), /escapes root/)
  t.absent(await drive.entry('/link'))

  // the symlink was never created, so this just writes a plain file inside root
  await drive.put('/link/file.txt', Buffer.from('hello'))
  t.ok(fs.existsSync(path.join(drive.root, 'link', 'file.txt')))
  t.absent(fs.existsSync(path.join(base, 'outside', 'file.txt')))
})

test('symlink(key, linkname) relative through relative link to root', async function (t) {
  const tmp = createTmpDir(t)
  const drive = new Localdrive(path.join(tmp, 'root'))
  fs.mkdirSync(path.join(tmp, 'outside'))

  await drive.symlink('/a', '.')
  await t.exception(async function () {
    await drive.symlink('/b', 'a/../outside')
    await drive.put('/b/c.txt', Buffer.from('c'))
  })
  t.alike(fs.readdirSync(path.join(tmp, 'outside')), [])
})

test('symlink(key, linkname) relative through absolute link to root', async function (t) {
  const tmp = createTmpDir(t)
  const drive = new Localdrive(path.join(tmp, 'root'))
  fs.mkdirSync(path.join(tmp, 'outside'))

  await drive.symlink('/a/b', '/')
  await t.exception(async function () {
    await drive.symlink('/c', 'a/b/../outside')
    await drive.put('/c/d.txt', Buffer.from('d'))
  })
  t.alike(fs.readdirSync(path.join(tmp, 'outside')), [])
})

test('symlink(key, linkname) through link outside root', async function (t) {
  const drive = createDrive(t)
  const outside = createTmpDir(t)

  fs.symlinkSync(outside, path.join(drive.root, 'linked'), 'junction')

  await t.exception(drive.symlink('/linked/LICENSE.shortcut', '/LICENSE'))
  t.alike(fs.readdirSync(outside), [])
})

test('put(key, buffer) through link outside root', async function (t) {
  const drive = createDrive(t)
  const outside = createTmpDir(t)

  fs.symlinkSync(outside, path.join(drive.root, 'linked'), 'junction')

  await t.exception(drive.put('/linked/a.txt', Buffer.from('a')))
  await t.exception(drive.put('/linked/b/c.txt', Buffer.from('c')))
  t.alike(fs.readdirSync(outside), [])
})

test('put(key, buffer) replace symlink', async function (t) {
  const drive = createDrive(t)

  await drive.symlink('/LICENSE.link', '/LICENSE')
  await drive.put('/LICENSE.link', Buffer.from('ISC'))

  t.is((await drive.entry('/LICENSE.link')).value.linkname, null)
  t.alike(await drive.get('/LICENSE'), Buffer.from('MIT'))
})

test('del(key) through link outside root', async function (t) {
  const drive = createDrive(t)
  const outside = createTmpDir(t)

  fs.writeFileSync(path.join(outside, 'a.txt'), 'a')
  fs.symlinkSync(outside, path.join(drive.root, 'linked'), 'junction')

  await t.exception(drive.del('/linked/a.txt'))
  t.ok(fs.existsSync(path.join(outside, 'a.txt')))
})

test('symlink(key, linkname) relative to parent folder', async function (t) {
  const drive = createDrive(t)

  await drive.symlink('/examples/LICENSE.shortcut', '../LICENSE')
  t.alike(fs.readFileSync(drive.toPath('/examples/LICENSE.shortcut')), Buffer.from('MIT'))
})

test('put(key, buffer) atomic with symlink at temp file', async function (t) {
  const drive = createDrive(t, { atomic: true })
  const outside = createTmpDir(t)

  fs.symlinkSync(path.join(outside, 'a.txt'), path.join(drive.root, 'a.txt.0.localdrive.tmp'))

  await drive.put('/a.txt', Buffer.from('a'))
  t.alike(await drive.get('/a.txt'), Buffer.from('a'))
  t.alike(fs.readdirSync(outside), [])
})

test('put(key, buffer) atomic with relative symlink at temp file', async function (t) {
  const tmp = createTmpDir(t)
  const drive = new Localdrive(path.join(tmp, 'root'), { atomic: true })
  fs.mkdirSync(path.join(tmp, 'outside'))

  await drive.symlink('/a.txt.0.localdrive.tmp', 'b/../outside/a.txt')
  await drive.symlink('/b', '.')
  await drive.put('/a.txt', Buffer.from('a'))

  t.alike(await drive.get('/a.txt'), Buffer.from('a'))
  t.alike(fs.readdirSync(path.join(tmp, 'outside')), [])
})

test('put, symlink and del with filesystem root', async function (t) {
  const tmp = path.resolve(createTmpDir(t))
  const root = tmp.split(path.sep)[0] + path.sep
  const drive = new Localdrive(root)
  const dir = '/' + path.relative(root, tmp).split(path.sep).join('/')

  await t.execution(drive.put(dir + '/a.txt', Buffer.from('a')))
  t.alike(await drive.get(dir + '/a.txt'), Buffer.from('a'))

  await t.execution(drive.symlink(dir + '/b.txt', dir + '/a.txt'))
  t.ok(await drive.entry(dir + '/b.txt'))

  await t.execution(drive.del(dir + '/b.txt'))
  t.absent(await drive.entry(dir + '/b.txt'))
})
