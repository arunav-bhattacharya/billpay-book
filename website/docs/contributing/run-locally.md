---
title: Run Locally
---

import Lead from '@site/src/components/Lead';

# Run Locally

<Lead>The site is a standard Docusaurus 3 project living in the `website/` directory of the `billpay-book` repo. You need Node 20+ — the repo pins a version in `.nvmrc`, so `nvm use` gets you the right one.</Lead>

## 1. Install dependencies

```bash
cd billpay-book/website
nvm use
npm ci
```

Prefer `npm ci` over `npm install` — it reproduces the lockfile exactly. On Apple Silicon, make sure you're on an **arm64** Node (the nvm one, not an x64 build under `/usr/local`), or the native bindings will fail.

## 2. Start the dev server

```bash
npm start
```

The dev server is pinned to port **3100**, so the site boots at **http://localhost:3100/billpay-book/** with hot reload.

## 3. Build a production bundle

```bash
npm run build
```

The static site lands in `./build/`. The build fails on broken internal links (`onBrokenLinks: 'throw'`) — that's deliberate; fix the link, don't lower the setting. To smoke-test the production bundle:

```bash
npm run serve
```

## Adding content

| Want to add… | Do this |
| --- | --- |
| A new page | Drop a markdown file into `docs/<section>/<name>.md` and register it in `sidebars.js`. |
| A diagram | Use a fenced ` ```mermaid ` block — the theme renders and styles it natively. |
| A new section | Create `docs/<section>/index.md` and add a `category` entry in `sidebars.js`. |
| A shared component | Put it in `src/components/<Name>/` (see `Lead`, `Highlights`, `RouteMap`, `WorkflowMeta` for the pattern) and import it from your page. |

Two content rules trump everything else: `docs/Wiki_Spec.md` (at the repo root) is the source of truth for every technical fact, and the Design and Build sections must never gain a "Services" subsection in any form — the platform's component model deliberately has no such layer.

## Project layout

```
billpay-book/
├── docs/                     # source spec + domain model (not the website)
│   ├── Wiki_Spec.md
│   └── domainModel/
└── website/
    ├── docs/                 # the wiki content
    │   ├── vision/  architecture/  design/  build/
    │   ├── testing/  deployment/  observability/  operations/
    │   └── contributing/
    ├── src/
    │   ├── components/       # Lead, Highlights, LayerStack, RouteMap, WorkflowMeta
    │   ├── css/custom.css    # the design system (Amex tokens, Mermaid theming)
    │   └── pages/index.js    # landing page
    ├── static/img/
    ├── sidebars.js           # left-nav definition
    └── docusaurus.config.js  # site config
```
