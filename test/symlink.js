const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const fs = require('fs')
const path = require('path')

test('symlink(key, linkname) basic', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/README.shortcut'))

  await drive.symlink('/README.shortcut', '/README.md')

  t.alike(await drive.entry('/README.shortcut'), {
    key: '/README.shortcut',
    value: {
      executable: false,
      linkname: '/README.md',
      blob: null,
      metadata: null
    }
  })
})

test('symlink(key, linkname) absolute inside a folder', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/examples/README.shortcut'))

  await drive.symlink('/examples/README.shortcut', '/examples/more/c.txt')

  t.alike(await drive.entry('/examples/README.shortcut'), {
    key: '/examples/README.shortcut',
    value: {
      executable: false,
      linkname: '/examples/more/c.txt',
      blob: null,
      metadata: null
    }
  })
})

test('symlink(key, linkname) relative inside a folder', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/examples/README.shortcut'))

  await drive.symlink('/examples/README.shortcut', 'more/c.txt')

  t.alike(await drive.entry('/examples/README.shortcut'), {
    key: '/examples/README.shortcut',
    value: {
      executable: false,
      linkname: 'more/c.txt',
      blob: null,
      metadata: null
    }
  })
})

test('symlink(key, linkname) replace', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.get('/LICENSE'), Buffer.from('MIT'))
  t.alike(await drive.entry('/LICENSE'), {
    key: '/LICENSE',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 3 },
      metadata: null
    }
  })

  await drive.symlink('/LICENSE', '/LICENSE-V2')

  t.absent(await drive.get('/LICENSE'))
  t.alike(await drive.entry('/LICENSE'), {
    key: '/LICENSE',
    value: {
      executable: false,
      linkname: '/LICENSE-V2',
      blob: null,
      metadata: null
    }
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
  await symlinkAndEntry('/examples/more/../f.txt.shortcut', '/examples/f.txt', '/examples/f.txt.shortcut')
  await symlinkAndEntry('\\examples\\more\\h.txt.shortcut', '/examples/more/h.txt', '/examples/more/h.txt.shortcut')
})

test('symlink(key, linkname) mutex', async function (t) {
  const drive = createDrive(t)

  t.ok(fs.existsSync(path.join(drive.root, 'solo')))

  const symlink = drive.symlink('/solo/two.txt', '/LICENSE')
  const del = drive.del('/solo/one.txt')
  await Promise.all([symlink, del])

  t.ok(fs.existsSync(path.join(drive.root, 'solo')))
})
