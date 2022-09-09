const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const unixPathResolve = require('unix-path-resolve')
const { FileReadStream, FileWriteStream } = require('./streams.js')
const mutexify = require('mutexify/promise')

module.exports = class Localdrive {
  constructor (root, opts = {}) {
    this.root = path.resolve(root)
    this.metadata = opts.metadata || {}
    this._lock = mutexify()
  }

  async ready () {
    // No-op because this method is only for compatibility
  }

  toKey (filename) {
    if (filename.startsWith(this.root)) filename = filename.slice(this.root.length)
    return unixPathResolve('/', filename)
  }

  toPath (key) {
    return keyResolve(this.root, key).filename
  }

  async entry (key) {
    const { keyname, filename } = keyResolve(this.root, key)

    const stat = await lstat(filename)
    if (!stat || stat.isDirectory()) {
      return null
    }

    const entry = {
      key: keyname,
      value: {
        executable: false,
        linkname: null,
        blob: null,
        metadata: null
      }
    }

    if (stat.isSymbolicLink()) {
      let link = await fsp.readlink(filename)
      if (link.startsWith(this.root)) link = link.slice(this.root.length)
      entry.value.linkname = link.replace(/\\/g, '/')
      return entry
    }

    entry.value.executable = isExecutable(stat.mode)
    if (this.metadata.entry) entry.value.metadata = await this.metadata.entry(keyname)

    if (stat.isFile()) {
      const blockLength = stat.blocks || Math.ceil(stat.size / stat.blksize) * 8
      entry.value.blob = { blockOffset: 0, blockLength, byteOffset: 0, byteLength: stat.size }
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

  put (key, buffer, opts) {
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
    const { keyname, filename } = keyResolve(this.root, key)

    try {
      await fsp.unlink(filename)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    const release = await this._lock()
    try {
      await gcEmptyFolders(this.root, path.dirname(filename))
    } finally {
      release()
    }

    if (this.metadata.del) await this.metadata.del(keyname)
  }

  async symlink (key, linkname) {
    const entry = await this.entry(key)
    if (entry) await this.del(key)

    const { filename: pointer } = keyResolve(this.root, key)
    const { filename: target } = keyResolve(this.root, linkname)

    const release = await this._lock()
    try {
      await fsp.mkdir(path.dirname(pointer), { recursive: true })
      await fsp.symlink(target, pointer)
    } finally {
      release()
    }
  }

  async * list (folder, opts = {}) {
    const { keyname, filename: fulldir } = keyResolve(this.root, folder || '/')
    const iterator = await fsp.opendir(fulldir)

    for await (const dirent of iterator) {
      const key = unixPathResolve(keyname, dirent.name)

      if (opts.filter && !opts.filter(key)) continue

      if (dirent.isDirectory()) {
        yield * this.list(key, opts)
        continue
      }

      const entry = await this.entry(key)
      if (entry) yield entry
    }
  }

  createReadStream (key, opts) {
    if (typeof key === 'object') key = key.key

    const { filename } = keyResolve(this.root, key)
    return new FileReadStream(filename, opts)
  }

  createWriteStream (key, opts) {
    if (typeof key === 'object') key = key.key

    const { keyname, filename } = keyResolve(this.root, key)
    return new FileWriteStream(filename, keyname, this, opts)
  }
}

function keyResolve (root, key) {
  const keyname = unixPathResolve('/', key)
  const filename = path.join(root, keyname)
  return { keyname, filename }
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
