# Tetris Play — user-controllable mode

**Date:** 2026-07-24 · **Status:** approved (operator: build straight through to verified deploy)
**Builds on:** `2026-07-24-tetris-lattice-design.md` (shipped)

## Summary

Split the experiments flyout's `tetris` entry into **`tetris auto`** (the shipped zero-player
mode) and **`tetris play`** (user-controlled). Play mode: WASD + space on desktop, swipes + tap
on mobile. All controls act in **board space** — A/D/S move along the lattice patch axes, so S
is always board-down regardless of how the sheet is folded (free consequence of the existing
lattice-indexed board).

## Decisions

| Question | Decision |
|---|---|
| Keys | W rotate · A/D move · S soft drop · **space hard drop** (captures the pause binding while play is on; toggling play off restores pause) |
| Wall kick | Rotate tries in place, then col −1, then col +1 |
| Mobile | Horizontal swipe = move (1 column per ~40px), downward swipe = hard drop, tap = rotate; touches on corners/menus ignored |
| Mode switch | Auto ↔ Play are mutually exclusive menu rows; **board carries over** on switch; fresh enable from off starts clean |
| Game over | Unchanged — top-out wipes with FX, play continues |
| Score / next-piece UI | None (YAGNI) |

## Sim changes (`tetris` object)

- `controlled: false` — set true in play mode.
- `spawn()`: when `controlled`, deal the piece at `{ rot: 0, col: 3, targetCol: 3 }` (no
  planning); when the classic spawn cell is blocked, top-out check happens at lock as today.
- `step()`: when `controlled`, skip the move-toward-targetCol drift; gravity unchanged.
- New methods (all via `fits()`, no-ops unless `state === 'falling'` and `active` exists):
  - `tryMove(dir)` — col ± 1.
  - `tryRotate()` — next rotation index (mod rotations), kick order [0, −1, +1].
  - `softDrop(clock)` — one row down if it fits; also resets `lastTick` (a held S shouldn't
    double-step with gravity). If it doesn't fit, locks via the shared lock path.
  - `hardDrop(clock)` — advance to rest row, lock immediately.
- `lock(clock)` — factored out of `step()`; shared by gravity, softDrop, hardDrop.

## Modes & menu

- Registry rows: `tetris auto`, `tetris play`. Turning one on turns the other off (row toggle
  handles it; the shared layer stays on). Both off → mesh hidden, sim idle.
- Handoff keeps `board`, `active`, `bag`, `state` intact; only `controlled` flips. A piece
  mid-fall simply changes owner (auto's `targetCol` is set to the current col on
  auto→play→auto… auto re-plans on the next spawn; the in-flight piece keeps falling straight
  in auto until it locks).
- Fresh enable (both were off): `reset()` as today.

## Input

- **Keyboard** (in the existing keydown handler): when play is on and no panel/menu is open,
  `w`/`a`/`s`/`d`/`space` route to the sim and `preventDefault()`; space does NOT toggle pause.
  Key auto-repeat provides hold-to-repeat for A/D/S.
- **Touch** (canvas-level `touchstart`/`touchend` when play is on): swipe classified by the
  larger axis delta — |dx| ≥ 30px horizontal → `tryMove` by `floor(|dx|/40)+1` columns
  (direction-signed, applied one collision-checked step at a time); dy ≥ 30px downward →
  `hardDrop`; neither threshold → tap → `tryRotate`. Upward swipes do nothing. Touches whose
  start target is a corner/menu/panel (existing `overUI` selector) are ignored; the corner
  tap-reveal keeps working.

## Reduced motion

Play mode works (keys/gestures act, frame renders on each input via the static repaint path);
gravity does not run (no frame loop) — the piece falls only by S / space. Acceptable for an
experiment; not called out in UI.

## Testing

Playwright, local server: (1) enable play via menu, assert W/A/S/D/space mutate
`__tetris.active` (rot/col/row) and hard drop locks + spawns next; (2) space no longer pauses
while play is on, pauses again after toggling off; (3) auto→play handoff preserves board cells;
(4) mobile-emulated page: swipe right moves piece right, swipe down locks, tap rotates;
(5) auto mode still self-plays after the refactor (regression).
