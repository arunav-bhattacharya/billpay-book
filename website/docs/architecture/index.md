---
title: Architecture
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Architecture

<Lead>Billpay is **layered so each tier has one responsibility**. A request travels from the API gateway at the top down to the systems that move the money, and async outcomes loop back in through event handlers.</Lead>

## In this section

<SectionIndex
  items={[
    {
      term: 'Overview',
      to: '/docs/architecture/overview',
      desc: `The system mapped from One-Data Functions through the workflows to the downstream systems, where the two worker pools run, and why the platform is built on Temporal.`,
    },
    {
      term: 'High Availability',
      to: '/docs/architecture/high-availability',
      desc: `Where everything physically runs, across the on-prem sites and AWS, and what fails over to what.`,
    },
  ]}
/>
