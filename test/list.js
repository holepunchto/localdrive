const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('list(folder) keys', async function (t) {
  const drive = createDrive(t)

  const actualKeys = []
  const expectedKeys = [
    '/README.md', '/script.sh', '/LICENSE', '/key.secret',
    '/examples/a.txt', '/examples/b.txt',
    '/examples/more/c.txt', '/examples/more/d.txt',
    '/LICENSE.shortcut'
  ]

  for await (const { key } of drive.list('/')) {
    actualKeys.push(key)
  }

  t.alike(actualKeys.sort(), expectedKeys.sort())
})

test('list(folder) entries', async function (t) {
  const drive = createDrive(t)

  for await (const { entry } of drive.list('/')) {
    t.is(typeof entry.executable, 'boolean')
    t.ok(entry.linkname === null || typeof entry.linkname === 'string')
    t.ok(entry.blob === null || typeof entry.blob === 'object')
    t.ok(entry.metadata === null || typeof entry.metadata === 'object')

    if (entry.linkname) {
      t.ok(entry.linkname.startsWith(drive.root))
    }

    if (entry.blob) {
      t.is(typeof entry.blob.blockOffset, 'number')
      t.is(typeof entry.blob.blockLength, 'number')
      t.is(typeof entry.blob.byteOffset, 'number')
      t.is(typeof entry.blob.byteLength, 'number')
    }
  }
})
