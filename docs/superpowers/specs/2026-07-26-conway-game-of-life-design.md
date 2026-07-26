# Conway's Game of Life — third bottom-left experiment

**Date:** 2026-07-26 · **Status:** approved, implementing
**Builds on:** the experiments registry + tetris cell-mesh infrastructure (`2026-07-24-tetris-*`).

A zero-player Game of Life that runs on the **full 64×64 lattice** — the whole neural sheet becomes
the colony and folds onto shapes as it evolves. Third row in the bottom-left flask flyout, mutually
exclusive with tetris.

## Lifecycle & exclusivity

- New registry row: `experiments.conway = { label: 'game of life', on:false, toggle }`.
- `setConway(on)`:
  - on: call `setTetrisMode('off')` first (exclusivity); lazy-build `golMesh` (+ seed); start ticking;
    `golMesh.visible = true`.
  - off: `golMesh.visible = false`; stop ticking (leave state so re-enable could resume — but a fresh
    enable from off re-seeds, matching tetris's "fresh enable starts clean").
- `setTetrisMode(mode)`: when turning tetris **on**, call `setConway(false)` (guarded against
  re-entrancy) so the two layers are never both live.
- Reduced motion (`reduce`): no frame loop — seed and render a single static generation, no ticking
  (mirrors the tetris auto static path).

## State & rules

- `golCells`, `golNext`: `Uint8Array(COLS*ROWS)` (64×64 = 4096), double-buffered.
- Rules: **B3/S23**, **toroidal wrap** on the neighbor count (edges wrap both axes — thematically
  matched to the sheet folding into a torus; no edge die-off).
- Tick cadence `CONFIG.conway.tickMs` (default 120 ≈ 8 gen/s), advanced in the main loop by comparing
  `clock - golLastTick` (same idiom as the tetris gravity tick), decoupled from frame rate.
- The ambient shape tour and camera are **untouched** — Life observes the sheet; it doesn't drive
  selection, pacing, or the servo.

## Rendering

- `golMesh`: a lazy dynamic quad mesh over the lattice, same technique as `initTetrisMesh` — one quad
  per cell positioned via `patchPointInto` on the live deformed `positions` buffer (so folds, wobble,
  and ripples deform the colony for free). Cell colour from the active palette ramp (reuse the tetris
  colour path). Dead cells → alpha 0.
- **Cost scales with population, not grid size:** each frame, only *live* cells get their quad
  positions + colours rewritten; dead-cell quads are zeroed once on death. Typical live counts are a
  few hundred, comparable to existing per-frame node work.

## Seeding — "a handful of random known shapes"

- Catalog of known patterns (name → relative cell coords):
  - still lifes: block, beehive, loaf
  - oscillators: blinker, toad, beacon, pulsar, pentadecathlon
  - spaceships: glider, LWSS
  - methuselah: r-pentomino (guarantees real evolution, not instant stasis)
- `seed()`: place `CONFIG.conway.seedCount` (default 7) patterns at random grid positions with random
  orientation (one of 8 rotations/reflections), spaced to avoid heavy overlap. Randomness is varied
  per placement (no `Math.random` restriction here — this is runtime, not a workflow script).
- **Auto-reseed** when the colony dies or stagnates:
  - population reaches 0 → reseed immediately.
  - stagnation: hash each generation (cheap rolling hash of `golCells`); if no *new* hash appears
    within `CONFIG.conway.reseedIdleS` (default 8 s), reseed. Catches still-lifes (period 1) and
    short-period oscillators alike without special-casing periods.

## Interaction

- On `pointerdown` (not over UI) while Life is on: **keep the existing click ripple** (current effect)
  **and** toggle the single cell at `nearestVertex(nx, ny)` on/off, updating its quad immediately.
- Life keeps running, so clicks paint/erase into a live colony. Single-cell toggle per click.

## Panel & QA

- Tweakpane `conway` folder mirroring the tetris one: `tickMs` (30–500 step 10), `seedCount`
  (1–20 step 1), `reseedIdleS` (0–30 step 1; 0 disables stagnation reseed).
- QA hooks: `window.__golPop = () => <live count>`, `window.__golStep = () => <advance one gen>`,
  `window.__golSeed = () => <reseed>`.

## Testing

- **Rules:** seed a blinker via a test, `__golStep()` once, assert the three cells rotated 90°.
- **Wrap:** place a glider one cell from an edge; after enough steps its cells reappear on the
  opposite edge.
- **Reseed:** clear the grid (all dead), step; `__golPop()` > 0 on the next tick.
- **Interaction:** a click toggles the expected cell and also spawns a ripple.
- **Exclusivity:** enabling Conway sets both tetris rows off; enabling a tetris mode sets Conway off.
- **Reduce path:** static seeded frame renders, no page errors.
- **Perf:** 64×64 at default tick holds frame rate (population-bounded per-frame writes).

## Out of scope (future)

- Persisting/resuming a paused colony across toggles.
- A pattern picker / drawing palette beyond single-cell toggle.
- Speed/zoom controls beyond the three knobs.
