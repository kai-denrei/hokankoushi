# Tetris Play Stage Direction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In play mode only: ban 3 hard shapes from the tour, hold the flat sheet 6s, ease camera+tilt to face the viewer while flat, and stop mobile swipes from triggering browser navigation.

**Architecture:** Four localized edits to `index.html`: a ban-list filter in the three shape pickers; a play-aware holdFlat in `advanceTimeline`; a `tetrisStageW` eased weight driving an azimuth blend in `updateCamera` plus an animated `buildFlat(tilt)` rebuild; non-passive touch handlers + CSS gesture containment.

**Tech Stack:** No new deps. Verify: Playwright vs `http://localhost:8799`.

**Spec:** `docs/superpowers/specs/2026-07-24-tetris-play-stage-design.md`.

## Global Constraints

- Play-only: every behavior gates on `tetrisMode === 'play'`; ambient/auto untouched.
- Ban list exactly: `sphericalHarmonic`, `sphereBand`, `swissRoll`; manual keys/panel unrestricted.
- `CONFIG.tetris.flatHoldS = 6`, `CONFIG.tetris.playFlatTilt = 0.45`; panel bindings for both.
- Branch `tetris-play-stage`, commit per task, author Kai Denrei.

---

### Task 1: Tour ban

**Files:** Modify `index.html` — `tourNext()`, `skipToNext()`, `advanceTimeline` `nextTarget` branch.

**Interfaces:** Produces `TETRIS_PLAY_BAN` (Set) + `tourCandidates()` used by all three pickers.

- [ ] Above `tourNext()` add:

```js
const TETRIS_PLAY_BAN = new Set(['sphericalHarmonic', 'sphereBand', 'swissRoll']);
function tourCandidates() {   // play mode prunes the hard shapes; manual picks stay free
  return TARGET_NAMES.filter((n) =>
    n !== CONFIG.morph.target && !(tetrisMode === 'play' && TETRIS_PLAY_BAN.has(n)));
}
```

- [ ] `tourNext()` and `skipToNext()`: replace their `const others = TARGET_NAMES.filter((n) => n !== CONFIG.morph.target);` with `const others = tourCandidates();`.
- [ ] `advanceTimeline` `nextTarget` branch: replace the sequential pick with `const cands = tourCandidates(); if (cands.length) switchTarget(cands[(TARGET_NAMES.indexOf(currentTarget) + 1) % cands.length]);` — wait, keep it simple and behavior-compatible: advance through `cands` by index: `switchTarget(cands[0])` is a behavior change. Use: sequential scan from the current shape forward until an allowed name: 

```js
else if (m.loopMode === 'nextTarget') {
  let ni = TARGET_NAMES.indexOf(currentTarget);
  for (let s = 0; s < TARGET_NAMES.length; s++) {
    ni = (ni + 1) % TARGET_NAMES.length;
    if (!(tetrisMode === 'play' && TETRIS_PLAY_BAN.has(TARGET_NAMES[ni]))) break;
  }
  switchTarget(TARGET_NAMES[ni]);
}
```

- [ ] Verify (Playwright evaluate): with play on, 40 in-page `tourNext()` calls never yield a banned name; with auto on, all 9 names appear across 200 calls.
- [ ] Commit `feat: ban hard shapes from the tour in play mode`.

### Task 2: Flat beat + viewer angle

**Files:** Modify `index.html` — `CONFIG.tetris`, `advanceTimeline` holdFlat branch, `buildFlat`, frame loop, `updateCamera`, panel tetris folder.

**Interfaces:** Produces `tetrisStageW` (module let, 0..1) read by `updateCamera`; `buildFlat(tiltOverride?)`.

- [ ] `CONFIG.tetris` gains `flatHoldS: 6` and `playFlatTilt: 0.45` (commented). Panel: `flatHoldS` (1–20 step 0.5, label 'flat hold s'), `playFlatTilt` (0.15–0.9 step 0.01, label 'flat lean').
- [ ] `advanceTimeline` holdFlat: `if (holdT >= (tetrisMode === 'play' ? CONFIG.tetris.flatHoldS : m.holdFlat)) {`.
- [ ] `buildFlat(tiltOverride)`: `const tilt = tiltOverride !== undefined ? tiltOverride : CONFIG.lattice.flatTilt;`.
- [ ] Near the tetris overlay state: `let tetrisStageW = 0, tetrisBuiltTilt = null;` and:

```js
function updateTetrisStage() {   // ease the "face the viewer" weight during play's flat beat
  const target = (tetrisMode === 'play' && phase === 'holdFlat') ? 1 : 0;
  tetrisStageW += (target - tetrisStageW) * 0.05;
  if (tetrisStageW < 1e-3 && target === 0) tetrisStageW = 0;
  const base = CONFIG.lattice.flatTilt;
  const want = base + (CONFIG.tetris.playFlatTilt - base) * tetrisStageW;
  if (tetrisBuiltTilt === null) tetrisBuiltTilt = base;
  if (Math.abs(want - tetrisBuiltTilt) > 1e-4) { buildFlat(want); tetrisBuiltTilt = want; }
}
```

- [ ] Frame loop: call `updateTetrisStage();` just before `updateCamera(clock, gp);`.
- [ ] `updateCamera`: after `const ang = clock * c.orbitSpeed;` add:

```js
  let angUsed = ang;
  if (tetrisStageW > 1e-3) {           // play flat beat: home to the frontal vantage
    const wrap = Math.atan2(Math.sin(-ang), Math.cos(-ang));   // shortest way to ang ≡ 0 (mod 2π)
    angUsed = ang + wrap * tetrisStageW;
  }
```

and use `angUsed` in the two `position.set` sin/cos terms.
- [ ] Verify: `?perf` + play on — measure `__dbg.phase === 'holdFlat'` wall time ≈ 6s (ambient run ≈ 1.2s); screenshot play flat beat (face-on, steeper lean) vs ambient flat (unchanged); no snap entering/leaving the beat (three consecutive screenshots differ smoothly).
- [ ] Commit `feat: play-mode flat beat hold + face-the-viewer blend`.

### Task 3: Mobile swipe guard

**Files:** Modify `index.html` — CSS block, tetris touch listeners.

- [ ] CSS: add `html, body { overscroll-behavior: none; }` to the existing `html, body` rule and `touch-action: none;` to the `#c` rule.
- [ ] Touch listeners: change both tetris handlers to `{ passive: false }`; in `touchstart`, after the guards pass (game touch), call `e.preventDefault()`; add:

```js
window.addEventListener('touchmove', (e) => {
  if (tetrisTouch && tetrisMode === 'play') e.preventDefault();   // horizontal pan must not become a nav gesture
}, { passive: false });
```

- [ ] Verify: mobile emulation — dispatch cancelable TouchEvents: game swipe has `defaultPrevented === true` and still moves the piece; a touch starting on `#exp` is not prevented and the menu still opens; desktop unaffected (no errors).
- [ ] Commit `feat: contain mobile gestures during tetris play`.

### Task 4: Deploy

- [ ] README: play bullet gains "(the tour skips the most distorting shapes and rests longer on the flat sheet, angled toward you)".
- [ ] Regression sweep: auto tour timing unchanged, pause/space behavior, panel folder bindings appear.
- [ ] `bust.sh`, commit, merge → main, push, poll Pages token, verify live (play on, flat beat face-on screenshot), Telegram, vault append.

## Self-Review

- Spec §1→T1, §2/§3→T2, §4→T3, testing→each verify step + T4 sweep. ✓
- No placeholders; `tourCandidates()`/`tetrisStageW`/`buildFlat(tiltOverride)` names consistent. ✓
- T1 nextTarget step: first draft self-corrected inline to the sequential-scan version — that's the one to implement.
