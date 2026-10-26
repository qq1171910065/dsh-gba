/**
 * dsh-gba — Host half.
 *
 * Owns everything that must outlive a browser tab:
 *   - the mGBA WebAssembly assets (`core/mgba.js`, `core/mgba.wasm`), served
 *     same-origin so the Client can `import()` them;
 *   - the GBA catalogue (`catalog.json`, built from libretro's no-intro DAT),
 *     the box-art proxy and the cached cover files;
 *   - the ROM library, the battery save, the save-state slots and the player
 *     preferences under `$DSH_HOME/storages/dsh-gba/`.
 *
 * The Client half is a pure view/emulator host: it never touches the disk, it
 * talks to this file over `/dsh-gba/api/*`. Every route is authenticated with
 * the same Connection trust fence and browser cookie the rest of the Web GUI
 * uses, so a cross-site page cannot read the library.
 *
 * @module dsh-gba
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Stable Cordis plugin name. */
export const name = 'dsh-gba';

/** The Web carrier is required; Connection is optional (loopback profiles). */
export const inject = ['webServer'];

/** Route prefix owned by this plugin. */
const ROUTE = '/dsh-gba';

/** Largest accepted ROM upload (bytes). GBA ROMs are 4–32 MiB. */
const MAX_ROM_BYTES = 64 * 1024 * 1024;

/** Largest accepted save-state / battery-save upload (bytes). */
const MAX_SAVE_BYTES = 8 * 1024 * 1024;

/** Largest box-art file the proxy accepts from upstream (bytes). */
const MAX_ART_BYTES = 4 * 1024 * 1024;

/** Largest upstream store asset (a cartridge) the Host will download (bytes). */
const MAX_STORE_BYTES = 64 * 1024 * 1024;

/** Save-state slots the player offers in its Save Center. */
const SLOTS = [0, 1, 2, 3, 4];

/** Slot the player writes its rolling auto-snapshot to; never listed as a user slot. */
const AUTO_SLOT = 9;

/** Every slot the API accepts: the visible ones plus the rolling auto-snapshot. */
const ACCEPTED_SLOTS = [...SLOTS, AUTO_SLOT];

/** Absolute directory of this package. */
const packageDir = dirname(fileURLToPath(import.meta.url));

/** Asset table served to the browser: request name → (file, content type). */
const ASSETS = {
  'mgba.js': ['core/mgba.js', 'text/javascript; charset=utf-8'],
  'mgba.wasm': ['core/mgba.wasm', 'application/wasm'],
};

/** Public box-art mirror the cover proxy reads from. */
const ART_BASE = 'https://thumbnails.libretro.com/Nintendo%20-%20Game%20Boy%20Advance/Named_Boxarts/';

/** Resolve the Harness home the same way the rest of DSH does. */
function harnessHome() {
  const configured = process.env.DSH_HOME;
  return configured !== undefined && configured !== '' ? configured : join(homedir(), '.dsh');
}

/** Root of this plugin's durable data. */
function storageRoot() {
  return join(harnessHome(), 'storages', 'dsh-gba');
}

/** Directory of one ROM's record. */
function romDir(id) {
  return join(storageRoot(), 'roms', id);
}

/** One ROM's battery save. */
function savePath(id) {
  return join(romDir(id), 'save.sav');
}

/** One ROM's save-state slot file. */
function statePath(id, slot) {
  return join(romDir(id), 'states', `${String(slot)}.ss`);
}

/** One ROM's metadata record. */
function metaPath(id) {
  return join(romDir(id), 'rom.json');
}

/** Preferences file. */
function settingsPath() {
  return join(storageRoot(), 'settings.json');
}

/** Cache directory for box art fetched from the public mirror. */
function coverDir() {
  return join(storageRoot(), 'covers');
}

/** Cache directory for store covers and downloaded store cartridges. */
function storeCacheDir() {
  return join(storageRoot(), 'store');
}

/**
 * The drop folder the player reads cartridges from when the user configured
 * none: `$DSH_HOME/storages/dsh-gba/games/`. Putting a `.gba` file there is the
 * zero-configuration way to make a catalogue tile playable.
 */
function dropFolder() {
  return join(storageRoot(), 'games');
}

/** The folders a scan reads, defaulting to the drop folder. */
function romFoldersOf(settings) {
  const configured = Array.isArray(settings.romFolders) ? settings.romFolders : [];
  return configured.length > 0 ? configured : [dropFolder()];
}

/** The default keyboard map: what a Game Boy Advance layout feels like on a PC. */
const DEFAULT_BINDINGS = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  a: ['KeyK'],
  b: ['KeyJ'],
  l: ['KeyU'],
  r: ['KeyI'],
  start: ['Enter'],
  select: ['ShiftLeft', 'ShiftRight'],
};

/** GBA buttons a binding may address. */
const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'l', 'r', 'start', 'select'];

/** Default player preferences. */
const DEFAULT_SETTINGS = {
  volume: 0.55,
  fastForward: 2,
  autoSave: true,
  lastRomId: null,
  floatOpen: false,
  floatHidden: false,
  floatOpacity: 1,
  romFolders: [],
  bindings: {},
  groups: {},
  groupNames: [],
};

/** Extensions a local ROM folder scan treats as cartridges. */
const ROM_EXTENSIONS = ['.gba', '.agb', '.bin', '.rom'];

/** Files larger than this in a scanned folder are skipped, not read. */
const MAX_SCAN_FILE_BYTES = 64 * 1024 * 1024;

/** Read a JSON file, or `undefined` when it does not exist / is unreadable. */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return undefined;
  }
}

/** Write a JSON file atomically enough for one writer. */
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** The GBA cartridge header title (offset 0xA0, 12 bytes), trimmed. */
function cartridgeTitle(bytes) {
  if (bytes.length < 0xac) return '';
  const raw = bytes.subarray(0xa0, 0xac);
  let out = '';
  for (const byte of raw) {
    if (byte === 0 || byte === 0xff) break;
    out += byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : ' ';
  }
  return out.trim().replace(/\s+/g, ' ');
}

/** The four-character game code at 0xAC, trimmed (region/variant identity). */
function gameCode(bytes) {
  if (bytes.length < 0xb0) return '';
  let out = '';
  for (const byte of bytes.subarray(0xac, 0xb0)) {
    if (byte < 0x20 || byte >= 0x7f) return '';
    out += String.fromCharCode(byte);
  }
  return out;
}

/** CRC32 of a buffer, as no-intro prints it. */
let crcTable;
function crc32(bytes) {
  if (crcTable === undefined) {
    crcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      crcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** `/data/games/<stem>.gba`-safe stem: a fixed-shape hash of the ROM id. */
function stemOf(id) {
  return `gba-${createHash('sha256').update(id).digest('hex').slice(0, 12)}`;
}

/** A filesystem-safe, human-recognizable id. */
function idFor(bytes, fileName) {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const base = String(fileName ?? 'game')
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return base === '' ? digest : `${base}-${digest}`;
}

/** Read a request body up to `limit` bytes; rejects with `too-large` beyond it. */
async function readBody(req, limit) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) {
    const error = new Error('too large');
    error.code = 'too-large';
    throw error;
  }
  const chunks = [];
  let total = 0;
  let overflow = false;
  for await (const chunk of req) {
    if (overflow) continue; // keep draining so the socket is not reset
    total += chunk.length;
    if (total > limit) {
      overflow = true;
      chunks.length = 0;
      continue;
    }
    chunks.push(chunk);
  }
  if (overflow) {
    const error = new Error('too large');
    error.code = 'too-large';
    throw error;
  }
  return Buffer.concat(chunks);
}

/** Send one JSON response. */
function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(body.length),
  });
  res.end(body);
}

/** Send one binary response. */
function sendBytes(res, status, bytes, type = 'application/octet-stream', extra = {}) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'content-length': String(bytes.length),
    ...extra,
  });
  res.end(bytes);
}

/** A short, model-readable failure body. */
function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

/** Normalize a keyboard binding map: every button maps to one or two key codes. */
function normalizeBindings(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const button of BUTTONS) {
    const candidate = source[button];
    if (Array.isArray(candidate)) {
      const keys = candidate.filter((code) => typeof code === 'string' && /^[A-Za-z0-9]+$/.test(code)).slice(0, 2);
      if (keys.length > 0) {
        out[button] = keys;
        continue;
      }
    }
    out[button] = DEFAULT_BINDINGS[button];
  }
  return out;
}

/** Normalize one ROM id's list of user groups. */
function normalizeGroups(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const [id, list] of Object.entries(source)) {
    if (typeof id !== 'string' || !Array.isArray(list)) continue;
    const names = list.filter((name) => typeof name === 'string' && name.trim() !== '').map((name) => name.trim().slice(0, 24)).slice(0, 12);
    if (names.length > 0) out[id] = [...new Set(names)];
  }
  return out;
}

/** Normalize the player preferences read from disk. */
function normalizeSettings(raw) {
  const value = raw !== null && typeof raw === 'object' ? raw : {};
  const volume = typeof value.volume === 'number' && value.volume >= 0 && value.volume <= 1 ? value.volume : DEFAULT_SETTINGS.volume;
  const fastForward = [1, 2, 3, 4].includes(value.fastForward) ? value.fastForward : DEFAULT_SETTINGS.fastForward;
  const folders = Array.isArray(value.romFolders)
    ? value.romFolders.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim()).slice(0, 16)
    : [];
  return {
    volume,
    fastForward,
    autoSave: typeof value.autoSave === 'boolean' ? value.autoSave : DEFAULT_SETTINGS.autoSave,
    lastRomId: typeof value.lastRomId === 'string' ? value.lastRomId : null,
    floatOpen: typeof value.floatOpen === 'boolean' ? value.floatOpen : DEFAULT_SETTINGS.floatOpen,
    floatHidden: typeof value.floatHidden === 'boolean' ? value.floatHidden : DEFAULT_SETTINGS.floatHidden,
    floatOpacity: typeof value.floatOpacity === 'number' && value.floatOpacity >= 0.35 && value.floatOpacity <= 1 ? value.floatOpacity : DEFAULT_SETTINGS.floatOpacity,
    romFolders: folders,
    bindings: normalizeBindings(value.bindings),
    groups: normalizeGroups(value.groups),
    groupNames: Array.isArray(value.groupNames)
      ? [...new Set(value.groupNames.filter((name) => typeof name === 'string' && name.trim() !== '').map((name) => name.trim().slice(0, 24)))].slice(0, 16)
      : [],
  };
}

/** One ROM's public record: metadata plus the artifacts that exist for it. */
async function describeRom(id) {
  const meta = await readJson(metaPath(id));
  if (meta === undefined) return undefined;
  let save = null;
  try {
    const info = await stat(savePath(id));
    save = { size: info.size, updatedAt: info.mtimeMs };
  } catch {
    save = null;
  }
  const states = [];
  for (const slot of SLOTS) {
    try {
      const info = await stat(statePath(id, slot));
      states.push({ slot, size: info.size, updatedAt: info.mtimeMs });
    } catch {
      /* empty slot */
    }
  }
  let auto = null;
  try {
    const info = await stat(statePath(id, AUTO_SLOT));
    auto = { slot: AUTO_SLOT, size: info.size, updatedAt: info.mtimeMs };
  } catch {
    auto = null;
  }
  return {
    id,
    stem: stemOf(id),
    name: typeof meta.name === 'string' ? meta.name : id,
    title: typeof meta.title === 'string' ? meta.title : '',
    size: typeof meta.size === 'number' ? meta.size : 0,
    crc: typeof meta.crc === 'string' ? meta.crc : null,
    addedAt: typeof meta.addedAt === 'number' ? meta.addedAt : 0,
    lastPlayedAt: typeof meta.lastPlayedAt === 'number' ? meta.lastPlayedAt : 0,
    playSeconds: typeof meta.playSeconds === 'number' ? meta.playSeconds : 0,
    catalogId: typeof meta.catalogId === 'string' ? meta.catalogId : null,
    art: typeof meta.art === 'string' ? meta.art : null,
    artSlug: typeof meta.artSlug === 'string' ? meta.artSlug : null,
    sourcePath: typeof meta.sourcePath === 'string' ? meta.sourcePath : null,
    store: typeof meta.store === 'string' ? meta.store : null,
    author: typeof meta.author === 'string' ? meta.author : null,
    save,
    states,
    auto,
  };
}

/** Every stored ROM, newest play first. */
async function listRoms() {
  const root = join(storageRoot(), 'roms');
  let ids;
  try {
    ids = await readdir(root);
  } catch {
    return [];
  }
  const records = [];
  for (const id of ids) {
    const record = await describeRom(id);
    if (record !== undefined) records.push(record);
  }
  records.sort((left, right) => (right.lastPlayedAt || right.addedAt) - (left.lastPlayedAt || left.addedAt));
  return records;
}

/**
 * List the cartridges inside the folders the player was pointed at.
 *
 * A browser cannot read an arbitrary directory, so this is how a cartridge the
 * user already owns on disk becomes playable: the Host walks the configured
 * folders, identifies every candidate by CRC32 (falling back to the cartridge
 * header and the game code), and reports which ones the catalogue recognizes.
 * Reading is bounded: only files with a cartridge extension and a plausible
 * size are opened, and only their first 0xB0 bytes plus a digest pass.
 * @param folders - absolute directories from the player preferences.
 * @returns one row per readable cartridge, plus the folders that failed.
 */
async function scanFolders(folders) {
  const index = await catalog();
  const found = [];
  const missing = [];
  const seen = new Set();
  const examine = async (path, name) => {
    let info;
    try {
      info = await stat(path);
    } catch {
      return;
    }
    if (!info.isFile() || info.size < 0xc0 || info.size > MAX_SCAN_FILE_BYTES) return;
    let bytes;
    try {
      bytes = await readFile(path);
    } catch {
      return;
    }
    const crc = crc32(bytes).toString(16).toUpperCase().padStart(8, '0');
    if (seen.has(crc)) return;
    seen.add(crc);
    const code = gameCode(bytes);
    const matched = index.byCrc.get(crc) ?? (code === '' ? undefined : index.byCode.get(code));
    found.push({
      crc,
      code,
      name,
      path,
      size: info.size,
      title: cartridgeTitle(bytes),
      catalogId: matched === undefined ? null : matched.t,
      art: matched?.art ?? null,
      artSlug: matched?.k ?? null,
    });
  };
  const walk = async (directory, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      missing.push(directory);
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (!ROM_EXTENSIONS.some((extension) => lower.endsWith(extension))) continue;
      await examine(path, entry.name);
    }
  };
  for (const folder of folders) await walk(folder, 0);
  found.sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base', numeric: true }));
  return { files: found, missing };
}

/** The catalogue, loaded once per process. */
let catalogCache;
async function catalog() {
  if (catalogCache !== undefined) return catalogCache;
  const raw = await readJson(join(packageDir, 'catalog.json'));
  const games = Array.isArray(raw?.games) ? raw.games : [];
  const byCrc = new Map();
  const byCode = new Map();
  for (const game of games) {
    const crcList = Array.isArray(game.crcs) ? game.crcs : game.c !== undefined ? [game.c] : [];
    for (const crc of crcList) if (!byCrc.has(crc.toUpperCase())) byCrc.set(crc.toUpperCase(), game);
    for (const code of Array.isArray(game.code) ? game.code : []) {
      if (!byCode.has(code.toUpperCase())) byCode.set(code.toUpperCase(), game);
    }
  }
  catalogCache = { version: raw?.version ?? 1, source: raw?.source ?? '', games, byCrc, byCode };
  return catalogCache;
}

/**
 * Mount the Host half: the asset route, the catalogue and cover proxy, and the
 * library API with its durable storage behind them.
 * @param ctx - Cordis context carrying `webServer`.
 */
export function apply(ctx) {
  const rejected = (req, res) => {
    const connection = ctx.get('connection');
    if (connection === undefined) return false;
    let status;
    try {
      status = connection.requestRejection({ headers: req.headers });
    } catch {
      status = undefined;
    }
    if (status === undefined) return false;
    res.writeHead(status, { 'cache-control': 'no-store' });
    res.end();
    return true;
  };

  const serveAsset = async (req, res, fileName) => {
    const entry = ASSETS[fileName];
    if (entry === undefined) return false;
    const [relative, type] = entry;
    let bytes;
    try {
      bytes = await readFile(join(packageDir, relative));
    } catch {
      sendError(res, 404, `asset ${fileName} is missing from the dsh-gba package`);
      return true;
    }
    // The core and the catalogue change only with a new bundle version, so
    // they can be cached for the lifetime of the page.
    sendBytes(res, 200, bytes, type, { 'cache-control': 'public, max-age=86400' });
    return true;
  };

  /**
   * Serve one cover, caching the upstream bytes on disk.
   *
   * The catalogue carries libretro's box-art basename per title; the browser
   * asks for `/api/cover/<slug>?art=<basename>`, and the first request that
   * needs it fetches the PNG from the public mirror and keeps it under the
   * plugin's storage. Later requests never touch the network.
   */

  /** The store index, loaded once per process. */
  let storeCache;
  const storeIndex = async () => {
    if (storeCache !== undefined) return storeCache;
    const raw = await readJson(join(packageDir, 'store.json'));
    const games = Array.isArray(raw?.games) ? raw.games : [];
    storeCache = { source: raw?.source ?? '', base: raw?.base ?? '', games };
    return storeCache;
  };

  /**
   * Fetch one upstream store asset, caching it under the plugin's storage.
   *
   * The store ships no cartridges: a cover or a ROM is pulled from the
   * community database the first time it is needed and kept on disk, so playing
   * a second time costs nothing and works offline.
   */
  const fetchCached = async (relative, cacheName, limit, accept) => {
    const cached = join(storeCacheDir(), cacheName);
    try {
      return await readFile(cached);
    } catch {
      /* not cached yet */
    }
    const index = await storeIndex();
    // The upstream mirror drops connections under load, so a download retries
    // before it gives up; the cache makes a successful attempt permanent.
    let upstream;
    let last;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        upstream = await fetch(index.base + relative, {
          headers: { 'user-agent': 'dsh-gba/1.0 (+deepseek harness plugin)' },
          signal: AbortSignal.timeout(120000),
        });
        if (!upstream.ok) {
          const error = new Error('upstream answered ' + String(upstream.status));
          error.status = upstream.status === 404 ? 404 : 502;
          throw error;
        }
        break;
      } catch (error) {
        last = error;
        if (error.status === 404) throw error;
        upstream = undefined;
        await new Promise((resolve) => setTimeout(resolve, attempt * 800));
      }
    }
    if (upstream === undefined) throw last ?? new Error('upstream is unreachable');
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length === 0) throw new Error('upstream returned an empty body');
    if (bytes.length > limit) throw new Error('upstream asset is larger than expected');
    if (accept !== undefined && !accept(bytes)) throw new Error('upstream asset has the wrong type');
    await mkdir(dirname(cached), { recursive: true });
    await writeFile(cached, bytes);
    return bytes;
  };

  const isImage = (bytes) =>
    (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8);

  /** Install one store cartridge into the library, downloading it once. */
  const installStoreGame = async (slug) => {
    const index = await storeIndex();
    const game = index.games.find((entry) => entry.slug === slug);
    if (game === undefined) return { status: 404, error: 'unknown store title' };
    // A cartridge cached from an earlier play is reused; the library record is
    // still re-created, so a deleted game can be installed again.
    const bytes = await fetchCached(game.rom, 'roms/' + slug + '.gba', MAX_STORE_BYTES, (data) => data.length > 0xc0);
    const id = idFor(bytes, game.rom.split('/').pop() || slug + '.gba');
    const dir = romDir(id);
    await mkdir(join(dir, 'states'), { recursive: true });
    await writeFile(join(dir, 'rom.gba'), bytes);
    const existing = await readJson(metaPath(id));
    const crc = crc32(bytes).toString(16).toUpperCase().padStart(8, '0');
    const code = gameCode(bytes);
    const catalogIndex = await catalog();
    const matched = catalogIndex.byCrc.get(crc) ?? (code === '' ? undefined : catalogIndex.byCode.get(code));
    await writeJson(metaPath(id), {
      name: (game.rom.split('/').pop() || slug + '.gba'),
      title: game.title,
      size: bytes.length,
      crc,
      code,
      catalogId: matched === undefined ? null : matched.t,
      art: null,
      artSlug: null,
      store: slug,
      author: game.developer,
      sourcePath: 'store:' + game.rom,
      addedAt: typeof existing?.addedAt === 'number' ? existing.addedAt : Date.now(),
      lastPlayedAt: typeof existing?.lastPlayedAt === 'number' ? existing.lastPlayedAt : 0,
      playSeconds: typeof existing?.playSeconds === 'number' ? existing.playSeconds : 0,
    });
    const settings = normalizeSettings(await readJson(settingsPath()));
    await writeJson(settingsPath(), { ...settings, lastRomId: id });
    return { status: 200, rom: await describeRom(id) };
  };

  const serveCover = async (res, slug, art) => {
    if (!/^[a-z0-9-]{1,72}$/.test(slug)) return sendError(res, 400, 'bad cover slug');
    if (art !== undefined && !/^[\w &()\-.,'+:!?%]+$/.test(art)) return sendError(res, 400, 'bad cover name');
    const cached = join(coverDir(), `${slug}.png`);
    try {
      const bytes = await readFile(cached);
      return sendBytes(res, 200, bytes, 'image/png', { 'cache-control': 'public, max-age=604800' });
    } catch {
      /* not cached yet */
    }
    if (art === undefined) return sendError(res, 404, 'no cover for this title');
    let upstream;
    try {
      upstream = await fetch(`${ART_BASE}${encodeURIComponent(art)}.png`, {
        headers: { 'user-agent': 'dsh-gba/1.0 (+deepseek harness plugin)' },
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      return sendError(res, 502, `box art unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!upstream.ok) return sendError(res, upstream.status === 404 ? 404 : 502, `box art upstream answered ${String(upstream.status)}`);
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_ART_BYTES) return sendError(res, 502, 'box art is unexpectedly large');
    if (!bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
      return sendError(res, 502, 'box art upstream did not return a PNG');
    }
    try {
      await mkdir(coverDir(), { recursive: true });
      await writeFile(cached, bytes);
    } catch {
      /* the cache is an optimization */
    }
    return sendBytes(res, 200, bytes, 'image/png', { 'cache-control': 'public, max-age=604800' });
  };

  const handler = async (req, res) => {
    if (rejected(req, res)) return;
    const url = new URL(req.url ?? '/', 'http://dsh.invalid');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (path.startsWith(`${ROUTE}/assets/`)) {
      if (method !== 'GET' && method !== 'HEAD') return sendError(res, 405, 'assets are read-only');
      const handled = await serveAsset(req, res, path.slice(`${ROUTE}/assets/`.length));
      if (!handled) sendError(res, 404, 'unknown asset');
      return;
    }

    const api = `${ROUTE}/api`;
    if (!path.startsWith(api)) return sendError(res, 404, 'not found');
    const rest = path.slice(api.length).replace(/^\/+/, '');
    const parts = rest === '' ? [] : rest.split('/');

    try {
      // GET /library
      if (parts.length === 1 && parts[0] === 'library' && method === 'GET') {
        const settings = normalizeSettings(await readJson(settingsPath()));
        const roms = (await listRoms()).map((rom) => ({ ...rom, groups: settings.groups[rom.id] ?? [] }));
        return sendJson(res, 200, { roms, settings, slots: SLOTS, autoSlot: AUTO_SLOT });
      }

      // GET /store — the online catalogue (browse only; nothing is downloaded yet)
      if (parts.length === 1 && parts[0] === 'store' && method === 'GET') {
        const index = await storeIndex();
        const owned = new Set((await listRoms()).map((rom) => rom.store).filter((slug) => typeof slug === 'string'));
        return sendJson(res, 200, {
          source: index.source,
          count: index.games.length,
          games: index.games.map((game) => ({
            slug: game.slug,
            title: game.title,
            developer: game.developer,
            date: game.date,
            description: game.description,
            tags: game.tags,
            categories: game.categories,
            event: game.event,
            size: game.size,
            installed: owned.has(game.slug),
            cover: game.cover === null ? null : '/dsh-gba/api/store/' + game.slug + '/cover',
          })),
        });
      }

      // GET /store/:slug — one store title, with its description and screenshots
      if (parts.length === 2 && parts[0] === 'store' && method === 'GET') {
        const index = await storeIndex();
        const game = index.games.find((entry) => entry.slug === parts[1]);
        if (game === undefined) return sendError(res, 404, 'unknown store title');
        const installed = (await listRoms()).find((rom) => rom.store === game.slug);
        return sendJson(res, 200, {
          game: {
            ...game,
            shots: game.shots.map((path, position) => '/dsh-gba/api/store/' + game.slug + '/shot/' + String(position)),
            cover: game.cover === null ? null : '/dsh-gba/api/store/' + game.slug + '/cover',
          },
          installed: installed ?? null,
        });
      }

      // GET /store/:slug/cover — the artwork, cached after the first request
      if (parts.length === 3 && parts[0] === 'store' && parts[2] === 'cover') {
        const index = await storeIndex();
        const game = index.games.find((entry) => entry.slug === parts[1]);
        if (game === undefined || game.cover === null) return sendError(res, 404, 'no artwork for this title');
        try {
          const bytes = await fetchCached(game.cover, 'covers/' + game.slug + '.img', MAX_ART_BYTES, isImage);
          const type = bytes[0] === 0x89 ? 'image/png' : 'image/jpeg';
          return sendBytes(res, 200, bytes, type, { 'cache-control': 'public, max-age=604800' });
        } catch (error) {
          return sendError(res, error.status === 404 ? 404 : 502, error.message);
        }
      }

      // GET /store/:slug/shot/:index — one screenshot
      if (parts.length === 4 && parts[0] === 'store' && parts[2] === 'shot') {
        const index = await storeIndex();
        const game = index.games.find((entry) => entry.slug === parts[1]);
        const position = Number(parts[3]);
        if (game === undefined || !Number.isInteger(position) || game.shots[position] === undefined) {
          return sendError(res, 404, 'no such screenshot');
        }
        try {
          const bytes = await fetchCached(game.shots[position], 'covers/' + game.slug + '-' + String(position) + '.img', MAX_ART_BYTES, isImage);
          const type = bytes[0] === 0x89 ? 'image/png' : 'image/jpeg';
          return sendBytes(res, 200, bytes, type, { 'cache-control': 'public, max-age=604800' });
        } catch (error) {
          return sendError(res, error.status === 404 ? 404 : 502, error.message);
        }
      }

      // POST /store/:slug — download the cartridge once and add it to the library
      if (parts.length === 2 && parts[0] === 'store' && method === 'POST') {
        try {
          const result = await installStoreGame(parts[1]);
          if (result.status !== 200) return sendError(res, result.status, result.error);
          return sendJson(res, 200, { rom: result.rom });
        } catch (error) {
          return sendError(res, 502, 'download failed: ' + (error instanceof Error ? error.message : String(error)));
        }
      }

      // GET /cover/<slug>?art=<basename>
      if (parts.length === 2 && parts[0] === 'cover') {
        return await serveCover(res, parts[1], url.searchParams.get('art') ?? undefined);
      }

      // GET|PUT /settings
      if (parts.length === 1 && parts[0] === 'settings') {
        if (method === 'GET') return sendJson(res, 200, normalizeSettings(await readJson(settingsPath())));
        if (method !== 'PUT') return sendError(res, 405, 'settings accept GET and PUT');
        const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8'));
        const next = normalizeSettings({ ...normalizeSettings(await readJson(settingsPath())), ...body });
        await writeJson(settingsPath(), next);
        return sendJson(res, 200, next);
      }

      // POST /scan — read the configured folders and report every cartridge
      if (parts.length === 1 && parts[0] === 'scan' && method === 'POST') {
        const settings = normalizeSettings(await readJson(settingsPath()));
        const folders = romFoldersOf(settings);
        const { files, missing } = await scanFolders(folders);
        return sendJson(res, 200, { folders, dropFolder: dropFolder(), files, missing });
      }

      // POST /import  { path } — copy one scanned cartridge into the library
      if (parts.length === 1 && parts[0] === 'import' && method === 'POST') {
        const body = JSON.parse((await readBody(req, 8 * 1024)).toString('utf8'));
        const target = typeof body?.path === 'string' ? body.path : '';
        if (target === '') return sendError(res, 400, 'path is required');
        const settings = normalizeSettings(await readJson(settingsPath()));
        const { files } = await scanFolders(romFoldersOf(settings));
        // Only a file the scan just enumerated is importable: the scan already
        // confined its walk to the configured folders, so this cannot read an
        // arbitrary path the caller made up.
        const file = files.find((entry) => entry.path === target);
        if (file === undefined) return sendError(res, 404, 'that cartridge is not in a configured folder');
        const bytes = await readFile(file.path);
        const id = idFor(bytes, file.name);
        const dir = romDir(id);
        await mkdir(join(dir, 'states'), { recursive: true });
        await writeFile(join(dir, 'rom.gba'), bytes);
        const existing = await readJson(metaPath(id));
        await writeJson(metaPath(id), {
          name: file.name,
          title: file.title,
          size: file.size,
          crc: file.crc,
          code: file.code,
          catalogId: file.catalogId,
          art: file.art,
          artSlug: file.artSlug,
          sourcePath: file.path,
          addedAt: typeof existing?.addedAt === 'number' ? existing.addedAt : Date.now(),
          lastPlayedAt: typeof existing?.lastPlayedAt === 'number' ? existing.lastPlayedAt : 0,
          playSeconds: typeof existing?.playSeconds === 'number' ? existing.playSeconds : 0,
        });
        const settings2 = normalizeSettings(await readJson(settingsPath()));
        await writeJson(settingsPath(), { ...settings2, lastRomId: id });
        return sendJson(res, 200, { rom: await describeRom(id) });
      }

      // POST /roms?name=…   (raw ROM bytes)
      if (parts.length === 1 && parts[0] === 'roms' && method === 'POST') {
        const bytes = await readBody(req, MAX_ROM_BYTES);
        if (bytes.length < 0xc0) return sendError(res, 400, 'this file is too small to be a GBA ROM');
        const fileName = url.searchParams.get('name') ?? 'game.gba';
        const id = idFor(bytes, fileName);
        const dir = romDir(id);
        await mkdir(join(dir, 'states'), { recursive: true });
        await writeFile(join(dir, 'rom.gba'), bytes);
        const existing = await readJson(metaPath(id));
        const now = Date.now();
        // Recognize the cartridge: CRC32 first (no-intro identity), then the
        // four-character game code, so the library can show its cover.
        const index = await catalog();
        const crc = crc32(bytes).toString(16).toUpperCase().padStart(8, '0');
        const code = gameCode(bytes);
        const matched = index.byCrc.get(crc) ?? (code === '' ? undefined : index.byCode.get(code));
        await writeJson(metaPath(id), {
          name: fileName,
          title: cartridgeTitle(bytes),
          size: bytes.length,
          crc,
          code,
          catalogId: matched === undefined ? null : matched.t,
          art: matched?.art ?? null,
          artSlug: matched?.k ?? null,
          addedAt: typeof existing?.addedAt === 'number' ? existing.addedAt : now,
          lastPlayedAt: typeof existing?.lastPlayedAt === 'number' ? existing.lastPlayedAt : 0,
          playSeconds: typeof existing?.playSeconds === 'number' ? existing.playSeconds : 0,
        });
        const settings = normalizeSettings(await readJson(settingsPath()));
        await writeJson(settingsPath(), { ...settings, lastRomId: id });
        return sendJson(res, 200, { rom: await describeRom(id), matched: matched === undefined ? null : { t: matched.t, art: matched.art ?? null } });
      }

      if (parts[0] !== 'roms' || parts.length < 2) return sendError(res, 404, 'not found');
      const id = parts[1];
      const record = await describeRom(id);
      if (record === undefined) return sendError(res, 404, 'unknown ROM');

      // POST /roms/:id/played  { seconds?: number }
      if (parts.length === 3 && parts[2] === 'played' && method === 'POST') {
        const meta = await readJson(metaPath(id));
        let seconds = 0;
        if ((req.headers['content-length'] ?? '0') !== '0') {
          try {
            const body = JSON.parse((await readBody(req, 8 * 1024)).toString('utf8'));
            if (typeof body?.seconds === 'number' && body.seconds > 0 && body.seconds < 86400) seconds = Math.round(body.seconds);
          } catch {
            seconds = 0;
          }
        }
        await writeJson(metaPath(id), {
          ...meta,
          lastPlayedAt: Date.now(),
          playSeconds: (typeof meta?.playSeconds === 'number' ? meta.playSeconds : 0) + seconds,
        });
        const settings = normalizeSettings(await readJson(settingsPath()));
        await writeJson(settingsPath(), { ...settings, lastRomId: id });
        return sendJson(res, 200, { ok: true });
      }

      // GET /roms/:id/rom
      if (parts.length === 3 && parts[2] === 'rom') {
        if (method !== 'GET') return sendError(res, 405, 'the ROM is read-only');
        return sendBytes(res, 200, await readFile(join(romDir(id), 'rom.gba')), 'application/octet-stream');
      }

      // GET|PUT|DELETE /roms/:id/save
      if (parts.length === 3 && parts[2] === 'save') {
        if (method === 'GET') {
          try {
            return sendBytes(res, 200, await readFile(savePath(id)), 'application/octet-stream');
          } catch {
            return sendError(res, 404, 'this ROM has no battery save yet');
          }
        }
        if (method === 'PUT') {
          const bytes = await readBody(req, MAX_SAVE_BYTES);
          await writeFile(savePath(id), bytes);
          return sendJson(res, 200, { size: bytes.length, updatedAt: Date.now() });
        }
        if (method === 'DELETE') {
          await rm(savePath(id), { force: true });
          return sendJson(res, 200, { ok: true });
        }
        return sendError(res, 405, 'save accepts GET, PUT and DELETE');
      }

      // /roms/:id/states/:slot
      if (parts.length === 4 && parts[2] === 'states') {
        const slot = Number(parts[3]);
        if (!Number.isInteger(slot) || !ACCEPTED_SLOTS.includes(slot)) {
          return sendError(res, 400, `slot must be one of ${ACCEPTED_SLOTS.join(', ')}`);
        }
        if (method === 'GET') {
          try {
            return sendBytes(res, 200, await readFile(statePath(id, slot)), 'application/octet-stream');
          } catch {
            return sendError(res, 404, `save-state slot ${String(slot)} is empty`);
          }
        }
        if (method === 'PUT') {
          const bytes = await readBody(req, MAX_SAVE_BYTES);
          await mkdir(dirname(statePath(id, slot)), { recursive: true });
          await writeFile(statePath(id, slot), bytes);
          return sendJson(res, 200, { slot, size: bytes.length, updatedAt: Date.now() });
        }
        if (method === 'DELETE') {
          await rm(statePath(id, slot), { force: true });
          return sendJson(res, 200, { ok: true });
        }
        return sendError(res, 405, 'save states accept GET, PUT and DELETE');
      }

      // DELETE /roms/:id
      if (parts.length === 2 && method === 'DELETE') {
        await rm(romDir(id), { recursive: true, force: true });
        return sendJson(res, 200, { ok: true });
      }

      return sendError(res, 404, 'not found');
    } catch (error) {
      if (error?.code === 'too-large') {
        return sendError(res, 413, 'this file is larger than the Game Boy Advance limit this player accepts');
      }
      if (error instanceof SyntaxError) return sendError(res, 400, 'malformed JSON body');
      ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)));
      return sendError(res, 500, error instanceof Error ? error.message : 'unexpected failure');
    }
  };

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE,
        handler,
      }),
    'dsh-gba: player route',
  );

  // Create the storage tree eagerly so the first library read is not an error
  // and the drop folder already exists for the user to copy cartridges into.
  ctx.effect(() => {
    const ready = Promise.all([
      mkdir(join(storageRoot(), 'roms'), { recursive: true }),
      mkdir(dropFolder(), { recursive: true }),
    ]).catch((error) => {
      ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {
      void ready;
    };
  }, 'dsh-gba: storage root');
}

// Helpers a future revision may reuse, and the hooks the tests exercise.
