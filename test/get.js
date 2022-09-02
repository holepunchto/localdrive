const test = require('brittle')
const { createDrive } = require('./helpers/index.js')

test('get(key) basic', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.get('/LICENSE'), Buffer.from('MIT'))
})

test('get(key) not found', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.get('/not-exists.txt'), null)
  t.is(await drive.get('/not/exists.txt'), null)
})

test('get(key) folder', async function (t) {
  const drive = createDrive(t)

  t.is(await drive.get('/examples'), null)
  t.is(await drive.get('/examples/more'), null)
})

test('get(key) empty file', async function (t) {
  const drive = createDrive(t)

  t.alike(await drive.get('/empty.txt'), Buffer.from(''))
})

test('get(key) resolve key path', async function (t) {
  const drive = createDrive(t)

  const buffer = await drive.get('/README.md')
  const a = await drive.get('/examples/a.txt')
  const c = await drive.get('/examples/more/c.txt')
  t.ok(buffer)
  t.ok(a)
  t.ok(c)

  t.alike(await drive.get('README.md'), buffer)
  t.alike(await drive.get('/examples/more/../a.txt'), a)
  t.alike(await drive.get('\\examples\\more\\c.txt'), c)
})
