---
title: Workflow Interfaces
sidebar_label: Interfaces
---

import Lead from '@site/src/components/Lead';

# Workflow Interfaces

<Lead>Each journey is a Temporal workflow definition. There is one per journey, composed from swappable stages — never subclassed per market.</Lead>

A workflow is defined as a Temporal `@WorkflowInterface` and implemented once in the shared core. It orchestrates the journey by calling its stages in order; it may call other workflows, stages, activity groups, and activities, but never a client or external system directly.

- **Location** — `core/lib/workflows/impl/` (default); `market/{market}/workflows/` for a market override.
- **Naming** — `{Market}InitiatePaymentWorkflow`.
- **Not abstract** — workflows are composed, not extended: a market varies the stages a workflow runs, not the workflow class.

The workflows themselves — Core, Composite, and Periodic, with their per-workflow logic — are catalogued in [Design → Workflows](../../design/workflows/index.md). The specific method signatures come from the workflow contracts and are not reproduced here.
