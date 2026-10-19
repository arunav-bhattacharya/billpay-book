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
- Pass the payment ID, not the payment. Stages and activities load what they need. There are two exceptions. A workflow that creates a payment takes the request itself as its start input, and Capture writes it to Oracle, so nothing is written before the workflow starts and the caller's path has no extra database call. And data from Payment Options and Payment Instruments, clear text included, travels on in the workflow to the later stages that need it, with the payload codec keeping it encrypted in history.
- Set search attributes once, at start. Use no signals or queries on the hot path. What a caller sends a running workflow, the confirm and the no, goes in as an update.
- Never wait for a date. Work due later is a Work Tracker row in Oracle, written in the same commit as the state change, and a dispatcher starts the next workflow when it falls due. Nothing waits on a Temporal timer until then. The one exception is a payment waiting minutes for its customer: `CreatePaymentIntentWorkflow` waits on its own timer for the confirmation window.

## How a workflow finds its stages

The Router pins a plan key when it starts the workflow: the market, the journey, the resolved behaviors and the market's config version (the market is there so a market override can match). The workflow reads its plan key and looks up its stages at runtime, in an index that KSP (Kotlin Symbol Processing) generates at build time. The most specific match wins, and a market override is a more specific match for that market. Stage objects are never passed into a workflow.

Every stage has a default implementation, but a market whose behaviors need more, such as Verify's mandate check, runs only once an implementation that declares them is in the build. A combination the build can't run can't be onboarded, and a request for a combination the market hasn't onboarded gets 422 before any workflow starts. [Building the Stage Index](./stage-index.md#the-capability-manifest) has the rule.

## How a workflow starts

How a workflow starts depends on who is waiting for it, and the Router picks the start mode for the journey: Update-With-Start when a caller waits, a dispatcher's start for work pulled from One-Data's inbox or due on a date, and an async start for an allocation callback. [Design → Routing](../../../design/routing.md#start-modes) has the table, and [Building the Router](./router.md#6-start) has the start calls in code.

When a caller waits, its update lands on the workflow's update method and returns as soon as the workflow has the answer, which for a new payment is Verify's decision. The workflow carries on after the reply: Temporal calls this the early-return pattern. On the Online cluster the decision's calls run as local activities, so Capture, Verify's calls and its commit all finish in the workflow's first task, and the update completes with that task. A repeated request joins the running workflow instead of starting a second one; that is what `USE_EXISTING` does.

A payment that waits for its customer takes two more kinds of update later: the confirm and the no, each sent to the same running `CreatePaymentIntentWorkflow`. An update, unlike a signal, answers its caller, and the channel needs the decision in the confirm's reply.

Eager workflow start is not used. The server refuses it with Update-With-Start, and online latency comes from Update-With-Start and local activities instead.

Every one of these starts goes through the Router, and the Router places it: the cluster, task queue, priority, fairness key and workflow ID. [Design → Routing](../../../design/routing.md#start-modes) has the full picture.

## Child workflows

A child always runs on its parent's cluster. These journeys use them:

- A composite runs core workflows as children. Multiple instructions runs one `CreateImmediatePaymentWorkflow` per instruction, and Pay & Plan runs one before it calls the Installments API.
- Update Payment starts the replacement payment as a child `CreateScheduledPaymentWorkflow`.
- Each leg of a consumer split payment runs `ExecuteSplitPaymentWorkflow` as a child.

A corporate payment starts no child at all. It can have 100K legs, so its allocation request, its execution and each of its legs start from a Work Tracker row that a dispatcher picks up. [Corporate Allocations](../../../design/corporate-allocations.md) walks through it. A payment that waits for bank confirmation or a go-ahead starts no child either: `CreatePaymentIntentWorkflow` holds the wait itself, takes the confirm and the no as updates, and cancels the payment on its own timer if neither comes.

## Versioning

Payment workflows are pinned to their build with Worker Versioning, so a deploy never changes the code under a running payment. A payment finishes on the build it started on, which is why payment workflow code carries no version branches. Dispatchers and the governor aren't pinned: they move to the new build when they continue-as-new.

Config is pinned the same way. The plan key carries the resolved behaviors, the config version and the market's rule settings, and for a payment that waits, its confirmation window, so a replay finds the same stages, thresholds and window. A scheduled payment gets a new plan key on its due date, because the dispatcher calls the Router again. It runs with today's config, and the version it was scheduled under stays in its timeline for audit.

## A worked example: Create Immediate Payment

This is the spec's sketch of the workflow that pays a bill today. Names other than the stages and `PaymentStore` are illustrative.

```kotlin
@WorkflowInterface
interface CreateImmediatePaymentWorkflow {
    @WorkflowMethod
    fun run(request: CreatePaymentRequest, plan: PlanKey)   // the request itself is the start input

    // The caller's Update-With-Start lands here and returns once Verify has decided.
    @UpdateMethod
    fun decision(): PaymentDecision
}

class CreateImmediatePaymentWorkflowImpl : CreateImmediatePaymentWorkflow {
    private var decided: PaymentDecision? = null

    override fun run(request: CreatePaymentRequest, plan: PlanKey) {
        // Stage implementations come from the plan key, looked up at runtime. On the Online cluster
        // the stubs it builds for Payment Instruments, Payment Options and Plans are local activities,
        // so Capture, Verify and its commit all run inside this first workflow task.
        val stages = StageIndex.lookup(plan)
        val paymentId = request.paymentId              // One-Data made it

        stages.capture.run(request)                    // PENDING: writes the request, insert-if-absent
        val verified = stages.verify.run(paymentId)    // ACCEPTED or DECLINED, one guarded commit,
                                                       // with what Options and Instruments returned
        decided = verified.decision
        // Early return: the caller's update has its answer here, and the rest runs with nobody waiting.
        // Announce both changes, in order.
        stages.capture.announce(paymentId)             // the PENDING event to RTF
        stages.verify.announce(paymentId)              // the decision to RTF, and to Raven where the customer is told
        if (decided != PaymentDecision.ACCEPTED) return
        // A corporate payment stops here: Verify's commit wrote its ALLOC_REQUEST row,
        // and dispatchers start every later step.
        if (plan.accountType == AccountType.CORPORATE) return

        // Data from Options and Instruments travels on in the workflow, encrypted in history by the payload codec.
        val executed = stages.execute.run(paymentId, verified)  // PROCESSING: clearing, AR, and the Instruments call, then OTB
        stages.execute.announce(paymentId)             // the PROCESSING event
        stages.fulfil.run(paymentId, executed)         // accounting, eBNC, risk, TFNE, GPHDB, B2Notifier; then RTF and Raven; then PROCESSED
    }

    override fun decision(): PaymentDecision {
        Workflow.await { decided != null }
        return decided!!
    }
}
```

The workflow never names a market: `StageIndex.lookup(plan)` is the only place its stages come from. The request arrives as the start input, and Capture writes it with insert-if-absent; from then on, every stage takes the ID. Capture, Verify's calls and both commits run as local activities in the first workflow task, and the moment `decided` is set, the caller's update returns with it. Both announcements go out after that, in order, so the reply never waits on RTF or Raven.

A payment that needs bank confirmation or a go-ahead never comes here: the Router starts `CreatePaymentIntentWorkflow` for it, the next example.

A declined payment ends after Verify, and so does a corporate one. Verify's commit already wrote the corporate payment's `ALLOC_REQUEST` row, so there is no corporate branch to write: dispatchers take it from there. Every other payment runs Execute and Fulfil, and Fulfil sends its RTF event and Raven message before it commits, because `PROCESSED` means they have gone out.

Nothing in the method touches a database, a clock or a wire. The stages and their activities do. The sketch leaves out consumer splits, whose legs run as child workflows.

## A worked example: Create Payment Intent

A payment that waits for its customer keeps one workflow from the create to its end. This is the spec's sketch, trimmed: the stages and `PaymentStore` are real names, the rest illustrative.

```kotlin
class CreatePaymentIntentWorkflowImpl : CreatePaymentIntentWorkflow {
    private var decided: PaymentDecision? = null     // the create's answer
    private var answer: Answer? = null               // YES or NO: the first one accepted wins
    private var result: PaymentDecision? = null      // what that answer gets back
    private var waiting = false

    override fun run(request: CreatePaymentRequest, plan: PlanKey) {
        val stages = StageIndex.lookup(plan)
        val paymentId = request.paymentId
        stages.capture.run(request)                              // PENDING: the request, and any pending IDs
        decided = if (plan.requiresBankConfirmation)
            stages.requestConfirmation.run(paymentId)             // PENDING with the link, or DECLINED
        else PaymentDecision.PENDING                             // a go-ahead: One-Data adds the pending list
        waiting = decided == PaymentDecision.PENDING              // open for answers before anything else runs
        stages.capture.announce(paymentId)                        // the reply goes out with this task
        if (!waiting) { /* announce, the delete, and end */ return }
        Async.procedure { inbox.deletePending(paymentId, stillWaits = true) }  // the wait doesn't wait for it

        val window = checkNotNull(plan.confirmationWindow)
        val due = Workflow.currentTimeMillis() + (window + GRACE).toMillis()
        if (!Workflow.await(window + GRACE) { answer != null } &&
            Workflow.currentTimeMillis() - due > LATE.toMillis()) {  // fired late: Online was down
            Workflow.await(window) { answer != null }                // one more window
        }
        waiting = false                                          // the validators turn answers away now

        result = if (answer == Answer.YES) stages.verify.run(paymentId).decision   // then Execute and Fulfil
                 else stages.cancel.run(paymentId)                                  // the no, or the timer
        // ... the announcements, Execute and Fulfil for ACCEPTED, then the delete
    }

    override fun checkConfirm() = check(waiting && answer == null) { "not waiting" }   // the API answers 409
    override fun confirm(): PaymentDecision {
        answer = Answer.YES
        Workflow.await { result != null }
        return result!!                                          // the confirm's early return
    }
    // decision() answers the create, as in Create Immediate Payment; decline() and checkDecline() mirror confirm
}
```

*(GRACE is Proposed at 30 seconds, and LATE at a minute.)*

- The confirm and the no are updates with fixed IDs, `{paymentId}-confirm` and `{paymentId}-no`, so a repeat whose reply was lost attaches to the same update and gets the same answer.
- The validator runs before anything is written. A confirm that comes after the workflow has its answer, or after the timer has fired, is turned away with no history event, and the API answers 409.
- When the timer fires with no answer, the workflow runs Cancel itself and announces it. It never relies on a terminate or an execution timeout, because either would leave the payment `PENDING` with nobody told.
- A timer that fires well after its time means the Online cluster or its workers were down, so the customer gets one more window. `Workflow.currentTimeMillis()` is the workflow's own clock, so a replay decides the same way.
- The workflow opens for answers the moment it decides to wait, before it announces anything, so an RTF outage that holds up the announcement can't turn a confirm away.
- The workflow calls One-Data's delete twice: after its reply, saying the payment still waits, and at its end. The first call runs alongside the wait, so a slow delete never keeps the workflow from taking an answer.

## Which cluster runs it

The Router decides, when it places the start, and the workflow has no say. Work a caller waits for runs on the Online cluster, and so does a payment waiting for its customer. Work that a dispatcher, a Schedule or a callback starts runs on the Offline cluster. Three workflows run on either, depending on what started them:

| Workflow | On Online | On Offline |
| --- | --- | --- |
| Create Scheduled Payment | From a channel | From AR, through the AR intake dispatcher |
| Execute Split Payment | A consumer leg of an Online parent | A corporate leg, or a consumer leg of an Offline parent |
| Create Balance Refund | From a channel | A refund AR raises, through the AR intake dispatcher |

[Design → Workflows](../../../design/component-model/workflows/index.md) has every workflow with its cluster, workflow ID and behaviors.
