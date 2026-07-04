// @ts-check
// Docusaurus config — Billpay Wiki
// Replace the GH_USER placeholder before deploying to GitHub Pages.

import {themes as prismThemes} from 'prism-react-renderer';

const GH_USER = 'arunav-bhattacharya'; // <-- replace with your GitHub username / org
const REPO_NAME = 'billpay-wiki';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Billpay Wiki',
  tagline: 'APIs, Workflows & State Machines that power payments',
  favicon: 'img/favicon.svg',

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

  onBrokenLinks: 'warn',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

  clientModules: [
    require.resolve('./src/clientModules/colorize-mermaid-notes.js'),
    require.resolve('./src/clientModules/inject-gantt-gradients.js'),
    require.resolve('./src/clientModules/inject-proposal-flowchart-gradients.js'),
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {tagName: 'link', attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'}},
    {tagName: 'link', attributes: {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous'}},
  ],

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      rel: 'stylesheet',
    },
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: 'docs',
          editUrl: `https://github.com/${GH_USER}/${REPO_NAME}/edit/main/`,
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
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
          fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
          flowchart: {
            htmlLabels: true,
            useMaxWidth: true,
            nodeSpacing: 60,
            rankSpacing: 70,
            padding: 16,
            curve: 'basis',
          },
          sequence: {
            actorFontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
            noteFontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
            messageFontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
            actorFontSize: 12,
            messageFontSize: 11,
            noteFontSize: 11,
            wrap: true,
            boxMargin: 10,
            boxTextMargin: 4,
            noteMargin: 10,
            messageMargin: 35,
            useMaxWidth: true,
            actorMargin: 20,
            width: 170,
          },
          state: {
            useMaxWidth: true,
            padding: 16,
            nodeSpacing: 70,
            rankSpacing: 80,
          },
          gantt: {
            useMaxWidth: true,
            leftPadding: 260,
            rightPadding: 48,
            topPadding: 48,
            barHeight: 28,
            barGap: 14,
            fontSize: 13,
            sectionFontSize: 14,
            gridLineStartPadding: 260,
            numberSectionStyles: 5,
            tickInterval: '2minute',
          },
          themeVariables: {
            fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
          },
        },
      },
      navbar: {
        title: 'Billpay Wiki',
        logo: {
          alt: 'Billpay',
          src: 'img/logo.svg',
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
              {label: 'Payment Services', to: '/docs/design/services'},
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
            title: 'Observability',
            items: [
              {label: 'SLA · SLI · SLO', to: '/docs/observability/monitoring/sla-sli-slo'},
              {label: '— One-Data Functions', to: '/docs/observability/monitoring/sla-sli-slo/one-data-functions'},
              {label: '— Billpay Core APIs', to: '/docs/observability/monitoring/sla-sli-slo/billpay-apis'},
            ],
          },
          {
            title: 'Contributing',
            items: [
              {label: 'Run Locally', to: '/docs/contributing/run-locally'},
              {label: 'Publish to GitHub Pages', to: '/docs/contributing/publish'},
            ],
          },
        ],
        copyright: `Billpay Wiki — © ${new Date().getFullYear()}`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'yaml'],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
};

export default config;
