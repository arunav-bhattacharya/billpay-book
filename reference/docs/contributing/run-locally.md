---
id: run-locally
title: Run the Docs Site Locally
sidebar_position: 1
---

# Run the Docs Site Locally

This site is a standard [Docusaurus 3](https://docusaurus.io/) project. You
need Node 20+ and npm (Yarn or pnpm also work).

## 1. Install dependencies

```bash
cd billpay-wiki
npm install
```

## 2. Start the dev server

```bash
npm run start
```

Docusaurus will boot on **http://localhost:3000/billpay-wiki/** with hot reload.

:::tip
The `baseUrl` is `/billpay-wiki/` so the local URL includes that prefix. If you
prefer the root path while developing, edit `baseUrl: '/'` in
`docusaurus.config.js` and remember to revert before publishing.
:::

## 3. Build a production bundle

```bash
npm run build
```

The static site lands in `./build/`. To smoke-test the production build:

```bash
npm run serve
```

## 4. Clean caches

```bash
npm run clear
```

## Adding content

| Want to add… | Do this |
| --- | --- |
| A new page | Drop a markdown file into `docs/<section>/<name>.md` and add it to `sidebars.js`. |
| A diagram | Use a fenced ` ```mermaid ` block — the theme renders it natively. |
| A new section | Create `docs/<section>/<intro>.md` and register it as a `category` in `sidebars.js`. |
| A custom React component | Put it in `src/components/` and import from `.mdx` files. |

## Project layout

```
billpay-wiki/
├── docs/                      # markdown content
│   ├── architecture/
│   ├── apis/
│   ├── workflows/
│   ├── services/
│   ├── flows/
│   ├── diagrams/
│   └── operate/
├── src/
│   ├── components/HomepageFeatures/
│   ├── css/custom.css
│   └── pages/index.js         # landing page
├── static/img/                # logo, social card
├── sidebars.js                # left-nav definition
└── docusaurus.config.js       # site config
```
