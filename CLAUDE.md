# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev             # Vite dev server on http://localhost:5173
npm run build           # tsc --noEmit, then vite build -> dist/
npm run preview         # serve the production build (test service worker / offline)
npm run prepare:clips   # regenerate public/clips/ from "Dance Moves/" (needs ffmpeg + ffprobe)
```

No test suite or linter is configured. Type errors are the main correctness gate — run
`npx tsc --noEmit`. For a subpath deploy (e.g. GitHub Pages): `VITE_BASE=/dance_moves/ npm run build`.

Note: in a sandboxed shell the dev server may fail to bind localhost — run it with the
sandbox disabled.

## Architecture

Local-first PWA (React 18 + Vite + TypeScript). No backend, no network calls at runtime.
All persistent state is per-device.

**Data layer** — `src/db.ts` defines a Dexie (IndexedDB) database `dance-moves` with three
tables: `moves`, `clips` (practice videos stored as `Blob`s), and `meta` (key/value).
Components never touch Dexie directly for reads; they use the hooks in `src/hooks/`
(`useMoves`, `useMove`, `useClips`) which wrap `dexie-react-hooks` `useLiveQuery`, so the UI
re-renders automatically on any write. Mutations are exported functions from those same
hook modules (`updateMove`, `createMove`, `addClip`, …).

**Seeding** — `src/seed.ts` runs once on app mount (guarded by `meta.seededVersion`). It
fetches `public/clips/index.json` and creates one `moves` row per bundled clip. That index
plus the `.mp4`/`.jpg` files are build artifacts produced by `scripts/prepare-clips.mjs`,
which remuxes/transcodes the raw phone exports in `Dance Moves/` (gitignored) to
web-friendly H.264 + poster frames. A hand-picked still at `stills/Move_NN.png` (committed)
replaces the auto-extracted frame, written as `<clip>-still.jpg` — a new filename, because
posters are runtime-cached `CacheFirst`. Posters are stored on the move row, so `seed.ts`
re-syncs seed moves' `poster` from the index on every launch.

**Gallery ordering** — `useMoves()` is the single source of sort order: `ready` moves sink
below everything else, then by `sortIndex`. Changing a move's status is what reorders the
gallery.

**Two kinds of video**:
- *Seed clip* — a bundled file at `/clips/<name>.mp4`, referenced by `move.seedClip`. Served
  as a normal static asset.
- *Practice clip* — a `Blob` in the `clips` table, rendered via an object URL (`useBlobUrl`
  handles creation/revocation). Created by `ClipRecorder` (camera `MediaRecorder`, or file
  input). Camera capture needs a secure context (localhost or HTTPS).

**PWA / offline** — configured in `vite.config.ts` via `vite-plugin-pwa` (`generateSW`). The
app shell is precached; `/clips/*.mp4` are deliberately excluded and instead runtime-cached
(`CacheFirst`, cache name `clip-videos`), so a clip is available offline once it has been
played.

**Routing** — `HashRouter` with two routes: `/` (`Gallery`) and `/move/:id` (`MoveDetail`).
Hash routing is intentional so the app works when opened from `file://` or a static host
without server rewrites.

**Backup** — `src/backup.ts` export/import a single JSON file (clip blobs base64-encoded).
This is the only way to move data between devices, since storage is local-only.

`import.meta.env.BASE_URL` (re-exported as `BASE_URL` from `src/App.tsx`) must be prefixed
onto every `/clips/...` URL so subpath deploys work.
