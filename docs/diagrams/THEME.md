# Diagram theme

Every diagram in this repo is an editable mermaid source in `src/*.mmd`, rendered
to a committed `.svg` by `node scripts/render-diagrams.mjs [names…]`. Markdown
embeds the `.svg` — never an inline `mermaid` code block.

## Why structural diagrams are flowcharts, not `C4Container`

The diagrams still follow the **C4 model** — the same levels (context, container,
component) and the same roles (person, container, datastore, external system).
They no longer use mermaid's **C4 syntax**.

Mermaid's C4 renderer lays shapes out on a fixed grid (`$c4ShapeInRow`) and draws
every relationship as a straight line between shape centres. With more than a
handful of elements the lines cut straight through the boxes and the labels pile
up on top of each other. It also offers no colour control.

`flowchart` uses dagre, which ranks nodes by their edges and routes links around
shapes, and `classDef` gives per-role colours. Same model, readable output.

## Palette

Derived from the app's cyan accent (`--accent: #5ad8ff`), shifted to a light
scale because diagrams render on a white background so they stay legible in both
GitHub themes.

| Role | Class | Fill | Stroke | Meaning |
| --- | --- | --- | --- | --- |
| Person | `person` | `#e2e8f0` | `#475569` | Human actor, stadium shape |
| Container | `container` | `#e0f5fd` | `#0891b2` | A deployable/runnable part of Aegis |
| Datastore | `datastore` | `#cbeefb` | `#0e7490` | Database or cache, cylinder shape |
| External | `external` | `#f1f5f9` | `#94a3b8` dashed | System we don't own |
| Boundary | `style` on subgraph | `#fbfdfe` | `#94a3b8` dashed | System or container boundary |

Edges: solid for calls inside the system, dotted (`-.->`) for calls out to an
external system. Line colour `#64748b`, edge labels on white.

## Conventions

- `flowchart TB` at the top level, `direction LR` inside a boundary subgraph —
  this keeps the aspect ratio near 2:1 instead of a thin horizontal strip.
- Node label shape: `<b>Name</b>` / `<small><i>Technology</i></small>` /
  `<small>short description</small>`.
- Externals live outside the boundary subgraph so dagre places them past its edge.
- Non-structural diagrams (sequences, state machines, flows) stay in their native
  mermaid form and are not themed by this palette.

## Adding a diagram

Copy the `%%{init}%%` header and the `classDef` block from
`src/readme-architecture-at-a-glance.mmd`, then render:

```sh
node scripts/render-diagrams.mjs my-new-diagram
```
