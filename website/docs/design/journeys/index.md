---
title: Payment Journeys
sidebar_label: Journeys
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Payment Journeys

<Lead accent="var(--amex-cat-design)">Every journey through Billpay begins one of two ways. Either a customer asks for it, or an event somewhere else sets it off.</Lead>

## Pages in this section

<Highlights
  accent="var(--amex-cat-design)"
  items={[
    {
      term: 'Customer Initiated',
      to: '/docs/design/journeys/customer-initiated',
      desc: `Paying, scheduling, changing, cancelling, and looking a payment up. Someone is waiting for an answer, so Billpay replies the moment it accepts and finishes the work afterwards.`,
    },
    {
      term: 'System Initiated',
      to: '/docs/design/journeys/system-initiated',
      desc: `A bank sends money back, a third party pushes a payment in, a timer fires to close out settlement. Nobody is waiting, so this runs in the background on its own schedule.`,
    },
    {
      term: 'APIs to Workflows',
      to: '/docs/design/journeys/api',
      desc: `Which API call starts which workflow, so you can trace any request from the endpoint it arrives on to the orchestration that runs it.`,
    },
  ]}
/>
