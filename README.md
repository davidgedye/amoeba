# Amoeba Soup

A fullscreen canvas animation of blob-like creatures drifting, bouncing, and morphing around the screen. Each amoeba is a closed cubic Bézier spline whose control points are driven by layered sine waves, giving them a continuously shifting, organic shape.

## Approach

### Shape generation

Each amoeba has **N** evenly-spaced skeleton points arranged in a circle. At every frame, two kinds of noise perturb those points:

- **Radial noise** — varies how far each point sits from the amoeba's centre.
- **Angular noise** — varies the angular position of each point around the centre.

Both noise signals are sums of sine waves (see *Sine noise* below). The perturbed points are then connected with a **Catmull-Rom–style cubic Bézier spline**: control handles are computed as `(P_{i+2} − P_{i-1}) / 6`, which produces a smooth closed loop with no cusps.

### Sine noise

`sineNoise(phases, t)` accumulates several sine waves:

```
v = Σ amp_k · sin(freq_k · t + phase_k)
```

`makePhases(n, targetAmp)` generates `n` random sinusoids and normalises their amplitudes so the total contribution is exactly `targetAmp`, keeping shapes within a predictable size envelope.

### Motion

Each amoeba moves at a **constant speed** in a slowly rotating direction. Heading rotation is itself driven by a sine-noise signal (`turnPhases`), so straight-line travel, gentle arcs, and lazy loops all emerge naturally over time.

On reaching a wall the velocity component perpendicular to that wall is reflected, with a small random scatter applied to the parallel component — so bounces are not perfectly elastic and no two are alike. Speed is renormalised after each bounce to prevent drift.

## Parameters

### Population

| Parameter | Value | Effect |
|-----------|-------|--------|
| `amoebas` count | 10 | Number of creatures on screen |

### Size

| Parameter | Value | Effect |
|-----------|-------|--------|
| `baseR` | `minDim × (0.04 – 0.20)` | Base radius in pixels; 5:1 size ratio (smallest is ~20% of largest), scaled to the shorter screen dimension |

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
| `targetAmp` | 0.55 | After normalisation, total radial swing is ±55 % of `baseR` |
| Time scale | `t × 0.55` | How fast the radial noise clock runs |

### Angular deformation (`aPhases`)

| Parameter | Value | Effect |
|-----------|-------|--------|
| Sinusoids per point | 2 | Fewer waves → smoother angular drift |
| `targetAmp` | 0.28 rad | Peak angular displacement per point (~16°); keeps points from crossing neighbours |
| Time scale | `t × 0.35` | Slightly slower than radial, so angular and radial changes feel independent |

### Motion

| Parameter | Value | Effect |
|-----------|-------|--------|
| `speed` | 45 – 90 px/s | Constant travel speed, randomised per amoeba |
| `turnPhases` sinusoids | 3 | Waves driving heading rotation |
| Turn rate scale | `age × 0.22`, amplitude `× 0.45` rad/s | Controls how tightly the heading wanders; low values → lazy curves |

### Bouncing

| Parameter | Value | Effect |
|-----------|-------|--------|
| Bounce threshold | `0.3 × baseR` | Centre must get this close to the wall before the velocity flips; lets the body visibly squish against the edge |
| Speed multiplier on bounce | 0.9 – 1.1 | Slight speed jitter per bounce |
| Lateral scatter | `±0.15 × speed` | Random nudge to the non-bouncing velocity component; prevents perfectly repeated paths |

### Wall clamping

| Parameter | Value | Effect |
|-----------|-------|--------|
| `margin` | 10 px | Control points are clamped this far inside each edge. The Bézier overshoot (~equal to the margin) carries the rendered curve to approximately the canvas boundary, so flattening only begins when the visible shape first touches the wall |

### Appearance

| Parameter | Value | Effect |
|-----------|-------|--------|
| `hue` | 0 – 359° (random) | Per-amoeba colour, fixed for the lifetime of the creature |
| Fill | `hsla(hue, 65%, 60%, 0.30)` | Semi-transparent fill; overlapping amoebas blend naturally |
| Stroke | `hsla(hue, 75%, 78%, 0.55)` | Brighter, slightly more opaque outline |
| `lineWidth` | 2 px | Outline thickness |

### Timing

| Parameter | Value | Effect |
|-----------|-------|--------|
| `age` offset | random 0 – 200 s | Each amoeba starts at a different point in its noise timeline so they don't pulse in sync |
| `dt` cap | 0.05 s | Prevents a large time jump after a tab switch from flinging amoebas off screen |
