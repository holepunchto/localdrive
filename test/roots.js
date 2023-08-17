const test = require('brittle')
const path = require('path')
const fs = require('fs')
const Localdrive = require('../index.js')
const { createTmpDir, createDrive, generateTestFiles, isWin } = require('./helpers/index.js')

test('map prefix keys to different roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const tmp = new Localdrive(tmpdir)
  t.is(await tmp.entry('/examples/README.md'), null)

  const drive = createDrive(t, {
    roots: {
      '/examples': tmpdir
    }
  })

  const entry = await drive.entry('/examples/README.md')
  t.is(entry.key, '/examples/README.md')
  t.alike(entry.value, {
    executable: false,
    linkname: null,
    blob: { byteOffset: 0, blockOffset: 0, blockLength: 8, byteLength: 9 },
    metadata: null
  })
})

test('get with roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: { '/examples': tmpdir }
  })

  t.alike(await drive.get('/examples/README.md'), Buffer.from('# example'))
})

test('put with roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: { '/examples': tmpdir }
  })

  await drive.put('/examples/new-thing.txt', Buffer.from('hello'))

  // File is written in the virtual root
  t.ok(await stat(path.join(tmpdir, 'new-thing.txt')))

  t.alike(await drive.get('/examples/new-thing.txt'), Buffer.from('hello'))
})

test('symlink with roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: { '/examples': tmpdir }
  })

  await drive.symlink('/examples/README.shortcut', '/examples/README.md')

  const entry = await drive.entry('/examples/README.shortcut')
  t.alike(entry.key, '/examples/README.shortcut')
  t.alike(entry.value, {
    executable: false,
    linkname: '/README.md',
    blob: null,
    metadata: null
  })

  const followed = await drive.entry('/examples/README.shortcut', { follow: true })
  t.alike(followed.key, '/README.md')
  t.alike(followed.value, {
    executable: false,
    linkname: null,
    blob: { byteOffset: 0, blockOffset: 0, blockLength: 8, byteLength: 9 },
    metadata: null
  })

  t.absent(await drive.get('/examples/README.shortcut'))

  t.alike(await drive.get('/examples/README.shortcut', { follow: true }), Buffer.from('# example'))
})

test('list with roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: { '/examples': tmpdir }
  })

  const actual = []
  const expected = [
    '/examples/README.md', '/examples/script.sh', '/examples/LICENSE', '/examples/LICENSE-V2', '/examples/key.secret', '/examples/empty.txt',
    '/examples/examples/a.txt', '/examples/examples/b.txt',
    '/examples/examples/more/c.txt', '/examples/examples/more/d.txt',
    '/examples/solo/one.txt'
  ]
  if (!isWin) expected.push('/examples/LICENSE.shortcut')

  for await (const entry of drive.list('/examples')) {
    actual.push(entry.key)
  }

  t.alike(actual.sort(), expected.sort())
})

test('readdir with roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: { '/examples': tmpdir }
  })

  const actual = []
  const expected = ['README.md', 'script.sh', 'LICENSE', 'LICENSE-V2', 'key.secret', 'empty.txt', 'examples', 'solo']
  if (!isWin) expected.push('LICENSE.shortcut')

  for await (const name of drive.readdir('/examples')) {
    actual.push(name)
  }

  t.alike(actual.sort(), expected.sort())
})

test('del with roots', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: { '/examples': tmpdir }
  })

  t.ok(await drive.entry('/examples/README.md'))
  t.ok(await stat(path.join(tmpdir, 'README.md')))

  await drive.del('/examples/README.md')

  t.absent(await stat(path.join(tmpdir, 'README.md')))
  t.absent(await drive.entry('/examples/README.md'))
})

test('roots should normalize the prefixes', async function (t) {
  const tmpdir = createTmpDir(t)
  generateTestFiles(t, tmpdir)

  const drive = createDrive(t, {
    roots: {
      '/examples//': tmpdir
    }
  })

  t.ok(await drive.entry('/examples/README.md'))
})

async function stat (filename) {
  try {
    return await fs.promises.stat(filename)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
