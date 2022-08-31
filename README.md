# fs-drive

File system interoperable with Hyperdrive.

```
npm i fs-drive
```

## Usage
```javascript
const Filedrive = require('fs-drive')

const drive = new Filedrive('/home/user/my-project')

await drive.put('/blob.txt', Buffer.from('example'))
await drive.put('/images/logo.png', Buffer.from('...'))
await drive.put('/images/old-logo.png', Buffer.from('...'))

const buffer = await drive.get('/blob.txt')
// => <Buffer ..> "example"

const entry = await drive.entry('/blob.txt')
// => { executable, linkname, blob, metadata }

await drive.del('/images/old-logo.png')

for await (const file of drive.list('/images')) {
  // file => { key, entry }
}

const rs = drive.createReadStream('/blob.txt')
for await (const chunk of rs) {
  // chunk => <Buffer ..>
}

const ws = drive.createWriteStream('/blob.txt')
ws.write('new example')
ws.end()
```

Minimal API that is similar to `Hyperdrive`.

## API

#### `const drive = new Filedrive(root, [options])`

Creates a drive based on a root directory.

#### `await drive.put(key, buffer)`

#### `const buffer = await drive.get(key)`

#### `const entry = await drive.entry(key)`

#### `await drive.del(key)`

#### `const iterator = drive.list([folder])`

#### `const rs = drive.createReadStream(key, [options])`

#### `const ws = drive.createWriteStream(key, [options])`

## License
MIT
