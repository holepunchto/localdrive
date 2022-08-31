const Filedrive = require('../../index.js')
const path = require('path')
const fs = require('fs')
const os = require('os')
const net = require('net')
const { promisify } = require('util')
let { pipeline, Readable } = require('stream')
pipeline = promisify(pipeline)

module.exports = {
  createTmpDir,
  createDrive,
  streamToString,
  bufferToStream
}

function createTmpDir () {
  const tmpdir = path.join(os.tmpdir(), 'filedrive-test-')
  return fs.mkdtempSync(tmpdir)
}

function createDrive (t) {
  const root = createTmpDir()
  t.teardown(() => fs.rmSync(root, { recursive: true }))
  generateTestFiles(t, root)

  return new Filedrive(root)
}

function generateTestFiles (t, root) {
  const fullpath = (name) => path.join(root, name)
  const createFile = (name, content) => fs.writeFileSync(fullpath(name), content)
  const createFolder = (name) => fs.mkdirSync(fullpath(name))

  createFile('README.md', '# example')
  createFile('script.sh', '#!/bin/bash')
  createFile('LICENSE', 'MIT')
  createFile('key.secret', '1234')
  createFile('empty.txt', '')
  // createFile('example.sock', '')

  createFolder('examples/')
  createFile('examples/a.txt', '1st')
  createFile('examples/b.txt', '2th')

  createFolder('examples/more/')
  createFile('examples/more/c.txt', '3rd')
  createFile('examples/more/d.txt', '4th')

  fs.chmodSync(fullpath('key.secret'), '222')
  fs.chmodSync(fullpath('script.sh'), '755')
  fs.symlinkSync(fullpath('LICENSE'), fullpath('LICENSE.shortcut'))

  const sockpath = fullpath('example.sock')
  const server = net.createServer().listen(sockpath)
  t.teardown(() => {
    server.close()
  })
}

async function streamToString (stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString()
}

async function bufferToStream (buffer, writeStream) {
  const readable = Readable.from(buffer)
  await pipeline(readable, writeStream)
}
