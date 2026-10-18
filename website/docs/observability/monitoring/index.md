---
title: Monitoring
description: 'Four views on a running platform: the Billpay apps, the two Temporal clusters underneath them, the governor and its dispatchers, and the service-level targets all of it is measured against.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Monitoring

<Lead>Four views on a running platform: the Billpay apps, the two Temporal clusters underneath them, the governor and its dispatchers, and the service-level targets all of it is measured against.</Lead>

The pacing view answers a question the others can't. With offline work released at the governor's rate, the question at midnight isn't only whether something is down, but whether the run is moving fast enough to make its cutoff, and what is holding it back if not.

## In this section

<SectionIndex
  items={[
    {
      term: 'App Health',
      to: '/docs/observability/monitoring/app-health',
      desc: `The Hydra console and the OpenSearch dashboard.`,
    },
    {
      term: 'Temporal Health',
      to: '/docs/observability/monitoring/temporal-health',
      desc: `Both clusters on the Grafana dashboard, with the governor's inputs and every task queue's backlog and limit.`,
    },
    {
      term: 'Pacing',
      to: '/docs/observability/monitoring/pacing',
      desc: `The governor and its dispatchers: rates by class, backlogs, in-flight work against the cap, cutoff projections and downstream limits.`,
    },
    {
      term: 'SLA · SLI · SLO',
      to: '/docs/observability/monitoring/sla-sli-slo',
      desc: `The commitments, the targets, and what we measure, including for work nobody waits on.`,
    },
  ]}
/>
