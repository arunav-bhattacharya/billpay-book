---
title: Temporal Workflows
sidebar_position: 1
---

# Temporal Workflows

**Workflows are the spine.** Each payment lifecycle (immediate / scheduled / recurring; pull / push; consumer / corporate) is a Temporal Workflow that encodes *what must happen and in what order*. Workflows do not execute business rules themselves — they call [Payment Services](./payment-services.md) (via [Temporal Activities](./temporal-activities.md)) for that.

## Build-time rules

- **Workflows are deterministic.** Workflow code cannot call `now()`, generate random numbers, or do direct I/O. Everything non-deterministic happens inside an activity. This is what makes the workflow *replay-safe* — Temporal can rebuild its state from event history any time.
- **One workflow per business intent.** `#CreateImmediatePaymentWF`, `#ExecuteScheduledPaymentWF`, `#ProcessReturnedPaymentWF`, etc. — each one owns a single, named slice of the lifecycle. Composite workflows (e.g. `#CreatePaymentWithMultipleInstructionsWF`) orchestrate child workflows; they never inline another workflow's body.
- **Workflow names are versioned contracts.** Renaming or reshaping an already-running workflow type is a breaking change for in-flight executions. Use Temporal's workflow-versioning APIs.
- **Workflow code lives in `:workflow` modules** in the monorepo, separate from services and activities. The build enforces that workflow modules cannot depend on activity *implementations* — only on activity interfaces.

## Naming convention

`#NameWF` hashtag style:
- `#CreateImmediatePaymentWF`
- `#ExecuteScheduledPaymentWF`
- `#ProcessReturnedPaymentWF`

The full list is on the [Design › Workflows](../../../design/workflows/core.md) page.

## Where the variance does **not** live

Workflows are **stable** — they do not change per market, per origination source, or per account-type. If you find yourself adding a per-market `if` to workflow code, you are in the wrong layer — push the variance down into a [Payment Service](./payment-services.md) implementation.

:::tip
Reading [The Payment State Model](../../../design/payment-state-model.md) alongside this page makes the workflow factoring obvious: each workflow drives one slice of state transitions. The state model is the contract between every workflow.
:::
