# Tetris — session high-score (on-sheet, top-right) + shape-name label

**Date:** 2026-07-24 · **Status:** approved (build straight through to deploy)
**Builds on:** `2026-07-24-tetris-score-design.md` (+ amendment)

## 1. Session high-score

- **Game semantics change:** a game ends at top-out. `beginTopOut` banks
  `tetrisHighScore = max(tetrisHighScore, lines)`; the post-wipe fresh board starts with
  `lines = 0`. Toggling the experiment off also banks (game abandoned = game over).
- `tetrisHighScore` is a module variable — survives mode toggles/switches, dies on reload.
- **Display:** mirrored 15×5 lattice-cell patch at the top-right (u 47–62, v 2–7), digits
  **right-aligned** into the corner, same font/material/idiom as the score, **alpha 0.2**
  (80 % transparent), `nodeHot` color. Hidden while `tetrisHighScore === 0` and when the
  experiment is off. Repaints when the value (or palette) changes.
- Refactor: `makeCellPatch(cols, rows)` factory shared by the score and high-score meshes;
  `litCellsFor(n, cols, rightAlign)` + `paintCellPatch(colArr, lit, cols, alpha)` shared
  painters.

## 2. Shape-name label

- `<div id="shapeName">` fixed next to the top-left skip button (top 20 px, left 50 px),
  10 px monospace, HUD teal `#7fd8c4`, text-shadow like the HUD, pointer-events none,
  opacity transition .3 s.
- Every `skipToNext()` invocation (the only caller is the skip button) sets the label to the
  incoming shape's **display name** (reverse lookup through the panel's `SHAPE_OPTS`, so
  "swiss roll" not "swissRoll"), shows it, and hides it 2.2 s after the last click (timer
  reset on rapid cycling). Works in the reduce path too (same code path).
- DOM, not on-sheet — deliberate: it is chrome attached to a UI button, not artwork.

## Testing

Seed lines → force top-out → after the wipe: lines 0, high patch visible at low alpha,
right-aligned; a worse second game does not lower it; toggle off/on banks and keeps it;
label shows the right display name per skip and fades; score/board rendering regression.
