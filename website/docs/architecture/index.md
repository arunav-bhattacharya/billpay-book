---
title: Architecture
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Architecture

<Lead>Billpay is **layered so each tier has one responsibility** — a request flows top-to-bottom from the API gateway down to the systems that move the money, and async events loop back in through event handlers.</Lead>

## The Big Picture

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
      desc: `Every payment is a durable Temporal workflow, run on an Online worker (an end user is waiting) or an Offline worker (async — event- or schedule-driven).`,
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
      desc: `Downstream outcomes — money movement, AR posting, Open-To-Buy updates — return as events through handlers, and Temporal Schedules drive the periodic work.`,
    },
  ]}
/>

- **[Overview](./overview.md)** — the system map from One-Data Functions to workflows to downstream systems, and why the platform is Temporal-first.
- **[Components](./components.md)** — a closer look at each block: the router, the Online/Offline workers, the component model, event handlers, and schedules.
- **[High Availability](./high-availability.md)** — where everything physically runs: the two on-prem sites, the two AWS regions, and what fails over to what.
