const Localdrive = require('../../index.js')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { promisify } = require('util')
let { pipeline, Readable } = require('stream')
pipeline = promisify(pipeline)

const isWin = os.platform() === 'win32'
const isRelativeTmpDir = process.argv.indexOf('--relative-tmp-dir') > -1

module.exports = {
  createTmpDir,
  createDrive,
  generateTestFiles,
  streamToString,
  bufferToStream,
  isWin,
  eventFlush
}

function createTmpDir (t) {
  const tmpdir = path.join(os.tmpdir(), 'localdrive-test-')
  const dir = fs.mkdtempSync(tmpdir)
  t.teardown(() => rmdir(dir))
  return dir
}

function createRelativeTmpDir (t) {
  const tmpdir = path.join('./localdrive-test-' + Math.floor(Math.random() * 100000))
  fs.mkdirSync(tmpdir)
  t.teardown(() => rmdir(tmpdir))
  return tmpdir
}

function createDrive (t, opts, cfg = {}) {
  const root = isRelativeTmpDir ? createRelativeTmpDir(t) : createTmpDir(t)
  if (!cfg.noTestFiles) generateTestFiles(t, root)

  const drive = new Localdrive(root, opts)
  t.teardown(() => drive.close(), { order: -1 })
  return drive
}

function generateTestFiles (t, root) {
  const fullpath = (name) => path.join(root, name)
  const createFile = (name, content) => fs.writeFileSync(fullpath(name), content)
  const createFolder = (name) => fs.mkdirSync(fullpath(name))

  createFile('README.md', '# example')
  createFile('script.sh', '#!/bin/bash')
  createFile('LICENSE', 'MIT')
  createFile('LICENSE-V2', 'ISC')
  createFile('key.secret', '1234')
  createFile('empty.txt', '')

  createFolder('examples/')
  createFile('examples/a.txt', '1st')
  createFile('examples/b.txt', '2th')

  createFolder('examples/more/')
  createFile('examples/more/c.txt', '3rd')
  createFile('examples/more/d.txt', '4th')

  createFolder('solo/')
  createFile('solo/one.txt', '5th')

  fs.chmodSync(fullpath('key.secret'), 0o222)
  fs.chmodSync(fullpath('script.sh'), 0o755)
  if (!isWin) fs.symlinkSync('LICENSE', fullpath('LICENSE.shortcut'))
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

async function rmdir (dir) {
  try {
    await fs.promises.rm(dir, { recursive: true })
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
}

function eventFlush () {
  return new Promise(resolve => setImmediate(resolve))
}
