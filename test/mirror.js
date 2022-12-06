const test = require('brittle')
const b4a = require('b4a')
const { createDrive } = require('./helpers/index.js')

test('drive.mirror()', async (t) => {
  const a = createDrive(t, {}, { noTestFiles: true })
  const b = createDrive(t, {}, { noTestFiles: true })

  await a.put('/foo.txt', 'hello world')
  await a.mirror(b).done()

  t.alike(await b.get('/foo.txt'), b4a.from('hello world'))
})
