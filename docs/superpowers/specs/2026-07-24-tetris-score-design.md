# Tetris — line-clear score (3×5 pixel digits, top-left)

**Date:** 2026-07-24 · **Status:** approved (build straight through to deploy)

## Requirement

A score at the top-left of the canvas counting cleared lines, rendered with the operator's
3×5 pixel digit font.

## Decisions

- **Element:** `<canvas id="score">` fixed at (14, 14), z-index 15, pointer-events none, same
  drop-shadow as the corner icons. 2D context, drawn at min(devicePixelRatio, 2). Pixel cell
  4 px, 1 px gap, 1 column (5 px) between digits, fill `rgba(255, 233, 163, 0.85)` (amber).
- **Font:** operator glyphs verbatim for 1–9; 0 from the right half of the "10" glyph:

```
0 ###  1 .#.  2 ###  3 ###  4 #.#  5 ###  6 ###  7 ###  8 ###  9 ###
  #.#    .#.    ..#    ..#    #.#    #..    #..    ..#    #.#    #.#
  #.#    .#.    ###    ###    ###    ###    ###    ..#    ###    ###
  #.#    .#.    #..    ..#    ..#    ..#    #.#    ..#    #.#    ..#
  ###    .#.    ###    ###    ..#    ###    ###    ..#    ###    ###
```

- **Counting:** `tetris.lines` increments by `full.length` in `lock()`. Auto and play both
  score. Top-out neither counts nor resets. `reset()` zeroes it (fresh enable from off).
- **Redraw:** `updateTetrisFrame` compares `tetris.lines` to the last drawn value; repaint only
  on change. `setTetrisMode` shows/hides the element and paints the initial value.
- **HUD collision:** while the score is visible, `body.score-on #hud { top: 60px; }` shifts the
  debug HUD down.

## Testing

Playwright: enable play, seed a near-full row, hard-drop the finisher → counter 1 and canvas
non-blank; double clear → 3; auto mode accrues on its own; toggle off hides; fresh re-enable
resets to 0.

## Amendment (operator correction, same day)

The score is rendered **on the neural sheet**, not as a DOM overlay: a lattice patch at the
sheet's top-left (origin u=2, v=2), 15×5 cells = up to 4 digits (3 columns + 1 gap each,
display clamped at 9999). Same cell-quad idiom as the board — quads sample the shared deformed
`positions` buffer with normal lift and share the board mesh's material — so the digits fold,
wobble and ripple with the sheet. Lit cells `CONFIG.palette.nodeHot` at alpha 0.92, unlit
alpha 0. Repaint on count change (and on palette change). The DOM `<canvas id="score">`, its
CSS and the HUD-shift rule are removed.
