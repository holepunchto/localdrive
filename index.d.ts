// Type declarations for the holepunchto/localdrive public API.
/// <reference types="node" />
// NOTE: could not resolve external type(s) FileReadStream, FileWriteStream — rendered as `any`; add a manual import/type if one is available.

import type MirrorDrive from 'mirror-drive'

/**
 * Options for creating a Localdrive instance.
 */
export interface LocaldriveOptions {
  /** If enabled, `entry(key)` follows the `linkname` for symlinks. */
  followLinks?: boolean
  /** If enabled, symlinks pointing outside the root are followed. */
  followExternalLinks?: boolean
  /** Hook functions called when metadata is read/written/deleted. */
  metadata?: {
    /** Called with `(key)` to retrieve metadata for a file. */
    get?: Function
    /** Called with `(key, value)` to store metadata for a file. */
    put?: Function
    /** Called with `(key)` to delete metadata for a file. */
    del?: Function
  }
  /** Enable atomic file writes (write to a tmp file then rename). */
  atomic?: boolean
}

/**
 * Options for `drive.entry()`.
 */
export interface EntryOptions {
  /** Follow symlinks (up to 16 levels deep). */
  follow?: boolean
}

/**
 * Options for `drive.get()`.
 */
export interface GetOptions {
  /** Follow symlinks when resolving the key. */
  follow?: boolean
}

/**
 * Options for `drive.put()` and `drive.createWriteStream()`.
 */
export interface WriteStreamOptions {
  /** Mark the written file as executable (chmod 0o755). */
  executable?: boolean
  /** Arbitrary metadata value stored via the metadata hook. */
  metadata?: any
}

/**
 * Options for `drive.list()`.
 */
export interface ListOptions {
  /** File/folder paths to exclude. May be a path string, an array of path strings, or a predicate function `(key) => boolean`. */
  ignore?: string | Array<string> | Function
}

/**
 * Options for `drive.createReadStream()`.
 */
export interface ReadStreamOptions {
  /** Byte offset to start reading from (inclusive). */
  start?: number
  /** Byte offset to stop reading at (inclusive). Ignored when `length` is set. */
  end?: number
  /** Number of bytes to read. Overrides `end`. */
  length?: number
}

/**
 * Options for `drive.mirror()`.
 */
export interface MirrorOptions {
  /** List differences without writing any changes. */
  dryRun?: boolean
  /** Remove files in the destination that are not in the source. */
  prune?: boolean
  /** Predicate `(key) => boolean` to include only matching entries. */
  filter?: Function
  /** Use batched writes on a Hyperdrive destination. */
  batch?: boolean
}

export class Localdrive {
  /**
   * Creates a drive based on a `root` directory. `root` can be relative or absolute.
   * @param root - `root` can be relative or absolute.
   * @param opts - Configuration options.
   */
  constructor(root: string, opts?: LocaldriveOptions)

  /**
   * No-op. Exists for API compatibility with Hyperdrive.
   * @returns Resolves immediately.
   */
  ready(): Promise<void>

  /**
   * No-op. Exists for API compatibility with Hyperdrive.
   * @returns Resolves immediately.
   */
  close(): Promise<void>

  /**
   * No-op. Exists for API compatibility with Hyperdrive.
   * @returns Resolves immediately.
   */
  flush(): Promise<void>

  /**
   * Returns the drive itself. Exists for API compatibility with Hyperdrive,
which supports write-batching.
   * @returns This drive instance.
   */
  batch(): Localdrive

  /**
   * Returns the drive itself. Exists for API compatibility with Hyperdrive,
which supports version checkouts.
   * @returns This drive instance.
   */
  checkout(): Localdrive

  /**
   * Converts a drive key (unix-style path) into an absolute filesystem path
under `drive.root`.
   * @param key - Drive key to convert (for example `/images/logo.png`).
   * @returns Absolute filesystem path for the given key.
   */
  toPath(key: string): string

  /**
   * Available `options`:
   * @param name - Drive key to look up (for example `/file.txt`).
   * @param opts - Entry lookup options.
   * @returns Returns the entry at `name` path in the drive.
   */
  entry(name: string, opts?: EntryOptions): Promise<object | null>

  /**
   * It also returns null for symbolic links.
   * @param key - Drive key of the file to read (for example `/blob.txt`).
   * @param opts - `options` are the same as in `drive.entry` method.
   * @returns Returns the blob at `key` path in the drive.
   */
  get(key: string, opts?: GetOptions): Promise<Buffer | null>

  /**
   * Creates a file at `key` path in the drive. `options` are the same as in `createWriteStream`.
   * @param key - Drive key of the file to write (for example `/images/logo.png`).
   * @param buffer - Data to write.
   * @param opts - `options` are the same as in `createWriteStream`.
   * @returns Resolves when the file has been fully written and closed.
   */
  put(key: string, buffer: Buffer | string, opts?: WriteStreamOptions): Promise<void>

  /**
   * Deletes the file at `key` path from the drive.
   * @param key - Drive key of the file to delete (for example `/images/old-logo.png`).
   * @returns Resolves when the file and any empty parent directories have been removed.
   */
  del(key: string): Promise<void>

  /**
   * Creates an entry in drive at `key` path that points to the entry at `linkname`.
   * @param key - Drive key where the symlink will be created.
   * @param linkname - Target path the symlink should point to.
   * @returns Resolves when the symlink entry has been created.
   */
  symlink(key: string, linkname: string): Promise<void>

  /**
   * Compares two drive entries by modification time.
   * @param a - First entry (must have an `mtime` property in milliseconds).
   * @param b - Second entry (must have an `mtime` property in milliseconds).
   * @returns Returns `0` if entries are the same, `1` if `entryA` is older, and `-1` if `entryB` is older.
   */
  compare(a: object, b: object): number

  /**
   * Available `options`:
   * @param folder - Unix-style path prefix to list (for example `/images`).
   * @param opts - Listing options.
   * @returns Returns a stream of all entries in the drive inside of specified `folder`.
   */
  list(folder?: string, opts?: ListOptions): Promise<AsyncIterable<object>>

  /**
   * Returns an async iterator that yields the immediate child names (not
full paths) under `folder`. Only non-empty sub-directories and files with
a valid entry are included.
   * @param folder - Unix-style path prefix to read (for example `/images`).
   * @returns Returns a stream of all subpaths of entries in drive stored at paths prefixed by `folder`.
   */
  readdir(folder?: string): Promise<AsyncIterable<string>>

  /**
   * Returns `true` if a file (or symlink) entry exists at `name`, `false` otherwise.
   * @param name - Drive key to check (for example `/file.txt`).
   * @returns Whether an entry exists at the given path.
   */
  exists(name: string): Promise<boolean>

  /**
   * Efficiently mirror this drive into another. Returns a [`MirrorDrive`](https://github.com/holepunchto/mirror-drive#api) instance constructed with `options`.
   * @param out - Destination drive (must implement the same drive API).
   * @param opts - Options forwarded to `MirrorDrive`.
   * @returns A MirrorDrive instance that runs the mirror operation.
   */
  mirror(out: object, opts?: MirrorOptions): MirrorDrive

  /**
   * Available `options`:
   * @param key - Drive key of the file to stream (for example `/blob.txt`).
   * @param opts - Range options.
   * @returns Returns a stream to read out the blob stored in the drive at `key` path.
   */
  createReadStream(key: string, opts?: ReadStreamOptions): any

  /**
   * Stream a blob into the drive at `key` path.
   * @param key - Drive key of the file to write (for example `/blob.txt`).
   * @param opts - Write options.
   * @returns Writable stream targeting the given key.
   */
  createWriteStream(key: string, opts?: WriteStreamOptions): any

  /**
   * String with the resolved (absolute) drive path.
   */
  root: string

  metadata: any

  /**
   * Boolean that indicates if the drive handles or not metadata. Default `false`.
   */
  supportsMetadata: boolean
}

export default Localdrive
