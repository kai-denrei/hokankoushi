# Tetris Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-controllable Tetris (WASD + space desktop, swipe/tap mobile) alongside the shipped auto mode, selected via `tetris auto` / `tetris play` flyout rows.

**Architecture:** All in `index.html`. Extends the shipped `tetris` sim with a `controlled` flag + input methods (shared `lock()`), splits the `experiments` registry entry into two mutually-exclusive rows sharing one `setTetrisMode(mode)` layer manager, and adds two input adapters (keydown routing, canvas touch gestures).

**Tech Stack:** No new deps. Verification: Playwright vs `http://localhost:8799`.

**Spec:** `docs/superpowers/specs/2026-07-24-tetris-play-design.md` — decisions there are final.

## Global Constraints

- Keys (play on): `w` rotate, `a`/`d` move, `s` soft drop, `space` hard drop + captured from pause.
- Wall-kick order: [0, −1, +1] columns.
- Touch: |dx| ≥ 30 horizontal → move `floor(|dx|/40)+1` cols stepwise; dy ≥ 30 down → hardDrop; else tap → rotate; starts on `overUI` targets ignored.
- Mode switch carries the board; fresh enable resets.
- Commit per task, author Kai Denrei, branch `tetris-play`.

---

### Task 1: Sim — controlled flag + input methods

**Files:** Modify `index.html`, `tetris` object.

**Interfaces (produced):** `tetris.controlled` (bool), `tetris.lock(clock)`, `tetris.tryMove(dir)`, `tetris.tryRotate()`, `tetris.softDrop(clock)`, `tetris.hardDrop(clock)`. All input methods: no-op unless `this.active && this.state === 'falling'`; all set `this.dirty = true` on change.

- [ ] Factor the lock branch of `step()` into `lock(clock)` (write cells, `above` top-out check, full-row scan → clearing state). `step()` calls it.
- [ ] `spawn()`: when `this.controlled`, use `{ type, rot: 0, col: 3, row: -2, targetCol: 3 }` (skip `plan()`); top-out still triggers at lock via `above`.
- [ ] `step()`: skip the `col → targetCol` drift when `this.controlled`.
- [ ] Add:

```js
tryMove(dir) {
  const a = this.active;
  if (!a || this.state !== 'falling') return false;
  if (!this.fits(a.type, a.rot, a.col + dir, a.row)) return false;
  a.col += dir; a.targetCol = a.col; this.dirty = true; return true;
},
tryRotate() {
  const a = this.active;
  if (!a || this.state !== 'falling') return false;
  const nr = (a.rot + 1) % TETRO[a.type].length;
  for (const k of [0, -1, 1]) {
    if (this.fits(a.type, nr, a.col + k, a.row)) {
      a.rot = nr; a.col += k; a.targetCol = a.col; this.dirty = true; return true;
    }
  }
  return false;
},
softDrop(clock) {
  const a = this.active;
  if (!a || this.state !== 'falling') return;
  if (this.fits(a.type, a.rot, a.col, a.row + 1)) { a.row++; this.lastTick = clock; this.dirty = true; }
  else this.lock(clock);
},
hardDrop(clock) {
  const a = this.active;
  if (!a || this.state !== 'falling') return;
  while (this.fits(a.type, a.rot, a.col, a.row + 1)) a.row++;
  this.lock(clock);
},
```

- [ ] Verify headless (page.evaluate): controlled spawn at col 3 rot 0; tryMove walls clamp; tryRotate kicks at the wall; softDrop steps + resets lastTick; hardDrop locks + clears a seeded row; auto mode regression (plan drift still happens with controlled=false).
- [ ] Commit `feat: sim input methods + controlled mode`.

### Task 2: Menu split + mode handoff

**Files:** Modify `index.html` — `experiments` registry + `experiments.tetris.toggle` block.

**Interfaces (produced):** `setTetrisMode(mode)` with `mode ∈ {'off','auto','play'}`; registry rows `tetrisAuto` (label `tetris auto`), `tetrisPlay` (label `tetris play`); `tetrisMode` (module `let`, `'off'` initial). Consumed by Task 3 (`tetrisMode === 'play'` gates input) and the frame hook (`tetrisMode !== 'off'` replaces `experiments.tetris.on`).

- [ ] Replace the single registry entry:

```js
const experiments = {
  tetrisAuto: { label: 'tetris auto', on: false, toggle(on) { setTetrisMode(on ? 'auto' : 'off'); } },
  tetrisPlay: { label: 'tetris play', on: false, toggle(on) { setTetrisMode(on ? 'play' : 'off'); } },
};
```

- [ ] `setTetrisMode(mode)` (replaces the old toggle body): lazy-init mesh/particles; `wasOff = tetrisMode === 'off'`; set `tetrisMode = mode`; sync `experiments.tetrisAuto.on / tetrisPlay.on` + `renderExpMenu()` (menu may be open); mesh/particles `visible = mode !== 'off'`; `tetris.controlled = mode === 'play'`; if `mode !== 'off' && wasOff` → `tetris.reset(); tetris.lastTick = clock; tpLife && tpLife.fill(0);` (carry-over when switching auto↔play: only `controlled` flips); reduced-motion branch as before (fast-forward only `wasOff`).
- [ ] Frame hook + anywhere `experiments.tetris.on` was read → `tetrisMode !== 'off'`.
- [ ] Verify: menu shows both rows; enabling play turns auto off with board intact (seed cells, switch, assert same cells); both-off hides mesh.
- [ ] Commit `feat: tetris auto/play menu split + carry-over handoff`.

### Task 3: Keyboard + touch input

**Files:** Modify `index.html` — main keydown handler ("Input: h HUD, space pause…") and a new touch block near the pointer handlers.

- [ ] Keydown, before the existing `switch`: 

```js
if (tetrisMode === 'play' && !e.metaKey && !e.ctrlKey && !e.altKey) {
  const k = e.key === ' ' ? 'space' : e.key.toLowerCase();
  if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'space') {
    e.preventDefault();
    if (paused) return;                      // shouldn't happen (space captured), belt+braces
    if (k === 'a') tetris.tryMove(-1);
    else if (k === 'd') tetris.tryMove(1);
    else if (k === 'w') tetris.tryRotate();
    else if (k === 's') tetris.softDrop(clock);
    else tetris.hardDrop(clock);
    if (reduce) { updateTetrisFrame(clock, 0); renderReducedStatic(); }
    return;                                  // space consumed — no pause toggle
  }
}
```

- [ ] Touch adapter (after the existing pointerdown handlers):

```js
let tetrisTouch = null;
window.addEventListener('touchstart', (e) => {
  if (tetrisMode !== 'play' || overUI(e.touches[0]) || e.touches.length > 1) { tetrisTouch = null; return; }
  const t = e.touches[0];
  tetrisTouch = { x: t.clientX, y: t.clientY };
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!tetrisTouch || tetrisMode !== 'play') return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tetrisTouch.x, dy = t.clientY - tetrisTouch.y;
  tetrisTouch = null;
  if (Math.abs(dx) >= 30 && Math.abs(dx) >= Math.abs(dy)) {
    const steps = Math.floor(Math.abs(dx) / 40) + 1, dir = dx > 0 ? 1 : -1;
    for (let i = 0; i < steps; i++) if (!tetris.tryMove(dir)) break;
  } else if (dy >= 30) tetris.hardDrop(clock);
  else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) tetris.tryRotate();
  if (reduce) { updateTetrisFrame(clock, 0); renderReducedStatic(); }
}, { passive: true });
```

Note `overUI` takes an event-like with `.target` — touches carry `.target`; pass the Touch object (it has `target`). Confirm signature; adapt if needed.

- [ ] Verify (Playwright): desktop — a/d change col, w changes rot, s advances row + delays gravity, space locks + next piece spawns, space does NOT pause while play on and DOES pause after toggling play off; mobile emulation (hasTouch) — swipe right moves right, swipe down locks, tap rotates, corner tap still reveals the flask.
- [ ] Commit `feat: WASD/space + swipe/tap input for tetris play`.

### Task 4: Polish + deploy

- [ ] README: controls line gains "experiments menu: tetris auto (zero-player) / tetris play (WASD + space; swipe/tap on touch)".
- [ ] Full regression: auto mode self-plays 20s with clears possible, pause works in auto, panel tetris folder intact, reduced-motion play (keys act, static repaint).
- [ ] `bust.sh`, commit, merge `tetris-play` → main, push, poll Pages token, verify play mode on the live site (keyboard), screenshot, Telegram, vault update.

## Self-Review

- Spec coverage: sim methods → T1; menu/handoff → T2; keyboard/touch/space-capture → T3; regression/deploy → T4. Reduced-motion input repaint handled in T3 code. ✓
- Placeholders: none. Types consistent: `setTetrisMode('off'|'auto'|'play')`, `tetrisMode` read by frame hook + input. ✓
- Known trap: `overUI` expects `{target}` — Touch objects have `.target`; verified in T3 note.
