# 007 — WebGL2 comet hero

**Status:** Phases 1–5 implemented; Phase 6 in progress
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
| 6 — in progress | Translate the supplied concept art into procedural depth cues: a shaded volumetric head, orbital loop, instanced energy strands, density breakup, and depth-tiered motes. Finish with screenshot baselines, real-device GPU profiling, context-loss testing, and measured release gates. |

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
- WebGL2 failure leaves the semantic page and its CSS background intact.

## Verification

For Phases 1–5, TypeScript and the production Next.js build passed. Visual
review covered desktop, mobile-width, reduced-motion, pointer movement, resize,
tab visibility, and transparent compositing. Phase 6 adds repeatable evidence
and real-device coverage to those checks.

Do not run `next build` while a development server is using the same checkout:
both processes mutate `.next`, which can create misleading missing-manifest
errors. Stop the dev server, build, then restart it.

## Phase 6 — stabilization and release validation

The reference-driven implementation portion is complete. It derives perceived
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
texture or downloaded at runtime. Remaining Phase 6 validation deliverables are:

- Capture stable desktop, mobile, and reduced-motion screenshot baselines.
- Profile representative integrated-GPU and mobile devices and record frame
  pacing, memory pressure, and resize behavior.
- Exercise `webglcontextlost` and `webglcontextrestored`; implement explicit
  restoration only if the current fallback does not recover cleanly.
- Verify the Vercel preview and production landing page with no shader, console,
  transparency, or layout regressions.
- Add adaptive DPR, particle, or bloom quality only when measurements show a
  sustained performance problem.

Phase 6 is complete when the evidence is recorded, release checks pass, and any
measured blocker is fixed. It is a validation phase, not a mandate to add more
visual intensity or interaction.

Scroll coupling, stronger parallax, denser particles, and heavier bloom are not
planned without visual and performance evidence.
