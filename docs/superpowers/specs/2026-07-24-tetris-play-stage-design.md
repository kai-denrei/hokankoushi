# Tetris Play — stage direction (shape ban, flat beat, viewer angle, swipe guard)

**Date:** 2026-07-24 · **Status:** approved (build straight through to verified deploy)
**Builds on:** `2026-07-24-tetris-play-design.md` (shipped)

## Requirements (operator)

All behaviors apply **only while `tetrisMode === 'play'`**; ambient/auto behavior is untouched.

1. **Tour ban.** The shape tour never lands on `sphericalHarmonic`, `sphereBand`, `swissRoll`.
   Applies to `tourNext()`, `skipToNext()` and the `nextTarget` loop path. Manual overrides
   (keys 1–9, panel dropdown) remain unrestricted. A banned shape already on screen when play
   toggles on finishes its cycle and doesn't return.
2. **Longer flat beat.** `CONFIG.tetris.flatHoldS = 6` seconds at flat (ambient stays
   `CONFIG.morph.holdFlat` = 1.2 s). Panel binding in the tetris folder (1–20 s).
3. **Angled toward the viewer.** A single eased weight `w` (target 1 during `phase === 'holdFlat'`
   in play, else 0; rate ~0.05/frame) drives:
   - camera azimuth eased to the nearest frontal multiple (`ang + wrapPi(-ang) * w`) so the
     sheet's lean faces the lens; orbit resumes seamlessly as `w` falls;
   - sheet lean eased `0.15 → CONFIG.tetris.playFlatTilt = 0.45` rad; `buildFlat(tilt)` gains an
     optional tilt argument and is re-run only while the animated tilt actually changes
     (>1e-4 delta). `mix(flat, target, s)` propagates it with no other plumbing.
4. **Mobile swipe guard.** While play is on, game touches must not trigger browser navigation /
   app-switch gestures:
   - CSS (unconditional — the app never scrolls): `html, body { overscroll-behavior: none; }`
     and `#c { touch-action: none; }`.
   - The tetris `touchstart`/`touchend` listeners become non-passive and `preventDefault()`
     game touches (not UI-chrome touches); add a `touchmove` preventDefault for active game
     touches so horizontal pans can't become history swipes.
   - Known limit: iOS screen-edge back-swipe cannot be blocked by web content; mid-screen
     swipes (the normal play surface) are covered.

## Implementation notes

- Ban list: `const TETRIS_PLAY_BAN = new Set(['sphericalHarmonic', 'sphereBand', 'swissRoll'])`;
  candidate pools become `.filter(n => n !== current && !(tetrisMode === 'play' && TETRIS_PLAY_BAN.has(n)))`.
- `advanceTimeline` holdFlat branch: `const flatS = tetrisMode === 'play' ? CONFIG.tetris.flatHoldS : m.holdFlat;`
- Weight + tilt live next to the tetris overlay code: `let tetrisStageW = 0, builtTilt = CONFIG.lattice.flatTilt;`
  updated in `frame()` before `updateCamera` (which reads `tetrisStageW` for the azimuth blend).
- `wrapPi(a)` = normalize to [−π, π].

## Testing

- `?perf` `__dbg.phase`: holdFlat duration ≈ 6 s in play, ≈ 1.2 s ambient (regression).
- 40 `tourNext()` iterations with play on → banned shapes absent; with auto on → all 9 appear.
- Screenshot the play flat beat → board face-on, steeper lean; screenshot ambient flat →
  unchanged framing.
- Touch listeners: synthetic horizontal swipe during play calls preventDefault (assert via
  `defaultPrevented` on a dispatched cancelable TouchEvent) and still moves the piece; UI-chrome
  touches are not prevented.
