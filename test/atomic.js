const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

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

  t.alike(await drive.get('/new-file.txt'), short)
})