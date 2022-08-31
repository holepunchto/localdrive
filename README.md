# fs-drive

File system interoperable with Hyperdrive.

```
npm i fs-drive
```

## Usage
```javascript
const Filedrive = require('fs-drive')

const drive = new Filedrive('/home/user/my-project')

const entry = await drive.entry('/blob.txt')
// => { executable, linkname, blob, metadata }

const buffer = await drive.get('/blob.txt')
// => <Buffer ..>

for await (const file of drive.list('/images')) {
  // file => { key, entry }
}

const rs = drive.createReadStream('/blob.txt')
for await (const chunk of rs) {
  // chunk => <Buffer ..>
}

const ws = drive.createWriteStream('/blob.txt')
ws.write('new app')
ws.end()
```

Minimal API that is similar to `Hyperdrive`.

## API

#### `const drive = new Filedrive(root, [options])`

Creates a drive based on a root directory.

#### `const entry = await drive.entry(key)`

#### `const buffer = await drive.get(key)`

#### `await drive.put(key, buffer)`

#### `await drive.del(key)`

#### `const iterator = drive.list([folder])`

#### `const rs = drive.createReadStream(key, [options])`

#### `const ws = drive.createWriteStream(key, [options])`

## License
MIT
