# Changelog

All 20 phases are complete and load-verified (149/149 source files pass an
isolated fresh-process load check as of the final build). Detailed,
phase-specific changelogs are kept separate rather than merged into one
giant file — each links below.

| Phases | File | Covers |
|---|---|---|
| 1–6 | `CHANGELOG_PHASE1-6.md` | Category hierarchy, Product redesign, Units, dynamic attribute templates, Variant engine, multi-warehouse Inventory |
| 7 | `CHANGELOG_PHASE7.md` | OTP authentication, per-device Sessions, Login History |
| 8–9 | *(pre-existing at time of Phase 10 audit — see `docs/API.md` for current endpoint reference)* | Shiprocket integration, order status timeline |
| 10–11 | *(see `docs/API.md`)* | CMS (pages, home sections, FAQs), Blog |
| 12–13 | *(see `docs/API.md`)* | Media Manager, SEO (sitemap.xml/robots.txt) |
| 14 | *(pre-existing, confirmed complete, not rebuilt)* | Dashboard analytics |
| 15 | `CHANGELOG_PHASE15.md` | Settings module, maintenance mode |
| 16–20 | `CHANGELOG_FINAL.md` | Notifications, Reports, Security, Performance, Production finalization |

**For the complete, current API reference across every phase, see
`docs/API.md`** — it's kept up to date as the single source of truth,
whereas the changelogs above are historical records of what changed and
why at each step.

**For database migration steps on an existing (pre-Phase-1) database, see
`DATABASE_MIGRATION_NOTES.md`.**

**For deployment steps, environment setup, and a production checklist,
see `DEPLOYMENT_GUIDE.md`.**

## Headline breaking changes across the whole project

- `Category.name` is unique per-parent, not globally unique (Phase 1)
- `User.cart[]` items and `Order.items[]` gained a `variant` field —
  default `null`, non-variant products/orders unaffected (Phase 5)
- Error responses now always include `error: {requestId}` rather than
  `error: undefined` in production (Phase 20)

No other breaking changes across Phases 1–20 — everything else is
additive fields, new endpoints, or internal implementation changes behind
an unchanged public API surface.
