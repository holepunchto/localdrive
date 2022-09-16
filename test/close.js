const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('close() basic', async function (t) {
  const drive = createDrive(t)

  const promise = drive.close()
  t.ok(promise.then)
  t.ok(promise.catch)
  t.ok(promise.finally)
  await promise
})
