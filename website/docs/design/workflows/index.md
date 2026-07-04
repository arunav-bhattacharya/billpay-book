---
title: Workflows
---

import Lead from '@site/src/components/Lead';

# Workflows

<Lead>A workflow orchestrates one payment journey end to end. Every workflow runs on Temporal, falls into one of three kinds, and executes on the Online or Offline worker depending on whether an end user is waiting for it.</Lead>

## The two workers

- **Online worker** — runs workflows an end user is waiting on: an immediate payment, an update, a cancellation, a payment intent.
- **Offline worker** — runs everything triggered asynchronously: scheduled execution, inbound payments, returns, and the periodic sweeps.

A few workflows — Create Schedule Payment, Execute Split Payment, Create Balance Refund — run on either worker, depending on where in the journey they're called.

## Three kinds

- **[Core](./core.md)** — the business workflows triggered per request: create, update, cancel, execute, return, represent, allocate.
- **[Composite](./composite.md)** — workflows that wrap one or more core workflows and add cross-domain logic, such as installments or multi-instruction payments.
- **[Periodic](./periodic.md)** — scheduler-driven workflows that run in waves: executing scheduled payments, processing allocations and representments, closing out paid events, and purging old data.
