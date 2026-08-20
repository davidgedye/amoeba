# Amoeba Soup

A fullscreen canvas animation of blob-like creatures drifting, bouncing, and morphing around the screen. Each amoeba is a closed cubic Bézier spline whose control points are driven by layered sine waves, giving them a continuously shifting, organic shape. With predation enabled, larger amoebas hunt smaller ones and smaller ones flee; an amoeba that ends up entirely inside another is swallowed — becoming trapped inside and growing its captor as it is absorbed. This continues to its logical conclusion, but then... a miracle occurs.

## Approach

### Shape generation

Each amoeba has a fixed number of evenly-spaced skeleton points arranged in a circle. At every frame, two kinds of noise perturb those points:

- **Radial noise** — varies how far each point sits from the amoeba's centre.
- **Angular noise** — varies the angular position of each point around the centre.

Both noise signals are sums of sine waves (see *Sine noise* below). The perturbed points are then connected with a **Catmull-Rom–style cubic Bézier spline**: control handles are computed as `(P_{i+2} − P_{i-1}) / TENSION`, which produces a smooth closed loop. The tension value is tuned to suppress sharp cusps and self-intersecting loops.

### Sine noise

`sineNoise(phases, t)` accumulates several sine waves:

```
v = Σ amp_k · sin(freq_k · t + phase_k)
```

`makePhases(n, targetAmp)` generates `n` random sinusoids and normalises their amplitudes so the total contribution is exactly `targetAmp`, keeping shapes within a predictable size envelope.

### Rendering

Each amoeba is filled with a radial gradient — pale and translucent at the centre, more saturated toward the edge — giving a slight sense of depth. The inner stop's opacity breathes slowly on an independent per-amoeba sine cycle, so no two amoebas pulse in sync. Free and captured amoebas share the same approach but with different colour weights; captured amoebas are noticeably more opaque so they remain visible through their container.

### Motion

Each amoeba moves at a **constant speed** (scaled to screen size) in a slowly rotating direction. Heading rotation is itself driven by a sine-noise signal, so straight-line travel, gentle arcs, and lazy loops all emerge naturally over time.

On reaching a wall the velocity component perpendicular to that wall is reflected, with a small random scatter applied to the parallel component — so bounces are not perfectly elastic and no two are alike. Speed is renormalised after each bounce to prevent drift.

### Predation

When `predation=true`, each frame `checkSwallowing` tests every unswallowed amoeba B against every amoeba A. If all of B's skeleton points (plus its centre) lie inside A's Bézier path — tested via `ctx.isPointInPath` — B is swallowed by A.

Nesting is always **flat**: if the eating amoeba A is itself already captured by C, B (and any amoebas B was holding) joins C directly — depth never exceeds one level.

Once swallowed, B:
- Stops bouncing off walls.
- Is constrained within a shrinking leash around the captor's centre, settling at a fraction of the captor's radius over a few seconds.
- Renders clipped to the captor's Bézier shape using a radial gradient (bright centre fading outward) — it never bleeds outside its container.
- Causes the captor to grow by B's original area, smoothly expanding over time. If the captor is later swallowed by a larger amoeba, the captor's children are reparented and the captor shrinks back to its own original size.

### Pursuit and evasion

Predation is theatrical rather than tactical: nothing is held under a standing force pulling it toward or away from anything else, so there is no attraction field that could quietly collapse the soup into a corner. When two amoebas whose sizes qualify (`EAT_RATIO`) come within `NOTICE` — a distance measured from the *predator's* radius, so both notice at the same instant — each reacts in its own way. The predator turns to face its prey, crouches briefly, then springs to `LUNGE_SPEED`; the crouch is pure anticipation, and without it a burst simply reads as drifting slightly faster. A lunge puts it on the hunt for good, pressing at about a dart a second, and it lies up for `REST` only once it has actually fed, so a hunter that keeps missing keeps trying. Prey reacts first every time, needing neither a particular heading nor a wind-up: it bolts with a sharp reflex turn and then keeps running for as long as the threat is in range, bending toward whichever heading has the most open water ahead. That last test does the real work — a fleeing amoeba casts a ray to the canvas edge along several candidate headings and takes the roomiest, so it breaks sideways rather than being flushed into a wall, and it is the only thing standing between a hunted amoeba and a corner. Finally, every burst sets a *target* speed that the amoeba's actual speed then chases at a rate inversely proportional to its area, so a small amoeba snaps to full pace almost at once while a large one has to heave itself into motion — handing prey a decisive edge in the opening second of a chase, which the predator's higher top speed only slowly claws back.

## URL parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| `n` | 30 | Number of amoebas (1 – 200) |
| `speed` | 0.7 | Speed multiplier |
| `coverage` | 0.3 | Fraction of screen area notionally covered by all amoebas combined (0.01 – 2) |
| `predation` | true | Disable swallowing and growth (`?predation=false`) |

Example: `?n=30&speed=0.5&coverage=0.4&predation=false`

## Endgame

When predation is enabled and only one top-level (unswallowed) amoeba remains, the simulation enters an endgame sequence:

1. **Flash** — the edges of all captured amoebas flash periodically.
2. **Eject** — captives are fired out one by one at even intervals. Each is launched in a random direction biased toward the canvas centre, so containers near corners don't fire amoebas into walls. The container shrinks by each captive's area on ejection, returning to its original size after the last one leaves.
3. **Drift** — all amoebas drift freely with predation suspended.
4. **Idle** — predation resumes and captures can restart.

## Interaction

Click and drag any free (unswallowed) amoeba to move it. The amoeba's centre tracks the cursor while preserving the offset from where you clicked, so there is no jump on pickup.

On release, the amoeba is thrown in the direction of the cursor's recent movement, and the throw speed decays back to normal over a short time.

If predation is enabled, dragging triggers swallowing normally — you can drag a small amoeba into a larger one, or drag a large amoeba over a small one.

Press **+** / **-** to increase or decrease the global speed multiplier. This scales movement, shape animation, turning, and the pace of pursuit and evasion together — identical in effect to the `?speed` URL parameter but adjustable at runtime. The endgame sequence above is deliberately left out of this: its phase durations stay in real seconds.
