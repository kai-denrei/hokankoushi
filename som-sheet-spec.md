# SPEC — "Neural Sheet" Faux-SOM Animation

## Intent

A browser animation that *looks* like a self-organizing map discovering the shape of data — a flat lattice that folds onto a 3D target while sparkles of "activation" roam and shrink — with **zero actual learning**. Everything is parametric interpolation plus cosmetic effects. The whole point of this build is a tight tuning loop: one `CONFIG` object at the top of the file drives every aspect of the look, so iterations are edits to constants, never to logic.

## Constraints

- Single `index.html`. Vanilla ES modules, no build step, no npm.
- Three.js via CDN import map (pin a version, e.g. 0.16x).
- Runs at 60fps on an M-series laptop with a 64×64 lattice.
- `prefers-reduced-motion`: render the final folded state, static, sparkles off.
- No text/UI except an optional debug HUD (toggle with `h` key). No PII anywhere, including code comments and metadata.

## Architecture (fixed — do not make configurable)

Three layers over one shared position buffer, updated per frame:

1. **Wireframe** — `LineSegments` over grid edges (horizontal + vertical neighbors). One indexed `BufferGeometry`; only the position attribute changes per frame.
2. **Nodes** — `Points` with additive blending, per-vertex color + size via shader material. This layer carries the sparkle effect.
3. **Dust** (optional) — a few hundred static particles sampled *on the target surface*, faint, pretending to be the "data" the sheet discovers.

Per-vertex position each frame:

```
p(u,v,t) = mix( flat(u,v), target(u,v), s(u,v,t) ) + wobble(u,v,t)
```

Where `s` is the per-vertex staggered eased progress (below). Precompute `flat`, `target`, and per-vertex stagger offsets once at init; the frame loop is pure arithmetic into the shared Float32Array.

## The math that sells it

### Stagger

Each vertex gets a scalar offset `d(u,v) ∈ [0,1]`:

```
d = mix( radial , noise , CONFIG.morph.staggerNoiseMix )
radial = distance((u,v), seedPoint) / maxDistance
noise  = fbm2(u * staggerNoiseScale, v * staggerNoiseScale)   // 2–3 octave value noise, hand-rolled, ~15 lines
```

Per-vertex progress:

```
raw = clamp( (t / duration - d * staggerSpread) / (1 - staggerSpread), 0, 1 )
s   = ease(raw)
```

`staggerSpread = 0` → uniform tween (boring). `→ 1` → wave crawling across the sheet (the "discovery" look). Sweet spot to start: **0.55**.

### Easing (the annealing overshoot)

```
ease(x) = easeInOutQuint(x) + overshootAmp * sin(x * π * overshootFreq) * (1 - x)^overshootDecay
```

The sine term makes each region overshoot the target and settle, decaying to zero as `x → 1`. This is what reads as "physical annealing" instead of "CSS transition." Start: `overshootAmp 0.08`, `overshootFreq 3`, `overshootDecay 2.5`.

### Wobble (ambient life)

```
wobble = normal(u,v) * wobbleAmp * (1 - globalProgress)^wobbleDecay * sin(t * wobbleFreq + phase(u,v))
```

`phase` from the same fbm noise so neighbors wobble coherently. Displace along the *interpolated surface normal* (cheap approximation: normalized cross product of grid-neighbor deltas), not world Y — this keeps the sheet looking like fabric, not jelly.

### Sparkles (fake BMU activations)

Maintain `sparkles.count` concurrent activations. Each is `{gridPos, birth, life}`. Every `spawnInterval` ms, respawn the oldest at a random grid position — **biased toward vertices whose `s` is mid-transition** (weight ∝ `s(1-s)`), so activity appears to chase the folding front. Per-vertex brightness:

```
b(u,v) = Σ over active sparkles: exp( -gridDist² / (2σ(t)²) ) * envelope(age/life)
σ(t) = mix(radiusStart, radiusEnd, globalProgress)   // the shrinking neighborhood — THE visual SOM signature
envelope = attack-decay, fast in / slow out
```

Brightness drives both node color (lerp base → hot along palette) and node size (× `1 + b * sizeBoost`). Persist a decaying trail: `b_frame = max(b_computed, b_prev * trailDecay)`.

### Loop

After hold at full fold: reverse (unfold) or crossfade back to flat, then pick a new `seedPoint` and (optionally) next target. Configurable.

## Targets

Implement as pure functions `(u,v) ∈ [0,1]² → vec3`, registered in a map keyed by name. Ship at minimum:

- `torus` — classic, reads instantly
- `swissRoll` — the canonical manifold-learning shape; best "unrolling" narrative
- `sphereBand` — sheet wrapping a sphere with a seam gap (avoid full closure; lattice edges pinching at poles looks broken)
- `mobius` — the risk pick; if edge-pinch artifacts appear, keep but don't default

Normalize all targets to fit in a unit-ish bounding sphere so camera framing is target-independent.

## CONFIG — the tuning surface

Everything below sits in one literal at the top of the file. Comment each field inline with its range and what it does visually. These defaults are the starting look; expect to touch mostly `morph`, `sparkles`, and `palette`.

```js
const CONFIG = {
  lattice: {
    cols: 64,            // 32–96. >96 needs perf check
    rows: 64,
    flatTilt: 0.15,      // rad, initial sheet tilt so "flat" isn't edge-on
  },

  morph: {
    target: 'swissRoll',      // 'torus' | 'swissRoll' | 'sphereBand' | 'mobius'
    duration: 14,             // seconds, flat → folded
    holdFolded: 4,            // seconds before loop action
    loopMode: 'reverse',      // 'reverse' | 'restart' | 'nextTarget'
    seedPoint: [0.2, 0.7],    // uv of stagger origin; null = random per loop
    staggerSpread: 0.55,      // 0–0.9. Higher = wave crawls, lower = uniform
    staggerNoiseMix: 0.35,    // 0 = pure radial wave, 1 = patchy noise
    staggerNoiseScale: 3.0,
    overshootAmp: 0.08,       // 0 = clinical, 0.15+ = wobbly jelly
    overshootFreq: 3,
    overshootDecay: 2.5,
  },

  wobble: {
    amp: 0.035,          // world units. 0 disables
    freq: 1.8,           // Hz-ish
    decay: 2.0,          // how fast ambient motion dies as fold completes
  },

  sparkles: {
    count: 7,            // concurrent activations
    spawnInterval: 420,  // ms
    radiusStart: 9.0,    // in grid units — the h_ci neighborhood
    radiusEnd: 1.2,      // shrink across the run = the SOM tell
    life: 1600,          // ms per activation
    attack: 0.15,        // fraction of life
    trailDecay: 0.90,    // per frame; 0.85 short tails, 0.96 long comets
    sizeBoost: 2.2,      // node size multiplier at full brightness
    frontBias: 0.7,      // 0 = spawn anywhere, 1 = only on the folding front
  },

  palette: {
    background: '#050807',
    wire: '#1d4d44',       // dim teal — must recede
    wireOpacity: 0.5,
    nodeBase: '#2a6b5d',
    nodeHot: '#ffe9a3',    // sparkle peak — warm amber against teal
    dust: '#8a7a4a',
    dustOpacity: 0.25,
    fog: 0.06,             // exp2 fog density; 0 disables
  },

  nodes: {
    baseSize: 2.0,         // px at reference distance
    sizeAttenuation: true,
  },

  dust: {
    count: 400,            // 0 disables layer
    jitter: 0.06,          // offset off the target surface
  },

  camera: {
    fov: 40,
    distance: 3.2,
    orbitSpeed: 0.04,      // rad/s; slow. 0 = static
    orbitTiltAmp: 0.12,    // gentle vertical bob
    driftIn: 0.15,         // fraction of distance to dolly in across the run
  },

  render: {
    exposure: 1.1,
    bloom: false,          // stretch goal; additive blending alone gets 90% there
    dprCap: 2,
  },
};
```

## Debug HUD (`h` key)

Tiny monospace overlay: fps, globalProgress, active target, seed point. Plus keys: `space` pause, `r` restart with new seed, `1–4` switch target. This is the tuning cockpit — build it early, it pays for itself.

## Build order

1. Lattice + flat/target position buffers + uniform lerp. Verify torus fold with no stagger.
2. Stagger + easing + overshoot. This is where the look emerges — iterate `morph.*` here.
3. Sparkles with shrinking σ and front bias.
4. Wobble, dust, camera drift, fog.
5. Loop logic, HUD, reduced-motion path, DPR cap.

## Acceptance criteria

- The fold reads as *propagating*, not tweening: a visible front crosses the sheet.
- Overshoot is felt, not seen — regions settle with a breath, no jelly.
- Sparkle neighborhoods are visibly larger early than late (the SOM signature survives at a glance).
- Wireframe recedes; sparkles are the brightest thing on screen; dust is subliminal.
- Idles at 60fps, 64×64, DPR 2.
- Changing any single CONFIG value produces a visible, isolated change — no hidden couplings.
