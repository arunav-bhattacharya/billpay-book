---
title: Architecture
description: 'Billpay is layered so each tier has one responsibility.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Architecture

<Lead>Billpay is **layered so each tier has one responsibility**. A request travels from the API gateway, through the Router, to one of two Temporal clusters, and from there to the systems that move the money. Outcomes that arrive later come back in through event handlers.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Overview',
      to: '/docs/architecture/overview',
      desc: `The system from One-Data Functions to the downstream systems, the two Temporal clusters and what each runs, and why the platform is built on Temporal.`,
    },
    {
      term: 'High Availability',
      to: '/docs/architecture/high-availability',
      desc: `Where everything physically runs, across the on-prem sites and AWS, and what fails over to what, including each cluster's standby.`,
    },
  ]}
/>
