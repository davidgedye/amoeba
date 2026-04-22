# Amoeba Soup

A fullscreen canvas animation of blob-like creatures drifting, bouncing, and morphing around the screen. Each amoeba is a closed cubic Bézier spline whose control points are driven by layered sine waves, giving them a continuously shifting, organic shape. With predation enabled, amoebas swallow one another when one fits entirely inside another — becoming trapped inside and growing their captor as they are absorbed. This continues to its logical conclusion, but then... a miracle occurs.

## Approach

### Shape generation

Each amoeba has **p** evenly-spaced skeleton points arranged in a circle. At every frame, two kinds of noise perturb those points:

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

### Predation

When `predation=true`, each frame `checkSwallowing` tests every unswallowed amoeba B against every amoeba A. If all of B's skeleton points (plus its centre) lie inside A's Bézier path — tested via `ctx.isPointInPath` — B is swallowed by A.

Once captured, B cannot be re-captured by any other amoeba, so area is never double-counted through chains.

Swallowing supports chains: a swallowed amoeba can itself swallow a smaller one. Draw order is sorted by chain depth (innermost first) with a stable index tiebreak to prevent flicker.

Once swallowed, B:
- Stops bouncing off walls.
- Is constrained within a shrinking circle around A's centre. The leash starts at the capture distance and tightens gradually to `0.35 × A.baseR` over a few seconds.
- Renders with a darker, more opaque fill and no stroke.
- Causes A to grow: A gains B's area (`B.baseR²` in r² units), smoothly expanding `A.baseR` toward the new target over ~1 s.

## URL parameters

These query-string parameters let you customise the simulation without editing the source:

| Parameter | Default | Effect |
|-----------|---------|--------|
| `n` | 20 | Number of amoebas (1 – 200) |
| `speed` | 1 | Speed multiplier (0.1 – 20) |
| `predation` | true | Disable swallowing and growth (`?predation=false`) |

Example: `?n=30&speed=0.5&predation=false`

## Endgame

When predation is enabled and only one top-level (unswallowed) amoeba remains, the simulation enters an endgame sequence:

1. **Flash** (10 s) — the edges of all captured amoebas flash at ~3 Hz.
2. **Push** (≥ 5 s) — edges stay visible and a reverse spring pushes each captured amoeba outward until it escapes its captor. The captor shrinks as each child leaves, area-conserving. The push phase continues until every amoeba has escaped naturally.
3. **Drift** (15 s) — all amoebas drift freely with predation suspended.
4. **Idle** — predation resumes and captures can restart.

## Interaction

Click and drag any free (unswallowed) amoeba to move it. The amoeba's centre tracks the cursor while preserving the offset from where you clicked, so there is no jump on pickup. Amoebas swallowed inside the dragged one continue to jiggle around its centre normally.

On release, the amoeba is thrown in the direction of the cursor's recent movement. Throw speed is proportional to how fast the cursor was moving (capped at 5× the amoeba's normal speed) and decays back to normal over roughly one to two seconds.

If predation is enabled, dragging triggers swallowing normally — you can drag a small amoeba into a larger one, or drag a large amoeba over a small one.

Press **+** / **-** to increase or decrease the global speed multiplier. This scales movement, shape animation, and turning together — identical in effect to the `?speed` URL parameter but adjustable at runtime.

## Parameters

### Population

| Parameter | Value | Effect |
|-----------|-------|--------|
| Initial count | `n` URL param (default 20) | Number of amoebas at startup |

### Size

| Parameter | Value | Effect |
|-----------|-------|--------|
| `baseR` | scaled so all N amoebas together cover ~25% of canvas area | Base radius; 5:1 size ratio (smallest ~20% of largest). The radius formula `minDim × (0.04 – 0.20)` is multiplied by a per-session scale factor derived from n and the canvas dimensions |

### Skeleton

| Parameter | Value | Effect |
|-----------|-------|--------|
| `p` | 10 | Number of skeleton control points |

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
| `speed` | `longDim / (30 – 50) × SPEED_MUL` px/s | Scaled to screen; fastest amoeba crosses the long dimension in 30 s, slowest in 50 s (before the `speed` URL multiplier) |
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

### Predation

| Parameter | Value | Effect |
|-----------|-------|--------|
| Detection | `ctx.isPointInPath` on B's centre + all p skeleton points | Uses the browser's own Bézier hit-testing; accurate to the actual rendered shape |
| Leash target | `0.35 × A.baseR` | Settled radius within which B's centre is confined |
| Leash tightening | `0.08 × A.baseR` per second | Rate at which the leash shrinks from capture distance to target; prevents a position jump on capture |
| Growth | `A.baseR → √(A.baseR² + B.baseR²)` | Capturer gains B's area; `baseR` grows smoothly over ~1 s |

### Appearance

| Parameter | Value | Effect |
|-----------|-------|--------|
| `hue` | 0 – 359° (random) | Per-amoeba colour, fixed for its lifetime |
| Free fill | `hsla(hue, 65%, 60%, 0.30)` | Semi-transparent; overlapping amoebas blend naturally |
| Free stroke | `hsla(hue, 75%, 78%, 0.55)` | Brighter, slightly more opaque outline |
| Swallowed fill | `hsla(hue, 65%, 20%, 0.60)` | Darker and more opaque; no stroke during normal predation (stroke shown during endgame flash and push phases) |
| `lineWidth` | 2 px | Outline thickness |

### Timing

| Parameter | Value | Effect |
|-----------|-------|--------|
| `age` offset | random 0 – 200 s | Each amoeba starts at a different point in its noise timeline so they don't pulse in sync |
| `dt` cap | 0.05 s | Prevents a large time jump after a tab switch from flinging amoebas off screen |
