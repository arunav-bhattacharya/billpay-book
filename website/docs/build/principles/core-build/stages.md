---
title: Building Stages
description: 'A stage is one business step of a journey: it makes its calls, commits the new state once, and returns its outcome.'
sidebar_label: Stages
---

import Lead from '@site/src/components/Lead';
import ClassMap from '@site/src/components/ClassMap';
import {rulePieces} from '@site/src/components/ClassMap/diagrams';

# Building Stages

<Lead>A stage is one business step of a journey: it makes its calls, commits the new state once, and returns its outcome. It is also the only layer that changes with a market's behaviors, through the checks and methods it is made of, so a market that does something differently adds a class, never a different workflow.</Lead>

[Design → Stages](../../../design/component-model/stages.md) lists every stage, the state it moves and what it varies by. This page is about writing one.

## The shape of a stage

Every stage is a `Payment{Step}Stage` interface with two functions. `run` does the step and returns what happened. `announce` tells RTF, and Raven where the customer is told, about the change `run` committed. The workflow calls them in that order, so a payment's events always reach RTF after the state they describe is in Oracle.

```kotlin
interface PaymentExecuteStage : Strategy<Step> {
    // PROCESSING, after the calls succeed
    fun run(
        ctx: StageContext, paymentId: String, verified: VerifyOutcome,
    ): ExecuteOutcome
    // the PROCESSING event
    fun announce(ctx: StageContext, paymentId: String)
}
```

A stage is a strategy: one instance, a `@Singleton` bean, serves every payment, so it keeps no state. What a payment needs arrives in its `StageContext`: the plan key and the activity stubs, which the [stage resolver](./stage-resolver.md#how-a-workflow-uses-it) makes on the workflow's own thread. The workflow never sees the context. It calls `stages.execute.run(paymentId, verified)`, and the resolver passes the context along.

The stage every market runs is `DefaultPayment{Step}Stage`. What varies inside a step is not a different stage but the checks and methods the stage uses, each a small class that says where it applies. [Naming](#naming) has the rule.

## Writing run

A stage makes its calls first, in parallel wherever they don't depend on each other, and then commits once. Here is Execute for a consumer payment with AR posting on, which clears, posts to Accounts Receivable (AR) and raises open-to-buy at the same time. Open-to-buy needs the instrument's details in clear text, so its branch asks Payment Instruments first, and `thenCompose` chains the two without holding up clearing and AR:

```kotlin
@Singleton
class DefaultPaymentExecuteStage(
    // RealtimeClearing or BatchClearing
    private val clearingMethods: MethodRegistry<ClearingMethod>,
) : PaymentExecuteStage {
    override val key = EXECUTE
    override val appliesTo = AppliesTo()       // every market

    override fun run(
        ctx: StageContext, paymentId: String, verified: VerifyOutcome,
    ): ExecuteOutcome {
        val s = ctx.stubs
        // the registry picks: real time or batch
        val clearing = clearingMethods.one(ctx.plan)
        // Payment Instruments, no rate limit
        val details =
            Async.function(s.instruments::clearTextDetails, paymentId)
        val openToBuy = details.thenCompose { d ->
            Async.function(s.authorization::raiseOpenToBuy, paymentId, d)
        }
        Promise.allOf(
            clearing.clear(ctx, paymentId),
            Async.function(s.receivables::reduceBalance, paymentId),
            openToBuy,
        ).get()
        // One commit: the guarded move, the timeline row with the
        // cluster, and any Work Tracker rows this step opens or closes.
        val outcome = s.store.commitExecute(
            paymentId, expected = ACCEPTED, next = PROCESSING)
        // Fulfil's notifications need the same details. They travel
        // on in the workflow, and the payload codec keeps them
        // encrypted in history.
        return outcome.copy(instrument = details.get())
    }

    // the PROCESSING event; no Raven message for it by default
    override fun announce(ctx: StageContext, paymentId: String) =
        ctx.stubs.events.publish(paymentId, PROCESSING)
}
```

*(A sketch: the interface names follow the spec; the method and class names are illustrative.)*

The clearing method comes from the registry, [as the Stage Resolver shows](./stage-resolver.md#a-key-with-two-strategies-executes-clearing). The other things Execute varies by, AR posting and the account type, are picked the same way, so the stage itself never tests a behavior. The sketch writes the AR call inline only because it shows a consumer payment with AR posting on.

Stage code runs inside the workflow, so it follows the workflow's rules. It calls activities through the stubs in its context, uses `Async.function` and `Promise.allOf` for parallel calls, and reaches nothing else: no client, no clock, no database. Everything that touches the world happens in an activity. A stage may call plain helper functions and the strategies the registries give it, but never a workflow, another stage or a client.

The commit is a guarded update: it moves the payment only if it is still in the state the stage expects. If another writer moved it first, such as a cancel that beat Reverify to a scheduled payment, the update changes no row, and the stage returns the payment as it stands instead of failing. The workflow reads that outcome and stops, which is why a stage returns its outcome rather than leaving the workflow to guess.

## The announcement

`announce` is a separate step because it can't share the commit. The commit is one Oracle transaction; RTF and Raven are calls to other systems, and Oracle can't roll them back. So the stage commits first and announces after, and the workflow waits for each announcement before the next stage starts. Which status changes send a Raven message is a market setting, and a change that is switched off sends only the RTF event.

Two stages bend that order:

- On the Online cluster, Capture and Verify commit back to back so the caller's answer isn't held up. Both announcements follow the reply, in order.
- Fulfil announces before its commit, because `PROCESSED` means the event and the message have gone out. Its other calls go first, and comms go last.

## How a stage gets picked

A workflow never chooses its stages, and nothing hands them to it. When it starts, it looks them up from the plan key the [Router](./router.md) pinned:

```kotlin
// inside the workflow, on its own thread
val stages = stageResolver.resolve(plan)
```

No `when` or `if` maps a plan key to classes, and there is no list to edit. Each stage, check and method says what job it does, its key, and where it applies, its `appliesTo`: a market or every market, an account type or every account type, and the behaviors that must be Y or N. For each key, the most specific class that applies wins. A class tied to a market beats one that isn't, so a market is the exception wherever it has a class of its own. Quarkus finds every class at build time, and a registry works out every combination when the app starts.

GB is the example today. A Pay with Bank Transfer payment there also runs `GBFundsCheck`, which asks the bank-confirmation provider whether the customer's bank account holds enough money for the payment. That one class, in GB's module, is all GB adds. That is why the plan key carries the market. [Building the Stage Resolver](./stage-resolver.md) works through Verify for every combination, shows a payment from start to finish, and explains why this design replaced a code generator.

Stages are never `abstract`. A variation is a class of its own that the registry picks, not an override of a base class, so reading one file tells you everything that class does. Payment workflows are pinned to their build with Worker Versioning, so a deploy that adds or changes a class never changes the code under a payment that is already running.

## Naming

Names are for people. The registries read `appliesTo`, never a name.

- A stage interface is `Payment{Step}Stage`, such as `PaymentVerifyStage`.
- The stage every market runs is `DefaultPayment{Step}Stage`.
- A market whose flow for a step really differs gets a stage of its own, named with the market's code first, `{Market}Payment{Step}Stage`, such as `GBPaymentVerifyStage`. GB doesn't need one today.
- A shared stage whose whole flow for a step differs by a behavior is named for that behavior, `Payment{Step}StageWith{Behavior}`. No step needs one today: a behavior that only adds or swaps a call is a check or a method.
- A check or a method is named for its job, such as `MandateCheck`, `TokenCheck` or `RealtimeClearing`, and a market's own starts with its code, such as `GBFundsCheck`. A test fails when a class tied to a market doesn't start with that market's code.

A name says what a class does, never what it calls. A market that needs a mandate doesn't get a mandate stage: Verify gets `MandateCheck`, which fetches the mandate details from Plans, and the rules that check them run. The next section shows that check.

## Writing verification rules

Verify, Reverify and Represent decide the same way. Each runs its checks, gathers the answers into one set of facts, runs the rules that apply, and commits once. [Design → Stages](../../../design/component-model/stages.md#how-verification-decides) explains the model, and this is the code it turns into.

Here are the pieces of a rule as a class diagram:

<ClassMap {...rulePieces} />

`GBRules` lives in GB's module and holds GB's funds rule. The rule registry gets every `RuleSet` bean the way the stage registries get every check.

A rule is built from specifications. A specification is a named yes/no question about the facts, and specifications combine with `and`, `or` and `not`, so each question is written once and shared:

```kotlin
/** A specification: a named yes/no question about a candidate. */
fun interface Spec<T> {
    fun isSatisfiedBy(t: T): Boolean
    infix fun and(other: Spec<T>) =
        Spec<T> { isSatisfiedBy(it) && other.isSatisfiedBy(it) }
    infix fun or(other: Spec<T>) =
        Spec<T> { isSatisfiedBy(it) || other.isSatisfiedBy(it) }
    operator fun not() = Spec<T> { !isSatisfiedBy(it) }
}

// Questions about the facts, written once and shared by the rules
typealias FactSpec = Spec<VerificationFacts>

fun ran(check: CheckKey) = FactSpec { check in it.ran }
val instrumentFound = FactSpec { it.instrument != null }
val instrumentOpen = FactSpec { it.instrument!!.status == OPEN }
val mandateActive = FactSpec { it.mandate!!.status == ACTIVE }
```

A rule then says where it applies, as a check does, and asks two questions: `runsWhen`, whether it makes sense for these facts, and `passes`, whether the payment passes it. Rules come in `RuleSet` beans, so the rule registry finds them the way the stage registries find checks:

```kotlin
@Singleton
class InstrumentRules : RuleSet {
    override val rules = listOf(
        Rule(
            id = "INSTRUMENT_FOUND",
            steps = setOf(VERIFY, REVERIFY),
            runsWhen = ran(INSTRUMENT),
            passes = instrumentFound,
            priority = 500,  // its code: see DeclineCodes
        ),
        Rule(
            id = "INSTRUMENT_OPEN",
            steps = setOf(VERIFY, REVERIFY),
            // skipped, not failed, when there is no instrument
            runsWhen = ran(INSTRUMENT) and instrumentFound,
            passes = instrumentOpen,
            priority = 400,
        ),
    )
}

@Singleton
class MandateRules : RuleSet {
    override val rules = listOf(
        Rule(
            id = "MANDATE_ACTIVE",
            appliesTo = AppliesTo(on = setOf(MANDATE_AUTHORIZATION)),
            steps = setOf(VERIFY, REVERIFY),
            runsWhen = ran(MANDATE),
            passes = mandateActive,
            priority = 300,  // the highest-priority failure decides
        ),
    )
}
```

Every rule's decline code sits in one table, keyed by the rule's ID, and a rule's `declineCode` reads it from there. Product's codes, when they come, change one file and no rule:

```kotlin
/** Every rule's decline code, in one place. */
object DeclineCodes {
    // the current app's closest codes, until product sends theirs
    private val byRule = mapOf(
        "INSTRUMENT_FOUND" to DeclineCode.INVALID_INSTRUMENT,
        "INSTRUMENT_OPEN" to DeclineCode.ACCOUNT_CLOSED,
        "MANDATE_ACTIVE" to DeclineCode.MANDATE_INACTIVE,
        "GB_FUNDS" to DeclineCode.INSUFFICIENT_FUNDS,
    )
    fun of(ruleId: String): DeclineCode? = byRule[ruleId]
}
```

*(A sketch: the names and decline codes are illustrative.)*

A test asks the rule registry for every rule it holds and fails if `DeclineCodes` has no code for one, so a new rule can't ship without its code.

`MandateCheck`, the check these rules read, and `DefaultPaymentVerifyStage`, which runs checks and rules for every payment, are on [Building the Stage Resolver](./stage-resolver.md#a-worked-example-verify). The stage asks the rule registry for the rules that apply to the payment, and gets back each rule's result: skipped, passed or failed.


- There is one Verify stage. A payment that needs no mandate never gets `MandateCheck` or `MANDATE_ACTIVE`, so it gathers no mandate details and runs no mandate rule.
- `runsWhen` replaces any list of rule dependencies. `INSTRUMENT_OPEN` only makes sense once the instrument was found, so after "instrument not found" it is skipped, not failed, and the decision carries `INSTRUMENT_FOUND`'s code.
- A rule keeps one decline code. Specifications combine inside a rule only when one code fits the whole condition; otherwise they are two rules.
- The rule registry picks rules the way the stage registries pick checks: for each rule ID, the most specific rule that applies wins. A market adds a rule in its own module with `market = M` in its `appliesTo`, or replaces a shared rule by reusing its ID. GB's funds rule sits beside `GBFundsCheck` in `market/gb/` and names GB and bank confirmation, as the check does.
- `fetchAll` waits for every check. An activity returns what its system said, such as a closed account or an expired mandate, as data, and throws only on an error, which Temporal retries. So an outage never declines a payment, and a "no" is never retried.
- The shared rules sit in `core/lib/verification/rules/`, each with the steps it runs in. Reverify runs the same `MandateCheck` and `MANDATE_ACTIVE` on the due date. Represent calls none of Payment Instruments, Payment Options and Plans: it will add checks and rules of its own once they are defined.
- A rule reads only the facts, never `Instant.now()` or a service. That is what makes it safe inside the workflow, where a replay must reach the same decision.
- The report keeps every rule's result. The commit's timeline row keeps the IDs of the rules that failed in its event JSON, and `billpay_verification_declines_total` counts declines by step and rule.
