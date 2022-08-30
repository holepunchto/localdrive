# fs-drive

File system interoperable with Hyperdrive.

```
npm i fs-drive
```

## Usage
```javascript
const Filedrive = require('fs-drive')

const drive = new Filedrive('/self/keet-desktop')

for await (const file of drive.list('/src')) {
  console.log(file) // => { key, entry }
}

const rs = drive.createReadStream('/src/app.js')
for await (const chunk of rs) {
  console.log(chunk) // Buffer<..>
}
```

Minimal API that is similar to `Hyperdrive`.

## API

#### `const drive = new Filedrive(root, options)`

Creates a drive based on a root directory.

#### `const entry = drive.entry(key)`

#### `const iterator = drive.list(folder)`

#### `const stream = drive.createReadStream(key)`

## License
MIT
