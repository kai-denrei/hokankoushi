# Tetris Play — pacing (more flat, faster shapes)

**Date:** 2026-07-24 · **Status:** approved (build straight through to deploy)
**Builds on:** `2026-07-24-tetris-play-stage-design.md` (shipped)

## Requirement

In play mode, the readable flat window must dominate the cycle; folded-shape phases pass faster.
Ambient/auto pacing untouched.

## Decisions

Play-only knobs in `CONFIG.tetris` (all in the panel's tetris folder):

| Knob | Default | Effect |
|---|---|---|
| `flatHoldS` | 6 → **12** | rest at flat (existing knob, new default) |
| `playTimeScale` | **2.0** | fold/unfold advance `dt × scale` in `advanceTimeline` (14 s → 7 s each). Scaling `dt`, not `morph.duration`, so `morphT`/`gp` semantics and in-flight state are untouched. |
| `holdFoldedS` | **2** | folded hold (ambient stays `morph.holdFolded` = 4 s) |

Resulting play cycle: 7 + 2 + 7 + 12 = 28 s, flat ≈ 43 % (plus playable near-flat tails).
Holds tick real-time; only morph phases are scaled. Panel: 'fold speed ×' (1–4 step 0.1),
'fold hold s' (0–10 step 0.5).

## Testing

`?perf` phase sampling: play fold ≈ 7 s, holdFolded ≈ 2 s, holdFlat ≈ 12 s; ambient fold ≈ 14 s,
holdFlat ≈ 1.2 s (regression). No page errors; pause still freezes the timeline in both modes.
