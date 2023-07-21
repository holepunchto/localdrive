const { Readable, Writable } = require('streamx')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const b4a = require('b4a')

class FileWriteStream extends Writable {
  constructor (filename, key, drive, opts = {}) {
    super({ map })

    this.filename = filename
    this.key = key
    this.drive = drive
    this.executable = !!opts.executable
    this.metadata = opts.metadata || null
    this.fd = 0

    this.atomic = opts.atomic
    this.atomicFilename = this.filename

    this._shouldCleanup = false
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
    if (this.atomic) this.atomicFilename = this.drive._alloc(this.filename)

    const release = await this.drive._lock()
    const mode = this.executable ? 0o744 : 0o644

    try {
      await fsp.mkdir(path.dirname(this.filename), { recursive: true })
      this.fd = await openFilePromise(this.atomicFilename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND, mode)
      this._shouldCleanup = true
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
    if (this.atomic && this._shouldCleanup) await this._cleanupAtomicFile()

    if (this.atomic) this.drive._free(this.atomicFilename)
  }

  async _finalp () {
    const { del, put } = this.drive.metadata
    if (this.metadata === null) {
      if (del) await del(this.key)
    } else if (put) await put(this.key, this.metadata)

    const fd = this.fd
    this.fd = 0
    await closeFilePromise(fd)

    if (this.atomic) {
      await renameFilePromise(this.atomicFilename, this.filename)
      this._shouldCleanup = false
    }
  }

  async _cleanupAtomicFile () {
    await fsp.unlink(this.atomicFilename)
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
