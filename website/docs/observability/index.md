---
title: Observability
description: 'How we watch Billpay in production: the dashboards that show the platform is healthy, the service-level targets it is held to, and the alerts that fire when it is not.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Observability

<Lead>How we watch Billpay in production: the dashboards that show the platform is healthy, the service-level targets it is held to, and the alerts that fire when it is not.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Monitoring',
      to: '/docs/observability/monitoring',
      desc: `App health (the Hydra console and the Opensearch dashboard), Temporal health (Grafana), and the SLA, SLI, and SLO targets.`,
    },
    {
      term: 'Alerts',
      to: '/docs/observability/alerts',
      desc: `The Kibana alerts, and what to do when one fires.`,
    },
  ]}
/>
