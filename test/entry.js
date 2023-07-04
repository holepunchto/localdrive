const test = require('brittle')
const { createDrive, isWin } = require('./helpers/index.js')

test('entry(key) basic', async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/README.md')
  t.alike(entry, {
    key: '/README.md',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 9 },
      metadata: null
    },
    mtime: entry.mtime
  })
  t.is(typeof entry.mtime, 'number')
})

test('entry(key) not found', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.entry('/not-exists.txt'), null)
  t.is(await drive.entry('/not/exists.txt'), null)
})

test('entry(key) executable', { skip: isWin }, async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/script.sh')
  t.alike(entry, {
    key: '/script.sh',
    value: {
      executable: true,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
      metadata: null
    },
    mtime: entry.mtime
  })
})

test('entry(key) symbolic link', { skip: isWin }, async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/LICENSE.shortcut')
  t.alike(entry, {
    key: '/LICENSE.shortcut',
    value: {
      executable: false,
      linkname: 'LICENSE',
      blob: null,
      metadata: null
    },
    mtime: entry.mtime
  })
})

test('entry(key) follow links', { skip: isWin }, async function (t) {
  const drive = createDrive(t, {
    followLinks: true
  })

  const entry = await drive.entry('/LICENSE.shortcut')
  t.alike(entry, {
    key: '/LICENSE.shortcut',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 3 },
      metadata: null
    },
    mtime: entry.mtime
  })
})

test('entry(key) folder', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.entry('/examples'), null)
  t.is(await drive.entry('/examples/more'), null)
})

test('entry(key) file inside a folder', async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/examples/a.txt')
  t.alike(entry, {
    key: '/examples/a.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 3 },
      metadata: null
    },
    mtime: entry.mtime
  })
})

test('entry(key) permission denied', async function (t) {
  const drive = createDrive(t)

  const entry = await drive.entry('/key.secret')
  t.alike(entry, {
    key: '/key.secret',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 4 },
      metadata: null
    },
    mtime: entry.mtime
  })

  // + should we ignore permission errors and just return null?
  try {
    await drive.get('/key.secret')
    if (!isWin) t.fail('should have given error')
  } catch (error) {
    t.is(error.code, 'EACCES')
  }
})

test('entry(key) resolve key path', async function (t) {
  const drive = createDrive(t)

  t.alike((await drive.entry('README.md')).key, '/README.md')
  t.alike((await drive.entry('/examples/more/../a.txt')).key, '/examples/a.txt')
  t.alike((await drive.entry('\\examples\\more\\c.txt')).key, '/examples/more/c.txt')
})

test('basic follow entry', async function (t) {
  const drive = createDrive(t)

  await drive.put('/file.txt', 'hi')
  await drive.symlink('/file.shortcut', '/file.txt')

  t.is((await drive.entry('/file.shortcut')).value.linkname, '/file.txt')

  const entry = await drive.entry('/file.shortcut', { follow: true })
  t.is(entry.key, '/file.txt')
  t.alike(entry.value, {
    executable: false,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 2 },
    metadata: null
  })
})

test('multiple follow entry', async function (t) {
  const drive = createDrive(t)

  await drive.put('/file.txt', 'hi')
  await drive.symlink('/file.shortcut', '/file.txt')
  await drive.symlink('/file.shortcut.shortcut', '/file.shortcut')

  t.is((await drive.entry('/file.shortcut.shortcut')).value.linkname, '/file.shortcut')

  const entry = await drive.entry('/file.shortcut.shortcut', { follow: true })
  t.is(entry.key, '/file.txt')
  t.alike(entry.value, {
    executable: false,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 2 },
    metadata: null
  })
})

test('max follow entry', async function (t) {
  const drive = createDrive(t)

  await drive.put('/file.0.txt', 'hi')

  for (let i = 1; i <= 17; i++) {
    await drive.symlink('/file.' + i + '.txt', '/file.' + (i - 1) + '.txt')
  }

  t.is((await drive.entry('/file.0.txt')).value.linkname, null)
  t.is((await drive.entry('/file.1.txt')).value.linkname, '/file.0.txt')
  t.is((await drive.entry('/file.16.txt')).value.linkname, '/file.15.txt')

  try {
    await drive.entry('/file.16.txt', { follow: true })
    t.fail('Should have failed')
  } catch {
    t.pass()
  }
})

test('non-existing follow entry', async function (t) {
  const drive = createDrive(t)

  await drive.put('/file.txt', 'hi')

  t.is(await drive.entry('/file.random.shortcut', { follow: true }), null)
})
