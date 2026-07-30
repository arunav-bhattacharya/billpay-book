# Billpay Wiki

A Docusaurus site documenting American Express's Billpay platform: how credit-card bill payments and refunds are processed, and how the payments domain is put together. The audience is company leaders, product owners, and technology leaders.

Published at <https://arunav-bhattacharya.github.io/billpay-book/>.

## Repo layout

```
billpay-book/
├── docs/                  # source material, not the website
│   ├── Wiki_Spec.md       # the technical source of truth
│   └── domainModel/
├── reference/             # snapshot of the older billpay-wiki, read only
├── CONTENT_PLAN.md        # which treatment each page gets
├── CLAUDE.md              # writing rules and hard constraints
└── website/               # the Docusaurus project
    ├── docs/              # the wiki content, one folder per section
    ├── src/components/    # page components (Lead, LandscapeMap, CompareTable, …)
    ├── src/css/custom.css # the design system
    ├── sidebars.js        # left-nav definition
    └── docusaurus.config.js
```

## Running it locally

You need Node 20 or newer. The repo pins a version in `website/.nvmrc`, so `nvm use` picks up the right one. On Apple Silicon, use the arm64 Node from nvm rather than an x64 build under `/usr/local`, or the native build bindings fail.

Everything below runs from `website/`:

```bash
cd website
```

Install:

```bash
nvm use && npm ci
```

`npm ci` reproduces the lockfile exactly, which is what CI does. Use `npm install` only when you are deliberately changing dependencies.

Start the dev server:

```bash
npm start
```

The port is pinned to 3100, so the site comes up at <http://localhost:3100/billpay-book/> with hot reload.

## Building

```bash
npm run build
```

The static site lands in `website/build/`. Broken internal links fail the build (`onBrokenLinks: 'throw'`). Fix the link rather than lowering the setting.

To check the production bundle before pushing:

```bash
npm run serve
```

If a stale cache is confusing you, `npm run clear` wipes `.docusaurus` and `build`.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds `website/` and publishes to GitHub Pages. There is nothing to run by hand, and pushing to a `gh-pages` branch does nothing.

## Writing content

Every page starts from an entry in `CONTENT_PLAN.md`. `docs/Wiki_Spec.md` wins over anything in `reference/` when the two disagree. `CLAUDE.md` has the style rules and the hard constraints, including the two subsections that must never appear.

New pages go in `website/docs/<section>/<name>.md` and get registered in `website/sidebars.js`. Diagrams can be Mermaid in a fenced code block, which the theme renders and styles natively, or a React component under `website/src/components/` when the layout needs more control.
