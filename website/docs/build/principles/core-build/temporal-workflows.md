---
title: Temporal Workflows
sidebar_label: Temporal Workflows
---

import Lead from '@site/src/components/Lead';

# Temporal Workflows

<Lead>A workflow is the durable orchestration for one payment journey. It sequences the business decision points and delegates every side-effect to activities — it never talks to an external system itself.</Lead>

## One workflow, composed — not subclassed

There is a single workflow per journey (Create Immediate Payment, Execute Scheduled Payment, and so on). The variation between markets does not come from alternate workflow subclasses; it comes from swapping the **Stage** and **ActivityGroup** implementations the workflow composes. Two rules keep this clean:

- **No inheritance.** Workflows (and Stages) are never `abstract` — the platform composes behaviour rather than extending it.
- **No alternate workflow implementations.** A market never gets its own copy of a workflow. It gets its own Stage and ActivityGroup implementations, selected from its dimensions.

So the workflow code reads the same in every market; what changes underneath is which stage runs.

## What a workflow may do

A workflow orchestrates. It may call other workflows, Stages, ActivityGroups, and Activities — but **not** Clients or external systems directly; that is the activity's job. Keeping I/O out of the workflow is what lets Temporal recover a payment's state by replaying the workflow after a restart or failure.

## The Temporal primitives the flows rely on

- **Child workflows** — a parent fans out to children: Create Immediate Payment triggers Get Corporate Payment Allocations, then an Execute Split Payment per allocation.
- **Signals** — a corporate payment waits on the *AllocationsReceived* signal before it continues past `ALLOCATING`.
- **Early return** — once a payment is accepted, the workflow returns to the caller while the rest of the processing runs in the background.

## Dimensions must be set first

A workflow is started with all four dimensions (`accountType`, `requiresArPosting`, `requiresRealtimeClearing`, `requiresMandateAuthorization`) already present in the payment context — they are what select the stage and activity-group implementations. A dimension combination a market never onboarded has no implementation, so the workflow is rejected before it starts.

## Where they live

Default implementations sit under `core/lib/workflows/impl/`; a market's overrides under `market/{market}/workflows/`. Workflows are named `{Market}InitiatePaymentWorkflow`.
