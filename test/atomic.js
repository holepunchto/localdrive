const test = require('brittle')
const fs = require('fs')
const path = require('path')
const { createDrive } = require('./helpers/index.js')

test('sequential put with atomic enabled', async function (t) {
  const drive = createDrive(t, { atomic: true })

  t.absent(await drive.entry('/new-file.txt'))

  await drive.put('/new-file.txt', Buffer.from('hello world'))
  await drive.put('/new-file.txt', Buffer.from('hello'))

  t.alike(await drive.get('/new-file.txt'), Buffer.from('hello'))
})

test('parallel put with atomic enabled', async function (t) {
  const drive = createDrive(t, { atomic: true })

  t.absent(await drive.entry('/new-file.txt'))

  const put1 = drive.put('/new-file.txt', Buffer.from('hello world'))
  const put2 = drive.put('/new-file.txt', Buffer.from('hello'))
  await Promise.all([put1, put2])

  t.ok(await drive.entry('/new-file.txt'))
})

test('atomic disabled', async function (t) {
  const drive = createDrive(t, { atomic: false })

  const short = Buffer.from('hello')
  const long = Buffer.from('hello world')

  await drive.put('/new-file.txt', long)

  const ws = drive.createWriteStream('/new-file.txt')

  ws.write(short)
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Atomic is disabled so write stream is writing it to the file live
  t.alike(await drive.get('/new-file.txt'), short)

  ws.end()
  await new Promise((resolve) => ws.once('close', resolve))

  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.0.localdrive.tmp'))
  )

  t.alike(await drive.get('/new-file.txt'), short)
})

test('atomic enabled', async function (t) {
  const drive = createDrive(t, { atomic: true })

  const short = Buffer.from('hello')
  const long = Buffer.from('hello world')

  await drive.put('/new-file.txt', long)

  const ws = drive.createWriteStream('/new-file.txt')

  ws.write(short)
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Atomic is enabled so the file still has the original content
  t.alike(await drive.get('/new-file.txt'), long)

  ws.end()
  await new Promise((resolve) => ws.once('close', resolve))

  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.0.localdrive.tmp'))
  )

  t.alike(await drive.get('/new-file.txt'), short)
})

test('atomic enabled but stream is destroyed', async function (t) {
  const drive = createDrive(t, { atomic: true })

  const short = Buffer.from('hello')
  const long = Buffer.from('hello world')

  await drive.put('/new-file.txt', long)

  const ws = drive.createWriteStream('/new-file.txt')

  ws.write(short)
  await new Promise((resolve) => setTimeout(resolve, 500))

  ws.destroy()
  await new Promise((resolve) => ws.once('close', resolve))

  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.0.localdrive.tmp'))
  )

  t.alike(await drive.get('/new-file.txt'), long)
})

test('multiple atomic write stream', async function (t) {
  const drive = createDrive(t, { atomic: true })

  await drive.put('/new-file.txt', Buffer.from('hello world'))

  const ws1 = drive.createWriteStream('/new-file.txt')
  const ws2 = drive.createWriteStream('/new-file.txt')
  const ws3 = drive.createWriteStream('/new-file.txt')

  ws1.write(Buffer.from('1'))
  ws2.write(Buffer.from('2'))
  ws3.write(Buffer.from('3'))

  await new Promise((resolve) => setTimeout(resolve, 500))
  t.alike(await drive.get('/new-file.txt'), Buffer.from('hello world'))

  ws2.end()
  await new Promise((resolve) => ws2.once('close', resolve))
  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.1.localdrive.tmp'))
  )
  t.alike(await drive.get('/new-file.txt'), Buffer.from('2'))

  const ws4 = drive.createWriteStream('/new-file.txt')
  ws4.write(Buffer.from('4'))
  await new Promise((resolve) => setTimeout(resolve, 500))
  ws4.end()
  await new Promise((resolve) => ws4.once('close', resolve))
  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.3.localdrive.tmp'))
  )
  t.alike(await drive.get('/new-file.txt'), Buffer.from('4'))

  ws1.end()
  await new Promise((resolve) => ws1.once('close', resolve))
  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.0.localdrive.tmp'))
  )
  t.alike(await drive.get('/new-file.txt'), Buffer.from('1'))

  ws3.end()
  await new Promise((resolve) => ws3.once('close', resolve))
  t.absent(
    await fileExists(path.join(drive.root, 'new-file.txt.2.localdrive.tmp'))
  )
  t.alike(await drive.get('/new-file.txt'), Buffer.from('3'))
})

async function fileExists(filename) {
  try {
    await fs.promises.stat(filename)
  } catch (err) {
    if (err.code === 'ENOENT') return false
  }
  return true
}
