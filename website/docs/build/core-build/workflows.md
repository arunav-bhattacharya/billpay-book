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

The same goes for stages, which run inside the workflow and reach the outside world only through their activities. Never read the wall clock: `Workflow.currentTimeMillis()` is the workflow's own clock, and it replays the same. When a workflow needs an ID of its own, `Workflow.randomUUID()` gives one that replays the same: that is how Process Paid Events makes a batch ID that a retried Settle reuses.

## Rules for workflow code

- One workflow per journey, with one implementation. Create Immediate Payment, Execute Scheduled Payment and Process Returned Payment exist once each, and no market has a workflow of its own.
- Never `abstract`. Variation comes from the stages, checks and methods the stage resolver picks, per the [composition rules](../../design/principles.md#composition-not-inheritance). A per-market `if` in workflow code is in the wrong layer; the branch belongs in a stage.
- Call stages, activities and, on the workflow's own cluster, child workflows. Nothing else: no client, no outside system and nothing on the other cluster. The [four layers](../../design/principles.md#the-four-layers) have the full call rules.
- Keep what the workflow carries light, but don't drop a detail a later step must have, and don't add a database read that slows the run (agreed 2026-11-08). A workflow that creates a payment takes the request itself as its start input, and Capture writes it to Oracle, so nothing is written before the workflow starts and the caller's path has no extra database call. A workflow that a Work Tracker row starts takes the payment ID. An activity may take the small value it needs, such as the money movement, instead of loading it again by ID. And data from Payment Options and Payment Instruments, clear text included, travels on in the workflow to the later stages that need it, with the payload codec keeping it encrypted in history.
- Set search attributes once, at start. Use no queries on the hot path, and a signal only where nobody needs an answer. What a caller sends a running workflow and waits on, such as the no or the channel's call once the customer is back from their bank, goes in as an update. Amex Pay with Bank Transfer's confirmation and M3's settled notice are signals.
- Never wait for a date. Work due later is a Work Tracker row in Oracle, written in the same commit as the state change, and a dispatcher starts the next workflow when it falls due. Nothing waits on a Temporal timer until then. The one exception is a payment waiting for its customer: `CreatePaymentIntentWorkflow` waits on its own timers: up to 2 minutes for a debit card's 3D Secure, and for a bank the 2 minutes before its fallback status calls, the intervals between them, and the market's wait of 24 to 48 hours.

## How a workflow finds its stages

The Router pins a resolved profile when it starts the workflow: the market, the journey, the resolved behaviors and the market's config version (the market is there so a market's own classes can apply). The workflow reads its resolved profile and looks up its stages at runtime, through the stage resolver it was given when the worker registered it. Each stage, check and method says where it applies, and for each job the most specific one wins, so a market's own class beats a shared one with the same key in that market, while classes with different keys add up. Stages are never passed into a workflow, and the workflow never builds a stage's activity stubs: the resolver makes them on the workflow's thread and binds them to the stages it returns. A workflow may still call an activity of its own directly, and a control or periodic workflow often does.

Every step has a default stage, but a market whose behaviors need more, such as Verify's mandate check, runs only once a class that handles them is in the build. A combination the build can't run can't be onboarded, and a request for a combination the market hasn't onboarded gets 422 before any workflow starts. [Building the Stage Resolver](./stage-resolver.md#the-capability-manifest) has the rule.

## How a workflow starts

How a workflow starts depends on who is waiting for it, and the Router picks the start mode for the journey: Update-With-Start when a caller waits, a dispatcher's start for work pulled from One-Data's inbox or due on a date, and an async start for an allocation callback. [Design → Routing](../../design/routing.md#start-modes) has the table, and [Building the Router](./router.md#6-start) has the start calls in code.

When a caller waits, its update lands on the workflow's update method and returns as soon as the workflow has the answer, which for a new payment is Verify's decision. The workflow carries on after the reply: Temporal calls this the early-return pattern. On the Online cluster the decision's calls run as local activities, so Capture, Verify's calls and its commit all finish in the workflow's first task, and the update completes with that task. A repeated request joins the running workflow instead of starting a second one; that is what `USE_EXISTING` does.

A payment that waits for its customer takes more calls later, each sent to the same running `CreatePaymentIntentWorkflow`. The no, the 3D Secure callback and the channel's call once the customer is back from their bank are updates, because an update, unlike a signal, answers its caller. The no and the callback need the decision back, and the channel's call needs the status Billpay gets from Amex Pay with Bank Transfer.

Eager workflow start is not used. The server refuses it with Update-With-Start, and online latency comes from Update-With-Start and local activities instead.

Every one of these starts goes through the Router, and the Router places it: the cluster, task queue, priority, fairness key and workflow ID. [Design → Routing](../../design/routing.md#start-modes) has the full picture.

## Child workflows

A child always runs on its parent's cluster. These journeys use them:

- A composite makes the decision itself, so it can reply with it, and runs each accepted payment's Execute and Fulfil as a child (agreed 2026-11-07). Multiple instructions starts one child per accepted instruction, and Pay & Plan one for its payment. Each child is `CreateImmediatePaymentWorkflow`, started with the composite's decision, so it skips Capture and Verify; the composite calls One-Data's delete for every payment it decides (agreed 2026-11-07).
- Update Payment starts the replacement payment as a child `CreateScheduledPaymentWorkflow`.
- Each leg of a consumer split payment runs `ExecuteSplitPaymentWorkflow` as a child, and the parent stays `ACCEPTED` while its legs move on.

A corporate payment starts no child at all. It can have 100K legs, so its allocation request, its execution and each of its legs start from a Work Tracker row that a dispatcher picks up. [Corporate Allocations](../../design/corporate-allocations.md) walks through it. A payment that waits for bank confirmation or a debit card's 3D Secure starts no child either: `CreatePaymentIntentWorkflow` holds the wait itself, takes the callback, the no and the channel's call as updates and Amex Pay with Bank Transfer's confirmation as a signal, submits a bank payment to Amex Pay with Bank Transfer, and cancels a debit card payment on its own timer if no callback comes.

## Versioning

Deploys are rolling, so a payment that is running when a new build goes out carries on in the new build. A change that would make the workflow take a different step for a history already recorded is patched with `Workflow.getVersion`: a payment that passed that point keeps its old path, and new ones take the new one. The replay tests in CI prove that the histories recorded on the old build still replay. A patch can come out once no running workflow can still need the old path. Dispatchers and the governor continue-as-new often, so they pick up a new build quickly anyway. Patching starts with the first production deploy: until then nothing runs in production, so a workflow change re-records its histories and the replay tests replay those (agreed 2026-11-08).

Worker Versioning, which pins each payment to the build it started on, is parked for later (2026-11-08). It needs each app's old and new builds running side by side during a deploy, which rolling deploys don't do.

Config is pinned the same way. The resolved profile carries the resolved behaviors, the config version and the market's rule settings, and for a payment that waits, its window, so a replay finds the same stages, thresholds and window. A scheduled payment gets a new resolved profile on its due date, because the dispatcher calls the Router again. It runs with today's config, and the version it was scheduled under stays in its timeline for audit.

## A worked example: Create Immediate Payment

This is the spec's sketch of the workflow that pays a bill today. Names other than the stages and `PaymentStore` are illustrative.

```kotlin
@WorkflowInterface
interface CreateImmediatePaymentWorkflow {
    @WorkflowMethod
    fun run(request: CreatePaymentRequest, profile: ResolvedProfile)   // the request itself is the start input

    // The caller's Update-With-Start lands here and returns once Verify has decided.
    @UpdateMethod
    fun decision(): PaymentDecision
}

class CreateImmediatePaymentWorkflowImpl(
    private val stageResolver: StageResolver,              // passed in by the factory the worker registers
) : CreateImmediatePaymentWorkflow {
    private var decided: PaymentDecision? = null

    override fun run(request: CreatePaymentRequest, profile: ResolvedProfile) {
        // Each step's stage, and the checks and methods it uses, come from the resolved profile at runtime.
        // On the Online cluster the stubs the resolver makes for Payment Instruments, Payment Options
        // and Plans are local activities, so Capture, Verify and its commit all run inside this
        // first workflow task.
        val stages = stageResolver.resolve(profile)
        val paymentId = request.paymentId              // One-Data made it

        stages.capture.run(request)                    // PENDING: writes the request, insert-if-absent
        val verified = stages.verify.run(paymentId)    // ACCEPTED or DECLINED, one guarded commit,
                                                       // with what Options and Instruments returned
        decided = verified.decision
        inbox.deletePending(paymentId)                 // decided: One-Data drops the create and the account's entry
        // Early return: the caller's update has its answer here, and the rest runs with nobody waiting.
        // Announce both changes, in order.
        stages.capture.announce(paymentId)             // the PENDING event to RTF
        stages.verify.announce(paymentId)              // the decision to RTF, and to Raven where the customer is told
        if (decided != PaymentDecision.ACCEPTED) return
        // A corporate payment stops here: Verify's commit wrote its ALLOC_REQUEST row,
        // and dispatchers start every later step.
        if (profile.accountType == AccountType.CORPORATE) return

        // Data from Options and Instruments travels on in the workflow, encrypted in history by the payload codec.
        val executed = stages.execute.run(paymentId, verified)  // PROCESSING: clearing, AR, and the Instruments call, then OTB (CAS)
        stages.execute.announce(paymentId)             // the PROCESSING event
        stages.fulfil.run(paymentId, executed)         // accounting, eBNC, risk, TFNE, GPHDB, B2Notifier, AMP; then RTF and Raven; then PROCESSED
    }

    override fun decision(): PaymentDecision {
        Workflow.await { decided != null }
        return decided!!
    }
}
```

The workflow never names a market: `stageResolver.resolve(profile)` is the only place its stages come from. The request arrives as the start input, and Capture writes it with insert-if-absent; from then on, every stage takes the ID. Capture, Verify's calls and both commits run as local activities in the first workflow task, and once `decided` is set, the caller's update returns with it as soon as that workflow task completes. Both announcements go out after that, in order, so the reply never waits on RTF or Raven.

A payment that needs bank confirmation, or pays by debit card, never comes here: the Router starts `CreatePaymentIntentWorkflow` for it, the next example.

A declined payment ends after Verify, and so does a corporate one. Verify's commit already wrote the corporate payment's `ALLOC_REQUEST` row, so there is no corporate branch to write: dispatchers take it from there. Every other payment runs Execute and Fulfil, and Fulfil sends its RTF event and Raven message before it commits, because `PROCESSED` means they have gone out.

Nothing in the method touches a database, a clock or a wire. The stages and their activities do. The sketch leaves out consumer splits, whose legs run as child workflows.

## A worked example: Create Payment Intent

A payment that waits for its customer keeps one workflow from the create to its end. This is the spec's sketch, trimmed: the stages and `PaymentStore` are real names, the rest illustrative.

```kotlin
class CreatePaymentIntentWorkflowImpl(private val stageResolver: StageResolver) : CreatePaymentIntentWorkflow {
    private var decided: PaymentDecision? = null     // the create's answer
    private var submitted = false                    // the channel's call: the customer is back, so submit now
    private var asks = 0                             // calls that answered pending
    private var confirmation: ConfirmationNotice? = null   // Amex PwBT's own answer, whether or not the channel called
    private var no = false                           // the customer's no
    private var authentication: AuthenticationResult? = null   // a debit card's 3D Secure result
    private var settlement: SettlementNotice? = null // M3's notice, which can come before Amex PwBT's answer
    private var result: PaymentDecision? = null      // the decision the no and the callback get back
    private var waiting = false

    override fun run(request: CreatePaymentRequest, profile: ResolvedProfile) {
        val stages = stageResolver.resolve(profile)
        val paymentId = request.paymentId
        stages.capture.run(request)                              // PENDING: the request
        val own = stages.verify.ownChecks(paymentId)             // Amex's checks first: Options for a bank, Instrument and Options for a card
        decided = if (own.decision == PaymentDecision.DECLINED) own.decision   // DECLINED, with no link
                  else stages.requestConfirmation.run(paymentId)  // PENDING with Amex PwBT's link or the card's
                                                                  // challenge link (or none), or DECLINED
        waiting = decided == PaymentDecision.PENDING              // open for answers before anything else runs
        stages.capture.announce(paymentId)                        // the reply goes out with this task
        if (!waiting) { /* the delete, the announcement, and end */ return }

        val decision = if (profile.cardAuthentication) card(stages, paymentId, own, profile)
                       else bank(stages, paymentId, own, profile)
        waiting = false
        result = decision.status
        // ... the delete and the announcement; then, for ACCEPTED:
        if (result == PaymentDecision.ACCEPTED && profile.bankConfirmation) {
            Workflow.await(checkNotNull(profile.settlementWait)) { settlement != null }  // its length is TBD
            if (settlement == null) return stages.exceptions.noSettlement(paymentId)   // exception list, alert
            if (!settlement!!.settled)                                  // Amex never got the money: it stays
                return stages.exceptions.settlementFailed(paymentId)   // ACCEPTED for a manual process
        }
        // ... Execute, with no clearing call, then Fulfil, for ACCEPTED
        Workflow.await { Workflow.isEveryHandlerFinished() }   // no update left without its reply
    }

    // A bank: wait for the channel's call, Amex PwBT's confirmation or 2 minutes; then, as the fallback,
    // ask for the status until it is final or the wait ends.
    private fun bank(stages: Stages, paymentId: String, own: OwnChecks, profile: ResolvedProfile): Decision {
        val paid = { settlement?.settled == true }
        val wake = { submitted || confirmation != null || no || paid() }
        val end = Workflow.currentTimeMillis() + checkNotNull(profile.confirmationWindow).toMillis()  // 24 to 48 h
        var gap = profile.statusCheckInterval                                // 2 minutes, doubling up to 30
        Workflow.await(profile.statusCheckDelay, wake)                       // 2 minutes, still TBD
        while (true) {
            if (no) return stages.cancel.run(paymentId)                      // CANCELLED
            confirmation?.let { return stages.verify.bankStatus(paymentId, own, it.status) }  // Amex PwBT's own answer
            if (paid()) return stages.verify.accept(paymentId, own)          // M3 first: logged
            val status = if (submitted) stages.verify.submit(paymentId)      // PaymentSubmission, one try
                         else stages.verify.paymentStatus(paymentId)         // the fallback: GET /payment-status;
            submitted = false                                                // a timeout or a 5xx counts as PENDING
            if (status != BankStatus.PENDING) return stages.verify.bankStatus(paymentId, own, status)
            asks++                                                           // a waiting channel's call gets PENDING
            val left = Duration.ofMillis(end - Workflow.currentTimeMillis())
            if (left <= Duration.ZERO) return stages.verify.notReceived(paymentId, own)  // CONFIRMATION_NOT_RECEIVED
            Workflow.await(minOf(gap, left), wake)                           // pending: ask again after the gap,
            gap = minOf(gap.multipliedBy(2), profile.statusCheckMaxInterval) // or at once on an answer or a call
        }
    }

    // A debit card: wait for the 3D Secure callback, 2 minutes and the grace.
    private fun card(stages: Stages, paymentId: String, own: OwnChecks, profile: ResolvedProfile): Decision {
        Workflow.await(checkNotNull(profile.confirmationWindow) + GRACE) { no || authentication != null }
        return when {
            no -> stages.cancel.run(paymentId)                                       // CANCELLED
            authentication != null -> stages.verify.cardAuthorization(paymentId, own, authentication!!)
            else -> stages.cancel.run(paymentId)                                     // no callback: CANCELLED
        }
    }

    override fun submit(): PaymentDecision {                               // the channel's call, update {paymentId}-submission
        result?.let { return it }                                          // decided already: its state
        val before = asks
        submitted = true                                                   // the loop submits at once
        Workflow.await { asks > before || result != null }                 // PaymentSubmission's answer
        return result ?: PaymentDecision.PENDING                           // PENDING, ACCEPTED or DECLINED
    }
    override fun confirmed(answer: ConfirmationNotice) {                     // Amex PwBT's, via One-Data; ignored
        if (waiting && result == null && confirmation == null) confirmation = answer   // once decided
    }
    override fun settled(notice: SettlementNotice) { if (settlement == null) settlement = notice }   // M3's, via One-Data
    // decision() answers the create, as in Create Immediate Payment; decline() and authenticated(result), the
    // card provider's 3D Secure callback, are updates that set `no` or keep the result for Verify
}
```

*(GRACE is 10 seconds.)*

- The no, the 3D Secure callback and the channel's call are updates with fixed IDs, `{paymentId}-no`, `{paymentId}-authentication` and `{paymentId}-submission` (Proposed), so a repeat whose reply was lost attaches to the same update and gets the same answer.
- Two calls are signals, since they need no answer from the workflow. Amex Pay with Bank Transfer's own answer reaches One-Data's `UpdatePaymentConfirmation.v1`, and One-Data calls `POST /payments/{payment-id}/confirmation`, which sends `confirmed`: it decides a payment still `PENDING` and is ignored once the payment is `ACCEPTED` (agreed 2026-11-24). M3's settled notice reaches One-Data's `CreateBillpaySettlementEvent.v1`, and One-Data calls `POST /payments/{payment-id}/settlement`, which sends `settled`: it lets Execute run for an `ACCEPTED` bank payment, and accepts one that Amex Pay with Bank Transfer hasn't said success for yet (agreed 2026-11-10; through One-Data 2026-11-23). Both get 202. A notice that the settlement failed leaves the payment `ACCEPTED`, on the exception list, for a manual exception process (agreed 2026-11-23).
- For a bank, the channel's call, `POST /payments/{payment-id}/submission`, sends `submit`, and Verify submits the payment through Amex Pay with Bank Transfer's `PaymentSubmission` at once. Success is `ACCEPTED` and failure `DECLINED` with `BANK_CONFIRMATION_DECLINED` (Proposed). Pending, a timeout or a 5xx is `PENDING`. The update replies with that status, and the channel's part ends there (agreed 2026-11-24). While no answer has come, Billpay asks `GET /payment-status` itself as the fallback, after a gap that starts at 2 minutes and doubles up to 30 minutes, until the status is final. The first ask comes after 2 minutes, still TBD. Once the market's wait of 24 to 48 hours has passed since the create, a payment still pending is `DECLINED` with `CONFIRMATION_NOT_RECEIVED` (agreed 2026-11-23). The timeouts of `PaymentSubmission` and the status call are still to be set.
- When a debit card's timer fires with no callback, the workflow cancels the payment itself and announces it. It never relies on a terminate or an execution timeout, because either would leave the payment `PENDING` with nobody told.
- A timer handled late, because the Online cluster or its workers were down, ends the wait like any other: a bank payment then asks for the status, and a debit card payment is cancelled.
- Amex's own checks run before the bank step or 3D Secure (agreed 2026-11-06), so a payment they would decline never sends the customer to their bank. A bank payment runs the Options check alone, and a debit card the Instrument and Options checks; neither runs the Mandate check (agreed 2026-11-23). After a debit card's callback, Verify runs only the card authorization (agreed 2026-11-06). For a bank, it takes Amex Pay with Bank Transfer's answer, to `PaymentSubmission`, in its confirmation or to the fallback `GET /payment-status`, and a rule reads it, with no token check and no funds check (agreed 2026-11-24). How Verify splits its checks is Proposed: each check says whether it needs the bank step, and the first part's facts are carried in the workflow.
- The workflow opens for answers the moment it decides to wait, before it announces anything, so an RTF outage that holds up the announcement can't turn a no or a callback away.
- The workflow calls One-Data's delete once, when the payment is decided: by Amex Pay with Bank Transfer's answer, M3's notice, the callback, the no or the timer, or at the create when it is declined there. Until then its entry stays in One-Data's Redis and blocks the account's next payment (agreed 2026-11-08).
- For Pay with Bank Transfer and a debit card, Execute makes no clearing call, and Fulfil tells accounting, TFNE, GPHDB and AMP only, with no RTF event or Raven message for `PROCESSED` (agreed 2026-11-23). For a debit card, its clearing method creates the payment's settlement event and hands it to One-Data's money movement handler instead, dated when the money moved (Proposed). For Pay with Bank Transfer, M3's notice is the settlement, and Billpay creates none (agreed 2026-11-10).

## Which cluster runs it

The Router decides, when it places the start, and the workflow has no say. Work a caller waits for runs on the Online cluster, and so does a payment waiting for its customer. Work that a dispatcher, a Schedule or a callback starts runs on the Offline cluster. Three workflows run on either, depending on what started them:

| Workflow | On Online | On Offline |
| --- | --- | --- |
| Create Scheduled Payment | From a channel | From AR, through the AR intake dispatcher |
| Execute Split Payment | A consumer leg of an Online parent | A corporate leg, or a consumer leg of an Offline parent |
| Create Balance Refund | From a channel | A refund AR raises, through the AR intake dispatcher |

[Design → Workflows](../../design/component-model/workflows/index.md) has every workflow with its cluster, workflow ID and behaviors.
