# fs-drive

File system interoperable with Hyperdrive.

```
npm i fs-drive
```

## Usage
```javascript
const Filedrive = require('fs-drive')

const drive = new Filedrive('/home/user/my-folder')

const entry = await drive.entry('/src/app.js')
// => { executable, linkname, blob, metadata }

for await (const file of drive.list('/src')) {
  // file => { key, entry }
}

const rs = drive.createReadStream('/src/app.js')
for await (const chunk of rs) {
  // chunk => <Buffer ..>
}
```

Minimal API that is similar to `Hyperdrive`.

## API

#### `const drive = new Filedrive(root, [options])`

Creates a drive based on a root directory.

#### `const entry = await drive.entry(key)`

#### `const buffer = await drive.get(key)`

#### `const iterator = drive.list(folder)`

#### `const stream = drive.createReadStream(key)`

#### `const stream = drive.createWriteStream(key, [options])`

## License
MIT
