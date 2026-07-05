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
| **Stage** | `core/lib/stages/impl/` | `market/{m}/stages/` | `{From}To{To}Stage` — e.g. `InitiatedToPendingStage` |
| **ActivityGroup** | `core/lib/activityGroups/` | `market/{m}/activityGroups/` | `{Responsibility}ActivityGroup` |
| **Activity** | `core/lib/activities/` + `impl/` | — | `{Action}Activity` / `{Action}ActivityImpl` |
| **Client** | `core/lib/clients/` | — | `{System}Client` |

Two things to notice. Activities and clients have **no market column** — they are shared everywhere, by design; market variation lives one level up, in which stage or activity-group implementation gets composed in. And workflows almost never need a market override either: one workflow per journey is the rule, and a market that needs different behaviour supplies different *stages*, not a different workflow.

## The dependency rule the build enforces

Workflow code may depend on **stage, activity-group, and activity interfaces — never on activity implementations, and never on clients.** The Gradle module graph makes the violation a compile error, not a review comment.

This isn't tidiness. Temporal replays workflow code from its event history to recover state, which only works if the code is deterministic — no I/O, no clocks, no randomness. Keeping the implementations (where all the I/O lives) out of the workflow's compile-time reach means the workflow *can't* cheat, even accidentally. The [workflows page](./workflows.md) covers what determinism demands in practice.

## What a change touches

- **New behaviour shared by every market** → `core/lib`, in whichever layer owns it.
- **A market doing something different** → that market's `market/{m}/stages/` or `market/{m}/activityGroups/` only. The workflow, activities, and clients don't change.
- **A new downstream system** → a new `{System}Client` in `core/lib/clients/`, plus the activity that calls it.

Name implementations for the **behaviour**, not the market: a stage that skips realtime clearing is `NonRealtimeClearingExecutionStage`-shaped, not `GermanyExecutionStage` — the next market with the same rule reuses it instead of copying it.

The deployables this monorepo produces — the worker app (one JVM hosting both the Online and Offline workers), codec server, UI, mocks — are covered under [Deployment](../../../deployment/deployables/index.md).
