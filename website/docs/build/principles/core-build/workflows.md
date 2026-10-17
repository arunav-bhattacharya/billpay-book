---
title: Building Workflows
description: 'A workflow is the durable spine of one payment journey: it runs its stages in order and does nothing else.'
sidebar_label: Workflows
---

import Lead from '@site/src/components/Lead';

# Building Workflows

<Lead>A workflow is the durable spine of one payment journey: it runs its stages in order and does nothing else. It holds no market logic, reaches no database or outside system itself, and never sleeps until a date.</Lead>

## Why workflow code must be deterministic

Temporal recovers a workflow after any failure by replaying its code against the event history it already recorded. That only works if the code takes the same path every time. So inside a workflow there is no I/O, no wall clock, no random number and no database. Anything that could come out differently on a second run happens in an activity, whose result is recorded and replayed.

The same goes for stages, which run inside the workflow and reach the outside world only through their activities. If you are tempted to compute a date inline, it belongs in an activity. When a workflow needs an ID of its own, `Workflow.randomUUID()` gives one that replays the same: that is how Process Paid Events makes a batch ID that a retried Settle reuses.

## Rules for workflow code

- One workflow per journey, with one implementation. Create Immediate Payment, Execute Scheduled Payment and Process Returned Payment exist once each, and no market has a workflow of its own.
- Never `abstract`. Variation comes from composing different stage implementations, per the [composition rules](../../../design/principles.md#composition-not-inheritance). A per-market `if` in workflow code is in the wrong layer; the branch belongs in a stage.
- Call stages and, on the workflow's own cluster, child workflows. Nothing else: no activity, no client, no outside system and nothing on the other cluster. The [four layers](../../../design/principles.md#the-four-layers) have the full call rules.
- Pass the payment ID, not the payment. Stages and activities load what they need.
- Set search attributes once, at start. Use no signals or queries on the hot path.
- Never wait for a date. Work due later is a Work Tracker row in Oracle, written in the same commit as the state change, and a dispatcher starts the next workflow when it falls due. Nothing waits on a Temporal timer until then.

## How a workflow finds its stages

The Router pins a plan key when it starts the workflow: the journey, the resolved behaviors and the market's config version. The workflow reads its plan key and looks up its stages at runtime, in an index that KSP (Kotlin Symbol Processing) generates at build time. The most specific match wins, and a market override is a more specific match for that market. Stage objects are never passed into a workflow.

Every behavior combination has a default implementation. A combination with no implementation can't be onboarded, and a request for a combination the market hasn't onboarded gets 422 before any workflow starts.

## How a workflow starts

How a workflow starts depends on who is waiting for it, and the Router picks the start mode for the journey.

| When | Start | Used by |
| --- | --- | --- |
| A caller waits | Update-With-Start, conflict policy `USE_EXISTING` | Pay today, schedule, composites, intent, update, cancel, refunds from channels |
| Nobody waits | One-Data stores the request, and a dispatcher pulls it from the inbox | AR intake, returns, inbound |
| An allocation callback | Async start, before the 202 reply | Allocation callbacks |
| Due on a date, or a big fan-out | A Work Tracker row in the producer's commit, which a dispatcher picks up | Scheduled execution, allocation requests, corporate execution, corporate legs, representments |

When a caller waits, its update lands on the workflow's update method and returns as soon as the workflow has the answer, which for a new payment is Verify's decision. The workflow carries on after the reply. A repeated request joins the running workflow instead of starting a second one; that is what `USE_EXISTING` does.

Eager workflow start is not used. The server refuses it with Update-With-Start, and online latency comes from Update-With-Start and local activities instead.

Every one of these starts goes through the Router, and the Router places it: the cluster, task queue, priority, fairness key and workflow ID. [Design → Routing](../../../design/routing.md#start-modes) has the full picture.

## Child workflows

A child always runs on its parent's cluster. These journeys use them:

- A composite runs core workflows as children. Multiple instructions runs one `CreateImmediatePaymentWorkflow` per instruction, and Pay & Plan runs one before it calls the Installments API.
- Update Payment starts the replacement payment as a child `CreateScheduledPaymentWorkflow`.
- Each leg of a consumer split payment runs `ExecuteSplitPaymentWorkflow` as a child.

A corporate payment starts no child at all. It can have 100K legs, so its allocation request, its execution and each of its legs start from a Work Tracker row that a dispatcher picks up. [Corporate Allocations](../../../design/corporate-allocations.md) walks through it.

## Versioning

Payment workflows are pinned to their build with Worker Versioning, so a deploy never changes the code under a running payment. A payment finishes on the build it started on, which is why payment workflow code carries no version branches. Dispatchers and the governor aren't pinned: they move to the new build when they continue-as-new.

Config is pinned the same way. The plan key carries the resolved behaviors and the config version, so a replay finds the same stages. A scheduled payment gets a new plan key on its due date, because the dispatcher calls the Router again. It runs with today's config, and the version it was scheduled under stays in its timeline for audit.

## A worked example: Create Immediate Payment

This is the spec's sketch of the workflow that pays a bill today. Names other than the stages and `PaymentStore` are illustrative.

```kotlin
@WorkflowInterface
interface CreateImmediatePaymentWorkflow {
    @WorkflowMethod
    fun run(paymentId: String, plan: PlanKey)

    // The caller's Update-With-Start lands here and returns once Verify has decided.
    @UpdateMethod
    fun decision(): PaymentDecision
}

class CreateImmediatePaymentWorkflowImpl : CreateImmediatePaymentWorkflow {
    private var decided: PaymentDecision? = null

    override fun run(paymentId: String, plan: PlanKey) {
        // Stage implementations come from the plan key, looked up at runtime.
        val stages = StageIndex.lookup(plan)

        stages.capture.run(paymentId)                  // PENDING, idempotent
        decided = stages.verify.run(paymentId)         // ACCEPTED or DECLINED, one guarded commit
        // The caller's update has its answer here. Announce both changes, in order.
        stages.capture.announce(paymentId)             // the PENDING event to RTF
        stages.verify.announce(paymentId)              // the decision to RTF, and to Raven where the customer is told
        if (decided != PaymentDecision.ACCEPTED) return
        // A corporate payment stops here: Verify's commit wrote its ALLOC_REQUEST row,
        // and dispatchers start every later step.
        if (plan.accountType == AccountType.CORPORATE) return

        stages.execute.run(paymentId)                  // PROCESSING: clearing, AR and OTB in parallel
        stages.execute.announce(paymentId)             // the PROCESSING event
        stages.fulfil.run(paymentId)                   // accounting, eBNC and risk; then RTF and Raven; then PROCESSED
    }

    override fun decision(): PaymentDecision {
        Workflow.await { decided != null }
        return decided!!
    }
}
```

The workflow never names a market: `StageIndex.lookup(plan)` is the only place its stages come from. Capture and Verify commit back to back, and the moment `decided` is set, the caller's update returns with it. Both announcements go out after that, in order, so the reply never waits on RTF or Raven.

A declined payment ends there, and so does a corporate one. Verify's commit already wrote the corporate payment's `ALLOC_REQUEST` row, so there is no corporate branch to write: dispatchers take it from there. Every other payment runs Execute and Fulfil, and Fulfil sends its RTF event and Raven message before it commits, because `PROCESSED` means they have gone out.

Nothing in the method touches a database, a clock or a wire. The stages and their activities do. The sketch leaves out consumer splits, whose legs run as child workflows.

## Which cluster runs it

The Router decides, when it places the start, and the workflow has no say. Work a caller waits for runs on the Online cluster. Work that a dispatcher, a Schedule or a callback starts runs on the Offline cluster. Three workflows run on either, depending on what started them:

| Workflow | On Online | On Offline |
| --- | --- | --- |
| Create Scheduled Payment | From a channel | From AR, through the AR intake dispatcher |
| Execute Split Payment | A consumer leg of an Online parent | A corporate leg, or a consumer leg of an Offline parent |
| Create Balance Refund | From a channel | A refund AR raises, through the AR intake dispatcher |

[Design → Workflows](../../../design/component-model/workflows/index.md) has every workflow with its cluster, workflow ID and behaviors.
