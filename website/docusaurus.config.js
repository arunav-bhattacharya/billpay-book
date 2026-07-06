// @ts-check
// Docusaurus config — Billpay Wiki
// A wiki documenting Amex's Billpay payment platform. Structure mirrors the
// reference billpay-wiki; facts come from docs/Wiki_Spec.md. See ../CLAUDE.md.

import {themes as prismThemes} from 'prism-react-renderer';

// Update these before deploying to GitHub Pages.
const GH_USER = 'arunav-bhattacharya';
const REPO_NAME = 'billpay-book';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Billpay Wiki',
  tagline: "American Express's platform for credit-card bill payments and refunds",
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

  // Text uses SF Pro Rounded, code uses SF Mono — Apple system fonts, so no
  // external webfont (Google Fonts) load is needed.

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

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
        defaultMode: 'dark',
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
          state: {
            useMaxWidth: true,
            padding: 18,
            nodeSpacing: 70,
            rankSpacing: 80,
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
          alt: 'American Express — Billpay Wiki',
          src: 'img/amex-logo.png',
        },
        items: [
          {to: '/docs/vision', label: 'Vision', position: 'left'},
          {to: '/docs/architecture', label: 'Architecture', position: 'left'},
          {to: '/docs/design', label: 'Design', position: 'left'},
          {to: '/docs/build', label: 'Build', position: 'left'},
          {to: '/docs/testing', label: 'Testing', position: 'left'},
          {to: '/docs/observability', label: 'Observability', position: 'left'},
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
              {label: 'Workflows', to: '/docs/design/workflows/core'},
            ],
          },
          {
            title: 'Diagrams',
            items: [
              {label: 'State Diagram', to: '/docs/design/diagrams/state-diagram'},
              {label: 'Sequence Diagram', to: '/docs/design/diagrams/sequence-diagram'},
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
        copyright: `Billpay Wiki — © ${new Date().getFullYear()}`,
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
