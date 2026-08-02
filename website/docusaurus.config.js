// @ts-check
// Docusaurus config for the Billpay Wiki
// A wiki documenting Amex's Billpay payment platform. Structure mirrors the
// reference billpay-wiki; facts come from docs/Wiki_Spec.md. See ../CLAUDE.md.

import {themes as prismThemes} from 'prism-react-renderer';

// Update these before deploying to GitHub Pages.
const GH_USER = 'arunav-bhattacharya';
const REPO_NAME = 'billpay-book';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Billpay Wiki',
  tagline:
    "Architecture, lifecycle, design, engineering standards, and operating guidance for American Express's Billpay platform",
  favicon: 'img/amex-logo.png',

  future: {
    v4: true,
    faster: true,
  },

  url: `https://${GH_USER}.github.io`,
  baseUrl: `/${REPO_NAME}/`,

  organizationName: GH_USER,
  projectName: REPO_NAME,
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // Holds an anchor link on target while Mermaid renders the diagrams above it.
  // See the file for why client-side navigation needs this and a full page load
  // does not.
  clientModules: ['./src/clientModules/anchorScroll.js'],

  // Text uses Benton Sans (the Amex corporate face), self-hosted as WOFF2
  // from src/css/fonts so every browser renders it the same. Code uses SF
  // Mono. See the @font-face block in src/css/custom.css.

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: [
    '@docusaurus/theme-mermaid',
    // Offline search. The site is static on GitHub Pages, so there is no
    // search service to call: this theme builds a Lucene-style index at build
    // time and ships it with the site, and the navbar search box queries it in
    // the browser. The `{type: 'search'}` navbar item below is what places the
    // box; without it the theme appends one at the end of the right-hand
    // items. The dev server serves a live index too, so search works under
    // `npm start` as well as in a production build.
    [
      '@easyops-cn/docusaurus-search-local',
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */
      ({
        hashed: true,
        language: ['en'],
        docsRouteBasePath: '/docs',
        indexDocs: true,
        indexBlog: false,
        // The homepage carries real copy (the section grid, the hero), so it
        // is worth having in the index alongside the docs.
        indexPages: true,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 10,
        searchResultContextMaxLength: 60,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
      }),
    ],
  ],

  plugins: [
    [
      '@docusaurus/plugin-client-redirects',
      {
        // Pages that moved when the wiki was de-duplicated: each fact now has
        // one home, so several pages were merged away. These keep old links
        // and bookmarks working. Paths are written without the baseUrl, which
        // the plugin adds. Redirect files are emitted by `build`, not by the
        // dev server, so test them with `npm run build && npm run serve`.
        redirects: [
          {from: '/docs/design/journeys/api', to: '/docs/design/routing'},
          {from: '/docs/design/journeys/customer-initiated', to: '/docs/design/journeys'},
          {from: '/docs/design/journeys/system-initiated', to: '/docs/design/journeys'},
          {from: '/docs/design/component-model/routing', to: '/docs/design/routing'},
          {from: '/docs/design/diagrams', to: '/docs/design/sequence-diagrams'},
          {
            from: '/docs/design/diagrams/sequence-diagram',
            to: '/docs/design/sequence-diagrams',
          },
          {
            from: '/docs/design/diagrams/state-diagram',
            to: '/docs/design/payment-state-model',
          },
          {from: '/docs/design/database', to: '/docs/build/database'},
          {from: '/docs/build/data-model', to: '/docs/build/domain-model'},
          {from: '/docs/build/data-model/payment', to: '/docs/build/domain-model/payment'},
          {
            from: '/docs/build/data-model/payment-options',
            to: '/docs/build/domain-model/payment-options',
          },
          {
            from: '/docs/build/data-model/instruments',
            to: '/docs/build/domain-model/instruments',
          },
          {from: '/docs/build/data-model/database', to: '/docs/build/database'},
          {from: '/docs/architecture/components', to: '/docs/architecture/overview'},
        ],
      },
    ],
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: 'docs',
          editUrl: `https://github.com/${GH_USER}/${REPO_NAME}/edit/main/website/`,
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.svg',
      colorMode: {
        // Light on a first visit, whatever the visitor's OS is set to, which
        // is what respectPrefersColorScheme: false buys. Dark is a click away
        // and the choice is remembered from then on.
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: false,
        },
      },
      mermaid: {
        theme: {light: 'neutral', dark: 'dark'},
        options: {
          // Colours are driven from custom.css (theme-aware); keep only layout
          // + font here, since Mermaid options are shared across light/dark.
          fontFamily:
            "'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          // No rankSpacing here. Mermaid 11 lays state diagrams out through
          // the shared dagre path, which reads rank separation from the
          // top-level config and never falls through to this block: setting it
          // here moved nothing, at any value. The diagrams that need to be
          // tighter than the 50 default declare `config.rankSpacing` in their
          // own front matter instead, which does work. See the two lifecycle
          // diagrams in design/payment-state-model.md.
          state: {
            useMaxWidth: true,
            padding: 18,
            nodeSpacing: 70,
          },
          // useMaxWidth: false makes Mermaid emit real width and height
          // attributes on the SVG rather than a max-width sized to the
          // column. Sizing then belongs entirely to CSS, which is what lets
          // the same rendered diagram fit the column inline and open at
          // window width or actual size when expanded. See section 14 of
          // custom.css and src/theme/Mermaid.
          //
          // Font size and family are deliberately absent here. Mermaid
          // resolves every *FontSize / *FontFamily from the global fontSize
          // and themeVariables.fontFamily, which are set to mono for the
          // state diagrams, so setting them per element in this block does
          // nothing. Each sequence diagram therefore declares its own face in
          // front matter (`config.fontFamily` / `config.fontSize` above the
          // `sequenceDiagram` line). Sans is both easier to read at this size
          // and about 20% narrower than mono, which is worth a lot on a
          // diagram that already runs past the column.
          //
          // Nothing in CSS may restate those fonts. Mermaid measures each
          // label, then draws its box around the measurement; restyling the
          // text afterwards would push it back out of the box.
          sequence: {
            useMaxWidth: false,
            diagramMarginX: 16,
            diagramMarginY: 14,
            actorMargin: 44,
            width: 170,
            height: 52,
            boxMargin: 14,
            boxTextMargin: 6,
            noteMargin: 12,
            messageMargin: 46,
            mirrorActors: true,
            actorFontWeight: 600,
            // Long message and note labels wrap instead of stretching the gap
            // between two participants. Takes roughly a fifth off the width of
            // the busier diagrams for a few extra pixels of height.
            wrap: true,
            wrapPadding: 10,
          },
          themeVariables: {
            fontFamily:
              "'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          },
        },
      },
      navbar: {
        title: 'Billpay Wiki',
        logo: {
          alt: 'American Express Billpay Wiki',
          src: 'img/amex-logo.png',
        },
        items: [
          {to: '/docs/intro', label: 'Introduction', position: 'left'},
          {to: '/docs/vision', label: 'Vision', position: 'left'},
          {to: '/docs/architecture', label: 'Architecture', position: 'left'},
          {to: '/docs/design', label: 'Design', position: 'left'},
          {to: '/docs/build', label: 'Build', position: 'left'},
          {type: 'search', position: 'right'},
          {
            href: `https://github.com/${GH_USER}/${REPO_NAME}`,
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Vision', to: '/docs/vision'},
              {label: 'Architecture Overview', to: '/docs/architecture/overview'},
              {label: 'APIs', to: '/docs/build/api-spec/billpay-core'},
              {label: 'Workflows', to: '/docs/design/component-model/workflows/core'},
            ],
          },
          {
            title: 'Diagrams',
            items: [
              {label: 'Payment State Model', to: '/docs/design/payment-state-model'},
              {label: 'Sequence Diagrams', to: '/docs/design/sequence-diagrams'},
            ],
          },
          {
            title: 'Operate',
            items: [
              {label: 'Observability', to: '/docs/observability'},
              {label: 'Deployment', to: '/docs/deployment'},
              {label: 'Operations', to: '/docs/operations'},
            ],
          },
          {
            title: 'Contributing',
            items: [
              {label: 'Run Locally', to: '/docs/contributing/run-locally'},
              {label: 'Publish', to: '/docs/contributing/publish'},
            ],
          },
        ],
        copyright: `Billpay Wiki · © ${new Date().getFullYear()}`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'yaml', 'kotlin', 'sql'],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
};

export default config;
