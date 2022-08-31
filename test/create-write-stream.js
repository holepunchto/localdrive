const test = require('brittle')
const { createDrive, bufferToStream } = require('./helpers/index.js')

test('createWriteStream(key)', async function (t) {
  const drive = createDrive(t)

  const buffer = Buffer.from('example')
  const writeStream = drive.createWriteStream('new-file.txt')
  await bufferToStream(buffer, writeStream)

  t.alike(await drive.entry('new-file.txt'), {
    executable: false,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 7 },
    metadata: null
  })
  t.alike(await drive.get('new-file.txt'), buffer)
})

test('createWriteStream(key) with options', async function (t) {
  const drive = createDrive(t)

  const buffer = Buffer.from('#!/bin/bash')
  const writeStream = drive.createWriteStream('new-script.sh', { executable: true })
  await bufferToStream(buffer, writeStream)

  t.alike(await drive.entry('new-script.sh'), {
    executable: true,
    linkname: null,
    blob: { blockOffset: 0, blockLength: 8, byteOffset: 0, byteLength: 11 },
    metadata: null
  })
  t.alike(await drive.get('new-script.sh'), buffer)
})
