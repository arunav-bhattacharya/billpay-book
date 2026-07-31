---
title: Code Layout
sidebar_label: Code Layout
---

import Lead from '@site/src/components/Lead';

# Code Layout

<Lead>billpay-core is one Gradle monorepo. The layout follows a single idea: shared behaviour lives once under <code>core/lib</code>, market-specific behaviour lives only in that market's package, and the build itself stops workflow code from seeing anything that would break its determinism.</Lead>

## Where everything lives

| Component | Default (shared) | Market override | Naming |
| --- | --- | --- | --- |
| **Workflow** | `core/lib/workflows/impl/` | `market/{m}/workflows/` | `{Market}InitiatePaymentWorkflow` |
| **Stage** | `core/lib/stages/impl/` | `market/{m}/stages/` | `{From}To{To}Stage`, for example `InitiatedToPendingStage` |
| **ActivityGroup** | `core/lib/activityGroups/` | `market/{m}/activityGroups/` | `{Responsibility}ActivityGroup` |
| **Activity** | `core/lib/activities/` + `impl/` | None | `{Action}Activity` / `{Action}ActivityImpl` |
| **Client** | `core/lib/clients/` | None | `{System}Client` |

Two things to notice. Activities and clients have **no market column**, because they are shared everywhere by design. Market variation lives one level up, in which stage or activity-group implementation gets composed in. Workflows almost never need a market override either. One workflow per journey is the rule, and a market that needs different behaviour supplies different *stages*, not a different workflow.

## The dependency rule the build enforces

Workflow code may depend on **stage, activity-group, and activity interfaces. Never on activity implementations, and never on clients.** The Gradle module graph makes the violation a compile error, not a review comment.

This is not tidiness. Temporal replays workflow code from its event history to recover state, and that only works if the code is deterministic: no I/O, no clocks, no randomness. Keeping the implementations, where all the I/O lives, out of the workflow's compile-time reach means the workflow *cannot* cheat, even accidentally. The [workflows page](./workflows.md) covers what determinism demands in practice.

## What a change touches

- New behaviour shared by every market goes in `core/lib`, in whichever layer owns it.
- A market doing something different changes only that market's `market/{m}/stages/` or `market/{m}/activityGroups/`. The workflow, activities, and clients stay as they are.
- A new downstream system means a new `{System}Client` in `core/lib/clients/`, plus the activity that calls it.

Name implementations for the **behaviour**, not the market. A stage that skips realtime clearing is called something like `NonRealtimeClearingExecutionStage`, not `GermanyExecutionStage`, so the next market with the same rule reuses it instead of copying it.

The deployables this monorepo produces are covered under [Deployment](../../../deployment/deployables/index.md): the worker app (one JVM hosting both the Online and Offline workers), the codec server, the UI, and the mocks.
