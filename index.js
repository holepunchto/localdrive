const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const b4a = require('b4a')
const unixPathResolve = require('unix-path-resolve')
const { FileReadStream, FileWriteStream } = require('./streams.js')
const mutexify = require('mutexify/promise')
const MirrorDrive = require('mirror-drive')

module.exports = class Localdrive {
  constructor (root, opts = {}) {
    this.root = path.resolve(root)
    this.metadata = handleMetadataHooks(opts.metadata) || {}
    this.supportsMetadata = !!opts.metadata

    this._roots = []
    this._stat = opts.followLinks ? stat : lstat
    this._lock = mutexify()
    this._atomics = opts.atomic ? new Set() : null

    if (opts.roots) {
      for (const prefix of Object.keys(opts.roots)) {
        this._roots.push({
          from: unixPathResolve('/', prefix),
          to: path.resolve(opts.roots[prefix])
        })
      }
    }
  }

  _root (keyname) {
    for (const { from, to } of this._roots) {
      if (keyname.startsWith(from)) return { prefix: from, root: to }
    }

    return { prefix: null, root: this.root }
  }

  _resolve (key) {
    const keyname = unixPathResolve('/', key)
    const { prefix, root } = this._root(keyname)
    const filename = path.join(root, prefix ? keyname.replace(prefix, '') : keyname)
    return { root, keyname, filename }
  }

  async ready () { /* No-op, compatibility */ }
  async close () { /* No-op, compatibility */ }
  async flush () { /* No-op, compatibility */ }

  batch () {
    return this
  }

  checkout () {
    return this
  }

  toPath (key) {
    return this._resolve(key).filename
  }

  async entry (name, opts) {
    if (!opts || !opts.follow) return this._entry(name)

    for (let i = 0; i < 16; i++) {
      const node = await this._entry(name)
      if (!node || !node.value.linkname) return node

      name = unixPathResolve(node.key, node.value.linkname)
    }

    throw new Error('Recursive symlink')
  }

  async _entry (key) {
    if (typeof key === 'object') key = key.key

    const { root, keyname, filename } = this._resolve(key)

    const st = await this._stat(filename)
    if (!st || st.isDirectory()) {
      return null
    }

    const entry = {
      key: keyname,
      value: {
        executable: false,
        linkname: null,
        blob: null,
        metadata: null
      },
      mtime: st.mtimeMs
    }

    if (st.isSymbolicLink()) {
      let link = await fsp.readlink(filename)
      if (link.startsWith(root)) link = link.slice(root.length)
      entry.value.linkname = link.replace(/\\/g, '/')
      return entry
    }

    entry.value.executable = isExecutable(st.mode)
    if (this.metadata.get) entry.value.metadata = await this.metadata.get(keyname)

    if (st.isFile()) {
      const blockLength = st.blocks || Math.ceil(st.size / st.blksize) * 8
      entry.value.blob = { byteOffset: 0, blockOffset: 0, blockLength, byteLength: st.size }
      return entry
    }

    return null
  }

  async get (key, opts) {
    const entry = await this.entry(key, opts)
    if (!entry || !entry.value.blob) return null

    const rs = this.createReadStream(key)
    const chunks = []
    for await (const chunk of rs) {
      chunks.push(chunk)
    }
    return b4a.concat(chunks)
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
    const { root, keyname, filename } = this._resolve(key)

    try {
      await fsp.unlink(filename)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    const release = await this._lock()
    try {
      await gcEmptyFolders(root, path.dirname(filename))
    } finally {
      release()
    }

    if (this.metadata.del) await this.metadata.del(keyname)
  }

  async symlink (key, linkname) {
    const entry = await this.entry(key)
    if (entry) await this.del(key)

    const { filename: pointer } = this._resolve(key)

    const release = await this._lock()
    try {
      await fsp.mkdir(path.dirname(pointer), { recursive: true })

      const target = linkname.startsWith('/')
        ? this._resolve(linkname).filename
        : linkname.replace(/\//g, path.sep)

      const st = await this._stat(target)
      const type = st && st.isDirectory() ? 'junction' : null

      await fsp.symlink(target, pointer, type)
    } finally {
      release()
    }
  }

  compare (a, b) {
    const diff = a.mtime - b.mtime
    return diff > 0 ? 1 : (diff < 0 ? -1 : 0)
  }

  async * list (folder, opts = {}) {
    if (typeof folder === 'object') {
      opts = folder
      folder = undefined
    }

    const ignore = opts.ignore ? [].concat(opts.ignore).map(e => unixPathResolve('/', e)) : []
    const { keyname, filename: fulldir } = this._resolve(folder || '/')
    const iterator = await opendir(fulldir)

    if (!iterator) return

    for await (const dirent of iterator) {
      const key = unixPathResolve(keyname, dirent.name)

      if (ignore.includes(key)) continue

      if (dirent.isDirectory()) {
        yield * this.list(key, opts)
        continue
      }

      const entry = await this.entry(key)
      if (entry) yield entry
    }
  }

  async * readdir (folder) {
    const { keyname, filename: fulldir } = this._resolve(folder || '/')
    const iterator = await readdir(fulldir)

    if (!iterator) return

    for await (const dirent of iterator) {
      const key = unixPathResolve(keyname, dirent.name)

      let suffix = key.slice(keyname.length)
      const i = suffix.indexOf('/')
      if (i > -1) suffix = suffix.slice(i + 1)

      if (dirent.isDirectory()) {
        if (!(await isEmptyDirectory(this, key))) {
          yield suffix
        }
        continue
      }

      const entry = await this.entry(key)
      if (entry) yield suffix
    }
  }

  mirror (out, opts) {
    return new MirrorDrive(this, out, opts)
  }

  createReadStream (key, opts) {
    if (typeof key === 'object') key = key.key

    const { filename } = this._resolve(key)
    return new FileReadStream(filename, opts)
  }

  createWriteStream (key, opts) {
    const { keyname, filename } = this._resolve(key)
    return new FileWriteStream(filename, keyname, this, opts)
  }

  _alloc (filename) {
    if (!this._atomics) return filename
    let c = 0
    while (this._atomics.has(filename + '.' + c + '.localdrive.tmp')) c++
    filename += '.' + c + '.localdrive.tmp'
    this._atomics.add(filename)
    return filename
  }

  _free (atomicFilename) {
    this._atomics.delete(atomicFilename)
  }
}

function handleMetadataHooks (metadata) {
  if (metadata instanceof Map) {
    return {
      get: (key) => metadata.has(key) ? metadata.get(key) : null,
      put: (key, value) => metadata.set(key, value),
      del: (key) => metadata.delete(key)
    }
  }

  return metadata
}

function isExecutable (mode) {
  return !!(mode & fs.constants.S_IXUSR)
}

async function lstat (filename) {
  try {
    return await fsp.lstat(filename)
  } catch {
    return null
  }
}

async function stat (filename) {
  try {
    return await fsp.stat(filename)
  } catch {
    return null
  }
}

async function opendir (dir) {
  try {
    return await fsp.opendir(dir)
  } catch {
    return null
  }
}

async function readdir (dir) {
  try {
    return await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return null
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

async function isEmptyDirectory (drive, key) {
  for await (const entry of drive.list(key)) { // eslint-disable-line
    return false
  }
  return true
}
