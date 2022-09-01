# fs-drive

File system interoperable with Hyperdrive.

```
npm i fs-drive
```

## Usage
```js
import Filedrive from 'fs-drive'

const drive = new Filedrive('my-project')

await drive.put('/blob.txt', Buffer.from('example'))
await drive.put('/images/logo.png', Buffer.from('..'))
await drive.put('/images/old-logo.png', Buffer.from('..'))

const buffer = await drive.get('/blob.txt')
console.log(buffer) // => <Buffer ..> "example"

const entry = await drive.entry('/blob.txt')
console.log(entry) // => { executable, linkname, blob, metadata }

await drive.del('/images/old-logo.png')

await drive.symlink('/images/old-logo.png', '/images/logo.png')

for await (const file of drive.list('/images')) {
  console.log('list', file) // => { key, entry }
}

const rs = drive.createReadStream('/blob.txt')
for await (const chunk of rs) {
  console.log('rs', chunk) // => <Buffer ..>
}

const ws = drive.createWriteStream('/blob.txt')
ws.write('new example')
ws.end()
ws.once('close', () => console.log('file saved'))
```

Minimal API that is similar to `Hyperdrive`.

## API

#### `const drive = new Filedrive(root, [options])`

Creates a drive based on a `root` directory. `root` can be relative or absolute.

Default `options`:
```js
{
  ignore: new Set(['.git', '.github'])
}
```

#### `await drive.put(key, buffer, [options])`

Creates a file at `key` path in the drive. `options` are the same as in `createWriteStream`.

#### `const buffer = await drive.get(key)`

Returns the blob at `key` path in the drive. If no blob exists, returns null.

It also returns null for symbolic links.

#### `const entry = await drive.entry(key)`

Returns the entry at `key` path in the drive. It looks like this:
```js
{
  key: '/blob.txt',
  value: {
    executable: Boolean,
    linkname: null,
    blob: {
      blockOffset: Number,
      blockLength: Number,
      byteOffset: Number,
      byteLength: Number
    },
    metadata: null
  }
}
```

#### `await drive.del(key)`

Deletes the file at `key` path from the drive.

#### `await drive.symlink(key, linkname)`

Creates an entry in drive at `key` path that points to the entry at `linkname`.

If a blob entry currently exists at `key` path then it will get overwritten and `drive.get(key)` will return null, while `drive.entry(key)` will return the entry with symlink information.

#### `const iterator = drive.list([folder])`

Returns a stream of all entries in the drive inside of specified `folder`.

#### `const rs = drive.createReadStream(key, [options])`

Returns a stream to read out the blob stored in the drive at `key` path.

Available `options`:
```js
{
  start: Number,
  end: Number,
  length: Number
}
```

`start` and `end` are inclusive.\
`length` overrides `end`, they're not meant to be used together.

#### `const ws = drive.createWriteStream(key, [options])`

Stream a blob into the drive at `key` path.

Available `options`:
```js
{
  executable: Boolean
}
```

## License
MIT
