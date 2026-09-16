# Dance Moves

A local-first PWA for practising and tracking dance moves. Browse your clips in a
gallery, watch them on loop, track each move's status (Not Started → In Progress →
Ready), and attach new clips from each practice session. Ready moves sink to the
bottom of the gallery.

All data lives in the browser (IndexedDB) on the device — no server, works offline
once installed. Use **Settings → Export backup** regularly; import it to move to a new
device. If a save ever fails (storage full, evicted data), the app says so on screen
rather than failing quietly.

## Setup

```bash
npm install
npm run prepare:clips   # converts "Dance Moves/" -> public/clips/ (needs ffmpeg)
npm run dev             # http://localhost:5173
```

## Build & deploy

```bash
npm run build           # -> dist/  (static; deploy to any host)
npm run preview         # test the production build + service worker locally
```

For GitHub Pages under a subpath, build with `VITE_BASE=/dance_moves/ npm run build`.

## How it works

- **Seed clips**: `scripts/prepare-clips.mjs` remuxes the raw phone exports to
  faststart MP4 + poster JPGs and writes `public/clips/index.json`. On first launch
  the app creates one move per entry.
- **Practice clips**: recorded in-app (`MediaRecorder`, capped at 90 seconds) or
  picked from a file, stored as `Blob`s in IndexedDB (`src/db.ts`).
- **Offline video**: the app shell is precached; seed videos are cached on demand
  (per-move "Available offline" toggle, or automatically on first play).

Camera recording requires a secure context — `localhost` or an HTTPS deployment.
