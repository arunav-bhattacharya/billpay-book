---
title: Code Layout
description: 'billpay-core is one Gradle monorepo and one app, which runs the workers for both Temporal clusters.'
sidebar_label: Code Layout
---

import Lead from '@site/src/components/Lead';

# Code Layout

<Lead>billpay-core is one Gradle monorepo and one app, which runs the workers for both Temporal clusters. The layout follows a single idea: shared behavior lives once under <code>core/lib</code>, a market's own behavior lives only in that market's own module, and the build stops workflow code from reaching anything that would break its determinism.</Lead>

## Where everything lives

| Layer | Shared by every market | A market's own |
| --- | --- | --- |
| Workflow | `core/lib/workflows/impl/` | None |
| Stage, with its checks and methods | `core/lib/stages/impl/{step}/`, one folder per step; the shared checks in `core/lib/verification/checks/` | `market/{m}/`: usually a check or a method, and a stage only when the market's flow differs |
| Activity | `core/lib/activities/` and `impl/` | None |
| Client | `core/lib/clients/` | None |

What each type is called is in the [naming conventions](../../../design/principles.md#naming). The Router, the dispatchers and the governor sit beside these four in modules of their own, and the [stage resolver](./stage-resolver.md) and its registries live in the app. The shared checks and rules that Verify, Reverify and Represent use sit in `core/lib/verification/`, with the checks in `checks/` and the rules, with the specifications they use, in `rules/`. Like stage code, they depend only on activity interfaces. Every module that holds stages, checks or methods carries an empty `META-INF/beans.xml`, so Quarkus finds its classes, and a test fails for any class it misses.

Only stages have a market column, because stages, with their checks and methods, are the only layer that varies. There is one implementation of each workflow, and it gets its stages from the stage resolver, never copied per market. Activities and clients are shared by every market by design.

Much of what used to be market code isn't code at all now. A market's execution time, time zone, windows and BOTH rules arrive in a release from the Market Onboarding UI in Control Tower, and the Router reads them at runtime. A new market whose behaviors the build already covers goes live with a release and no deploy ([Market Onboarding](../../../onboarding/index.md)).

## The dependency rule the build enforces

Each layer may depend only on the interfaces of the layer below it:

- Workflow code depends on stage interfaces and the stage resolver. It never sees an activity, a client or another cluster.
- Stage code depends on activity interfaces, and gets their stubs through its `StageContext`. It never sees an activity's implementation or a client.
- Activity implementations depend on clients. A client depends on nothing above it.

The Gradle module graph makes a violation a compile error, not a review comment. That matters most at the top. Stage code runs inside the workflow, so keeping the implementations, where all the I/O lives, out of compile-time reach is how the build enforces [determinism](./workflows.md#why-workflow-code-must-be-deterministic): the workflow can't cheat, even by accident.

## What a change touches

- Behavior every market shares goes in `core/lib`, in whichever layer owns it.
- A market that really does something differently gets a class of its own in `market/{m}/`: usually a check or a method, and a stage only when its flow differs. Its workflows, activities and clients stay as they are.
- A new downstream system means a new `{System}Client`, the `{System}Activities` that calls it, and the stage that uses it.

This is where naming classes for their jobs earns its keep. The check that verifies a mandate is `MandateCheck`, not a Germany check, so the next market that needs a mandate turns the behavior on and gets the same class. Only a class that really belongs to one market carries that market's code, at the front, such as `GBFundsCheck` ([the naming rule](../../../design/component-model/stages.md#naming)).

The deployables this monorepo produces are covered under [Deployment](../../../deployment/deployables/index.md).
