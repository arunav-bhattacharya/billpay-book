---
title: Workflows
---

import Lead from '@site/src/components/Lead';

# Workflows

<Lead>A workflow orchestrates one payment journey end to end. Every workflow runs on Temporal, falls into one of three kinds, and executes on the Online or Offline worker depending on whether an end user is waiting for it.</Lead>

## The two workers

- The **Online worker** runs workflows an end user is waiting on: an immediate payment, an update, a cancellation, a payment intent.
- The **Offline worker** runs everything triggered asynchronously: scheduled execution, inbound payments, returns, and the periodic sweeps.

Three workflows run on either worker, depending on where in the journey they are called: Create Schedule Payment, Execute Split Payment, and Create Balance Refund.

## Three kinds

- [Core](./core.md) workflows are triggered per request: create, update, cancel, execute, return, represent, allocate.
- [Composite](./composite.md) workflows wrap one or more core workflows and add logic that spans domains, such as installments or multi-instruction payments.
- [Periodic](./periodic.md) workflows are scheduler driven and run in waves: executing scheduled payments, processing allocations and representments, closing out paid events, and purging old data.
