const test = require('brittle')
const Filedrive = require('./index.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

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

test('get(key) basic', async function (t) {
  const drive = createDrive(t)

  t.alike((await drive.get('LICENSE')).toString(), 'MIT')
})

test('get(key) not found', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.get('not-exists.txt'), null)
  t.is(await drive.get('not/exists.txt'), null)
})

test('get(key) folder', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.get('examples'), null)
  t.is(await drive.get('examples/more'), null)
})

test('list(folder) keys', async function (t) {
  const drive = createDrive(t)

  const expectedKeys = [
    '/README.md', '/script.sh', '/LICENSE',
    '/examples/a.txt', '/examples/b.txt',
    '/examples/more/c.txt', '/examples/more/d.txt',
    '/LICENSE.shortcut'
  ]
  const actualKeys = []

  for await (const { key } of drive.list('/')) {
    actualKeys.push(key)
  }

  t.alike(expectedKeys.sort(), actualKeys.sort())
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

test('createReadStream(key)', async function (t) {
  const drive = createDrive(t)

  const stream = drive.createReadStream('/LICENSE')
  t.is(await streamToString(stream), 'MIT')
})

test('createReadStream(key) with options', async function (t) {
  const drive = createDrive(t)

  const stream1 = drive.createReadStream('/LICENSE', { start: 0, end: 0 })
  t.is(await streamToString(stream1), 'M')

  const stream2 = drive.createReadStream('/LICENSE', { start: 1, end: 1 })
  t.is(await streamToString(stream2), 'I')

  const stream3 = drive.createReadStream('/LICENSE', { start: 1 })
  t.is(await streamToString(stream3), 'IT')

  const stream4 = drive.createReadStream('/LICENSE', { end: 1 })
  t.is(await streamToString(stream4), 'MI')

  const stream5 = drive.createReadStream('/LICENSE', { length: 1 })
  t.is(await streamToString(stream5), 'M')

  const stream6 = drive.createReadStream('/LICENSE', { length: 2 })
  t.is(await streamToString(stream6), 'MI')

  const stream7 = drive.createReadStream('/LICENSE', { start: 1, length: 2 })
  t.is(await streamToString(stream7), 'IT')

  // const stream8 = drive.createReadStream('/LICENSE', { start: 0, end: Infinity, length: 0 })
  // t.is(await streamToString(stream8), 'MIT')
})

function createDrive (t) {
  const tmpdir = path.join(os.tmpdir(), 'filedrive-test-')

  const root = fs.mkdtempSync(tmpdir)
  t.teardown(() => fs.rmSync(root, { recursive: true }))
  generateTestFiles(root)

  return new Filedrive(root)
}

function generateTestFiles (root) {
  const fullpath = (name) => path.join(root, name)
  const createFile = (name, content) => fs.writeFileSync(fullpath(name), content)
  const createFolder = (name) => fs.mkdirSync(fullpath(name))

  createFile('README.md', '# example')
  createFile('script.sh', '#!/bin/bash')
  createFile('LICENSE', 'MIT')

  createFolder('examples/')
  createFile('examples/a.txt', '1st')
  createFile('examples/b.txt', '2th')

  createFolder('examples/more/')
  createFile('examples/more/c.txt', '3rd')
  createFile('examples/more/d.txt', '4th')

  fs.chmodSync(fullpath('script.sh'), '755')
  fs.symlinkSync(fullpath('LICENSE'), fullpath('LICENSE.shortcut'))
}

async function streamToString (stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString()
}
