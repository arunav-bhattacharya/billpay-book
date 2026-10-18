---
title: Observability
description: 'How we watch Billpay in production: the dashboards that show the platform is healthy, the service-level targets it is held to, and the alerts that fire when it is not.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Observability

<Lead>How we watch Billpay in production: the dashboards that show the platform is healthy, the service-level targets it is held to, and the alerts that fire when it is not.</Lead>

Most trouble in this design shows up as a delay, not a failure. When a downstream slows, the database runs hot or the governor stops, payments wait where they are and resume on their own. So watching Billpay is mostly watching for work that waits too long: a backlog that ages, a cutoff that drifts closer, a payment that stays `PROCESSED`.

## In this section

<SectionIndex
  items={[
    {
      term: 'Monitoring',
      to: '/docs/observability/monitoring',
      desc: `App health, both Temporal clusters, the governor and its dispatchers, and the SLA, SLI and SLO targets.`,
    },
    {
      term: 'Alerts',
      to: '/docs/observability/alerts',
      desc: `Every alert Billpay raises, what fires it, and what people do when it does.`,
    },
  ]}
/>
