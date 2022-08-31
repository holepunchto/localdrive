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

#### `const drive = new Filedrive(root)`

Creates a drive based on a root directory. `root` can be relative or absolute.

Relative root:
```js
const drive = new Filedrive('my-project')
```

Absolute root:
```js
const drive = new Filedrive('/home/user/Desktop/my-project')
```

#### `await drive.put(key, buffer)`

#### `const buffer = await drive.get(key)`

#### `const entry = await drive.entry(key)`

#### `await drive.del(key)`

#### `const iterator = drive.list([folder], [options])`

#### `const rs = drive.createReadStream(key, [options])`

#### `const ws = drive.createWriteStream(key, [options])`

## License
MIT
