# Tetris on the Lattice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bottom-left "experimental" corner affordance opening a flyout menu whose first entry toggles a zero-player Tetris played on a 10×20 sub-window of the 64×64 lattice, cells deforming with the sheet, lines clearing with flash→dissolve→particle FX.

**Architecture:** All code lives in `index.html` (the app is a single self-contained file — follow that convention). Three additive units: (1) UI — corner button + flyout registry; (2) `tetris` sim — pure board-space logic, no 3-D knowledge, exposed as `window.__tetris` for headless checks; (3) overlay renderer — one custom-shader quad mesh whose 800 vertices sample the shared deformed `positions` buffer each frame, plus a pooled particle burst layer.

**Tech Stack:** Vanilla ES modules, Three.js via existing CDN import map. No new dependencies. Verification: `python3 -m http.server` + Playwright (installed in `/Users/minikai/Dev/01-kai-meta/node_modules`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-tetris-lattice-design.md` — decisions there are final.
- Single file: all changes to `index.html`; no build step, no new deps.
- Board 10×20 at lattice patch `u∈[27,37)`, `v∈[20,40)`; "down" = +v.
- `CONFIG.tetris = { tickMs:350, flawRate:0.15, clearFlashMs:150, dissolveMs:400, collapseMs:200, particleCount:6, dimStack:0.55 }` — exact names.
- Experiment off ⇒ zero per-frame cost (`mesh.visible=false`, sim not ticked).
- Pause (`space`) freezes the sim (drive it off the shared `clock`/`dt` gated by `!paused`).
- Reduced motion: no particles, no glide; rows fade.
- Commit after each task; author Kai Denrei (already the repo-local config).

---

### Task 1: Corner button + experiments flyout

**Files:** Modify `index.html` — CSS block (`.corner` rules ~line 27–41), HTML corner buttons (~line 108–130), `overUI()` (~line 1246), `addCorner` registrations (~line 1314).

**Interfaces:**
- Produces: `const experiments = { tetris: { label: 'tetris', on: false, toggle(on) {} } }` — Task 3 overwrites `toggle`. Produces `#exp` button + `#expMenu` flyout.
- Menu row click flips `on`, calls `toggle(on)`, updates row text.

- [ ] **Step 1: CSS** — after the `.corner.bl` rule add:

```css
#exp.open { color: #ffe9a3; }
#expMenu {
  position: fixed; left: 14px; bottom: 52px; z-index: 12; display: none;
  background: rgba(10, 14, 16, 0.92); border: 1px solid rgba(122, 180, 170, 0.18);
  border-radius: 8px; padding: 6px 4px; min-width: 132px; backdrop-filter: blur(6px);
}
#expMenu.open { display: block; }
#expMenu .xrow {
  display: flex; justify-content: space-between; gap: 14px; align-items: baseline;
  padding: 5px 10px; border-radius: 5px; cursor: pointer;
  font: 11px/1.3 ui-monospace, monospace; color: #9fb8b2; user-select: none;
}
#expMenu .xrow:hover { background: rgba(122, 180, 170, 0.08); color: #ffe9a3; }
#expMenu .xrow .state { color: #4a5a56; }
#expMenu .xrow.on .state { color: #ffe9a3; }
```

- [ ] **Step 2: HTML** — after the `#aboutBtn` button add a flask-icon button + menu (same 22px stroke style):

```html
<button id="exp" class="corner bl" aria-label="experimental" title="experimental">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 2v6.3L4.6 17.6A2.4 2.4 0 0 0 6.7 21h10.6a2.4 2.4 0 0 0 2.1-3.4L14 8.3V2"/>
    <path d="M8.5 2h7"/><path d="M7.3 15h9.4"/>
  </svg>
</button>
<div id="expMenu" role="menu" aria-label="experiments"></div>
```

- [ ] **Step 3: JS** — near the `addCorner` registrations:

```js
// Experiments registry — the bottom-left flask opens this menu. Each entry's
// toggle(on) is wired by its own layer (tetris installs its real one later).
const experiments = { tetris: { label: 'tetris', on: false, toggle() {} } };
const expBtn = document.getElementById('exp'), expMenu = document.getElementById('expMenu');
let expOpen = false;
function renderExpMenu() {
  expMenu.innerHTML = '';
  for (const [key, x] of Object.entries(experiments)) {
    const row = document.createElement('div');
    row.className = 'xrow' + (x.on ? ' on' : '');
    row.innerHTML = '<span>' + x.label + '</span><span class="state">' + (x.on ? 'on' : 'off') + '</span>';
    row.addEventListener('click', () => { x.on = !x.on; x.toggle(x.on); renderExpMenu(); });
    expMenu.appendChild(row);
  }
}
function setExpOpen(open) {
  expOpen = open;
  expMenu.classList.toggle('open', open);
  expBtn.classList.toggle('open', open);
  if (open) renderExpMenu();
}
expBtn.addEventListener('click', () => setExpOpen(!expOpen));
window.addEventListener('pointerdown', (e) => {
  if (expOpen && !e.target.closest('#exp, #expMenu')) setExpOpen(false);
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && expOpen) setExpOpen(false); });
addCorner(expBtn, () => expOpen);
```

- [ ] **Step 4:** extend `overUI()` selector with `, #exp, #expMenu` and the about-modal Escape handler must not conflict (exp handler checks `expOpen` only). Verify (`python3 -m http.server` + Playwright): click bottom-left corner → menu shows `tetris off`; click row → `on`; outside click closes; no ripple spawns over the menu.
- [ ] **Step 5:** Commit `feat: experimental corner + flyout menu`.

### Task 2: Zero-player sim core

**Files:** Modify `index.html` — new section before the "Timeline state machine" section.

**Interfaces:**
- Produces: `tetris` object — `board` (Uint8Array(200), row-major, row 0 = top), `W=10, H=20`, `active` ({type 1–7, rot, col, row, targetCol, targetRot} | null), `state` ('falling'|'clearing'|'collapsing'), `clearingRows` (int[]), `clearStart` (clock s), `collapseStart`, `dirty` (bool — render must refresh colors), `step(clock)` (advance sim; call only when experiment on and !paused), `reset()`. Also `TETRO` rotation tables and `window.__tetris` (the object) for QA.
- Consumes: `CONFIG.tetris` (Task 5 adds it; until then use inline defaults via `CONFIG.tetris ||= {...}` guard at the top of the section — Task 5 replaces the guard with the real block).

- [ ] **Step 1: implement** — the complete sim (rotation tables as offset lists; 7-bag; greedy policy with flaws; move-then-fall; line detection; top-out):

```js
// ── Experiment: zero-player Tetris in board space (no 3-D knowledge) ─────────
// Fake SOM, meet fake Tetris: pieces fall and lines clear with nobody playing.
const TETRO = {              // [type] = rotations; each rotation = 4 [x, y] cells
  1: [[[0,1],[1,1],[2,1],[3,1]], [[2,0],[2,1],[2,2],[2,3]]],                                   // I
  2: [[[1,0],[2,0],[1,1],[2,1]]],                                                              // O
  3: [[[1,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[2,1],[1,2]], [[0,1],[1,1],[2,1],[1,2]], [[1,0],[0,1],[1,1],[1,2]]], // T
  4: [[[1,0],[2,0],[0,1],[1,1]], [[1,0],[1,1],[2,1],[2,2]]],                                   // S
  5: [[[0,0],[1,0],[1,1],[2,1]], [[2,0],[1,1],[2,1],[1,2]]],                                   // Z
  6: [[[0,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[0,2],[1,2]]], // J
  7: [[[2,0],[0,1],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,1],[0,2]], [[0,0],[1,0],[1,1],[1,2]]], // L
};
const tetris = {
  W: 10, H: 20, board: new Uint8Array(200), bag: [], active: null,
  state: 'falling', clearingRows: [], clearStart: 0, collapseStart: 0,
  lastTick: 0, dirty: true,
  cellAt(c, r) { return (c < 0 || c >= 10 || r >= 20) ? 1 : (r < 0 ? 0 : this.board[r * 10 + c]); },
  fits(type, rot, col, row) {
    for (const [x, y] of TETRO[type][rot]) if (this.cellAt(col + x, row + y)) return false;
    return true;
  },
  nextType() {
    if (!this.bag.length) { this.bag = [1,2,3,4,5,6,7]; for (let i = 6; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]]; } }
    return this.bag.pop();
  },
  dropRow(type, rot, col) {           // landing row for a piece dropped in col (may start above board)
    let row = -2;
    if (!this.fits(type, rot, col, row)) return null;
    while (this.fits(type, rot, col, row + 1)) row++;
    return row;
  },
  plan(type) {                        // greedy scored placement, deliberately imperfect
    const opts = [];
    for (let rot = 0; rot < TETRO[type].length; rot++)
      for (let col = -2; col < 10; col++) {
        const row = this.dropRow(type, rot, col);
        if (row === null) continue;
        // simulate lock on a copy
        const b = this.board.slice();
        for (const [x, y] of TETRO[type][rot]) if (row + y >= 0) b[(row + y) * 10 + col + x] = type;
        let lines = 0;
        for (let r = 0; r < 20; r++) { let full = true; for (let c = 0; c < 10; c++) if (!b[r * 10 + c]) { full = false; break; } if (full) lines++; }
        let holes = 0, aggH = 0;
        for (let c = 0; c < 10; c++) {
          let seen = false;
          for (let r = 0; r < 20; r++) {
            if (b[r * 10 + c]) { if (!seen) { seen = true; aggH += 20 - r; } }
            else if (seen) holes++;
          }
        }
        opts.push({ rot, col, score: lines * 40 - holes * 12 - aggH * 0.8 });
      }
    if (!opts.length) return null;
    opts.sort((a, b) => b.score - a.score);
    const T = CONFIG.tetris;
    const pool = Math.random() < T.flawRate ? opts.slice(0, Math.min(8, opts.length)) : opts.slice(0, Math.min(3, opts.length));
    return pool[(Math.random() * pool.length) | 0];
  },
  spawn(clock) {
    const type = this.nextType();
    const p = this.plan(type);
    if (!p || !this.fits(type, p.rot, 3, -2)) {   // top-out: dissolve everything, keep going
      this.state = 'clearing'; this.clearingRows = []; this.clearStart = clock; this.topOut = true;
      this.active = null; return;
    }
    this.active = { type, rot: p.rot, col: 3, row: -2, targetCol: p.col };
    if (!this.fits(type, p.rot, 3, -2)) this.active.col = p.col;  // cramped spawn: start at target
  },
  step(clock) {                       // one gravity/animation step driver — call from frame()
    const T = CONFIG.tetris;
    if (this.state === 'clearing') {
      if ((clock - this.clearStart) * 1000 >= T.clearFlashMs + T.dissolveMs) {
        if (this.topOut) { this.board.fill(0); this.topOut = false; this.state = 'falling'; }
        else { this.collapseStart = clock; this.state = 'collapsing'; }
        this.dirty = true;
      }
      return;
    }
    if (this.state === 'collapsing') {
      if ((clock - this.collapseStart) * 1000 >= T.collapseMs) {
        // drop rows above each cleared row (process bottom-up)
        for (const cr of this.clearingRows.slice().sort((a, b) => a - b))
          for (let r = cr; r > 0; r--) this.board.copyWithin(r * 10, (r - 1) * 10, r * 10);
        this.board.fill(0, 0, 10 * 0 + 10 * this.clearingRows.filter(r => r === 0).length || 0);
        this.clearingRows = []; this.state = 'falling'; this.dirty = true;
      }
      return;
    }
    if (clock - this.lastTick < T.tickMs / 1000) return;
    this.lastTick = clock;
    if (!this.active) { this.spawn(clock); this.dirty = true; return; }
    const a = this.active;
    if (a.col !== a.targetCol) {      // move-then-fall toward the planned column
      const dir = a.targetCol > a.col ? 1 : -1;
      if (this.fits(a.type, a.rot, a.col + dir, a.row)) a.col += dir;
    }
    if (this.fits(a.type, a.rot, a.col, a.row + 1)) { a.row++; this.dirty = true; return; }
    // lock
    for (const [x, y] of TETRO[a.type][a.rot]) if (a.row + y >= 0) this.board[(a.row + y) * 10 + a.col + x] = a.type;
    this.active = null;
    const full = [];
    for (let r = 0; r < 20; r++) { let f = true; for (let c = 0; c < 10; c++) if (!this.board[r * 10 + c]) { f = false; break; } if (f) full.push(r); }
    if (full.length) { this.state = 'clearing'; this.clearingRows = full; this.clearStart = clock; }
    this.dirty = true;
  },
  reset() { this.board.fill(0); this.bag = []; this.active = null; this.state = 'falling'; this.clearingRows = []; this.dirty = true; },
};
window.__tetris = tetris;             // QA hook (harness + Playwright)
```

Note the collapse bug-trap: the `copyWithin` shift already zeroes nothing — after shifting rows down, row 0's vacated copies remain; explicitly clear row 0 per cleared row: replace the odd `fill` line with `for (let i = 0; i < this.clearingRows.length; i++) this.board.fill(0, 0, 10);` — actually shifting for each cleared row leaves exactly one duplicated top row per clear; clearing row 0 once per cleared row is correct.

- [ ] **Step 2: verify headless** — Playwright `page.evaluate`: build a board with row 19 missing one cell, drop pieces until it clears; assert 3 bags deal 21 pieces with each type ×3; assert `plan()` returns in-bounds placements for all types; force top-out (fill columns) → after clear window, board is all zeros and state 'falling'.
- [ ] **Step 3:** Commit `feat: zero-player tetris sim core`.

### Task 3: Overlay mesh — cells on the deformed sheet

**Files:** Modify `index.html` — after the dust layer setup; per-frame hook in `frame()` right after `updatePositions(...)`; wire `experiments.tetris.toggle`.

**Interfaces:**
- Consumes: `tetris` (Task 2), shared `positions`, `COLS`, `basePos`, `CONFIG.palette.colormap`, `clock`, `paused`, `reduce`.
- Produces: `initTetrisMesh()`, `updateTetrisFrame(clock)` (samples positions, writes cell geometry + colors), `tetrisMesh` (THREE.Mesh), `PIECE_RGB` recompute on colormap change (`refreshTetrisColors()` called from the colormap panel binding and `applyPalette`).

Key constants: `BU0 = 27`, `BV0 = 20` (patch origin); cell (c,r) corners = lattice vertices `(BU0+c, BV0+r)`…`(BU0+c+1, BV0+r+1)`; vertex index `v * COLS + u`. 800 mesh vertices (4 per cell, duplicated for flat color), 1200 indices. Fractional row (collapse glide) uses `patchPoint(u, vFloat)` linear interp between rows.

- [ ] **Step 1: JS colormaps** — port the four GLSL polynomial colormaps (coefficients verbatim from the node shader) + the base→hot ladder:

```js
const CM_COEF = {   // Matt Zucker polynomial approximations — same numbers as the node shader
  viridis: [[0.2777,0.0054,0.3341],[0.1051,1.4046,1.3846],[-0.3308,0.2148,0.0951],[-4.6342,-5.7991,-19.3324],[6.2283,14.1799,56.6906],[4.7764,-13.7451,-65.3530],[-5.4355,4.6459,26.3124]],
  inferno: [[0.0002,0.0017,-0.0195],[0.1065,0.5640,3.9327],[11.6025,-3.9729,-15.9424],[-41.7040,17.4364,44.3541],[77.1629,-33.4024,-81.8073],[-71.3194,32.6261,73.2095],[25.1311,-12.2427,-23.0703]],
  magma:   [[-0.0021,-0.0007,-0.0054],[0.2517,0.6775,2.4940],[8.3537,-3.5777,0.3145],[-27.6687,14.2647,-13.6492],[52.1761,-27.9436,12.9442],[-50.7685,29.0466,4.2342],[18.6557,-11.4898,-5.6020]],
  turbo:   [[0.1141,0.0629,0.2248],[6.7164,3.1823,7.5716],[-66.0940,-4.9280,-10.0944],[228.7661,25.0499,-91.5411],[-334.8352,-69.3175,288.5859],[218.7637,67.5215,-305.2046],[-52.8890,-21.5453,110.5175]],
};
function cmapJS(name, t) {
  const C = CM_COEF[name];
  if (!C) { const a = new THREE.Color(CONFIG.palette.nodeBase), b = new THREE.Color(CONFIG.palette.nodeHot); return a.lerp(b, t); }
  let r = 0, g = 0, bl = 0;
  for (let i = 6; i >= 0; i--) { r = r * t + C[i][0]; g = g * t + C[i][1]; bl = bl * t + C[i][2]; }
  return new THREE.Color(Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, bl)));
}
let PIECE_RGB = [];
function refreshTetrisColors() {   // 7 stations along the active ramp; type t → t/8
  PIECE_RGB = [null];
  for (let t = 1; t <= 7; t++) PIECE_RGB.push(cmapJS(CONFIG.palette.colormap, t / 8));
  if (tetris) tetris.dirty = true;
}
refreshTetrisColors();
```

- [ ] **Step 2: mesh** — geometry (800 verts: position 3f dynamic, aColor 4f dynamic), index buffer, tiny ShaderMaterial (`attribute vec4 aColor; varying vColor; gl_FragColor = vColor` + FogExp2 term like the nodes), `transparent: true, blending: THREE.NormalBlending, depthWrite: false`, `visible = false`, `frustumCulled = false`. `patchPoint(out, u, vFloat)` samples `positions` with row interp; per-vertex normal via the wobble loop's tangent-cross idiom on `positions`; offset `0.004`.
- [ ] **Step 3: per-frame** — `updateTetrisFrame(clock)`: build render cells = settled board (dim `T.dimStack`, clearing rows flash/dissolve per Task 4) + active piece (bright, alpha 1); write positions every frame (deformation!), colors only when `tetris.dirty` or during clear/collapse animation. Hook in `frame()` after `updatePositions(...)`:

```js
if (experiments.tetris.on) {
  if (!paused) tetris.step(clock);
  updateTetrisFrame(clock);
}
```

- [ ] **Step 4: toggle** — `experiments.tetris.toggle = (on) => { if (on && !tetrisMesh) initTetrisMesh(); if (tetrisMesh) tetrisMesh.visible = on; if (tetrisParticles) tetrisParticles.visible = on; if (on) { tetris.reset(); tetris.lastTick = clock; } if (reduce) { tetris.step(clock); updateTetrisFrame(clock); renderReducedStatic(); } };` — lazy init keeps startup untouched.
- [ ] **Step 5: hook color refresh** — call `refreshTetrisColors()` inside the panel's colormap binding change handler and in `applyPalette()`.
- [ ] **Step 6: verify** — Playwright: enable via menu, wait 8s, assert `__tetris.board.some(v=>v>0) || __tetris.active`, screenshot flat + folded (`?freeze=1` param exists? use natural timeline), toggle off → `tetrisMesh.visible === false`. Screenshot shows colored blocks riding the folded surface.
- [ ] **Step 7:** Commit `feat: tetris overlay mesh on the deformed lattice`.

### Task 4: Clear FX — flash, dissolve, particles, glide

**Files:** Modify `index.html` — extend `updateTetrisFrame` clear/collapse rendering; add particle pool near the dust layer.

**Interfaces:**
- Consumes: `tetris.state/clearingRows/clearStart/collapseStart`, `CONFIG.tetris`, patch sampling + normals from Task 3.
- Produces: `tetrisParticles` (THREE.Points, pool 480), `spawnClearBurst(cells)` (cells = [{c, r}]), integrated into `updateTetrisFrame`.

- [ ] **Step 1: clear rendering** — in `updateTetrisFrame`, cells in `clearingRows` (or all occupied cells when `topOut`): during first `clearFlashMs` lerp RGB → white-amber `(1.0, 0.91, 0.64)`; then alpha eases 1→0 over `dissolveMs` (cubic out). Rows above cleared rows render with `vOffset = easeInOut(min(1, (clock-collapseStart)*1000/T.collapseMs)) * rowsClearedBelow(r)` during 'collapsing' (glide along the surface via fractional-row sampling). `reduce` skips the offset (rows just reappear shifted).
- [ ] **Step 2: particles** — pool of 480 `{pos, vel, life}` in a Points buffer (additive, dust-like size). On entering 'clearing' (detect edge: previous state ≠ clearing), `spawnClearBurst`: for each clearing cell, `T.particleCount` particles at the deformed cell center, `vel = normal * (0.25 + 0.2*rand) + tangentJitter*0.08`, `life = 0.7s`. Per frame: integrate, alpha = life fraction, dead particles alpha 0. Skip entirely when `reduce`.
- [ ] **Step 3: verify** — Playwright: seed a nearly-full bottom row via `__tetris.board.set(...)`, let the sim complete it; capture frames through flash/dissolve/collapse; assert board shifted (row gone) and particles alpha returns to 0; force top-out → whole board dissolves and play continues.
- [ ] **Step 4:** Commit `feat: line-clear flash/dissolve/particles + collapse glide`.

### Task 5: CONFIG + panel + integration polish

**Files:** Modify `index.html` — CONFIG block (~line 300), `ensurePanel()` folders, `overUI` (done in Task 1 — re-verify), spec/README/TODO touch-ups.

- [ ] **Step 1:** add the real `CONFIG.tetris` block (exact values from Global Constraints, with the spec's comments); delete Task 2's `||=` guard.
- [ ] **Step 2:** Tweakpane `tetris` folder: bindings for tickMs (100–1200 step 10), flawRate (0–1), dimStack (0–1), particleCount (0–12 step 1), clearFlashMs/dissolveMs/collapseMs (0–1500 step 10).
- [ ] **Step 3:** README "Features" bullet + controls note; TODO.md: mark bottom-left corner decided (experimental menu).
- [ ] **Step 4: full verify** — pause freezes falling piece; `r`/shape-skip leave the game alone; colormap switch recolors cells next frame; reduced-motion (`?reduce`) path renders a static board without errors; `bust.sh` runs. Screenshots: flat board mid-game, folded torus with the board wrapped, a line-clear burst.
- [ ] **Step 5:** Commit `feat: tetris config + panel folder`, push, verify Pages serves the new build (poll + screenshot the live URL), report PoC to operator.

## Self-Review

- Spec coverage: §1→Task 1, §2→Task 2, §3→Tasks 2/3 constants, §4→Task 3, §5→Task 4, §6→Task 5, §7 edge behavior→Tasks 3.4/4.1/5.4, Testing→each task's verify step. ✓
- Placeholders: none — every code step has real code or an exact anchored instruction. ✓
- Type consistency: `tetris.step(clock)`, `updateTetrisFrame(clock)`, `experiments.tetris.toggle(on)`, `refreshTetrisColors()` used consistently across tasks. ✓
- Known trap called out inline: row-0 duplication after `copyWithin` collapse shift (Task 2 note).
