# Tetris on the Lattice — "experimental" corner affordance

**Date:** 2026-07-24 · **Status:** approved (operator pre-approved implementation through PoC)

## Summary

Add a fourth corner affordance (bottom-left, flask icon) opening a small flyout menu of
**experiments**. The first experiment: a zero-player, continuous Tetris whose board is a
sub-window of the 64×64 lattice. Tetrominoes fall in lattice (u,v) space, settle into a stack,
and full lines flash → dissolve with a particle burst — all deformed in 3-D because the cell
geometry samples the sheet's own shared position buffer. Fake SOM, meet fake Tetris.

## Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Playable? | **Zero-player** — plays itself forever |
| Board mapping | **Sub-window patch** at native lattice resolution; rest of sheet untouched |
| Button UX | **Flyout menu** listing experiments with on/off toggles (`tetris` first) |
| Cell colors | **Palette-native** — 7 piece types = 7 stations on the active colormap ramp; falling piece sparkle-hot |
| Rendering | **A: quad overlay mesh sampling the shared `positions` buffer** |

## 1. Corner affordance + flyout menu

- New `<button id="exp" class="corner bl">` with a flask SVG matching the existing 22px stroke icons.
- Registered through the existing `addCorner(el, isOpen)` — proximity fade, touch reveal,
  reduced-motion handling all inherited. `isOpen` returns menu-open so the icon stays lit.
- Flyout `<div id="expMenu">` anchored above the button, styled like the panel/about surfaces
  (dark glass, thin border). One row per experiment: name + on/off state. Rows toggle their
  experiment; menu closes on outside-click or `Esc`.
- Add `#exp, #expMenu` to the `overUI()` selector so interacting with them doesn't spawn ripples.

## 2. Game simulation (board space, no 3-D knowledge)

- Board: **10 wide × 20 tall**, `Uint8Array(200)`, values 0 (empty) or 1–7 (piece type).
- Pieces: the 7 tetrominoes with standard rotation tables (simple offset lists; no SRS kicks needed
  for a zero-player game — the policy only picks reachable placements).
- Randomizer: **7-bag**.
- Gravity: piece drops one row per tick, `CONFIG.tetris.tickMs` (default 350ms), driven by the
  main animation clock (so `space` pause freezes it).
- **Auto-placement policy:** on spawn, enumerate all (rotation × column) resting placements,
  score = −(holes created)·a − (resulting max height)·b + (lines completed)·c; pick randomly among
  the top few, with `CONFIG.tetris.flawRate` probability of taking a deliberately mediocre
  placement so the stack breathes. The piece then falls tick-by-tick into the chosen column/rotation
  (rotation applied at spawn; horizontal drift animated over the first ticks — no teleporting).
- Full rows: enter clear animation (§4), then rows above shift down.
- Top-out (spawn blocked): every occupied cell dissolves with the clear FX; board resets; play
  continues. One continuous game — no score, no game-over screen.

## 3. Board → lattice mapping

- The patch occupies lattice cells **u ∈ [27, 37), v ∈ [20, 40)** (10×20 cells, 11×21 vertices),
  horizontally centered. Constant offsets: `latU = 27 + col`, `latV = 20 + row`.
- "Down" (increasing row) = **+v** on the lattice, so falling follows the folded surface.
- Board state and mapping never change with shape morphs — deformation comes entirely from the
  position buffer at render time.

## 4. Rendering — cell-quad overlay (approach A)

- One `THREE.Mesh` with 200 quads (2 tris each), own `Float32Array` position buffer over the
  patch's 231 vertices, indexed like the wire grid.
- Per frame (only while the experiment is on): copy those 231 vertices from the shared deformed
  `positions` array, offset **~0.004 along the per-vertex normal** (already computed for wobble)
  to float just above the wire. All sheet motion — fold, wobble, ripples — transfers exactly.
- Per-cell color/alpha via vertex-color + alpha attributes (4 corner vertices per quad are
  duplicated per-cell in the color attribute — cells are flat-colored, no bleeding).
  - Piece type t (1–7) → colormap ramp at `t/8` using the active scientific colormap; when
    colormap = `none`, a 7-step teal→amber ladder.
  - Falling piece: sparkle-hot brightness (like `nodeHot`); settled stack dimmed by
    `CONFIG.tetris.dimStack` (default 0.55).
- Material: `transparent`, `depthWrite:false`, additive-leaning blending, rendered after the wire.
- Experiment off → `mesh.visible = false`, sim doesn't tick, per-frame cost zero.

## 5. Line-clear / dissolve FX

1. **Flash** (~150ms): cleared cells ramp to hot white-amber.
2. **Dissolve** (~400ms): cell alpha eases to 0 while a one-shot particle burst (reusing the dust
   point-cloud idiom — a small dedicated `THREE.Points` buffer, ~`CONFIG.tetris.particleCount`
   per cell) ejects from each cleared cell center along the surface normal with slight tangential
   scatter, fading as it flies.
3. **Collapse** (~200ms): rows above glide down — cells re-map to lower rows with an eased
   v-offset interpolating along the lattice, so they slide along the surface.
- Top-out reuses steps 1–2 on all occupied cells simultaneously.
- `prefers-reduced-motion`: no particles; rows fade out/in without glide.

## 6. Config + panel

```js
CONFIG.tetris = {
  tickMs: 350,        // gravity interval
  flawRate: 0.15,     // chance of a mediocre placement
  clearFlashMs: 150,
  dissolveMs: 400,
  collapseMs: 200,
  particleCount: 6,   // per cleared cell
  dimStack: 0.55,     // settled-stack brightness vs falling piece
};
```

- A `tetris` folder in the Tweakpane panel binds these (lazy-built like the rest).
- Experiment on/off is session-only; fresh loads start with all experiments off.

## 7. Edge behavior

- `space` pause: sim clock freezes (it runs off the shared animation clock).
- `r` reseed / shape skips / colormap changes: game unaffected (colors recompute from the ramp).
- Reduced motion: experiment usable; FX simplified per §5.
- CDN failure of Three.js already kills the whole app; no new failure surface (no new deps).

## Testing

- Local server (`python3 -m http.server`) + Playwright: toggle the experiment via the corner menu,
  run ~30s, screenshot flat and folded states; verify pause, colormap recolor, menu toggle off
  (mesh hidden), reduced-motion render.
- Sim sanity: in-page console harness — deal 3 full bags (21 pieces), assert bag distribution,
  line detection on a hand-built board, top-out reset.

## Out of scope

- Playable controls, scoring, hold/next-piece UI, SRS wall kicks.
- Persistence of experiment state.
- Additional experiments (menu is built to receive them later).
