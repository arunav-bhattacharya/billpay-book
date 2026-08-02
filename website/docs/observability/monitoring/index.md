---
title: Monitoring
description: 'Three views on a running platform: the health of the Billpay apps themselves, the health of the Temporal cluster underneath them, and the service-level targets both are measured against.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Monitoring

<Lead>Three views on a running platform: the health of the Billpay apps themselves, the health of the Temporal cluster underneath them, and the service-level targets both are measured against.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'App Health',
      to: '/docs/observability/monitoring/app-health',
      desc: `The Hydra console and the Opensearch dashboard.`,
    },
    {
      term: 'Temporal Health',
      to: '/docs/observability/monitoring/temporal-health',
      desc: `The Grafana dashboard for the Temporal cluster.`,
    },
    {
      term: 'SLA · SLI · SLO',
      to: '/docs/observability/monitoring/sla-sli-slo',
      desc: `The commitments, the targets, and what we measure.`,
    },
  ]}
/>
