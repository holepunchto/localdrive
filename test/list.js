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

  for await (const { value } of drive.list('/')) {
    t.is(typeof value.executable, 'boolean')
    t.ok(value.linkname === null || typeof value.linkname === 'string')
    t.ok(value.blob === null || typeof value.blob === 'object')
    t.ok(value.metadata === null || typeof value.metadata === 'object')

    if (value.linkname) {
      t.ok(value.linkname.startsWith(drive.root))
    }

    if (value.blob) {
      t.is(typeof value.blob.blockOffset, 'number')
      t.is(typeof value.blob.blockLength, 'number')
      t.is(typeof value.blob.byteOffset, 'number')
      t.is(typeof value.blob.byteLength, 'number')
    }
  }
})
