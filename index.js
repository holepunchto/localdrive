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

    this._followLinks = !!opts.followLinks
    this._followExternalLinks = !!opts.followExternalLinks
    this._lock = mutexify()
    this._atomics = opts.atomic ? new Set() : null
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
    const keyname = unixPathResolve('/', key)
    const filename = path.join(this.root, keyname)
    return filename
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

  async _resolve (filename) {
    if (this._followLinks) {
      const st = await stat(filename)
      return { st, filename }
    }

    if (!this._followExternalLinks) {
      const st = await lstat(filename)
      return { st, filename }
    }

    // 256 is the max recursion...
    for (let i = 0; i < 256; i++) {
      const st = await lstat(filename)

      if (!st || !st.isSymbolicLink()) return { st, filename }

      const link = await fsp.readlink(filename)
      const resolved = path.resolve(path.dirname(filename), link)

      // not external
      if (resolved.startsWith(this.root)) return { st, filename }

      filename = resolved
    }

    // too much recursion, bail
    throw new Error('Reached symlink recursion limit')
  }

  async _entry (key) {
    if (typeof key === 'object') key = key.key

    const keyname = unixPathResolve('/', key)
    const { st, filename } = await this._resolve(path.join(this.root, keyname))

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
      if (link.startsWith(this.root)) link = link.slice(this.root.length)
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
    const keyname = unixPathResolve('/', key)
    const filename = path.join(this.root, keyname)

    try {
      await fsp.unlink(filename)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }

    const dir = path.dirname(filename)

    if (dir.startsWith(this.root)) {
      const release = await this._lock()
      try {
        await gcEmptyFolders(this.root, path.dirname(filename))
      } finally {
        release()
      }
    }

    if (this.metadata.del) await this.metadata.del(keyname)
  }

  async symlink (key, linkname) {
    const entry = await this.entry(key)
    if (entry) await this.del(key)

    const pointer = this.toPath(key)

    const release = await this._lock()
    try {
      await fsp.mkdir(path.dirname(pointer), { recursive: true })

      const target = linkname.startsWith('/')
        ? this.toPath(linkname)
        : linkname.replace(/\//g, path.sep)

      const st = await lstat(target)
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

    const ignore = opts.ignore ? typeof opts.ignore === 'function' ? opts.ignore : [].concat(opts.ignore).map(e => unixPathResolve('/', e)) : []
    const keyname = unixPathResolve('/', folder)
    const fulldir = path.join(this.root, keyname)
    const follow = this._followLinks || this._followExternalLinks

    const iterator = await opendir(fulldir)

    if (!iterator) return

    for await (const dirent of iterator) {
      const key = unixPathResolve(keyname, dirent.name)

      let isDirectory = dirent.isDirectory()

      if (Array.isArray(ignore) ? ignore.includes(key) : !isDirectory && ignore(key)) continue

      if (dirent.isSymbolicLink() && follow) {
        const { st } = await this._resolve(path.join(fulldir, dirent.name))
        if (st && st.isDirectory()) isDirectory = true
      }

      if (isDirectory) {
        yield * this.list(key, opts)
        continue
      }

      const entry = await this.entry(key)
      if (entry) yield entry
    }
  }

  async * readdir (folder) {
    const keyname = unixPathResolve('/', folder)
    const fulldir = path.join(this.root, keyname)
    const follow = this._followLinks || this._followExternalLinks

    const iterator = await readdir(fulldir)

    if (!iterator) return

    for await (const dirent of iterator) {
      const key = unixPathResolve(keyname, dirent.name)

      let suffix = key.slice(keyname.length)
      const i = suffix.indexOf('/')
      if (i > -1) suffix = suffix.slice(i + 1)

      let isDirectory = dirent.isDirectory()

      if (dirent.isSymbolicLink() && follow) {
        const { st } = await this._resolve(path.join(fulldir, dirent.name))
        if (st && st.isDirectory()) isDirectory = true
      }

      if (isDirectory) {
        if (!(await isEmptyDirectory(this, key))) {
          yield suffix
        }
        continue
      }

      const entry = await this.entry(key)
      if (entry) yield suffix
    }
  }

  async exists (name) {
    return await this.entry(name) !== null
  }

  mirror (out, opts) {
    return new MirrorDrive(this, out, opts)
  }

  createReadStream (key, opts) {
    if (typeof key === 'object') key = key.key

    const filename = this.toPath(key)
    return new FileReadStream(filename, opts)
  }

  createWriteStream (key, opts) {
    const keyname = unixPathResolve('/', key)
    const filename = path.join(this.root, keyname)

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
