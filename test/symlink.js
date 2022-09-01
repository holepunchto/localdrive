const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const path = require('path')

test('symlink(key, linkname) basic', async function (t) {
  const drive = createDrive(t)

  t.absent(await drive.entry('/README.shortcut'))

  await drive.symlink('/README.shortcut', '/README.md')

  t.alike(await drive.entry('/README.shortcut'), {
    key: '/README.shortcut',
    value: {
      executable: true,
      linkname: path.join(drive.root, 'README.md'),
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

test('symlink(key, linkname) resolve key path', async function (t) {
  const drive = createDrive(t)

  const symlinkAndEntry = async (key, linkname, expectedKey) => {
    t.absent(await drive.entry(expectedKey))
    await drive.symlink(key, linkname)
    const entry = await drive.entry(expectedKey)
    t.is(entry.key, expectedKey)
  }

  await symlinkAndEntry('b.txt.shortcut', '/b.txt', '/b.txt.shortcut')
  // await symlinkAndEntry('/../c.txt.shortcut', '/c.txt', '/c.txt.shortcut')
  // await symlinkAndEntry('../d.txt.shortcut', '/d.txt', '/d.txt.shortcut')
  // await symlinkAndEntry('../../../../e.txt.shortcut', '/e.txt', '/e.txt.shortcut')
  await symlinkAndEntry('/examples/more/../f.txt.shortcut', '/examples/f.txt', '/examples/f.txt.shortcut')
  await symlinkAndEntry('\\examples\\more\\h.txt.shortcut', '/examples/more/h.txt', '/examples/more/h.txt.shortcut')
})
