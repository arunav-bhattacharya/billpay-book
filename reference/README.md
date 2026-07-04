# Reference Snapshot — billpay-wiki

Read-only snapshot of the existing site, captured for **Phase 0**. Used for
**structure, tone, and section boundaries only — never for facts** (facts come
from `../Wiki_Spec.md`; see `../CLAUDE.md` source-of-truth hierarchy).

## Provenance
- Source repo: https://github.com/arunav-bhattacharya/billpay-wiki (public)
- Rendered site: https://arunav-bhattacharya.github.io/billpay-wiki/
- Commit: `a21fd36a48537afe8b9f61da37cc0523b4fc9813` (2026-05-21)
- Captured: 2026-07-03

### How it was captured
The rendered site is a client-rendered Docusaurus SPA, so an HTTP fetch returns
only an empty shell. Rather than scrape the DOM page-by-page (browser extension
was not connected), the **source repo was cloned directly** — the reference site
is itself a Docusaurus project, so this yields the exact authored Markdown, the
real nav tree (`sidebars.js`), and the theme. This is more faithful than SPA
scraping and needs no browser.

## What's included
- `docs/` — all 101 authored `.md`/`.mdx` pages (verbatim)
- `sidebars.js` — the authoritative nav tree (source of the map below)
- `docusaurus.config.js` — navbar, footer, mermaid config, color mode
- `src/css/custom.css` — theme / design tokens
- `src/theme/`, `src/clientModules/` — swizzled components + mermaid gradient hooks

Not copied (not needed for structure/tone): `package*.json`, `static/`, homepage
`src/pages`, `HomepageFeatures`, CI workflow.

## Confirmed nav tree (from `sidebars.js`)
The CONTENT_PLAN's original 7-section table was a reconstruction from the brief.
The **actual** reference sidebar has **10 top-level entries** and is much deeper:

- `intro` (standalone landing doc)
- **Vision** — index · product · engineering
- **Architecture** — index · overview · components
- **Design** — index · principles · payment-state-model · **Journeys** (apis · schedulers) · **Workflows** (core · composite · scheduled · event-handlers) · **services** · database · **Diagrams** (state-diagram · sequence-diagram)
- **Build** — index · **Principles** (**Tool Selection**: http-client · database · datasource · orm; **Core Build**: temporal-workflows · **payment-services** · temporal-activities) · one-data · **Billpay-core** (modules-in-monorepo) · **API Spec** (one-data · billpay-core) · **Data Model** (domain · database) · **Workflows** (interfaces) · **Services** (interfaces · strategies · **Proposal**: interfaces · strategies · data-flow · annotations · variant-resolution · rule-engine · tooling-rationale · faqs) · **Activities** (interfaces) · schedules
- **Testing** — **Functional** (unit · integration · replay · e2e) · **Non-Functional** (performance)
- **Deployment** — **Deployables** (one-data-functions · realtime-app · batch-app · codec-server-app · ui-app · mocks-app) · ci-checks · code-merge-strategy · pipeline
- **Observability** — **Monitoring** (app-health · temporal-health · **SLA·SLI·SLO**: one-data-functions · billpay-apis) · **Alerts** (kibana)
- **Operations** — **Familiarity** (temporal-web-ui · billpay-ui · opensearch-logs · tracing-ui · temporal-server-aws · temporal-db-aws · oracle-db) · sops
- **Contributing** — run-locally · publish

### Navbar vs. sidebar
The top navbar (`docusaurus.config.js`) surfaces only **6** sections as tabs:
Vision · Architecture · Design · Build · Testing · Observability (plus a GitHub
link). Deployment, Operations, Contributing, and `intro` live in the sidebar but
are **not** promoted to the navbar. Footer additionally links Payment Services,
the two Diagrams, SLA·SLI·SLO, and Contributing.

## ⚠️ Flags for later phases (do not act on in Phase 0)
- **Forbidden subsections exist in the reference** and must be dropped in the new
  site per `CLAUDE.md` hard rules:
  - Design → `design/services.md` ("Payment Services"), also linked in the footer.
  - Build → `build/services/**` (the entire "Services" category, incl. Proposal).
  - Build → `build/principles/core-build/payment-services.md`.
- Reference theme uses **Inter** font, dark-default, no pink accent — the new site
  targets the house design system (Google Sans, pink accent). Reference theme is
  for reference, not to copy.
- CONTENT_PLAN's Phase 1 table (7 sections) does not mention Operations,
  Contributing, or `intro`, and flattens Design/Build. Treatment decisions for
  those extra sections are a Phase 1 call, not settled here.
