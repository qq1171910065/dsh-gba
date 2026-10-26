// Exercise the dsh-gba Host half without a running Harness: mount the plugin
// on a stub Cordis context, route HTTP through its handler, and assert the
// library / ROM / save / state round-trips and the auth fence.
import http from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { apply } from './index.js';

const packageDir = dirname(fileURLToPath(import.meta.url));
const home = await mkdtemp(join(tmpdir(), 'dsh-gba-home-'));
process.env.DSH_HOME = home;

let handler;
const disposers = [];
const ctx = {
  logger: { warn: (error) => console.error('host warn:', error?.message ?? error) },
  get: () => undefined,
  effect(callback) {
    const disposer = callback();
    disposers.push(disposer);
    return disposer;
  },
  webServer: {
    register(route) {
      handler = route.handler;
      return () => {
        handler = undefined;
      };
    },
  },
};

apply(ctx, {});

const server = http.createServer((req, res) => handler(req, res));
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const json = async (path, init) => {
  const response = await fetch(`${base}${path}`, init);
  const type = response.headers.get('content-type') ?? '';
  return {
    status: response.status,
    body: type.includes('json') ? await response.json() : new Uint8Array(await response.arrayBuffer()),
    type,
  };
};

try {
  // An empty library reads cleanly.
  const empty = await json('/dsh-gba/api/library');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.roms, []);
  assert.deepEqual(empty.body.slots, [0, 1, 2, 3, 4]);
  assert.equal(empty.body.autoSlot, 9);
  console.log('empty library ok');

  // Assets are served with the right types.
  const wasm = await fetch(`${base}/dsh-gba/assets/mgba.wasm`);
  assert.equal(wasm.status, 200);
  assert.equal(wasm.headers.get('content-type'), 'application/wasm');
  const wasmBytes = new Uint8Array(await wasm.arrayBuffer());
  assert.equal(wasmBytes.length, 1822241);
  assert.deepEqual([...wasmBytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
  const js = await fetch(`${base}/dsh-gba/assets/mgba.js`);
  assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
  console.log('assets ok');

  // The catalogue is a Host-side lookup table, not a route: the panel has no
  // catalogue page, so the three endpoints that only served one are gone.
  for (const gone of ['/dsh-gba/api/catalog', '/dsh-gba/api/sources', '/dsh-gba/assets/catalog.json', '/dsh-gba/assets/store.json']) {
    const response = await json(gone);
    assert.equal(response.status, 404, `${gone} should be gone`);
  }
  const catalogFile = JSON.parse(await readFile(join(packageDir, 'catalog.json'), 'utf8'));
  assert.ok(catalogFile.count > 2000, `expected a full catalogue, got ${catalogFile.count}`);
  assert.equal(catalogFile.games.length, catalogFile.count);
  const metroid = catalogFile.games.find((game) => game.t === 'Metroid Fusion');
  assert.ok(metroid !== undefined, 'Metroid Fusion should be catalogue-listed');
  assert.equal(typeof metroid.c, 'string');
  assert.equal(typeof metroid.art, 'string');
  // The slimmed file carries only the fields the Host reads: an entry may omit
  // `crcs` when it has a single `c`, but nothing else.
  const allowed = new Set(['t', 'k', 'c', 'crcs', 'code', 'art']);
  for (const game of catalogFile.games) {
    for (const key of Object.keys(game)) assert.ok(allowed.has(key), `catalogue entry carries an unexpected ${key}`);
  }
  for (const key of ['r', 's', 'v']) assert.equal(metroid[key], undefined, `catalogue entry should not carry ${key}`);
  console.log('catalog lookup ok', catalogFile.count);

  // The online store index is served from the bundle; no cartridge is bundled.
  const store = await json('/dsh-gba/api/store');
  assert.equal(store.status, 200);
  assert.ok(store.body.count >= 200, `expected the store catalogue, got ${store.body.count}`);
  assert.equal(store.body.games.length, store.body.count);
  const storeGame = store.body.games.find((game) => game.categories.length > 0);
  assert.ok(storeGame !== undefined, 'expected a categorised store title');
  assert.equal(typeof storeGame.slug, 'string');
  assert.equal(typeof storeGame.developer, 'string');
  assert.ok(storeGame.size > 0);
  assert.equal(storeGame.installed, false);
  // Every store title names a cover route, and the index carries no bytes.
  assert.ok(store.body.games.every((game) => game.cover === null || game.cover.startsWith('/dsh-gba/api/store/')));
  assert.equal(store.body.games.every((game) => game.rom === undefined), true);
  // One title's detail route, and the guards around unknown slugs.
  const one = await json(`/dsh-gba/api/store/${storeGame.slug}`);
  assert.equal(one.status, 200);
  assert.equal(one.body.game.slug, storeGame.slug);
  assert.equal(one.body.installed, null);
  const noStore = await json('/dsh-gba/api/store/definitely-not-a-game');
  assert.equal(noStore.status, 404);
  const noShot = await json(`/dsh-gba/api/store/${storeGame.slug}/shot/99`);
  assert.equal(noShot.status, 404);
  console.log('store index ok', store.body.count);

  // A cover is proxied through the Host; an invalid slug is refused.
  const badCover = await json('/dsh-gba/api/cover/NOT_A_SLUG');
  assert.equal(badCover.status, 400);
  const missingCover = await json('/dsh-gba/api/cover/no-such-game');
  assert.equal(missingCover.status, 404);
  console.log('cover guard ok');

  // The bundle ships no cartridges: the shipped-set routes are gone, and the
  // store is the only source of ready-to-play games.
  for (const gone of ['/dsh-gba/api/homebrew', '/dsh-gba/assets/homebrew.json']) {
    const response = await json(gone);
    assert.equal(response.status, 404, `${gone} should be gone`);
  }
  const noHomebrewAssets = await fetch(`${base}/dsh-gba/assets/homebrew.json`);
  assert.equal(noHomebrewAssets.status, 404);
  console.log('no bundled cartridges ok');

  // A minimal GBA cartridge: header title at 0xA0, size above the 0xC0 gate.
  const rom = new Uint8Array(0x200);
  rom.set([...Buffer.from('TESTCART    ', 'ascii')], 0xa0);
  const added = await json('/dsh-gba/api/roms?name=Test%20Cart.gba', { method: 'POST', body: rom });
  assert.equal(added.status, 200);
  assert.equal(added.body.rom.title, 'TESTCART');
  assert.equal(added.body.rom.name, 'Test Cart.gba');
  assert.match(added.body.rom.stem, /^gba-[0-9a-f]{12}$/);
  assert.equal(typeof added.body.rom.catalogId, 'object');
  const id = added.body.rom.id;
  console.log('rom add ok', id);

  // The ROM bytes come back byte-identical.
  const romBack = await json(`/dsh-gba/api/roms/${id}/rom`);
  assert.equal(romBack.status, 200);
  assert.deepEqual(romBack.body, rom);

  // A missing battery save is a 404, a written one reads back.
  const noSave = await json(`/dsh-gba/api/roms/${id}/save`);
  assert.equal(noSave.status, 404);
  const sav = new Uint8Array(0x2000).fill(7);
  const putSave = await json(`/dsh-gba/api/roms/${id}/save`, { method: 'PUT', body: sav });
  assert.equal(putSave.status, 200);
  assert.equal(putSave.body.size, sav.length);
  const readSave = await json(`/dsh-gba/api/roms/${id}/save`);
  assert.deepEqual(readSave.body, sav);
  console.log('battery save ok');

  // Save states round-trip per slot, and the auto slot is addressable too.
  const state = new Uint8Array(0x1000).fill(3);
  for (const slot of [0, 4, 9]) {
    const put = await json(`/dsh-gba/api/roms/${id}/states/${slot}`, { method: 'PUT', body: state });
    assert.equal(put.status, 200);
    const read = await json(`/dsh-gba/api/roms/${id}/states/${slot}`);
    assert.deepEqual(read.body, state);
  }
  const rejected = await json(`/dsh-gba/api/roms/${id}/states/42`, { method: 'PUT', body: state });
  assert.equal(rejected.status, 400);
  const library = await json('/dsh-gba/api/library');
  assert.equal(library.body.roms.length, 1);
  assert.deepEqual(library.body.roms[0].states.map((entry) => entry.slot).sort(), [0, 4]);
  assert.equal(library.body.roms[0].auto.slot, 9);
  assert.equal(library.body.roms[0].save.size, sav.length);
  console.log('save states ok');

  // Settings persist a normalized patch.
  const settings = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ volume: 0.2, fastForward: 3 }),
  });
  assert.equal(settings.body.volume, 0.2);
  assert.equal(settings.body.fastForward, 3);
  const reread = await json('/dsh-gba/api/settings');
  assert.equal(reread.body.fastForward, 3);
  assert.equal(reread.body.lastRomId, id);
  console.log('settings ok');

  // played stamps the record and accepts a play duration.
  const played = await json(`/dsh-gba/api/roms/${id}/played`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seconds: 90 }),
  });
  assert.equal(played.body.ok, true);
  const withPlay = await json('/dsh-gba/api/library');
  assert.equal(withPlay.body.roms[0].playSeconds, 90);
  assert.ok(withPlay.body.roms[0].lastPlayedAt > 0);
  console.log('played ok');

  // The floating-player preference round-trips as a boolean.
  const floatOn = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ floatOpen: true }),
  });
  assert.equal(floatOn.body.floatOpen, true);
  assert.equal(floatOn.body.volume, 0.2);
  const floatOff = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ floatOpen: 'yes-please' }),
  });
  assert.equal(floatOff.body.floatOpen, false);
  // The boss key adds a second, independent flag.
  const bossHidden = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ floatHidden: true }),
  });
  assert.equal(bossHidden.body.floatHidden, true);
  assert.equal(bossHidden.body.floatOpen, false);
  const bossShown = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ floatHidden: 'nope' }),
  });
  assert.equal(bossShown.body.floatHidden, false);
  // Keyboard bindings default to WASD and round-trip per button.
  const defaults = await json('/dsh-gba/api/settings');
  assert.deepEqual(defaults.body.bindings.up, ['KeyW']);
  assert.deepEqual(defaults.body.bindings.a, ['KeyK']);
  const rebound = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bindings: { up: ['ArrowUp', 'KeyW'], a: ['KeyZ'] } }),
  });
  assert.deepEqual(rebound.body.bindings.up, ['ArrowUp', 'KeyW']);
  assert.deepEqual(rebound.body.bindings.a, ['KeyZ']);
  // The untouched buttons keep their defaults.
  assert.deepEqual(rebound.body.bindings.b, ['KeyJ']);
  const junkBindings = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bindings: { up: ['not a code!'], down: 'KeyS' } }),
  });
  assert.deepEqual(junkBindings.body.bindings.up, ['KeyW']);
  assert.deepEqual(junkBindings.body.bindings.down, ['KeyS']);
  // Groups attach to a ROM and come back on the library payload.
  const grouped = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ groups: { 'some-rom': ['RPG', ' RPG ', 'Favourites'], bad: 'nope' } }),
  });
  assert.deepEqual(grouped.body.groups['some-rom'], ['RPG', 'Favourites']);
  assert.equal(grouped.body.groups.bad, undefined);
  console.log('bindings + groups ok');

  // Oversized bodies are refused, not buffered.
  const huge = new Uint8Array(65 * 1024 * 1024);
  const tooBig = await json('/dsh-gba/api/roms?name=huge.gba', { method: 'POST', body: huge });
  assert.equal(tooBig.status, 413);
  console.log('size guard ok');

  // A configured ROM folder is scanned and its cartridge imported on demand.
  const folder = join(home, 'roms-on-disk');
  await mkdir(folder, { recursive: true });
  // The walk reads a real cartridge from disk; the catalogue only supplies art.
  assert.ok(catalogFile.games.some((game) => typeof game.art === 'string'), 'expected a catalogue entry with box art');
  const diskRom = new Uint8Array(0x400);
  diskRom.set([...Buffer.from('DISKCART    ', 'ascii')], 0xa0);
  diskRom.set([...Buffer.from('ABCE', 'ascii')], 0xac);
  await writeFile(join(folder, 'On Disk.gba'), diskRom);
  // Something that is not a cartridge must be ignored by the walk.
  await writeFile(join(folder, 'notes.txt'), 'not a cartridge');
  const configured = await json('/dsh-gba/api/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ romFolders: [folder] }),
  });
  assert.deepEqual(configured.body.romFolders, [folder]);
  const scan = await json('/dsh-gba/api/scan', { method: 'POST' });
  assert.equal(scan.status, 200);
  assert.deepEqual(scan.body.folders, [folder]);
  assert.equal(typeof scan.body.dropFolder, 'string');
  assert.equal(scan.body.files.length, 1, 'the text file must not be scanned as a cartridge');
  assert.equal(scan.body.files[0].name, 'On Disk.gba');
  assert.equal(scan.body.files[0].region, undefined);
  assert.deepEqual(scan.body.missing, []);
  const scannedPath = scan.body.files[0].path;
  const imported = await json('/dsh-gba/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: scannedPath }),
  });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.rom.sourcePath, scannedPath);
  assert.equal(imported.body.rom.title, 'DISKCART');
  const afterScan = await json('/dsh-gba/api/library');
  assert.equal(afterScan.body.roms.length, 2);
  // A path outside the configured folders is refused, even if it exists.
  const outside = await json('/dsh-gba/api/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: join(home, 'roms', id, 'rom.gba') }),
  });
  assert.equal(outside.status, 404);
  console.log('folder scan ok');

  // Delete removes the record and its artifacts.
  const removed = await json(`/dsh-gba/api/roms/${id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  const after = await json('/dsh-gba/api/library');
  assert.equal(after.body.roms.length, 1);
  assert.equal(after.body.roms[0].id, imported.body.rom.id);
  console.log('delete ok');

  // An unknown path under the prefix is a JSON 404.
  const missing = await json('/dsh-gba/api/nope');
  assert.equal(missing.status, 404);
  console.log('404 ok');

  console.log('\nALL HOST CHECKS PASSED');
} finally {
  await new Promise((resolve) => server.close(resolve));
  for (const disposer of disposers) if (typeof disposer === 'function') disposer();
  await rm(home, { recursive: true, force: true });
}
