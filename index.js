const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const unixPathResolve = require('unix-path-resolve')

module.exports = class Filedrive {
  constructor (root, opts = {}) {
    this.root = root
    this.ignore = opts.ignore || new Set(['.git', '.github'])
  }

  async entry (key) {
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

    const filename = path.join(this.root, key)
    return fsp.readFile(filename)
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

  createReadStream (key, opts = {}) {
    if (typeof key === 'object') return this.createReadStream(key.key)

    if (typeof opts.length === 'number' && opts.length > 0) {
      const start = opts.start || 0
      opts = { start, end: start + opts.length - 1 }
    }

    const filename = path.join(this.root, key)
    return fs.createReadStream(filename, opts)
  }

  createWriteStream (key, opts = {}) {
    if (typeof key === 'object') return this.createWriteStream(key.key)

    const filename = path.join(this.root, key)
    const stream = fs.createWriteStream(filename)

    if (opts.executable) {
      // + not sure about this
      stream.on('open', function () {
        fs.chmodSync(filename, '755')
      })
    }

    return stream
  }
}

function isExecutable (mode) {
  return !!(mode & fs.constants.S_IXUSR)
}

async function lstat (filename) {
  try {
    return await fsp.lstat(filename)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
