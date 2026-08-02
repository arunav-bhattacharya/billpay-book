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

From the repo root:

```bash
./start.sh
```

That is the whole thing. The site comes up at <http://localhost:3100/billpay-book/> with hot reload, and `Ctrl-C` stops it.

`start.sh` handles the four things that otherwise go wrong:

- Selects the Node version pinned in `website/.nvmrc`, sourcing nvm itself so it works in a non-interactive shell.
- Refuses to run under an x64 Node on an Apple Silicon Mac. The build pulls native bindings for whichever architecture installed them, so a mismatch fails later with a confusing missing-module error.
- Stops a dev server this repo left on port 3100. If something else holds the port it says so and stops, rather than killing a process it does not own.
- Runs `npm ci` when `node_modules/.bin/docusaurus` is missing. A dependency tree can hold every package and still be missing its `.bin` symlinks, and the failure then reads only as `sh: docusaurus: command not found`.

If you would rather drive it by hand, the equivalent is `cd website && nvm use && npm ci && npm start`. Use `npm ci` rather than `npm install` unless you are deliberately changing dependencies: it reproduces the lockfile exactly, which is what CI does.

Restart the server after editing `website/docusaurus.config.js` or anything under `website/src/theme/`. Hot reload does not cover either.

## Building

These run from `website/`:

```bash
npm run build
```

The static site lands in `website/build/`. Broken internal links fail the build (`onBrokenLinks: 'throw'`). Fix the link rather than lowering the setting.

To check the production bundle before pushing, on port 3101 so it does not collide with the dev server:

```bash
npm run serve
```

Site search is offline: the index is generated during `build` and shipped with the site, so it works only in the built bundle, not under `npm start`.

If a stale cache is confusing you, `npm run clear` wipes `.docusaurus` and `build`.

## Deploying

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds `website/` and publishes to GitHub Pages. There is nothing to run by hand, and pushing to a `gh-pages` branch does nothing.

## Writing content

Every page starts from an entry in `CONTENT_PLAN.md`. `docs/Wiki_Spec.md` wins over anything in `reference/` when the two disagree. `CLAUDE.md` has the style rules and the hard constraints, including the two subsections that must never appear.

New pages go in `website/docs/<section>/<name>.md` and get registered in `website/sidebars.js`. Diagrams can be Mermaid in a fenced code block, which the theme renders and styles natively, or a React component under `website/src/components/` when the layout needs more control.
