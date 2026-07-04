// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Vision',
      collapsed: false,
      link: {type: 'doc', id: 'vision/index'},
      items: [
        'vision/product',
        'vision/engineering',
      ],
    },
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      link: {type: 'doc', id: 'architecture/index'},
      items: [
        'architecture/overview',
        'architecture/components',
      ],
    },
    {
      type: 'category',
      label: 'Design',
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
          items: [
            'design/journeys/apis',
            'design/journeys/schedulers',
          ],
        },
        {
          type: 'category',
          label: 'Workflows',
          collapsed: true,
          link: {type: 'doc', id: 'design/workflows/index'},
          items: [
            'design/workflows/core',
            'design/workflows/composite',
            'design/workflows/scheduled',
            'design/workflows/event-handlers',
          ],
        },
        'design/services',
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
              label: 'Tool Selection',
              collapsed: true,
              link: {type: 'doc', id: 'build/principles/tool-selection/index'},
              items: [
                'build/principles/tool-selection/http-client',
                'build/principles/tool-selection/database',
                'build/principles/tool-selection/datasource',
                'build/principles/tool-selection/orm',
              ],
            },
            {
              type: 'category',
              label: 'Core Build',
              collapsed: true,
              link: {type: 'doc', id: 'build/principles/core-build/index'},
              items: [
                'build/principles/core-build/temporal-workflows',
                'build/principles/core-build/payment-services',
                'build/principles/core-build/temporal-activities',
              ],
            },
          ],
        },
        'build/one-data',
        {
          type: 'category',
          label: 'Billpay-core',
          collapsed: true,
          link: {type: 'doc', id: 'build/billpay-core/index'},
          items: [
            'build/billpay-core/modules-in-monorepo',
          ],
        },
        {
          type: 'category',
          label: 'API Spec',
          collapsed: true,
          link: {type: 'doc', id: 'build/api-spec/index'},
          items: [
            'build/api-spec/one-data',
            'build/api-spec/billpay-core',
          ],
        },
        {
          type: 'category',
          label: 'Data Model',
          collapsed: true,
          link: {type: 'doc', id: 'build/data-model/index'},
          items: [
            'build/data-model/domain',
            'build/data-model/database',
          ],
        },
        {
          type: 'category',
          label: 'Workflows',
          collapsed: true,
          link: {type: 'doc', id: 'build/workflows/index'},
          items: [
            'build/workflows/interfaces',
          ],
        },
        {
          type: 'category',
          label: 'Services',
          collapsed: true,
          link: {type: 'doc', id: 'build/services/index'},
          items: [
            'build/services/interfaces',
            'build/services/strategies',
            {
              type: 'category',
              label: 'Proposal',
              collapsed: true,
              link: {type: 'doc', id: 'build/services/proposal/index'},
              items: [
                'build/services/proposal/interfaces',
                'build/services/proposal/strategies',
                'build/services/proposal/data-flow',
                'build/services/proposal/annotations',
                'build/services/proposal/variant-resolution',
                'build/services/proposal/rule-engine',
                'build/services/proposal/tooling-rationale',
                'build/services/proposal/faqs',
              ],
            },
          ],
        },
        {
          type: 'category',
          label: 'Activities',
          collapsed: true,
          link: {type: 'doc', id: 'build/activities/index'},
          items: [
            'build/activities/interfaces',
          ],
        },
        'build/schedules',
      ],
    },
    {
      type: 'category',
      label: 'Testing',
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
          items: [
            'testing/non-functional/performance',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
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
            'deployment/deployables/realtime-app',
            'deployment/deployables/batch-app',
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
          items: [
            'observability/alerts/kibana',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Operations',
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
    {
      type: 'category',
      label: 'Contributing',
      collapsed: true,
      link: {type: 'doc', id: 'contributing/index'},
      items: [
        'contributing/run-locally',
        'contributing/publish',
      ],
    },
  ],
};

export default sidebars;
