# interpolating-lattice — TODO

## Next features

- [x] **Scientific colormaps (viridis / inferno / magma / turbo)** — done 2026-07-12.
  `palette.colormap` select in the colour folder; GLSL 6th-order polynomial per map (no
  texture/CDN), driven by clamped node brightness (so the cursor light ramps through it too).
  `none` keeps the base→hot teal/amber look.

- [ ] **Cursor attractor / repulsor**
  Drag (or hold) to pull the sheet toward the pointer (a gravity well) or push it away, with
  Gaussian falloff — complements the existing click ripples. Needs a world-space cursor
  (unproject the pointer onto a view-facing plane), then a per-vertex displacement in the
  shared position buffer (so wire + nodes move together, like wobble/ripples). Panel controls:
  `mouse.pull` strength (+ attract / − repel), radius, and a hold-vs-toggle mode.

## Corner affordances (four-corner scheme)

- [x] **top-right** — controls (gear → Tweakpane panel)
- [x] **bottom-right** — explanation (book → math + code)
- [x] **top-left** — force next shape (skip ⏭)
- [x] **bottom-left** — experiments (flask → flyout menu) — done 2026-07-24. First experiment:
      zero-player Tetris on a 10×20 lattice patch (spec + plan in `docs/superpowers/`).
      Parked candidates for other corners/menu rows: play/pause · hide-all-UI (pure art mode) ·
      shareable-URL snapshot of the current CONFIG · fullscreen · reseed.

## Ideas parked (from earlier brainstorm)

- [ ] Continuous shape-blend already shipped; consider a "blend both A and B through the tour".
- [ ] Curvature-based node colouring (differential geometry of the folded surface).
- [ ] Curl-noise flow advecting sparkles/wobble.
- [ ] Feedback/afterimage trails.
- [ ] Audio reactivity (FFT → intensity / spawns).
