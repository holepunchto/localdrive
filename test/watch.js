const test = require('brittle')
const { createDrive, eventFlush } = require('./helpers/index.js')

const isMac = process.platform === 'darwin'

test('basic watch', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  await watcher.ready()

  let put = null
  eventFlush().then(async () => {
    put = drive.put('/a.txt', Buffer.from('hi'))
  })

  for await (const diff of watcher) { // eslint-disable-line no-unreachable-loop
    t.alike(diff, {})
    break
  }

  await put
})

test('basic watch next', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  let put = null
  eventFlush().then(async () => {
    put = drive.put('/a.txt', Buffer.from('hi'))
  })

  const { done, value } = await watcher.next()

  t.is(done, false)
  t.alike(value, {})

  await put
})

test('watch multiple next() on parallel - value', async function (t) {
  t.plan(6)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  const a = watcher.next()
  const b = watcher.next()
  const c = watcher.next()

  const put1 = drive.put('/a', Buffer.from('hi')) // Run on background

  {
    const { done, value } = await a

    t.is(done, false)
    t.alike(value, {})
  }

  const put2 = drive.put('/b', Buffer.from('hi')) // Run on background

  {
    const { done, value } = await b

    t.is(done, false)
    t.alike(value, {})
  }

  const put3 = drive.put('/c', Buffer.from('hi')) // Run on background

  {
    const { done, value } = await c

    t.is(done, false)
    t.alike(value, {})
  }

  await put1
  await put2
  await put3
})

test('watch multiple next() on parallel - done', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()

  const a = watcher.next()
  const b = watcher.next()

  await watcher.destroy()

  t.alike(await a, { done: true, value: undefined })
  t.alike(await b, { done: true, value: undefined })
})

test('watch next() after is destroyed', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  const watcher = drive.watch()

  await watcher.destroy()

  t.alike(await watcher.next(), { done: true, value: undefined })
})

test('watch waits for new change', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  let put = null
  eventFlush().then(async () => {
    put = drive.put('/b', Buffer.from('hi')) // Run on background
  })

  const { done, value } = await watcher.next()

  t.is(done, false)
  t.alike(value, {})

  await put
})

test('watch does not lose changes if next() was not called yet', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  await drive.put('/b', Buffer.from('hi'))
  await eventFlush()

  await drive.put('/c', Buffer.from('hi'))
  await eventFlush()

  const { done, value } = await watcher.next()

  t.is(done, false)
  t.alike(value, {})
})

test('destroy watch while waiting for a new change', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  const watcher = drive.watch()

  eventFlush().then(async () => {
    await watcher.destroy()
  })

  t.alike(await watcher.next(), { done: true, value: undefined })
})

test('watch on folder', { skip: isMac }, async function (t) {
  t.plan(1)

  const drive = createDrive(t, undefined, { noTestFiles: true })
  const buf = Buffer.from('hi')

  await drive.put('/README.md', buf)
  await drive.put('/examples/a.txt', buf)
  await drive.put('/examples/more/a.txt', buf)

  const watcher = drive.watch('/examples')

  let next = watcher.next()
  let onchange = null
  next.then(data => {
    next = watcher.next()
    onchange(data)
  })

  onchange = () => t.fail('should not trigger changes')
  await drive.put('/b.txt', buf)
  await eventFlush()
  onchange = null

  onchange = () => t.pass('change')
  await drive.put('/examples/b.txt', buf)
  await eventFlush()
  onchange = null
})

test('watch should normalize folder', { skip: isMac }, async function (t) {
  t.plan(1)

  const drive = createDrive(t, undefined, { noTestFiles: true })
  const buf = Buffer.from('hi')

  await drive.put('/README.md', buf)
  await drive.put('/examples/a.txt', buf)
  await drive.put('/examples/more/a.txt', buf)

  const watcher = drive.watch('examples//more//')

  let next = watcher.next()
  let onchange = null
  next.then(data => {
    next = watcher.next()
    onchange(data)
  })

  onchange = () => t.fail('should not trigger changes')
  await drive.put('/examples/a.txt', buf)
  await eventFlush()
  onchange = null

  onchange = () => t.pass('change')
  await drive.put('/examples/more/a.txt', buf)
  await eventFlush()
  onchange = null
})

test.skip('watch on non existing folder', async function (t) {
  t.plan(1)

  const drive = createDrive(t, undefined, { noTestFiles: true })
  const buf = Buffer.from('hi')

  const watcher = drive.watch('/examples/more')

  let next = watcher.next()
  let onchange = null
  next.then(data => {
    next = watcher.next()
    onchange(data)
  })

  onchange = () => t.pass('change')
  await drive.put('/examples/more/a.txt', buf)
  await eventFlush()
  onchange = null
})

test('batch multiple changes', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  eventFlush().then(async () => {
    const batch = drive.batch()
    await batch.put('/a')
    await batch.put('/b')
    await batch.put('/c')
    await batch.flush()
    t.pass()
  })

  for await (const diff of watcher) { // eslint-disable-line no-unreachable-loop
    t.alike(diff, {})
    break
  }
})

test('destroy watch (without)', async function (t) {
  t.plan(3)

  const drive = createDrive(t)
  const watcher = drive.watch()
  t.teardown(() => watcher.destroy())

  watcher.next().then(({ done }) => {
    if (done) {
      t.pass()
      return
    }

    t.fail('should not trigger changes')
  })

  t.absent(watcher.closed)
  await watcher.destroy()
  t.ok(watcher.closed)

  await drive.put('/a', Buffer.from('hi'))
  await eventFlush()
})

test('destroy watch (with)', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()

  watcher.next().then(async ({ done }) => {
    if (done) t.fail('should not have been closed')

    t.absent(watcher.closed)
    await watcher.destroy()
    t.ok(watcher.closed)
  })

  await drive.put('/a', Buffer.from('hi'))
})

test('closing drive should destroy watcher', async function (t) {
  t.plan(2)

  const drive = createDrive(t)
  const watcher = drive.watch()

  t.absent(watcher.closed)
  await drive.close()
  t.ok(watcher.closed)
})

test('watcher ready throwing an error', async function (t) {
  t.plan(3)

  const drive = createDrive(t)
  const watcher1 = drive.watch('/this-does-not-exists-1')
  const watcher2 = drive.watch('/this-does-not-exists-2')

  try {
    await watcher1.ready()
    t.fail('should have failed')
  } catch (err) {
    t.is(err.code, 'ENOENT')
  }

  // Closing a watcher should not throw error if it had an error on open
  await watcher1.close()

  // Closing a drive should not throw error if it had an error on open
  await drive.close()

  // They had errors on open so they're not closed
  t.absent(watcher1.closed)
  t.absent(watcher2.closed)
})

test('watcher iterator throwing an error', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  const watcher = drive.watch('/this-does-not-exists')

  let put = null
  eventFlush().then(async () => {
    put = drive.put('/a.txt', Buffer.from('hi'))
  })

  try {
    await watcher.next()
    t.fail('should have failed')
  } catch (err) {
    t.is(err.code, 'ENOENT')
  }

  await put
})

test('create lots of watchers', async function (t) {
  t.plan(1)

  const drive = createDrive(t)
  const watchers = []

  const max = isMac ? 100 : 1000
  let count = 0

  for (let i = 0; i < max; i++) {
    const watcher = drive.watch()
    t.teardown(() => watcher.destroy())

    watchers.push(watcher)

    watcher.next().then(({ value }) => {
      if (JSON.stringify(value) !== '{}') {
        t.fail('wrong value')
      }

      if (++count === max) {
        t.pass()
      }
    })
  }

  await drive.put('/a', Buffer.from('hi'))
})

test('create and destroy lots of watchers', async function (t) {
  const drive = createDrive(t)

  const max = isMac ? 100 : 1000

  for (let i = 0; i < max; i++) {
    let changed = false

    const watcher = drive.watch()

    const next = watcher.next().then(({ done }) => {
      if (!done) changed = true
    })

    await drive.put('/a', Buffer.from('hi'))
    await eventFlush()
    await next // Sometimes it needs more than one flushes, probably due how recursive-watch works, not critical for now

    if (!changed) {
      t.fail('should have changed')
    }

    await watcher.destroy()
  }
})
