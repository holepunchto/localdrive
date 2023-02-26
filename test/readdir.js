const fsp = require('fs/promises')
const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('readdir(folder) names', async function (t) {
  const drive = createDrive(t, undefined, { noTestFiles: true })

  const buffer = Buffer.from('hi')
  await drive.put('/file1.txt', buffer)
  await drive.put('/file2.txt', buffer)
  await drive.put('/folder/file3.txt', buffer)
  await drive.put('/folder/file4.txt', buffer)
  await drive.put('/folder/sub/file5.txt', buffer)
  await drive.put('/folder/sub/sub2/file6.txt', buffer)

  const actual = []
  const expected = ['file1.txt', 'file2.txt', 'folder']

  for await (const name of drive.readdir()) {
    actual.push(name)
  }

  t.alike(actual.sort(), expected.sort())
})

test('readdir(folder) prefix', async function (t) {
  const drive = createDrive(t, undefined, { noTestFiles: true })

  const buffer = Buffer.from('hi')
  await drive.put('/file1.txt', buffer)
  await drive.put('/file2.txt', buffer)
  await drive.put('/folder/file3.txt', buffer)
  await drive.put('/folder/file4.txt', buffer)
  await drive.put('/folder/sub/file5.txt', buffer)
  await drive.put('/folder/sub/sub2/file6.txt', buffer)

  const actual = []
  const expected = ['file3.txt', 'file4.txt', 'sub']

  for await (const name of drive.readdir('/folder')) {
    actual.push(name)
  }

  t.alike(actual.sort(), expected.sort())
})

test('readdir(folder) root does not exists', async function (t) {
  const drive = createDrive(t)

  await fsp.rm(drive.root, { recursive: true })

  for await (const { key } of drive.readdir()) {
    t.fail('should not have given entry: ' + key)
  }

  await fsp.mkdir(drive.root, { recursive: true })

  t.pass()
})
