const { Readable, Writable } = require('streamx')
const fs = require('fs')
const path = require('path')

class FileWriteStream extends Writable {
  constructor (filename, opts = {}, lock) {
    super({ map })

    this.executable = !!opts.executable
    this.filename = filename
    this.fd = 0
    this._lock = lock || (() => Promise.resolve()) // + do custom resolve to avoid waiting a tick?
  }

  _open (cb) {
    this._lock().then((release) => {
      fs.mkdir(path.dirname(this.filename), { recursive: true }, () => {
        const mode = this.executable ? 0o744 : 0o644

        fs.open(this.filename, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND, mode, (err, fd) => {
          if (release) release()
          if (err) return cb(err)

          const onerror = (err) => fs.close(fd, () => cb(err))

          fs.fstat(fd, (err, st) => {
            if (err) return onerror(err)

            if (this.executable === !!(st.mode & fs.constants.S_IXUSR)) {
              this.fd = fd
              return cb(null)
            }

            // file was already made so above mode had no effect, chmod to adjust...
            fs.fchmod(fd, mode, (err) => {
              if (err) return onerror(err)
              this.fd = fd
              cb(null)
            })
          })
        })
      })
    })
  }

  _writev (datas, cb) {
    fs.writev(this.fd, datas, cb)
  }

  _destroy (cb) {
    if (!this.fd) return cb(null)
    fs.close(this.fd, () => cb(null))
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

    const data = Buffer.allocUnsafe(Math.min(this._missing, 65536))

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
  return typeof s === 'string' ? Buffer.from(s) : s
}
