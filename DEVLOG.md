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

## 2026-09-16 — Practice timer, and dropping the offline toggle

`setTimeout` was rejected for the 5-minute chime: mobile throttles background timers,
so the sound would land late or not at all. The chime is instead scheduled on the
audio clock (`osc.start(ctx.currentTime + 300)`), which the audio thread drives
independently of JS timers, with a wake lock to keep the page from being backgrounded
in the first place. Because iOS suspends a hidden `AudioContext` — and a suspended
context's scheduled events don't fire on time — there is also a tick/`visibilitychange`
fallback that replays the chime on return. Timer state is deliberately component-local,
not in Dexie: nothing asks for it to survive a reload.

Verified with a patched `OscillatorNode.prototype.start` in the browser: context
running after the tap, three beeps scheduled at the end timestamp, and the fallback
firing exactly once after a forced `ctx.suspend()`. Still unverified: whether the chime
is *audible* on the phone, and behaviour under a real screen lock (only `ctx.suspend()`
was simulated). That is the thing to check first if it misbehaves.

The per-move "Available offline" toggle is gone, but the Workbox `clip-videos`
runtime cache stays — that rule is what makes clips play at all on repeat visits, and
removing it would have broken offline playback rather than simplifying it. `clipUrl`
moved from the deleted `src/offline.ts` to `App.tsx`; it was never offline-specific.

## 2026-09-22 — The clip-saving freeze names itself (partly)

The failure the last entry left open finally produced evidence: "Saving…" stuck
forever, then the gallery stuck on "Loading…". Both are one mechanism — a closed or
blocked IndexedDB connection leaves Dexie operations *pending forever*, neither
resolving nor rejecting. That defeats the `guard()` wrapper added last time, which
only catches rejections, and it defeats `useLiveQuery`, which signals "loading" and
"wedged" identically by staying `undefined`. The self-reporting built last session
was structurally unable to see this class of failure.

Auto-reopening on Dexie's `close` event was tried and then bounded to a single
attempt: Dexie fires `close` when it closes the connection itself, so an
unconditional reopen can cycle close → open → blocked → close on exactly the device
already in trouble. It is also near-useless — reopening does not revive live queries
that were pending when the connection died. The load-bearing fix is the 5s
`useStalled` timeout that turns an eternal "Loading…" into a Reload button; the
reopen is a courtesy.

Root cause is *still* unknown: connection death (another tab, storage reclaim) versus
a large blob write hitting quota trouble. Not distinguishable from source, and not
reproducible here — no camera, and it needs a real phone under real storage pressure.
So a failed save now appends `db open/closed, storage NMB used of NMB` to the toast.
That string on the next occurrence is what settles it.

Left unfixed deliberately: `ClipRecorder`'s camera effect stops all stream tracks on
cleanup, so if that runs while `MediaRecorder` is flushing its last chunk, `onstop`
can yield a *truncated* blob. The `size === 0` guard catches empty, not short. It is
a separate bug from the freeze and was not what was reported.
