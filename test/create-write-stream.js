const test = require('brittle')
const { createDrive, bufferToStream } = require('./helpers/index.js')

test('createWriteStream(key)', async function (t) {
  const drive = createDrive(t)

  const buffer = Buffer.from('example')
  const writeStream = drive.createWriteStream('new-file.txt')
  await bufferToStream(buffer, writeStream)

  t.alike(await drive.entry('new-file.txt'), {
    key: '/new-file.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 7 },
      metadata: null
    }
  })
  t.alike(await drive.get('new-file.txt'), buffer)
})

test('createWriteStream(key) with options', async function (t) {
  const drive = createDrive(t)

  const buffer = Buffer.from('#!/bin/bash')
  const writeStream = drive.createWriteStream('new-script.sh', { executable: true })
  await bufferToStream(buffer, writeStream)

  t.alike(await drive.entry('new-script.sh'), {
    key: '/new-script.sh',
    value: {
      executable: true,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
      metadata: null
    }
  })
  t.alike(await drive.get('new-script.sh'), buffer)
})

test('createWriteStream(key) write and end', async function (t) {
  const drive = createDrive(t)

  const data = 'new example'
  const ws = drive.createWriteStream('new-example.txt')
  ws.write(data)
  ws.end()

  // file doesn't exist yet
  t.absent(await drive.entry('new-example.txt'))

  // file exists but no data written yet
  t.alike(await drive.entry('new-example.txt'), {
    key: '/new-example.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 0, byteOffset: 0, byteLength: 0 },
      metadata: null
    }
  })

  // file exists and data written
  t.alike(await drive.entry('new-example.txt'), {
    key: '/new-example.txt',
    value: {
      executable: false,
      linkname: null,
      blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
      metadata: null
    }
  })

  t.alike(await drive.get('new-example.txt'), Buffer.from(data))
})
