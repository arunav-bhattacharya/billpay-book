---
title: Publish
---

import Lead from '@site/src/components/Lead';

# Publish

<Lead>Publishing is automatic: every push to <code>main</code> triggers the <strong>Deploy to GitHub Pages</strong> workflow, which builds the site and deploys it to <strong>https://arunav-bhattacharya.github.io/billpay-book/</strong>. There is no manual deploy step.</Lead>

## How it works

GitHub Pages for this repo is configured with **Source: GitHub Actions**. The workflow (`.github/workflows/`) checks out `main`, runs `npm ci` and `npm run build` in `website/`, uploads the build as a Pages artifact, and deploys it.

Two consequences worth knowing:

- **Pushing to `main` is publishing.** If the build passes in CI, the change is live a minute or two later.
- **Pushing a `gh-pages` branch does nothing.** The live site serves the workflow's artifact, not a branch — a hand-built `gh-pages` push is silently ignored.

## When the deploy fails

The **Build** job failing means a real problem — usually a broken link (`onBrokenLinks: 'throw'`); fix it and push again.

The **Deploy** job occasionally fails with *"Deployment failed, try again later."* while Build is green. That's a transient on GitHub's side, not your change. Re-run just the failed job:

```bash
gh run list --workflow "Deploy to GitHub Pages" --limit 3
gh run rerun <run-id> --failed
```

It reuses the already-built artifact and typically goes green in seconds.

## Checking what's live

The site serves hashed bundles, so after a deploy give the CDN a minute and hard-refresh. To verify a specific change landed, check the run is green (`gh run list`) and load the page you changed — if it still looks stale, the CDN is catching up, not the deploy failing.
