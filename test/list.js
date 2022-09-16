const fsp = require('fs/promises')
const test = require('brittle')
const { createDrive, isWin } = require('./helpers/index.js')

test('list(folder) keys', async function (t) {
  const drive = createDrive(t)

  const actualKeys = []
  const expectedKeys = [
    '/README.md', '/script.sh', '/LICENSE', '/LICENSE-V2', '/key.secret', '/empty.txt',
    '/examples/a.txt', '/examples/b.txt',
    '/examples/more/c.txt', '/examples/more/d.txt',
    '/solo/one.txt'
  ]
  if (!isWin) expectedKeys.push('/LICENSE.shortcut')

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
      t.ok(key.substring(1).startsWith(value.linkname))
    }

    if (value.blob) {
      t.is(typeof value.blob.blockOffset, 'number')
      t.is(typeof value.blob.blockLength, 'number')
      t.is(typeof value.blob.byteOffset, 'number')
      t.is(typeof value.blob.byteLength, 'number')
    }
  }
})

test('list(folder) filter', async function (t) {
  const drive = createDrive(t)
  const filter = (key) => key !== '/LICENSE' && !key.startsWith('/examples/more')

  const actualKeys = []
  const expectedKeys = [
    '/README.md', '/script.sh', '/LICENSE-V2', '/key.secret', '/empty.txt',
    '/examples/a.txt', '/examples/b.txt',
    '/solo/one.txt'
  ]
  if (!isWin) expectedKeys.push('/LICENSE.shortcut')

  for await (const { key } of drive.list('/', { filter })) {
    actualKeys.push(key)
  }

  t.alike(actualKeys.sort(), expectedKeys.sort())
})

test('list(folder) root does not exists', async function (t) {
  const drive = createDrive(t)

  await fsp.rm(drive.root, { recursive: true })

  for await (const { key } of drive.list()) {
    t.fail('should not have given entry: ' + key)
  }

  await fsp.mkdir(drive.root, { recursive: true })
})
