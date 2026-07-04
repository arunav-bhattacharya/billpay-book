---
title: Strategies
sidebar_position: 3
---

# Routing Strategy

**Routing is data, not branching.** A workflow holds a `PaymentContext` and a [`ServiceResolver<I>`](./variant-resolution.md#the-serviceresolver); the resolver does a pure lookup against a build-time-generated index and returns the most-specific implementation for that context. There is no `if (market == "GB") …` in workflow code, and there is no container scan or service-locator lookup on the hot path.

This page covers what happens at runtime. The declarations behind it are on [Interfaces](./interfaces.md); the build-time machinery is on [Variant Resolution](./variant-resolution.md).

## `PaymentContext`

The routing key is a small, immutable value object the workflow constructs once per execution:

```kotlin
@Serializable
data class PaymentContext(
    val paymentMethod: PaymentMethod,
    val market:        Market,
    val accountType:   AccountType,
    val frequency:     Frequency,
    val paymentState:  PaymentState,
)
```

`PaymentContext` carries every committed axis; a service may bind any subset of them via `@VariesOn`. It is built from the request at workflow start and is the **only** input the resolver consults. Nothing else — not the time, not the clock, not the worker — affects which implementation gets picked.

## Workflows invoke services directly

The workflow holds an injected [`ServiceResolver<I>`](./variant-resolution.md#the-serviceresolver) for each service it uses and calls `resolver.resolve(ctx).method(...)` inline. **No dispatch activity.** The service runs on the workflow thread; activities used by the service are created via `Workflow.newActivityStub(...)` from inside the service or its rules.

```kotlin
@WorkflowImpl
class CreatePaymentWFImpl(
    private val validationResolver: ServiceResolver<PaymentValidationService>,
    private val stateResolver:      ServiceResolver<PaymentStateTransitionService>,
    /* … one resolver per service the workflow uses … */
) : CreatePaymentWF {

    override fun run(req: CreatePaymentRequest): PaymentResult = runBlocking {
        val ctx = PaymentContext(req.paymentMethod, req.market, req.accountType, req.frequency, req.paymentState)
        var payload = PaymentPayload(payment = PendingPayment.from(req))

        val validated = validationResolver.resolve(ctx)
            .validate(ctx, payload)
            .bindOrDecline(ctx)
        payload = payload.withScratchpad(validated)

        val accepted = stateResolver.resolve(ctx)
            .transition(ctx, payload, to = PaymentState.ACCEPTED)
            .bindOrDecline(ctx)
        payload = payload.withPayment(accepted)

        PaymentResult.ok(payload.payment)
    }
}
```

### Why this is deterministic under Temporal replay

- [`ServiceResolver.resolve(ctx)`](./variant-resolution.md#the-serviceresolver) is a pure lookup over an immutable index. The same `ctx` always returns the same implementation class — no clock, no random, no container scan.
- The resolver itself is injected at worker registration time; the workflow's construction is deterministic.
- I/O still flows through Temporal activities (called from inside the service or rule). Activity results are recorded in the event history and replayed identically.

The full payload-threading walkthrough is on [Data Flow](./data-flow.md#workflow-walkthrough).

## Specificity-based resolution

Every registered tuple gets a **score** computed from which axes it binds. The resolver picks the highest-scoring tuple that matches the context. The policy encoded in the weights is: **payment-state is the most specific** (which exact lifecycle moment the variant covers), then frequency, then account-type, then market, with **payment-method (push vs pull) the most general** — a binary world-split that should fall back behind every other axis.

| Axis bound | Weight |
| --- | ---: |
| `paymentMethod` | 1 |
| `market` | 2 |
| `accountType` | 4 |
| `frequency` | 8 |
| `paymentState` | 16 |

The weights are powers of two so no two axis combinations can tie. `(market + accountType)` scores 6; `(market + frequency)` scores 10; `(market + paymentState)` scores 18 — distinct, total ordering, no tiebreaker needed.

A `@PaymentVariant(generic = true)` tuple has score `0` and matches any context.

:::tip[Why bit weights, and why not pattern matching?]
The reasoning behind powers-of-two weights — and why this proposal picks scoring over wildcard / regex / predicate / `@Order` pattern-matching schemes — lives on the [Design FAQs](./faqs.md#routing--scoring) page. The short version: weights kill ties without a tiebreaker, encode the priority policy as data, and let KSP enforce uniqueness at build time.
:::

## Worked example — `PaymentValidationService`

Suppose four rulebooks/impls are registered for `PaymentValidationService`. Tuples are shown in `(paymentMethod, market, accountType, frequency, paymentState)` order:

| Impl / rulebook | Tuple | Score |
| --- | --- | ---: |
| `PaymentValidationServiceUKConsumer` (or `UkConsumerRulebook`) | `(*, GB, CONSUMER, *, *)` | `2 + 4 = 6` |
| `PaymentValidationServicePushUKConsumerRecurringPending` (or `PushUkConsumerRecurringPendingRulebook`) | `(PUSH, GB, CONSUMER, RECURRING, PENDING)` | `1 + 2 + 4 + 8 + 16 = 31` |
| `PaymentValidationServiceUSCorporate` (or `UsCorporateRulebook`) | `(*, US, CORPORATE, *, *)` | `2 + 4 = 6` |
| `RuleBasedPaymentValidationService` *(generic fallback in `:service-impl-generic`)* | `(generic = true)` | `0` |

### Context A: `(PUSH, GB, CONSUMER, RECURRING, PENDING)`

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(*, GB, CONSUMER, *, *)` | yes | 6 |
| `(PUSH, GB, CONSUMER, RECURRING, PENDING)` | yes | **31 ◄** |
| `(*, US, CORPORATE, *, *)` | no (market, accountType) | — |
| `(generic = true)` | yes | 0 |

Resolver returns the Recurring-Pending-Push impl — highest specificity wins.

### Context B: `(PULL, GB, CONSUMER, IMMEDIATE, PENDING)`

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(*, GB, CONSUMER, *, *)` | yes | **6 ◄** |
| `(PUSH, GB, CONSUMER, RECURRING, PENDING)` | no (paymentMethod, frequency) | — |
| `(*, US, CORPORATE, *, *)` | no (market, accountType) | — |
| `(generic = true)` | yes | 0 |

Resolver returns the UK Consumer base impl. **Hierarchical fallback is automatic** — the Recurring-Pending-Push tuple didn't match, but the more general one did. No separate fallback table is maintained; the score ordering produces it.

### Context C: `(PUSH, MX, CONSUMER, IMMEDIATE, PENDING)` *— and the deployable did **not** register a generic*

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(*, GB, CONSUMER, *, *)` | no (market) | — |
| `(PUSH, GB, CONSUMER, RECURRING, PENDING)` | no | — |
| `(*, US, CORPORATE, *, *)` | no | — |
| `(generic = true)` | *not registered for this deployable* | — |

No match, no `generic = true` impl on the classpath. Resolver throws [`NoVariantImplFoundException`](./variant-resolution.md#the-serviceresolver). See [Failure modes](#failure-modes) — failing loudly in an unsupported market is deliberate.

### Context D: `(PUSH, JP, CORPORATE, IMMEDIATE, PENDING)` — falls back to the generic

| Candidate | Matches? | Score |
| --- | --- | ---: |
| `(*, GB, CONSUMER, *, *)` | no (market, accountType) | — |
| `(PUSH, GB, CONSUMER, RECURRING, PENDING)` | no | — |
| `(*, US, CORPORATE, *, *)` | no (market) | — |
| `(generic = true)` | yes | **0 ◄** |

JP isn't bound to any specific tuple, but `:service-impl-generic` registered `RuleBasedPaymentValidationService` with `@PaymentVariant(generic = true)`. The resolver matches nothing specific, then takes the generic fallback. Context D is the explicit-fallback case — the deployable's `live-markets.txt` would normally list `JP` as a generic-fallback market so the [coverage gate](./variant-resolution.md#coverage-gate) doesn't fail the release. Context C is the *fail-loud* case: a market that should never silently take the generic.

## Failure modes

### No matching impl

**Hard fail.** The resolver throws [`NoVariantImplFoundException(serviceInterface, ctx, registeredTuples)`](./variant-resolution.md#the-serviceresolver). The workflow catches it, transitions the payment to `DECLINED` with reason `routing_unsupported` via `PaymentStateTransitionService`, and returns. We deliberately do **not** silently fall back to a generic impl unless the deployable advertises one (via the `:service-impl-generic` module's `@PaymentVariant(generic = true)` class). Money movement that silently runs a default validator in an unsupported market is worse than failing loudly.

### Ambiguous match

Cannot happen at runtime — the build fails first. The [KSP processor](./variant-resolution.md#conflict-detection) rejects duplicate tuples for the same interface with a file-pinned diagnostic.

### Missing prerequisite data

A rule that declares `requires = setOf(RepresentmentEligibility::class)` will throw `IllegalStateException` if the workflow hasn't run `PaymentRepresentmentEligibilityService` before validation. This too is caught at build time by [`OrchestrationLint`](./data-flow.md#orchestrationlint) — the build fails naming the rulebook, the rule, and the missing prerequisite.

## Onboarding a new market

To start routing traffic to market `XX`, the deployable must contain — for every service that has `MARKET` in its `@VariesOn` — at least one impl or rulebook binding to `market = "XX"` in the corresponding `:service-impl-<paymentMethod>-xx` module(s), or an explicit `falls-back-to-generic` annotation in `live-markets.txt`. A release-gate KSP check enumerates the [services design reference](../../../design/services.md), cross-references the live-market list (28 markets at launch), and fails the release artifact if any required `(service, market)` pair is missing.

This is documented in detail on [Variant Resolution › Coverage gate](./variant-resolution.md#coverage-gate).

## Per-service migration

The proposal does not require a big-bang switchover. The realtime worker can run a mix of resolver-driven services and bespoke selection logic during rollout:

- Services not yet migrated continue using their existing selection.
- Migrated services get a [`ServiceResolver<I>`](./variant-resolution.md#the-serviceresolver) bean produced by the KSP-generated `ResolverFactory`.
- A workflow can use either path simply by injecting `ServiceResolver<I>` or the legacy selector. No global switch.

Recommended order: **Generic services first** (smallest blast radius — single impl, no routing), then market-only services, then 2-axis, then 3-axis. By the time `PaymentValidationService` (the 5-axis service) is migrated, the resolver and KSP plumbing has been exercised by ~18 simpler services.

:::tip
The flow above intentionally hides the rules and the [`PaymentPayload`](./data-flow.md#the-two-halves-of-paymentpayload) accumulator to keep the resolution story isolated. For the end-to-end walkthrough of how a single `PaymentValidationService.validate(...)` call composes rules and reads upstream service results, see [Data Flow › Workflow walkthrough](./data-flow.md#workflow-walkthrough).
:::
