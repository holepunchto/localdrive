const { Readable, Writable } = require('streamx')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const b4a = require('b4a')

class FileWriteStream extends Writable {
  constructor (filename, key, drive, opts = {}) {
    super({ map })

    this.filename = filename
    this.atomicFilename = this.filename
    this.key = key
    this.drive = drive
    this.executable = !!opts.executable
    this.metadata = opts.metadata || null
    this.fd = 0
  }

  _open (cb) {
    this._openp().then(cb, cb)
  }

  _final (cb) {
    this._finalp().then(cb, cb)
  }

  _destroy (cb) {
    this._destroyp().then(cb, cb)
  }

  async _openp () {
    this.atomicFilename = this.drive._alloc(this.filename)

    const release = await this.drive._lock()
    const mode = this.executable ? 0o744 : 0o644

    try {
      await fsp.mkdir(path.dirname(this.filename), { recursive: true })
      this.fd = await openFilePromise(this.atomicFilename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND, mode)
    } finally {
      release()
    }

    const st = await fstatPromise(this.fd)
    if (this.executable !== !!(st.mode & fs.constants.S_IXUSR)) {
      await fchmodPromise(this.fd, mode)
    }
  }

  _writev (datas, cb) {
    fs.writev(this.fd, datas, cb)
  }

  async _destroyp (cb) {
    if (this.fd) await closeFilePromise(this.fd)

    if (this.atomicFilename !== this.filename) {
      await unlinkSafe(this.atomicFilename)
      this._free()
    }
  }

  async _finalp () {
    if (this.metadata === null) {
      if (this.drive.metadata.del) {
        await this.drive.metadata.del(this.key)
      }
    } else if (this.drive.metadata.put) {
      await this.drive.metadata.put(this.key, this.metadata)
    }

    const fd = this.fd
    this.fd = 0
    await closeFilePromise(fd)

    if (this.atomicFilename !== this.filename) {
      await renameFilePromise(this.atomicFilename, this.filename)
      this._free()
    }
  }

  _free () {
    if (this.atomicFilename === this.filename) return
    this.drive._free(this.atomicFilename)
    this.atomicFilename = this.filename
  }
}

class FileReadStream extends Readable {
  constructor (filename, opts = {}) {
    super()

    this.filename = filename
    this.fd = 0

    this._offset = opts.start || 0
    this._missing = 0

    if (opts.length) this._missing = opts.length
    else if (typeof opts.end === 'number') this._missing = opts.end - this._offset + 1
    else this._missing = -1
  }

  _open (cb) {
    fs.open(this.filename, fs.constants.O_RDONLY, (err, fd) => {
      if (err) return cb(err)

      const onerror = (err) => fs.close(fd, () => cb(err))

      fs.fstat(fd, (err, st) => {
        if (err) return onerror(err)
        if (!st.isFile()) return onerror(new Error(this.filename + ' is not a file'))

        this.fd = fd
        if (this._missing === -1) this._missing = st.size

        if (st.size < this._offset) {
          this._offset = st.size
          this._missing = 0
          return cb(null)
        }
        if (st.size < this._offset + this._missing) {
          this._missing = st.size - this._offset
          return cb(null)
        }

        cb(null)
      })
    })
  }

  _read (cb) {
    if (!this._missing) {
      this.push(null)
      return cb(null)
    }

    const data = b4a.allocUnsafe(Math.min(this._missing, 65536))

    fs.read(this.fd, data, 0, data.byteLength, this._offset, (err, read) => {
      if (err) return cb(err)

      if (!read) {
        this.push(null)
        return cb(null)
      }

      if (this._missing < read) read = this._missing
      this.push(data.subarray(0, read))
      this._missing -= read
      this._offset += read
      if (!this._missing) this.push(null)

      cb(null)
    })
  }

  _destroy (cb) {
    if (!this.fd) return cb(null)
    fs.close(this.fd, () => cb(null))
  }
}

module.exports = { FileWriteStream, FileReadStream }

function map (s) {
  return typeof s === 'string' ? b4a.from(s) : s
}

function openFilePromise (filename, flags, mode) {
  return new Promise((resolve, reject) => {
    fs.open(filename, flags, mode, function (error, fd) {
      if (error) reject(error)
      else resolve(fd)
    })
  })
}

function fstatPromise (fd) {
  return new Promise((resolve, reject) => {
    fs.fstat(fd, function (error, stats) {
      if (error) reject(error)
      else resolve(stats)
    })
  })
}

function fchmodPromise (fd, mode) {
  return new Promise((resolve, reject) => {
    fs.fchmod(fd, mode, function (error) {
      if (error) reject(error)
      else resolve()
    })
  })
}

function closeFilePromise (fd) {
  return new Promise((resolve, reject) => {
    fs.close(fd, function (error) {
      if (error) reject(error)
      else resolve()
    })
  })
}

function renameFilePromise (oldPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, function (err) {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function unlinkSafe (filename) {
  try {
    await fsp.unlink(filename)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}
