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

## 2026-09-16 — silent failures, and the quota theory that wasn't

Investigated a report that practice clips, then notes, then the whole app stopped
working. The leading hypothesis was storage quota exhaustion, and it was wrong:
loading six ~5 MB clips (matching the reported 15-second recordings) used 31.5 MB
against a 2.15 GB quota — 1.5%. Rejected the follow-on suggestion of moving clips to
a backend, since the confirmed bug is a controlled-input race that a network
round-trip makes strictly slower, at the cost of the offline-first design. Also ruled
out the Pages base path (the workflow does set `VITE_BASE`) and missing clips in the
deploy (all 57 files are committed).

The one confirmed root cause: notes and the move name wrote to IndexedDB on every
keystroke while their `value` came back from a `useLiveQuery`, so each re-render
clobbered anything typed since the last completed read. Measured 62 characters typed,
1 saved; after the debounce/local-state fix, 62/62.

Clip-saving via the camera and the original blank page are still unexplained. Neither
was reproducible here — there is no camera in this environment, and forcing the read
failure didn't work because Dexie holds the connection open against
`deleteDatabase`. Rather than keep generating hypotheses, the deliberate choice was
to make failures self-reporting (ErrorBoundary + a `guard()` wrapper on every write),
since the app previously discarded every error it produced. Next occurrence should
name itself.
