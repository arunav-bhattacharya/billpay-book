---
title: Architecture
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Architecture

<Lead>Billpay is **layered so each tier has one responsibility**. A request travels from the API gateway at the top down to the systems that move the money, and async outcomes loop back in through event handlers.</Lead>

## How the system fits together

<Highlights
  accent="var(--amex-cat-architecture)"
  items={[
    {
      term: 'A gateway, then a router',
      desc: (
        <>
          Requests enter through versioned <strong>One-Data Functions</strong> and core REST APIs; a <strong>Billpay Router</strong> then picks the workflow from the request's date, instructions, and dimensions.
        </>
      ),
    },
    {
      term: 'Temporal at the core',
      desc: `Every payment is a durable Temporal workflow. It runs on an Online worker when an end user is waiting, and on an Offline worker when an event or a schedule drives it.`,
    },
    {
      term: 'Composed, not branched',
      desc: (
        <>
          A workflow composes <strong>Stages → ActivityGroups → Activities → Clients</strong>; which implementations run is selected from the market's dimensions.
        </>
      ),
    },
    {
      term: 'Events loop back',
      desc: `Downstream outcomes come back as events through handlers: money movement, AR posting, Open-To-Buy updates. Temporal Schedules drive the periodic work.`,
    },
  ]}
/>

- [Overview](./overview.md) maps the system from One-Data Functions through the workflows to the downstream systems, and says why the platform is built on Temporal.
- [Components in Detail](./components.md) takes each block in turn: the router, the Online and Offline workers, the component model, event handlers, and schedules.
- [High Availability](./high-availability.md) covers where everything physically runs, across two on-prem sites and two AWS regions, and what fails over to what.
