// @ts-check
// Nav tree for the Billpay Wiki. Structure mirrors the reference billpay-wiki,
// minus the banned Services / Payment-Services pages and the non-spec-supported
// tool-selection subtree. See CONTENT_PLAN.md for the treatment of each section.

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Vision',
      className: 'sidebar-sec sidebar-sec--vision',
      collapsed: false,
      link: {type: 'doc', id: 'vision/index'},
      items: ['vision/product', 'vision/engineering'],
    },
    {
      type: 'category',
      label: 'Architecture',
      className: 'sidebar-sec sidebar-sec--architecture',
      collapsed: false,
      link: {type: 'doc', id: 'architecture/index'},
      items: ['architecture/overview', 'architecture/components'],
    },
    {
      type: 'category',
      label: 'Design',
      className: 'sidebar-sec sidebar-sec--design',
      collapsed: false,
      link: {type: 'doc', id: 'design/index'},
      items: [
        'design/principles',
        'design/payment-state-model',
        {
          type: 'category',
          label: 'Journeys',
          collapsed: true,
          link: {type: 'doc', id: 'design/journeys/index'},
          items: ['design/journeys/apis', 'design/journeys/schedulers'],
        },
        {
          type: 'category',
          label: 'Workflows',
          collapsed: true,
          link: {type: 'doc', id: 'design/workflows/index'},
          items: [
            'design/workflows/core',
            'design/workflows/composite',
            'design/workflows/periodic',
          ],
        },
        'design/stages',
        'design/activities',
        'design/database',
        {
          type: 'category',
          label: 'Diagrams',
          collapsed: true,
          link: {type: 'doc', id: 'design/diagrams/index'},
          items: [
            'design/diagrams/state-diagram',
            'design/diagrams/sequence-diagram',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Build',
      className: 'sidebar-sec sidebar-sec--build',
      collapsed: true,
      link: {type: 'doc', id: 'build/index'},
      items: [
        {
          type: 'category',
          label: 'Principles',
          collapsed: true,
          link: {type: 'doc', id: 'build/principles/index'},
          items: [
            {
              type: 'category',
              label: 'Tech Stack',
              collapsed: true,
              link: {type: 'doc', id: 'build/principles/tech-stack/index'},
              items: [
                'build/principles/tech-stack/database',
                'build/principles/tech-stack/datasource',
                'build/principles/tech-stack/orm',
                'build/principles/tech-stack/http-client',
                'build/principles/tech-stack/serialization',
              ],
            },
            {
              type: 'category',
              label: 'Core Build',
              collapsed: true,
              link: {type: 'doc', id: 'build/principles/core-build/index'},
              items: [
                'build/principles/core-build/code-layout',
                'build/principles/core-build/workflows',
                'build/principles/core-build/stages',
                'build/principles/core-build/activities',
                'build/principles/core-build/clients',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'API Spec',
          collapsed: true,
          link: {type: 'doc', id: 'build/api-spec/index'},
          items: ['build/api-spec/one-data', 'build/api-spec/billpay-core'],
        },
        {
          type: 'category',
          label: 'Data Model',
          collapsed: true,
          link: {type: 'doc', id: 'build/data-model/index'},
          items: [
            'build/data-model/payment',
            'build/data-model/payment-options',
            'build/data-model/instruments',
            'build/data-model/database',
          ],
        },
        'build/schedules',
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      className: 'sidebar-sec sidebar-sec--testing',
      collapsed: true,
      link: {type: 'doc', id: 'testing/index'},
      items: [
        {
          type: 'category',
          label: 'Functional',
          collapsed: true,
          link: {type: 'doc', id: 'testing/functional/index'},
          items: [
            'testing/functional/unit',
            'testing/functional/integration',
            'testing/functional/replay',
            'testing/functional/e2e',
          ],
        },
        {
          type: 'category',
          label: 'Non-Functional',
          collapsed: true,
          link: {type: 'doc', id: 'testing/non-functional/index'},
          items: ['testing/non-functional/performance'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      className: 'sidebar-sec sidebar-sec--deployment',
      collapsed: true,
      link: {type: 'doc', id: 'deployment/index'},
      items: [
        {
          type: 'category',
          label: 'Deployables',
          collapsed: true,
          link: {type: 'doc', id: 'deployment/deployables/index'},
          items: [
            'deployment/deployables/one-data-functions',
            'deployment/deployables/online-worker-app',
            'deployment/deployables/offline-worker-app',
            'deployment/deployables/codec-server-app',
            'deployment/deployables/ui-app',
            'deployment/deployables/mocks-app',
          ],
        },
        'deployment/ci-checks',
        'deployment/code-merge-strategy',
        'deployment/pipeline',
      ],
    },
    {
      type: 'category',
      label: 'Observability',
      className: 'sidebar-sec sidebar-sec--observability',
      collapsed: true,
      link: {type: 'doc', id: 'observability/index'},
      items: [
        {
          type: 'category',
          label: 'Monitoring',
          collapsed: true,
          link: {type: 'doc', id: 'observability/monitoring/index'},
          items: [
            'observability/monitoring/app-health',
            'observability/monitoring/temporal-health',
            {
              type: 'category',
              label: 'SLA · SLI · SLO',
              collapsed: true,
              link: {type: 'doc', id: 'observability/monitoring/sla-sli-slo/index'},
              items: [
                'observability/monitoring/sla-sli-slo/one-data-functions',
                'observability/monitoring/sla-sli-slo/billpay-apis',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'Alerts',
          collapsed: true,
          link: {type: 'doc', id: 'observability/alerts/index'},
          items: ['observability/alerts/kibana'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Operations',
      className: 'sidebar-sec sidebar-sec--operations',
      collapsed: true,
      link: {type: 'doc', id: 'operations/index'},
      items: [
        {
          type: 'category',
          label: 'Familiarity',
          collapsed: true,
          link: {type: 'doc', id: 'operations/familiarity/index'},
          items: [
            'operations/familiarity/temporal-web-ui',
            'operations/familiarity/billpay-ui',
            'operations/familiarity/opensearch-logs',
            'operations/familiarity/tracing-ui',
            'operations/familiarity/temporal-server-aws',
            'operations/familiarity/temporal-db-aws',
            'operations/familiarity/oracle-db',
          ],
        },
        'operations/sops',
      ],
    },
  ],
};

export default sidebars;
