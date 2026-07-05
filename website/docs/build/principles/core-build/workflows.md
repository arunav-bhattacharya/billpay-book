---
title: Building Workflows
sidebar_label: Workflows
---

import Lead from '@site/src/components/Lead';

# Building Workflows

<Lead>A workflow is the durable spine of one payment journey. It sequences stages, fans out child workflows, waits on signals — and does nothing else. If you remember one thing from this page: workflow code orchestrates; it never does the work.</Lead>

## Determinism is the contract

Temporal recovers a workflow after any failure by **replaying** its code against the event history it already recorded. That only works if the code takes the same path every time. So inside a workflow: no direct I/O, no wall clocks, no random numbers, no reaching for the database. Anything non-deterministic happens inside an [activity](./activities.md), whose *result* is recorded and replayed.

You don't have to police this alone — the [module layout](./code-layout.md) keeps activity implementations and clients out of the workflow's compile-time reach. But the discipline still matters when you're tempted to "just compute a date" inline. Don't; ask an activity.

## The rules

- **One workflow per journey.** Create Immediate Payment, Execute Scheduled Payment, Process Returned Payment — one each, ever. There are no per-market workflow implementations.
- **Never `abstract`.** Variation comes from composition: the same workflow is handed different stage and activity-group implementations, selected by the market's dimensions. If you're adding a per-market `if` to workflow code, you're in the wrong layer — the branch belongs in a stage.
- **Dimensions come first.** All four dimensions (`accountType`, `requiresArPosting`, `requiresRealtimeClearing`, `requiresMandateAuthorization`) must be present in the payment context *before* the workflow starts — they're what select the implementations. A combination the market never onboarded has no implementations, and the request is rejected before any workflow begins.
- **Composite workflows call child workflows.** They never inline another workflow's body.
- **Treat a running workflow's shape as a contract.** In-flight executions replay against the code that exists when they resume. Renaming or restructuring a workflow with live executions is a breaking change — use Temporal's workflow-versioning facilities to branch behaviour, and remove the old path only when the last old execution has drained.

## The Temporal toolkit we actually use

- **Child workflows** — `newChildWorkflowStub<T>()`. Create Immediate Payment fans out to Get Corporate Payment Allocations, then one Execute Split Payment per allocation.
- **Signals** — a corporate payment waits on *AllocationsReceived* (and Get Corporate Payment Allocations waits on *AllocationsReady*) instead of polling.
- **Timed waits** — `Workflow.await(duration) { condition }` parks the workflow durably until the condition or the deadline.
- **Async fan-out** — `asyncFunction { }` / `asyncProcedure { }` return promises; `Promise.allOf(...)` joins them.
- **Early return** — once a payment is `ACCEPTED`, the caller gets its response and the workflow keeps processing in the background.

## The worked example

This is the spec's own sketch of Create Immediate Payment — worth reading line by line, because every rule above is visible in it:

```kotlin
    // Check if the incoming payment is idempotent
    val pendingPayment = InitiatedToPendingStage.execute(inputPayment)
    if (!pendingPayment.isIdempotent) {
        return newActivityStub<PaymentRepository>()
		  .getExistingPayment(idempotencyKey)
    }

    // Validate the payment
    val isValidPayment = paymentValidationActivityGroup.validate(pendingPayment)

    // If payment is not valid then decline it
    if (!isValidPayment) {
        val declinedPayment = pendingToDeclinedStage(pendingPayment)
        return paymentResponse(declinedPayment)
    }

    val acceptedPayment = pendingToAcceptedStage.execute(pendingPayment)
    // This is temporal early return, workflow method will actually not return
    early_return paymentResponse(acceptedPayment)

    // Process based on Account-type and Split/Non-Split
    return when {
        // Corporate Account and the payment is split into allocations
        acceptedPayment.account.type == CORPORATE && acceptedPayment.isSplit -> {
            val processingPaymentPromise = asyncFunction {
                acceptedToProcessingStage(acceptedPayment)
            }
            val childWorkflowPromise = asyncProcedure {
                newChildWorkflowStub<CorporatePaymentAllocationsWorkflow>()
                    .fetchAllocations(acceptedPayment)
            }
            Promise.allOf(processingPaymentPromise, childWorkflowPromise).get()
            Workflow.await(duration) { allocationsReceivedPromise.isCompleted }
            allocations.forEach {
                newChildWorkflowStub<ExecuteSplitPaymentWorkflow>
                    .execute(it)
            }
            paymentResponse(processingPaymentPromise.get())
        }

        // Consumer Non-split
        acceptedPayment.isFull -> {
            val processingPayment = acceptedToProcessingStage(acceptedPayment)
            val processedPayment = processingToProcessedStage(processingPayment)
            paymentResponse(processedPayment)
        }

        // Consumer Split
        acceptedPayment.isSplit -> {
            val acceptedPaymentSplits =
                newActivityStub<CreatePaymentSplitsActivity>(acceptedPayment)
            acceptedPaymentSplits.forEach {
                newChildWorkflowStub<ExecuteSplitPaymentWorkflow>
                    .execute(it)
            }
            paymentResponse(acceptedPayment)
        }
    }
```

Walk it once: the idempotency check happens before anything else; every state move is a **stage**; validation is an **activity group**; the caller is answered at `ACCEPTED` via early return; and the corporate branch runs processing and the allocations child workflow *in parallel*, then waits on the signal before fanning out the splits. Nothing in the method touches a database, a clock, or a wire — the stages and activities behind it do.

## Which worker runs it

Every workflow is pinned to a Temporal worker by one question — is a person waiting? **Online** runs the request path (create, update, cancel, intent). **Offline** runs everything event- or scheduler-driven (scheduled execution, inbound, returns, representment, allocations, the periodic sweeps). A few — Create Schedule Payment, Execute Split Payment, Create Balance Refund — run on either, depending on where in the journey they're invoked. The catalogue with per-workflow worker and dimensions is in [Design → Workflows](../../../design/workflows/index.md).
