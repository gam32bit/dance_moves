# Dance Moves

A local-first PWA for practising and tracking dance moves. Browse your clips in a
gallery, watch them, track each move's status (Not Started → In Progress →
Ready), and attach new clips from each practice session. Ready moves sink to the
bottom of the gallery. Each move has a 5-minute practice timer that chimes when the
time is up. Swipe left/right on a move to step to the next/previous one in gallery
order.

Any practice clip can replace a move's main video (**Use as main**; **Restore
original** switches back). **Choose thumbnail** opens a frame picker (slider plus
frame-step buttons) on the main video; the frame becomes that move's gallery image —
stored on the device, so it survives backup/import but doesn't touch the committed
`stills/`.

**Sessions** is for turning long freestyle recordings into new moves. Record (up to 30
minutes, screen kept awake) or upload a long clip, then on its page **Mark start** /
**Mark end** around a move idea and **Cut move**: name it, pick a thumbnail frame, and
it lands in the gallery with the cut as its clip. Cutting replays the range in real
time, so it needs Chrome. Sessions delete themselves 7 days after recording and are
not part of the backup.

**Battle round** mode is a second screen for freestyle practice: a 3-minute round
timer plus a grid of the moves you've marked Ready. Tap a move's thumbnail once
you've worked it into the freestyle and it drops out of the grid, staying out across
subsequent rounds so the session pushes you toward the ones you keep avoiding. "New
session" brings them all back. Nothing about a session is saved — a reload starts
fresh.

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
  faststart MP4 (HEVC re-encoded to H.264, ≤1280px) + poster JPGs and writes
  `public/clips/index.json`; outputs that already exist are skipped. On each launch
  the app creates a move for any entry the device hasn't been offered yet, so clips
  added later reach existing installs without bringing back deleted moves.
- **Practice clips**: recorded in-app (`MediaRecorder`, capped at 90 seconds) or
  picked from a file, stored as `Blob`s in IndexedDB (`src/db.ts`).
- **Offline video**: the app shell is precached; seed videos are cached automatically
  on first play.

Camera recording requires a secure context — `localhost` or an HTTPS deployment.
