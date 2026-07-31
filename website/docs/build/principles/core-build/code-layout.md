---
title: Code Layout
sidebar_label: Code Layout
---

import Lead from '@site/src/components/Lead';

# Code Layout

<Lead>billpay-core is one Gradle monorepo. The layout follows a single idea: shared behaviour lives once under <code>core/lib</code>, market-specific behaviour lives only in that market's package, and the build itself stops workflow code from seeing anything that would break its determinism.</Lead>

## Where everything lives

| Component | Default (shared) | Market override |
| --- | --- | --- |
| **Workflow** | `core/lib/workflows/impl/` | `market/{m}/workflows/` |
| **Stage** | `core/lib/stages/impl/` | `market/{m}/stages/` |
| **ActivityGroup** | `core/lib/activityGroups/` | `market/{m}/activityGroups/` |
| **Activity** | `core/lib/activities/` + `impl/` | None |
| **Client** | `core/lib/clients/` | None |

What each type is called is in the [naming conventions](../../../design/principles.md#naming-conventions).

Two things to notice. Activities and clients have **no market column**, because they are shared everywhere by design. Market variation lives one level up, in which stage or activity-group implementation gets composed in. Workflows almost never need a market override either. One workflow per journey is the rule, and a market that needs different behaviour supplies different *stages*, not a different workflow. The spec still reserves a `market/{m}/workflows/` path and a `{Market}`-prefixed workflow name for the case where a market genuinely cannot share one, so the door is open and nothing has walked through it yet.

## The dependency rule the build enforces

Workflow code may depend on **stage, activity-group, and activity interfaces. Never on activity implementations, and never on clients.** The Gradle module graph makes the violation a compile error, not a review comment.

This is not tidiness. It is how the module graph enforces [determinism](./workflows.md#why-workflow-code-must-be-deterministic): keeping the implementations, where all the I/O lives, out of the workflow's compile-time reach means the workflow *cannot* cheat, even accidentally.

## What a change touches

- New behaviour shared by every market goes in `core/lib`, in whichever layer owns it.
- A market doing something different changes only that market's `market/{m}/stages/` or `market/{m}/activityGroups/`. The workflow, activities, and clients stay as they are.
- A new downstream system means a new `{System}Client` in `core/lib/clients/`, plus the activity that calls it.

This is where the name-for-behaviour rule earns its keep. A stage that skips realtime clearing is called something like `NonRealtimeClearingExecutionStage`, not `GermanyExecutionStage`, so the next market with the same rule reuses the file instead of copying it.

The deployables this monorepo produces are covered under [Deployment](../../../deployment/deployables/index.md): the worker app (one JVM hosting both the Online and Offline workers), the codec server, the UI, and the mocks.
