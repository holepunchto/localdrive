const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const unixPathResolve = require('unix-path-resolve')
const { FileReadStream, FileWriteStream } = require('./streams.js')

module.exports = class Filedrive {
  constructor (root, opts = {}) {
    this.root = root
    this.ignore = opts.ignore || new Set(['.git', '.github'])
  }

  async entry (key) {
    key = normalizePath(key)
    const filename = path.join(this.root, key)

    const stat = await lstat(filename)
    if (!stat || stat.isDirectory()) {
      return null
    }

    const entry = {
      key,
      value: {
        executable: isExecutable(stat.mode),
        linkname: null,
        blob: null,
        metadata: null
      }
    }

    if (stat.isSymbolicLink()) {
      entry.value.linkname = await fsp.readlink(filename)
      return entry
    }

    if (stat.isFile()) {
      entry.value.blob = { blockOffset: 0, blockLength: stat.blocks, byteOffset: 0, byteLength: stat.size }
      return entry
    }

    return null
  }

  async get (key) {
    const entry = await this.entry(key)
    if (!entry || !entry.value.blob) return null

    const rs = this.createReadStream(key)
    const chunks = []
    for await (const chunk of rs) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async put (key, buffer, opts) {
    return new Promise((resolve, reject) => {
      const ws = this.createWriteStream(key, opts)
      let error = null
      ws.on('error', (err) => {
        error = err
      })
      ws.on('close', () => {
        if (error) reject(error)
        else resolve()
      })
      ws.end(buffer)
    })
  }

  async del (key) {
    key = normalizePath(key)
    const filename = path.join(this.root, key)

    try {
      await fsp.unlink(filename)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    await gcEmptyFolders(this.root, path.dirname(filename))
  }

  async symlink (key, linkname) {
    const entry = await this.entry(key)
    if (entry) await this.del(key)

    key = normalizePath(key)
    const pointer = path.join(this.root, key)

    linkname = normalizePath(linkname)
    const filename = path.join(this.root, linkname)

    await fsp.symlink(filename, pointer)
  }

  async * list (folder = '/') {
    const fulldir = path.join(this.root, folder)
    const iterator = await fsp.opendir(fulldir)

    for await (const dirent of iterator) {
      if (this.ignore.has(dirent.name)) continue

      const key = unixPathResolve(folder, dirent.name)

      if (dirent.isDirectory()) {
        yield * this.list(key)
        continue
      }

      const entry = await this.entry(key)
      if (entry) yield entry
    }
  }

  createReadStream (key, opts) {
    if (typeof key === 'object') key = key.key

    key = normalizePath(key)
    const filename = path.join(this.root, key)

    return new FileReadStream(filename, opts)
  }

  createWriteStream (key, opts) {
    if (typeof key === 'object') key = key.key

    key = normalizePath(key)
    const filename = path.join(this.root, key)

    return new FileWriteStream(filename, opts)
  }
}

function isExecutable (mode) {
  return !!(mode & fs.constants.S_IXUSR)
}

function normalizePath (name) {
  return unixPathResolve('/', name)
}

async function lstat (filename) {
  try {
    return await fsp.lstat(filename)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

async function gcEmptyFolders (root, dir) {
  try {
    while (dir !== root) {
      await fsp.rmdir(dir)
      dir = path.dirname(dir)
    }
  } catch {
    // silent error
  }
}
