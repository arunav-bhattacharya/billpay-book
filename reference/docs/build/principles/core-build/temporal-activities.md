---
title: Temporal Activities
sidebar_position: 3
---

# Temporal Activities

**Activities are the I/O units invoked by [Payment Services](./payment-services.md).** Anything a [Temporal Workflow](./temporal-workflows.md) cannot do directly — read the clock, call a database, hit an HTTP endpoint, generate a UUID — happens inside an activity.

The layering is **Workflow → Service → Activity**:

- Workflows never invoke activities directly. They call a Payment Service.
- The service composes **one or more activities** to do its job, and **owns the activity options** (timeouts, retry policy) for each invocation.
- Activities are the only place real-world side-effects happen.

## Build-time rules

- **One activity per side-effect boundary.** Calling clearing, writing to `trans_dtl`, posting to AR, publishing a lifecycle event, hitting an external validation service — each is a separate activity. Activities never call other activities; services compose them.
- **Activities are reusable across services.** The same `WriteLifecycleEventActivity` is used by many services. The service decides *when*, *with what options*, and *in what sequence* to invoke it.
- **Activity options are passed down from the service.** An activity does **not** declare its own `startToCloseTimeout`, `scheduleToCloseTimeout`, or retry policy as defaults. The invoking service constructs `ActivityOptions` and passes them in. The same activity used in a realtime workflow may run with a tight timeout and a small retry budget; the same activity called from a batch flow may run with a generous timeout and a longer retry tail. The activity does not need to know.
- **Activities must be idempotent.** Temporal *will* retry. An activity that writes half-state and throws will be retried with the same input and must not double-write.
- **Activities should be small.** A long activity is harder to retry safely and harder to observe. Prefer many short activities composed by a service over one long activity — Temporal handles the orchestration cheaply.

## Naming convention

`XxxActivity` interface + `XxxActivityImpl` implementation:
- `ClearingCallActivity`
- `ARDecrementActivity`
- `OTBIncreaseActivity`
- `WriteLifecycleEventActivity`
- `PublishLifecycleEventActivity`

A Payment Service like `PaymentExecutionService` would compose `ClearingCallActivity` + `ARDecrementActivity` + `OTBIncreaseActivity` in parallel, supplying each with its own `ActivityOptions`.

## Where activities live in the build

- **`:activity-api`** modules — interfaces only. Services depend on these to declare what they invoke.
- **`:activity-impl`** modules — implementations that talk to external systems / databases. Only the worker process depends on these.

A workflow module *cannot* depend on activity-impl. This rule is enforced by the build and is what guarantees the workflow stays deterministic at compile time.

:::tip
If you find yourself wanting to put a retry policy or timeout inside an activity implementation, stop — that decision belongs to the service that invokes it. The same activity is reused with different `ActivityOptions` in different flows.
:::
