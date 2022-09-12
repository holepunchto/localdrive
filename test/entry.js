const test = require('brittle')
const { createDrive, isWin } = require('./helpers/index.js')

test('entry(key) basic', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('/README.md'), {
    key: '/README.md',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 9 },
      metadata: null
    }
  })
})

test('entry(key) not found', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.entry('/not-exists.txt'), null)
  t.is(await drive.entry('/not/exists.txt'), null)
})

test('entry(key) executable', { skip: isWin }, async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('/script.sh'), {
    key: '/script.sh',
    value: {
      executable: true,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
      metadata: null
    }
  })
})

test('entry(key) symbolic link', { skip: isWin }, async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('/LICENSE.shortcut'), {
    key: '/LICENSE.shortcut',
    value: {
      executable: false,
      linkname: 'LICENSE',
      blob: null,
      metadata: null
    }
  })
})

test('entry(key) follow links', { skip: isWin }, async function (t) {
  const drive = createDrive(t, {
    followLinks: true
  })

  t.alike(await drive.entry('/LICENSE.shortcut'), {
    key: '/LICENSE.shortcut',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 3 },
      metadata: null
    }
  })
})

test('entry(key) folder', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.entry('/examples'), null)
  t.is(await drive.entry('/examples/more'), null)
})

test('entry(key) file inside a folder', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('/examples/a.txt'), {
    key: '/examples/a.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 3 },
      metadata: null
    }
  })
})

test('entry(key) permission denied', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.entry('/key.secret'), {
    key: '/key.secret',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 4 },
      metadata: null
    }
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
