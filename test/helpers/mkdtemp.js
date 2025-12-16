const fs = require('fs')

// Polyfill as mkdtempSync doesn't exist in bare-fs
function mkdtempSync (prefix) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  const dir = prefix + suffix
  fs.mkdirSync(dir)
  return dir
}

module.exports = fs.mkdtempSync || mkdtempSync
