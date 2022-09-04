const test = require('brittle')
const { createDrive } = require('./helpers/index.js')
const fs = require('fs')
const path = require('path')

test('del(key) basic', async function (t) {
  const drive = createDrive(t)

  t.ok(await drive.entry('/LICENSE'))
  await drive.del('/LICENSE')
  t.absent(await drive.entry('/LICENSE'))
})

test('del(key) not found', async function (t) {
  const drive = createDrive(t)

  const key = '/this-does-not-exists.txt'
  t.absent(await drive.entry(key))
  await drive.del(key)
  t.absent(await drive.entry(key))
})

test('del(key) folder', async function (t) {
  const drive = createDrive(t)

  try {
    await drive.del('/examples')
    t.fail('should have given error')
  } catch (error) {
    t.ok(error.code === 'EISDIR' || error.code === 'EPERM')
  }
})

test('del(key) gc empty folders', async function (t) {
  const drive = createDrive(t)
  const folder = path.join(drive.root, 'examples', 'more')

  t.ok(fs.existsSync(folder))
  await drive.del('/examples/more/c.txt')
  t.ok(fs.existsSync(folder))
  await drive.del('/examples/more/d.txt')
  t.absent(fs.existsSync(folder))
})

test('del(key) gc empty parent folders', async function (t) {
  const drive = createDrive(t)

  t.ok(fs.existsSync(path.join(drive.root, 'examples')))
  t.ok(fs.existsSync(path.join(drive.root, 'examples', 'more')))

  await drive.del('/examples/a.txt')
  await drive.del('/examples/b.txt')

  // it still exists because there is still a "examples/more" folder with files
  t.ok(fs.existsSync(path.join(drive.root, 'examples')))

  await drive.del('/examples/more/c.txt')
  await drive.del('/examples/more/d.txt')

  t.absent(fs.existsSync(path.join(drive.root, 'examples')))
  t.absent(fs.existsSync(path.join(drive.root, 'examples', 'more')))
})

test('del(key) should not gc root', async function (t) {
  const drive = createDrive(t, undefined, { noTestFiles: true })

  t.ok(fs.existsSync(drive.root))

  await drive.put('/example.txt', Buffer.from(''))
  await drive.del('/example.txt')

  t.ok(fs.existsSync(drive.root))
})

test('del(key) mutex', async function (t) {
  const drive = createDrive(t)

  t.ok(fs.existsSync(path.join(drive.root, 'solo')))

  const del = drive.del('/solo/one.txt')
  const put = drive.put('/solo/two.txt', Buffer.from('new file'))
  await Promise.all([del, put])

  t.ok(fs.existsSync(path.join(drive.root, 'solo')))
})

test('put(key, buffer) resolve key path', async function (t) {
  const drive = createDrive(t)

  const delAndEntry = async (key, expectedKey) => {
    t.ok(await drive.entry(expectedKey))
    await drive.del(key)
    t.absent(await drive.entry(expectedKey))
  }

  await delAndEntry('README.md', '/README.md')
  await delAndEntry('/examples/more/../a.txt', '/examples/a.txt')
  await delAndEntry('\\examples\\more\\c.txt', '/examples/more/c.txt')
})
