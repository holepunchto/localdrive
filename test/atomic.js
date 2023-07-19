const test = require('brittle')
const fs = require('fs')
const path = require('path')
const { createDrive } = require('./helpers/index.js')

test('double atomic put', async function (t) {
  const drive = createDrive(t, { atomic: true })

  await drive.put('/new-file.txt', Buffer.from('hello world'))
  await drive.put('/new-file.txt', Buffer.from('hello'))

  t.alike(await drive.get('/new-file.txt'), Buffer.from('hello'))
})

test('atomic disabled', async function (t) {
  const drive = createDrive(t, { atomic: false })

  const short = Buffer.from('hello')
  const long = Buffer.from('hello world')

  await drive.put('/new-file.txt', long)

  const ws = drive.createWriteStream('/new-file.txt')

  ws.write(short)
  await new Promise(resolve => setTimeout(resolve, 500))

  // Atomic is disabled so write stream is writing it to the file live
  t.alike(await drive.get('/new-file.txt'), short)

  ws.end()
  await new Promise(resolve => ws.once('close', resolve))

  t.absent(await fileExists(path.join(drive.root, 'new-file.txt.localdrive.tmp')))

  t.alike(await drive.get('/new-file.txt'), short)
})

test('atomic enabled', async function (t) {
  const drive = createDrive(t, { atomic: true })

  const short = Buffer.from('hello')
  const long = Buffer.from('hello world')

  await drive.put('/new-file.txt', long)

  const ws = drive.createWriteStream('/new-file.txt')

  ws.write(short)
  await new Promise(resolve => setTimeout(resolve, 500))

  // Atomic is enabled so the file still has the original content
  t.alike(await drive.get('/new-file.txt'), long)

  ws.end()
  await new Promise(resolve => ws.once('close', resolve))

  t.absent(await fileExists(path.join(drive.root, 'new-file.txt.localdrive.tmp')))

  t.alike(await drive.get('/new-file.txt'), short)
})

test('atomic enabled but stream is destroyed', async function (t) {
  const drive = createDrive(t, { atomic: true })

  const short = Buffer.from('hello')
  const long = Buffer.from('hello world')

  await drive.put('/new-file.txt', long)

  const ws = drive.createWriteStream('/new-file.txt')

  ws.write(short)
  await new Promise(resolve => setTimeout(resolve, 500))

  ws.destroy()
  await new Promise(resolve => ws.once('close', resolve))

  t.absent(await fileExists(path.join(drive.root, 'new-file.txt.localdrive.tmp')))

  t.alike(await drive.get('/new-file.txt'), long)
})

async function fileExists (filename) {
  try {
    await fs.promises.stat(filename)
  } catch (err) {
    if (err.code === 'ENOENT') return false
  }
  return true
}
