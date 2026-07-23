# hokankoushi — interpolating lattice

**Live:** https://jelaludo.github.io/hokankoushi/

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
- Four proximity-revealed corner affordances (controls, explanation, next shape).
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
to reveal its control (gear = settings, book = explanation, ⏭ = next shape).
