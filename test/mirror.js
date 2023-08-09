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

test('drive.mirror() edge case', async (t) => {
  const a = createDrive(t, {}, { noTestFiles: true })
  const b = createDrive(t, {}, { noTestFiles: true })

  await a.put('/folder/file', 'actually a file')
  await b.put('/folder', 'but its a file')
  await b.mirror(a).done()

  t.alike(await b.get('/folder'), b4a.from('but its a file'))
  t.alike(await a.get('/folder'), b4a.from('but its a file'))
})
