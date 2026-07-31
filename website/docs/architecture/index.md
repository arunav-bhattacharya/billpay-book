---
title: Architecture
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Architecture

<Lead>Billpay is **layered so each tier has one responsibility**. A request travels from the API gateway at the top down to the systems that move the money, and async outcomes loop back in through event handlers.</Lead>

## Pages in this section

<Highlights
  accent="var(--amex-cat-architecture)"
  items={[
    {
      term: 'Overview',
      to: '/docs/architecture/overview',
      desc: `The system mapped from One-Data Functions through the workflows to the downstream systems, and why the platform is built on Temporal.`,
    },
    {
      term: 'Components in Detail',
      to: '/docs/architecture/components',
      desc: `Each block taken in turn: the router, the Online and Offline workers, the component model, the event handlers, and the schedules.`,
    },
    {
      term: 'High Availability',
      to: '/docs/architecture/high-availability',
      desc: `Where everything physically runs, across two on-prem sites and two AWS regions, and what fails over to what.`,
    },
  ]}
/>
