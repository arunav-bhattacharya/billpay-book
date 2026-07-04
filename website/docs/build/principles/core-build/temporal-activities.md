---
title: Temporal Activities
sidebar_label: Temporal Activities
---

import Lead from '@site/src/components/Lead';

# Temporal Activities

<Lead>An activity is one retryable business action — publish an event, persist a record, update a downstream balance. Activities are where the platform's I/O happens, and they are deliberately thin.</Lead>

## Thin, shared, retryable

- **One action each.** An activity does a single thing that can be safely retried, and delegates the protocol details to a **Client** — the adapter to one external system.
- **Shared across markets.** The same activity is reused everywhere; the per-market difference lives in the ActivityGroup that coordinates activities, not in the activity itself.
- **Pass only what it needs.** An activity is called with just the fields it requires, never the whole `Payment` object.

## Grouped by concern

Related activities are coordinated by an **ActivityGroup**, named for the business concern it serves (`PaymentExecutionActivityGroup`, `PaymentValidationActivityGroup`, …). A Stage calls an ActivityGroup, the ActivityGroup calls its activities, and an activity calls its Client. Nothing skips a layer, and nothing calls back upward.

## Where they live

Activities sit under `core/lib/activities/` (interface) and `impl/` (implementation), named `{Action}Activity` / `{Action}ActivityImpl`. ActivityGroups sit under `core/lib/activityGroups/` (shared) or `market/{market}/activityGroups/` (market-specific), named `{Responsibility}ActivityGroup`. Clients live under `core/lib/clients/`, named `{System}Client`. The [component model](../../../design/principles.md) sets out the full call rules.
