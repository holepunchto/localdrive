const test = require('brittle')
const { createDrive, bufferToStream, isWin } = require('./helpers/index.js')

test('createWriteStream(key)', async function (t) {
  const drive = createDrive(t)

  const buffer = Buffer.from('example')
  const ws = drive.createWriteStream('/new-file.txt')
  await bufferToStream(buffer, ws)

  t.alike(await drive.entry('/new-file.txt'), {
    key: '/new-file.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 7 },
      metadata: null
    }
  })
  t.alike(await drive.get('/new-file.txt'), buffer)
})

test('createWriteStream(key) with options', async function (t) {
  const drive = createDrive(t)

  const buffer = Buffer.from('#!/bin/bash')
  const ws = drive.createWriteStream('/new-script.sh', { executable: true })
  await bufferToStream(buffer, ws)

  t.alike(await drive.entry('/new-script.sh'), {
    key: '/new-script.sh',
    value: {
      executable: !isWin,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
      metadata: null
    }
  })
  t.alike(await drive.get('/new-script.sh'), buffer)
})

test('createWriteStream(key) write and end', function (t) {
  t.plan(2)

  const drive = createDrive(t)

  const data = 'new example'
  const ws = drive.createWriteStream('/new-example.txt')
  ws.once('close', onClose)
  ws.write(data)
  ws.end()

  async function onClose () {
    t.alike(await drive.entry('/new-example.txt'), {
      key: '/new-example.txt',
      value: {
        executable: false,
        linkname: null,
        blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
        metadata: null
      }
    })

    t.alike(await drive.get('/new-example.txt'), Buffer.from(data))
  }
})

test('createWriteStream(key) replace', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.get('/LICENSE'), Buffer.from('MIT'))

  const buffer = Buffer.from('ISC')
  const ws = drive.createWriteStream('/LICENSE')
  await bufferToStream(buffer, ws)

  t.alike(await drive.get('/LICENSE'), buffer)
})

test('createWriteStream(key) replace existing executable', { skip: isWin }, async function (t) {
  const drive = createDrive(t)

  t.ok((await drive.entry('/script.sh')).value.executable)

  const buffer = Buffer.from('# script replaced')
  const ws = drive.createWriteStream('/script.sh') // we're not marking it as executable
  await bufferToStream(buffer, ws)

  t.absent((await drive.entry('/script.sh')).value.executable)
})
