# Devlog

## 2026-08-29 — project started

A local-first PWA to train for an upcoming dance event: browse a gallery of old dance-move
clips, watch them on loop, track each move's status (Not Started / In Progress / Ready,
Ready sinks to the bottom), and attach new practice-session clips to each move. Also create
brand-new move entries for new ideas.

Decisions:
- Fully offline, no backend — all state in IndexedDB (Dexie). Multi-device only via manual
  JSON export/import.
- The 28 existing clips are bundled: `scripts/prepare-clips.mjs` converts `Dance Moves/`
  (gitignored originals) to `public/clips/` and the app seeds one move per clip on first run.
- Stack: React + Vite + TypeScript + vite-plugin-pwa.
- `public/clips/` (~207 MB of committed video) is tracked so the deployed app is
  self-contained — revisit if the repo gets unwieldy (Git LFS or a CDN).

Verified in-browser: gallery, seeding, video playback, status change + reorder. Camera
recording and backup import not runtime-tested (need a real device / camera).
