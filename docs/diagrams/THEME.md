# Diagram theme

Two kinds of diagram live here, and they are produced differently.

| | Structural (C4) | Everything else |
| --- | --- | --- |
| What | context / container / component views | flows, sequences, state machines, ER |
| Source | the `.svg` itself, hand-authored | `src/*.mmd`, rendered by script |
| Count | 7 | 49 |
| Canvas | dark, self-contained | white background |

## Structural diagrams are hand-authored SVG

There is no `.mmd` for these — **the `.svg` is the source**. Edit it directly.

They started as mermaid `C4Container` / `C4Component`. That renderer lays shapes
on a fixed grid and draws every relationship as a straight line between shape
centres, so edges cut through boxes and labels collided. Moving to mermaid
`flowchart` fixed the crossings but left the layout to dagre, which spreads
things where it likes and offers no way to say "this box is the important one".
Placing the coordinates by hand costs more per diagram and buys deliberate
composition — the request path reads top to bottom because that is the order a
request travels, not because a layout engine happened to rank it that way.

The C4 **model** is unchanged: same levels, same person / container / datastore /
external roles, boundaries drawn as dashed rectangles.

## Palette

Derived from the app's cosmic tokens in `frontend/src/app/globals.css`, so the
docs and the product share one identity. The canvas is opaque, so these render
identically under GitHub's light and dark themes.

| Token | Hex | Used for |
| --- | --- | --- |
| void | `#050810` | canvas |
| pane | `#0e1422` | every box fill |
| fg | `#e5ecf5` | element names, title |
| fg-2 | `#b6c2d2` | edge labels |
| dim | `#8499b3` | `[Type]` lines, descriptions |
| dim-2 | `#6a7488` | connectors, external strokes |
| accent | `#5ad8ff` | containers, boundaries, the one call-out line |
| ok | `#59d6a3` | datastores |
| person | `#8aa6c4` | people |

Stroke widths: `2` normal, `2.5` for the element the diagram is *about*,
`1.6` + `stroke-dasharray="6 4"` for externals and boundaries.

## Conventions

- **Every box carries three registers**: name (`16–17px` bold, `fg`), `[Type ·
  Technology]` (`12px`, `dim`), then description (`12.5px`, `dim`). At most one
  line per diagram is `accent` — the thing a reader should leave knowing.
- **Edge labels are short** — `HTTPS`, `SQL`, `tool_use`, `enqueue`. Detail
  belongs inside a box. Long labels are what forced the collisions in the
  mermaid versions; the geometry only works if labels stay under ~14 characters.
- **Order boxes so edges don't cross.** In the container view the bottom row is
  Database │ Worker │ Redis specifically because the worker talks to both
  neighbours; any other order puts a line through a box.
- **Externals sit outside the boundary rectangle**, dashed, muted.
- **`role="img"` plus `<title>` and `<desc>`** on every file. The `<desc>` is a
  plain-English summary for anyone who cannot see the image.
- Diagonals are fine; use an orthogonal `<polyline>` when a straight line would
  cross something.

### Editing one

Open the `.svg`, change the coordinates, and check the result. Nothing to build.
To preview a change:

```sh
/opt/brave.com/brave/brave-browser --headless --disable-gpu \
  --screenshot=/tmp/check.png --window-size=1300,790 \
  docs/diagrams/readme-architecture-at-a-glance.svg
```

Watch for the two failure modes that actually happen: a box growing past its
boundary rectangle, and a label landing on top of a connector.

## The other 49

Flows, sequences, state machines and ER diagrams stay in mermaid — those shapes
are ones mermaid lays out well, and hand-placing a sequence diagram buys
nothing. They live as `src/<name>.mmd` and render with:

```sh
node scripts/render-diagrams.mjs [names…]
```

That script only reads `src/*.mmd`, so it cannot overwrite a hand-authored SVG —
there is no `.mmd` for those seven names.

These are still on a white canvas and carry no role colours, so the two families
do not yet look alike. Unifying them is open work.
