# Amoeba Soup

A fullscreen canvas animation of blob-like creatures drifting, bouncing, and morphing around the screen. Each amoeba is a closed cubic Bézier spline whose control points are driven by layered sine waves, giving them a continuously shifting, organic shape. Larger amoebas can swallow smaller ones, which become trapped inside and drift around until the population drops low enough to trigger a new spawn.

## Approach

### Shape generation

Each amoeba has **N** evenly-spaced skeleton points arranged in a circle. At every frame, two kinds of noise perturb those points:

- **Radial noise** — varies how far each point sits from the amoeba's centre.
- **Angular noise** — varies the angular position of each point around the centre.

Both noise signals are sums of sine waves (see *Sine noise* below). The perturbed points are then connected with a **Catmull-Rom–style cubic Bézier spline**: control handles are computed as `(P_{i+2} − P_{i-1}) / TENSION`, which produces a smooth closed loop. `TENSION = 8` (higher than the classic value of 6) shortens the handles to suppress sharp cusps and self-intersecting loops.

### Sine noise

`sineNoise(phases, t)` accumulates several sine waves:

```
v = Σ amp_k · sin(freq_k · t + phase_k)
```

`makePhases(n, targetAmp)` generates `n` random sinusoids and normalises their amplitudes so the total contribution is exactly `targetAmp`, keeping shapes within a predictable size envelope.

### Motion

Each amoeba moves at a **constant speed** (scaled to screen size) in a slowly rotating direction. Heading rotation is itself driven by a sine-noise signal (`turnPhases`), so straight-line travel, gentle arcs, and lazy loops all emerge naturally over time.

On reaching a wall the velocity component perpendicular to that wall is reflected, with a small random scatter applied to the parallel component — so bounces are not perfectly elastic and no two are alike. Speed is renormalised after each bounce to prevent drift.

### Swallowing

Each frame, `checkSwallowing` tests every pair of amoebas. If B is meaningfully smaller than A (`B.baseR < A.baseR × 0.85`) and all of B's skeleton points (plus its centre) lie inside A's Bézier path — tested via `ctx.isPointInPath` — B is swallowed by A.

Swallowing is fully general and supports chains: a swallowed amoeba can itself swallow a smaller one. Draw order is sorted by chain depth (innermost first) with a stable index tiebreak to prevent flicker.

Once swallowed, B:
- Stops bouncing off walls.
- Is constrained within a shrinking circle around A's centre. The leash starts at the actual distance at the moment of capture (no jump) and tightens gradually to `0.35 × A.baseR` over a few seconds.
- Renders with a darker, more opaque fill and no stroke, distinguishing it from free amoebas.
- Moves with A as A drifts around.

### Spawning

When the number of free (unswallowed) amoebas drops below `SPAWN_THRESHOLD × initialCount`, a new amoeba is spawned at a random position and fades in over 2 seconds. A cooldown prevents burst spawning.

## Parameters

### Population

| Parameter | Value | Effect |
|-----------|-------|--------|
| Initial count | 10 | Number of amoebas at startup |
| `SPAWN_THRESHOLD` | 0.7 | Spawn a new amoeba when free count drops below this fraction of initial N |
| `SPAWN_COOLDOWN` | 3 s | Minimum time between spawns |
| Fade-in duration | 2 s | New spawns fade from invisible to full opacity |

### Size

| Parameter | Value | Effect |
|-----------|-------|--------|
| `baseR` | `minDim × (0.04 – 0.20)` | Base radius; 5:1 size ratio (smallest ~20% of largest), scaled to shorter screen dimension |

### Skeleton

| Parameter | Value | Effect |
|-----------|-------|--------|
| `N` | 8 – 11 (random integer) | Number of skeleton control points. More points → more potential lobes and folds |

### Radial deformation (`rPhases`)

Each skeleton point gets its own independent set of sinusoids.

| Parameter | Value | Effect |
|-----------|-------|--------|
| Sinusoids per point | 4 | Number of sine waves summed per point |
| Frequency range | 0.3 – 1.7 rad/s | Spread of oscillation speeds; wide range creates beat frequencies |
| Raw amplitude range | 0.4 – 1.0 | Relative weight before normalisation |
| `targetAmp` | 0.55 | After normalisation, total radial swing is ±55% of `baseR` |
| Time scale | `t × 0.55` | How fast the radial noise clock runs |

### Angular deformation (`aPhases`)

| Parameter | Value | Effect |
|-----------|-------|--------|
| Sinusoids per point | 2 | Fewer waves → smoother angular drift |
| `targetAmp` | 0.12 rad | Peak angular displacement per point (~7°); kept small to prevent skeleton points crossing and causing cusps |
| Time scale | `t × 0.35` | Slightly slower than radial, so angular and radial changes feel independent |

### Spline tension

| Parameter | Value | Effect |
|-----------|-------|--------|
| `TENSION` | 8 | Catmull-Rom handle divisor. Lower → rounder but loopier; higher → tighter. Classic value is 6; 8 suppresses sharp points and self-intersections |

### Motion

| Parameter | Value | Effect |
|-----------|-------|--------|
| `speed` | `longDim / (30 – 50)` px/s | Scaled to screen; fastest amoeba crosses the long dimension in 30 s, slowest in 50 s |
| `turnPhases` sinusoids | 3 | Waves driving heading rotation |
| Turn rate | `age × 0.22`, amplitude `× 0.45` rad/s | Controls how tightly the heading wanders; low values → lazy curves |

### Bouncing

| Parameter | Value | Effect |
|-----------|-------|--------|
| Bounce threshold | `0.3 × baseR` | Centre must get this close to the wall before velocity flips; lets the body visibly squish against the edge |
| Speed multiplier on bounce | 0.9 – 1.1 | Slight speed jitter per bounce |
| Lateral scatter | `±0.15 × speed` | Random nudge to the non-bouncing velocity component; prevents perfectly repeated paths |

### Wall clamping

| Parameter | Value | Effect |
|-----------|-------|--------|
| `margin` | 10 px | Control points are clamped this far inside each edge. Bézier overshoot carries the rendered curve to approximately the canvas boundary |

### Swallowing

| Parameter | Value | Effect |
|-----------|-------|--------|
| Size threshold | `B.baseR < A.baseR × 0.85` | A must be more than ~18% larger than B to swallow it |
| Detection | `ctx.isPointInPath` on B's centre + all N skeleton points | Uses the browser's own Bézier hit-testing; accurate to the actual rendered shape |
| Leash target | `0.35 × A.baseR` | Settled radius within which B's centre is confined |
| Leash tightening | `0.08 × A.baseR` per second | Rate at which the leash shrinks from capture distance to target; prevents a position jump on capture |

### Appearance

| Parameter | Value | Effect |
|-----------|-------|--------|
| `hue` | 0 – 359° (random) | Per-amoeba colour, fixed for its lifetime |
| Free fill | `hsla(hue, 65%, 60%, 0.30)` | Semi-transparent; overlapping amoebas blend naturally |
| Free stroke | `hsla(hue, 75%, 78%, 0.55)` | Brighter, slightly more opaque outline |
| Swallowed fill | `hsla(hue, 65%, 20%, 0.60)` | Darker and more opaque; no stroke |
| `lineWidth` | 2 px | Outline thickness |

### Timing

| Parameter | Value | Effect |
|-----------|-------|--------|
| `age` offset | random 0 – 200 s | Each amoeba starts at a different point in its noise timeline so they don't pulse in sync |
| `dt` cap | 0.05 s | Prevents a large time jump after a tab switch from flinging amoebas off screen |
