# Tetris Play — board visibility bias (A + D) + superformula fast-pass

**Date:** 2026-07-24 · **Status:** approved (A + D; operator added: superformula much shorter)
**Builds on:** `2026-07-24-tetris-play-pacing-design.md`

All behaviors play-mode only; ambient/auto untouched.

## A. Board-tracking camera

- Each frame (in `updateTetrisFrame`), sample 9 board-patch points (pu ∈ {1,5,9} × pv ∈
  {2,10,18}) from the live deformed positions → board centroid `tetrisBoardC` and mean normal
  `tetrisBoardN` (normalized; sign-flipped to agree with the centroid direction so
  inward-oriented parameterizations can't cancel it).
- New eased weight `tetrisTrackW` → `CONFIG.tetris.trackStrength` (default 0.85) while play is
  on and `phase !== 'holdFlat'` (the flat beat keeps its existing frontal homing), else → 0.
  Ease rate 0.04/frame.
- In `updateCamera`, after the flat-beat homing: home `angUsed` toward the horizontal bearing
  of `centroid + sign·normal` by `tetrisTrackW` (shortest-arc wrap, same idiom).
- **Look-at bias:** `CONFIG.tetris.lookAtBias` (default 0.25) — `camera.lookAt` lerps from the
  origin toward the board centroid by `max(tetrisStageW, tetrisTrackW) · lookAtBias`, drifting
  the board toward screen center.
- Panel bindings: `trackStrength` (0–1 step 0.05, 'board track'), `lookAtBias` (0–0.6 step
  0.05, 'board center').

## D. Per-shape re-anchoring

- `TETRIS_PLAY_PHASE = { torus: { dv: 0.5 } }` — fractional (u,v) phase shifts applied inside
  `sampleShape` when play is on. Torus: `ph = v·TAU` puts board rows v 20–40 across the inner
  throat (ph ≈ 114–229°); +0.5 v-shift lands them on the outer equator. Seamless: the torus is
  closed in v (the sheet seam relocates, which it does anyway).
- Offsets apply at target build time. `setTetrisMode` rebuilds targets (A and B) on toggle
  **only when the sheet is near flat** (`morphT < 0.05 · duration`) to avoid a folded-state
  jump; otherwise the offset lands at the next shape switch.

## Superformula fast-pass

- `TETRIS_PLAY_SHAPE_SPEED = { superformula: 2.5 }` — in `advanceTimeline` (play only), the
  fold/unfold `mdt` is additionally multiplied by the current shape's factor, and the folded
  hold is divided by it. Net: superformula fold ≈ 2.8 s, hold ≈ 0.8 s, unfold ≈ 2.8 s (vs
  7/2/7 for other shapes) — it flashes by instead of confusing the board.

## QA hooks

`window.__camAng = () => atan2(camera.position.x, camera.position.z)` for tracking assertions.

## Testing

- Play + torus: after a fold completes, board renders on the outer equator (screenshot) and
  `|wrap(__camAng − boardBearing)|` settles < 0.7 rad; ambient torus unchanged (screenshot).
- Superformula in play passes in ≈ 6.5 s total vs ≈ 16 s for torus (phase-sampled timings).
- Regression: flat-beat homing still frontal; ambient orbit free; pause; no page errors.
