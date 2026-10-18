---
title: Code Layout
description: 'billpay-core is one Gradle monorepo and one app, which runs the workers for both Temporal clusters.'
sidebar_label: Code Layout
---

import Lead from '@site/src/components/Lead';

# Code Layout

<Lead>billpay-core is one Gradle monorepo and one app, which runs the workers for both Temporal clusters. The layout follows a single idea: shared behavior lives once under <code>core/lib</code>, a market's own behavior lives only in that market's stages, and the build stops workflow code from reaching anything that would break its determinism.</Lead>

## Where everything lives

| Layer | Default (shared) | Market override |
| --- | --- | --- |
| Workflow | `core/lib/workflows/impl/` | None |
| Stage | `core/lib/stages/impl/{step}/`, one folder per step | `market/{m}/stages/` |
| Activity | `core/lib/activities/` and `impl/` | None |
| Client | `core/lib/clients/` | None |

What each type is called is in the [naming conventions](../../../design/principles.md#naming). The Router, the dispatchers and the governor, and the KSP processor that builds the stage index sit beside these four in modules of their own.

Only stages have a market column, because stages are the only layer that varies. There is one implementation of each workflow, composed from different stage implementations, never copied per market. Activities and clients are shared by every market by design.

Much of what used to be market code isn't code at all now. A market's execution time, time zone, windows and BOTH rules arrive in a release from billpay-ui, the onboarding control plane, and the Router reads them at runtime. A new market whose behaviors the build already covers goes live with a release and no deploy ([Market Onboarding](../../../onboarding/index.md)).

## The dependency rule the build enforces

Each layer may depend only on the interfaces of the layer below it:

- Workflow code depends on stage interfaces and the generated stage index. It never sees an activity, a client or another cluster.
- Stage code depends on activity interfaces, to create their stubs. It never sees an activity's implementation or a client.
- Activity implementations depend on clients. A client depends on nothing above it.

The Gradle module graph makes a violation a compile error, not a review comment. That matters most at the top. Stage code runs inside the workflow, so keeping the implementations, where all the I/O lives, out of compile-time reach is how the build enforces [determinism](./workflows.md#why-workflow-code-must-be-deterministic): the workflow can't cheat, even by accident.

## What a change touches

- Behavior every market shares goes in `core/lib`, in whichever layer owns it.
- A market that really does something differently gets a stage implementation in `market/{m}/stages/`. Its workflows, activities and clients stay as they are.
- A new downstream system means a new `{System}Client`, the `{System}Activities` that calls it, and the stage that uses it.

This is where the name-for-behavior rule earns its keep. The Verify that checks a mandate is `PaymentVerifyStageWithMandate`, not `GermanyVerifyStage`, so the next market that needs a mandate reuses the file instead of copying it. Only a real market override carries a market in its name, as `In{Market}` at the end ([the naming rule](../../../design/component-model/stages.md#naming-implementations)).

The deployables this monorepo produces are covered under [Deployment](../../../deployment/deployables/index.md).
