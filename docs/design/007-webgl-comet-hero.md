# 007 — WebGL2 comet hero

**Status:** Phases 1–7 implemented; physical-device sign-off pending
**Date:** 2026-08-13

## Objective

Replace the landing page's generic background effect with a distinctive Aegis
comet: a warm luminous core, a curved plasma tail, sparse energy particles, and
restrained bloom. The visual must remain atmospheric rather than interactive
content, preserve the page's transparent composition, and add no runtime 3D
dependency.

## Architecture

React owns the canvas lifecycle and translates browser capabilities into a
small input policy. Everything frame-sensitive remains below that boundary:

```text
AegisComet (React canvas lifecycle)
└── Renderer (WebGL2 context, sizing, frame timer, cleanup)
    └── CometScene
        ├── Comet
        │   ├── core
        │   └── Tail
        ├── EnergyStrands (instanced depth layer)
        ├── ParticleSystem
        └── PostProcessor
            ├── highlight extraction
            ├── separable blur
            └── premultiplied-alpha composite
```

The implementation lives in
[`frontend/src/lib/webgl`](../../frontend/src/lib/webgl/) and is mounted by
[`AegisComet.tsx`](../../frontend/src/components/webgl/AegisComet.tsx).

## Phase decisions

| Phase | Decision |
|------:|----------|
| 1 | Establish a dependency-free WebGL2 renderer, transparent canvas, animated core, responsive DPR, hidden-tab pause, and deterministic resource cleanup. |
| 2 | Generate the tail procedurally in shaders using a compact strip, layered filaments, curvature, taper, and time-driven flow. |
| 3 | Keep energy particles GPU-driven with a seeded static buffer; change density by responsive quality tier rather than uploading positions every frame. |
| 4 | Apply bloom only to extracted highlights, blur at reduced resolution, and composite with premultiplied alpha so the DOM background remains visible. |
| 5 | Add subtle parallax only for fine pointers, cap its displacement, smooth it independently of frame rate, and disable it for touch and reduced motion. |
| 6 | Translate the supplied concept art into procedural depth cues, then add automatic context restoration, deterministic capture states, and frame-pacing diagnostics. Physical-device screenshots and profiling remain a release sign-off gate rather than implementation work. |
| 7 | Replace the horizontal loop with a one-shot 4.8-second cubic-Bézier arrival from the upper-left to a settled right-center composition. Drive every layer from one rotated pose and continue only restrained ambient breathing after arrival. |

## Performance budgets

- Device-pixel ratio is capped at `1.5`.
- The procedural tail uses 50 vertices and one draw call.
- Five desktop, three compact, or two reduced-motion energy strands share one
  static 66-vertex ribbon and one instanced draw call.
- Particle tiers use 160 desktop, 64 compact, or 32 reduced-motion points.
- Particle seeds occupy a static 3.75 KB buffer at the highest tier.
- Bloom uses reduced-resolution intermediate targets rather than full-size
  ping-pong buffers.
- The renderer pauses while the document is hidden and releases programs,
  buffers, textures, framebuffers, and animation handles on unmount.

These are design ceilings, not targets to increase automatically when hardware
appears faster.

## Transparency and compositing

The context and every post-processing stage preserve alpha. Bloom extraction
isolates only bright comet energy; the final pass uses premultiplied-alpha
compositing. This avoids the dark rectangle and edge halos that result from
treating an overlay effect like an opaque scene.

## Responsive and accessibility behavior

- Canvas resolution follows its CSS size and the capped DPR.
- Particle and strand density drop on compact viewports.
- `prefers-reduced-motion` uses the lowest particle/strand tiers, freezes the
  orbital head composition, and removes pointer parallax.
- Parallax is enabled only when `(hover: hover) and (pointer: fine)` matches.
- Pointer influence is bounded to `0.025` horizontally and `0.018` vertically,
  smoothed exponentially, and eased away near page edges.
- Normal motion arrives once and does not loop. The desktop head settles near
  78% width and 42% height; compact layouts interpolate toward a slightly
  higher, farther-right endpoint.
- WebGL2 failure leaves the semantic page and its CSS background intact.

## Verification

For Phases 1–7, TypeScript and the production Next.js build passed. Visual
review covered desktop, mobile-width, reduced-motion, pointer movement, resize,
tab visibility, and transparent compositing. Deterministic query states and
canvas diagnostics make Phase 6 evidence repeatable; see
[`../validation/comet-phase-6.md`](../validation/comet-phase-6.md).

Do not run `next build` while a development server is using the same checkout:
both processes mutate `.next`, which can create misleading missing-manifest
errors. Stop the dev server, build, then restart it.

## Phase 6 — stabilization and release validation

The reference-driven implementation derives perceived
3D from overlapping transparent layers rather than a model, image texture, or
third-party engine:

- The core fragment shader reconstructs a sphere normal for directional
  shading, then adds a depth-occluded elliptical energy orbit and forward flare.
- `EnergyStrands` instances one static ribbon into five independently swept and
  depth-colored paths, reduced to three compact or two reduced-motion strands.
- The broad tail combines two lightweight value-noise octaves with its existing
  filaments to form translucent volumes and sharper wisps.
- Particle seed depth now controls spread, opacity, size, and highlight color,
  creating background dust, mid-layer motes, and rare foreground accents.

The supplied reference image is a visual target only; it is not shipped as a
texture or downloaded at runtime. Phase 6 stabilization adds:

- Explicit `webglcontextlost` handling that pauses the loop and abandons invalid
  resource wrappers, followed by full scene reconstruction on
  `webglcontextrestored`.
- `?comet-still=<0..1>` for deterministic capture at a fixed flight position and
  `&comet-reduced-motion=1` for the corresponding accessibility baseline.
- `?comet-context-test=1` to exercise the browser's real
  `WEBGL_lose_context` restoration path.
- Development-only 240-frame average, p95, and long-frame diagnostics exposed
  as `data-aegis-*` attributes on the canvas.

All Phase 6 engineering work is complete. Physical-device screenshots and a
mobile trace remain release sign-off evidence because no controllable browser or
attached mobile device was available in the implementation environment. Do not
claim those observations until they are captured. Adaptive quality remains
deferred unless measurements demonstrate a sustained problem.

## Phase 7 — cinematic arrival and settled composition

Phase 7 changes the comet from a repeating background pass into a composed hero
moment:

- A clamped cubic Bézier moves the head from outside the upper-left boundary to
  desktop NDC `(0.56, 0.16)`, equivalent to approximately 78% width and 42%
  height, over 4.8 seconds.
- A shared pose carries position, screen-space heading, scale, and arrival state
  to the core, tail, energy strands, and particles. Local tail geometry rotates
  before aspect correction, so every layer stays physically connected along
  the diagonal path.
- The final `-0.38` rad desktop heading leaves the luminous head pointing
  downward-right while the long tail extends toward the upper-left, matching
  the supplied concept composition.
- Once settled, position drift is capped at NDC `0.008 × 0.006` and scale
  breathing at 1.5%. Plasma flow, motes, bloom, and bounded fine-pointer
  parallax remain active; the entrance never repeats.
- Compact layouts interpolate to NDC `(0.68, 0.28)` with a `-0.5` rad heading,
  reduced tail density, and the existing particle/strand tiers.
- Reduced motion skips the entrance, breathing, parallax, and continuous RAF,
  rendering the settled composition immediately.

Deterministic Phase 7 captures use `comet-still=0` for the start,
`comet-still=0.5` for descent, and `comet-still=1` for the settled result.

Scroll coupling, stronger parallax, denser particles, and heavier bloom are not
planned without visual and performance evidence.
