# hokankoushi — interpolating lattice

**Live:** https://kai-denrei.github.io/hokankoushi/

A browser animation that *looks* like a self-organizing map discovering the shape of data — a
flat lattice folds onto a 3-D target while sparkles of "activation" roam and shrink — with
**zero actual learning**. Everything is parametric interpolation plus cosmetic effects.

Single self-contained `index.html`, vanilla ES modules, no build step, Three.js via CDN import
map. One `CONFIG` object drives every visual.

## Features

- Per-vertex fold `mix(flat, target, s)` with staggered eased progress + annealing overshoot.
- Ambient wobble along the interpolated surface normal.
- Fake BMU sparkles with a shrinking neighborhood (the SOM tell), trails, and a folding-front bias.
- Nine shapes as pure `(u,v) → ℝ³` functions: torus, swiss roll, sphere band, Möbius,
  superformula, spherical harmonics, tesseract (4-D), pyramid, bipyramid — with a continuous
  A→B blend and a random no-repeat shape "tour".
- Pointer interaction: cursor light, click ripples (damped waves), camera parallax.
- Scientific colormaps (viridis / inferno / magma / turbo) for the node colour ramp.
- Four proximity-revealed corner affordances (controls, explanation, next shape, experiments).
- **Experimental (bottom-left flask):** Tetris on a 10×20 patch of the lattice — pieces fall
  along the surface, deform with every fold, and cleared lines flash, dissolve and burst
  particles off the sheet. **tetris auto** plays itself (a deliberately imperfect greedy policy
  keeps the stack breathing — fake SOM, meet fake Tetris); **tetris play** hands you the stick:
  `W` rotate · `A`/`D` move · `S` soft drop · `space` hard drop (all board-space — S is always
  board-down no matter how the sheet is folded; space returns to pause when play is off). On
  touch: swipe left/right to move, swipe down to drop, tap to rotate. The board carries over
  when switching modes. In play the tour skips the most distorting shapes and rests longer on
  the flat sheet, angled toward you; on touch, game swipes are contained so they can't trigger
  browser navigation.
- A live control panel (Tweakpane) bound to `CONFIG`; `prefers-reduced-motion` renders a static
  folded frame.

## Run locally

ES modules + import maps need HTTP (not `file://`):

```bash
python3 -m http.server
# open http://localhost:8000/index.html
```

## Controls

`h` HUD · `space` pause · `r` reseed · `1`–`9` switch shape. Sweep the pointer toward a corner
to reveal its control (gear = settings, book = explanation, ⏭ = next shape, ⚗ = experiments).
