---
id: publish
title: Publish to GitHub Pages
sidebar_position: 2
---

# Publish to GitHub Pages

There are two ways to publish: a **one-shot `npm run deploy`** from your
laptop, or a **GitHub Actions workflow** that publishes on every push to
`main`. Use the Actions route for any docs site beyond a personal one.

## Prerequisites

1. A GitHub repo for this site — recommended name: **`billpay-wiki`**.
2. Replace the placeholder values in `docusaurus.config.js`:

```js
const GH_USER  = 'YOUR_GH_USER';  // e.g. 'arunavxxx' or your org name
const REPO_NAME = 'billpay-wiki';
```

The site URL becomes:

```
https://<GH_USER>.github.io/billpay-wiki/
```

If you push to a custom domain, set `url:` to that domain and `baseUrl: '/'`.

## Option A — One-shot deploy from your laptop

Docusaurus ships with a `deploy` script that:

1. Runs `npm run build`
2. Force-pushes `./build/` to the `gh-pages` branch

```bash
# macOS / Linux
GIT_USER=<your-github-username> \
USE_SSH=true \
npm run deploy
```

```bash
# Windows (PowerShell)
$env:GIT_USER="<your-github-username>"
$env:USE_SSH="true"
npm run deploy
```

Then in GitHub → **Settings → Pages**:
- **Source:** `Deploy from a branch`
- **Branch:** `gh-pages` / `/ (root)`

After a minute or two, the site is live at `https://<GH_USER>.github.io/billpay-wiki/`.

## Option B — Continuous deployment with GitHub Actions

Create `.github/workflows/deploy.yml` in the repo root:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then in GitHub → **Settings → Pages**:
- **Source:** `GitHub Actions`

Every push to `main` will rebuild and publish the site automatically.

## Quick deploy checklist

- [ ] `GH_USER` and `REPO_NAME` updated in `docusaurus.config.js`
- [ ] Repo created on GitHub and `main` pushed
- [ ] **Settings → Pages** source configured (`gh-pages` branch *or* `GitHub Actions`)
- [ ] `npm run build` passes locally (no broken links)
- [ ] Site reachable at `https://<GH_USER>.github.io/billpay-wiki/`

## Custom domain (optional)

1. Add a `static/CNAME` file containing your domain, e.g. `billpay-wiki.example.com`.
2. Set `url:` in `docusaurus.config.js` to that domain and `baseUrl: '/'`.
3. Configure the DNS record (CNAME → `<GH_USER>.github.io`).

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| 404 on every page | `baseUrl` doesn't match the path the site is served from. Verify `/<REPO_NAME>/` matches the published path. |
| Mermaid blocks render as code | Confirm `markdown.mermaid: true` and `themes: ['@docusaurus/theme-mermaid']` in `docusaurus.config.js`. |
| Broken-link build failure | Set `onBrokenLinks: 'warn'` in `docusaurus.config.js` *or* fix the link. |
| Actions deploy fails on `actions/deploy-pages` | In **Settings → Pages**, switch the source to **GitHub Actions**. |
