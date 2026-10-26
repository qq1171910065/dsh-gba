# Third-party notices

`dsh-gba` bundles one emulator core. It ships no ROM data: the store and the
catalogue are indexes that point at upstream projects, and a cartridge reaches
disk only when a user installs one.

## The emulator

| File | Origin | License |
| --- | --- | --- |
| `core/mgba.js` | [`@thenick775/mgba-wasm`](https://www.npmjs.com/package/@thenick775/mgba-wasm) 1.1.1 — mGBA compiled to WebAssembly, a fork of [mGBA](https://mgba.io/) | MPL-2.0 |
| `core/mgba.wasm` | same package and version | MPL-2.0 |

mGBA is Copyright © 2013–2023 Jeffrey Pfau and contributors. The WebAssembly
port is by Nicholas VanCise. The MPL-2.0 text ships with the upstream project;
the Source Code Form of the fork is available at
<https://github.com/thenick775/mgba/tree/feature/wasm>.

Version 1.1.1 is pinned deliberately: it is the last build without a threaded
WebAssembly runtime, so it boots on an ordinary HTTP origin with no
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` isolation. The
newer 2.x builds need `SharedArrayBuffer` and therefore cross-origin isolation,
which a page served by DeepSeek Harness does not have.

## Cartridges: none bundled

**This bundle carries no ROM data at all.** What it carries is an index of where
the store's cartridges live upstream, and the code that fetches one on request.
Two consequences:

- Nothing under this package can be mistaken for a redistributed game. A
  vulnerability scan or a licence review of the package sees metadata and code,
  never a `.gba`.
- The only cartridges on disk are the ones a user installs, in
  `$DSH_HOME/storages/dsh-gba/` — outside the package, and gone when they delete
  the game.

An earlier version of this plugin bundled the
[retrobrews/gba-games](https://github.com/retrobrews/gba-games) collection, whose
own note reads:

> The ROMs listed here have been approved for free distribution on this
> site/project only. If you want to share it, please contact owner/developer.

That restriction is one reason the set is no longer shipped: the store's model —
copy per user, from upstream, on request — needs no redistribution grant.

## The online store

`store.json` is an index of
[gbadev-org/games](https://github.com/gbadev-org/games), the database behind the
Homebrew Hub project: 245 community Game Boy Advance games, each with its
title, developer, date, description and tags. The database is published under
the GPLv3 for the *Homebrew Hub* code, and — as its own LICENSE states — every
individual entry's assets remain copyrighted by that entry's author under
whatever terms that author chose.

Consequences for this plugin:

- **No cartridge is bundled or mirrored.** `store.json` carries a repository
  path and a byte size; the Host fetches the cartridge from the upstream project
  the first time a user installs it, and caches it locally like any other
  private copy.
- A store entry is only listed because its `game.json` marks a `.gba` as
  `playable`. Nothing is redistributed by this bundle.
- Attribution stays with the entry: the store card and its dialog show the
  developer name the database records.

If you redistribute this bundle, the store is a pointer to upstream, not a copy
of it — keep it that way and the package stays free of ROM data.

## The catalogue

`catalog.json` is derived from
[libretro-database](https://github.com/libretro/libretro-database)'s
`metadat/no-intro/Nintendo - Game Boy Advance.dat` (no-intro DAT, version
2026.10.07), reduced to one row per title: the title, a slug, the no-intro CRC32
codes and game codes, and the box-art file name. It contains **no ROM data** for
any commercial title; a catalogue entry is metadata only. The Host reads it to
recognise a cartridge the user already has, and nothing else — there is no
catalogue page and no catalogue endpoint.

## Box art

Box art is not bundled. The Host fetches one image per title from
[thumbnails.libretro.com](https://thumbnails.libretro.com/) the first time it is
needed and caches it under `$DSH_HOME/storages/dsh-gba/covers/`. Cover artwork
belongs to the respective publishers; it is displayed for identification only.
The panel does not list or sell games it cannot play — the catalogue is a
lookup table for identifying a cartridge the user already owns.
