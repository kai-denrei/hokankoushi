# Tetris Play — shape-management system (rating table → ordering + duration + anchor)

**Date:** 2026-07-26 · **Status:** design approved (classification "as is for now"); **not yet implemented**
**Builds on:** `2026-07-24-tetris-board-visibility-design.md`, `2026-07-24-tetris-play-pacing-design.md`
**Shipped precursor:** `fix: bypass superformula during tetris play` (commit 108c243) — added `superformula`
to the play ban and re-anchored to torus on entering play.

All behaviors are **play-mode only** (`tetrisMode === 'play'`). Ambient/auto tour is untouched.

## Problem

During tetris play the shape tour picks randomly from an ad-hoc ban list, holds every shape for the
same time, and can land the board on a hard-to-read shape immediately after another hard one. Three
knobs are scattered across separate constants (`TETRIS_PLAY_BAN`, `TETRIS_PLAY_SHAPE_SPEED` — now
emptied, `TETRIS_PLAY_PHASE`). The deleted `TETRIS_PLAY_SHAPE_SPEED` "fast-pass" was an unprincipled
one-off (superformula only). We want one coherent system that keeps the play area readable.

## Non-goals / hard constraints

- **No camera-motion changes.** The rate-limited azimuth servo from
  `2026-07-24-tetris-board-visibility-design.md` (Amendment) stays exactly as-is. Lesson from that
  amendment: forcing/snapping the camera bearing lurched (the mean-normal sign flip can invert the
  target ~180° in one frame → staccato). Camera angular velocity must stay bounded by
  `orbitSpeed + trackRate`. **Board visibility is improved only at build time (re-anchor) and by
  spending less time on bad shapes — never by moving the camera harder.**
- Ambient/auto pacing, selection, and camera unchanged.

## Data model — `TETRIS_SHAPE_META`

A single table keyed by shape name is the source of truth. It replaces `TETRIS_PLAY_BAN` and
`TETRIS_PLAY_PHASE` and the (emptied) `TETRIS_PLAY_SHAPE_SPEED`.

```js
// tier: 'neutral' | 'moderate' | 'hard' | 'ban'   (play-mode readability class)
// anchor?: { du?, dv? }   fractional (u,v) phase shift applied in sampleShape when play is on
//                          (build-time board re-anchor — see 07-24 board-visibility spec §D)
const TETRIS_SHAPE_META = {
  torus:             { tier: 'neutral',  anchor: { dv: 0.5 } },
  pyramid:           { tier: 'neutral'  },
  bipyramid:         { tier: 'moderate' },
  mobius:            { tier: 'moderate' },
  tesseract:         { tier: 'hard'     },
  superformula:      { tier: 'ban'      },
  swissRoll:         { tier: 'ban'      },
  sphereBand:        { tier: 'ban'      },
  sphericalHarmonic: { tier: 'ban'      },
};
```

Tier → fold-speed boost (fixed map, not per-shape panel knobs):

```js
const TETRIS_TIER_BOOST = { neutral: 1.0, moderate: 1.4, hard: 2.2 };
```

Higher boost = fold/unfold advances faster **and** the folded hold is shorter (same mechanism the old
per-shape `shapeBoost` used) — so hard shapes flash by and neutral shapes linger.

Helpers (thin, tolerate unknown names by defaulting to `neutral`):
- `shapeTier(name)` → `TETRIS_SHAPE_META[name]?.tier ?? 'neutral'`
- `shapeBoost(name)` → `TETRIS_TIER_BOOST[shapeTier(name)] ?? 1`
- `shapeAnchor(name)` → `TETRIS_SHAPE_META[name]?.anchor ?? null`

## Consumers

Three small readers; no new control loop.

1. **Selection / ban.** `tourCandidates()` excludes `tier === 'ban'` during play (replacing the
   `TETRIS_PLAY_BAN.has(n)` check). The `nextTarget` sequence loop and `skipToNext` already route
   through / mirror this filter.

2. **Ordering (no hard-after-hard).** A candidate whose tier is `hard` is rejected when the shape
   just shown was also `hard` — so every hard shape is followed by a `neutral`/`moderate` recovery
   beat. Applies to all three "pick next" paths: the tour loop (`tourNext`), the `nextTarget`
   sequence step in `advanceTimeline`, and manual `skipToNext` (so hitting skip to escape a hard
   shape lands somewhere readable).
   - **Edge case:** if the ordering filter empties the candidate set (e.g. only hard shapes remain),
     drop the hard-after-hard constraint for that pick — a hard shape beats no shape. Ban filtering
     is never dropped.
   - Track `lastPlayTier` (updated on each play-mode target switch) to evaluate "just shown."

3. **Duration weighting.** `advanceTimeline` reads `shapeBoost(m.target)` in place of the removed
   `TETRIS_PLAY_SHAPE_SPEED[m.target] || 1`. Play cycle for a neutral shape is unchanged from the
   07-24 pacing spec (fold 7s + holdFolded 2s + unfold 7s + holdFlat 12s); moderate ≈ /1.4, hard
   ≈ /2.2 on the fold/hold phases (flat beat is real-time, unscaled — the playable window is
   preserved regardless of tier).

## Camera / board visibility

Unchanged servo. The only visibility lever is `shapeAnchor(name)` applied at target build time
inside `sampleShape` (as today). Initially only `torus` carries an anchor (matching current
behavior); the table makes it trivial to add anchors for other shapes as they're eyeball-tuned,
without touching the camera. Re-anchoring moves the board patch onto a viewer-facing face **before**
any frame renders, so it introduces zero camera motion and cannot jitter.

## Classification (approved "as is for now" — tunable)

Active play rotation (5 shapes): torus, pyramid (neutral) · bipyramid, mobius (moderate) ·
tesseract (hard). Banned: superformula, swissRoll, sphereBand, sphericalHarmonic. Tiers are a
starting guess from geometry and can be re-graded by editing the table; the operator deferred
re-grading and un-banning for now.

## Testing / QA

- **Ordering:** force a `hard` shape (tesseract), advance the tour; assert the next play target has
  tier ≠ `hard` across N transitions. With only-hard-remaining (temporarily ban all non-hard),
  assert selection still returns a shape (fallback path).
- **Duration:** `?perf` phase sampling — neutral fold ≈ 7s, hard fold ≈ 7/2.2 ≈ 3.2s, flat beat
  ≈ 12s for every tier (unscaled). Regression: ambient pacing unchanged.
- **Selection:** banned shapes never appear in play; all four bans still excluded; manual key/panel
  picks remain unrestricted (shapes stay available outside tetris).
- **Anchor:** torus board still lands on the outer equator in play (screenshot); ambient torus
  unchanged.
- **Camera regression:** `|wrap(__camAng − boardBearing)|` still settles < ~0.7 rad and glides (no
  per-frame jumps); flat-beat homing still frontal; pause freezes; no page errors.

## Out of scope (future)

- Per-shape anchors beyond torus (add to table as tuned).
- Un-banning a shape as `hard` for more variety.
- Bag-shuffle draw order (Approach B) if random-with-constraint feels repetitive.
