---
title: Alerts
description: 'Monitoring tells us how the platform is doing; alerting is what turns a bad signal into action.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Alerts

<Lead>Monitoring tells us how the platform is doing; alerting is what turns a bad signal into action. Billpay's alerts run through Kibana.</Lead>

An alert in this design rarely means something broke. Most failures heal themselves: calls wait out a 429, payments pause during an Oracle patch, dispatchers catch up after an outage. An alert fires when waiting has gone on long enough that a person should look, or when the system has done all it can and handed a payment over.

## In this section

<SectionIndex
  items={[
    {
      term: 'Kibana Alerts',
      to: '/docs/observability/alerts/kibana',
      desc: `The catalogue: every alert, what fires it, and what people do, with a link to the runbook where there is one.`,
    },
  ]}
/>
