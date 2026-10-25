# Theme research

Checked 30 September 2026, Asia/Bangkok. Scope: complementary modes for Aegis's already accepted identity. No broad landing/login redesign is proposed.

| Reference | Evidence inspected | Adaptation |
| --- | --- | --- |
| [Linear, March 2026 interface refresh](https://linear.app/now/behind-the-latest-design-refresh) | Official article describes restrained neutral colors, predictable hierarchy, softer structural boundaries, and paired default modes. Text/page research; no signed-in product testing. | Keep task content prominent and use a shared semantic language. Aegis keeps its own amber/teal identity; Linear's palette is not copied. |
| [Actual Budget custom themes](https://actualbudget.org/docs/custom-themes/) | Official documentation separates page, table, button, and sidebar roles and describes overrides across light/dark/System choices. Documentation research, not live integration. | Review every control/content state, not just the canvas. Define mode-aware role tokens and preserve explicit preferences. No Actual theme catalog integration is proposed. |
| Aegis accepted spec and local source | `012-aegis-design-spec.md`, route CSS, shared header, providers, and `stores/app-store.ts` inspected. Current landing inspected in the visible browser; original screenshot retained. | Keep Meridian and Focus layouts, original icon, type, and finance meaning. Separate mode from existing named identity; preserve typed input. |

Design proposals derive from these patterns and Aegis's existing system. Reference text does not establish production availability, accessibility certification, or owner acceptance of the new light palettes.
