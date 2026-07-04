---
title: Interfaces
sidebar_position: 2
---

# Service Interfaces

**Interfaces fix the variance contract; implementations honour it.** Every Payment Service is a Kotlin interface that declares — explicitly, with an annotation — which variance axes its implementations may bind to. Implementations then declare their tuple. The pairing is checked at build time.

This page covers what an author writes. The runtime behaviour is on [Strategies](./strategies.md); the build-time machinery is on [Variant Resolution](./variant-resolution.md).

## Variance axes

The proposal commits to five axes today. The mechanism supports adding more without rework.

The **Type** column distinguishes two kinds of axes:

- **`closed`** — finite, compile-time-known value set (Kotlin `enum`s). The compiler exhaustiveness-checks every `when` branch, so missing impls for a value of a closed axis tend to surface as a build error at the call site.
- **`open-ended`** — accepts new values without code changes. `market` is modelled as `@JvmInline value class Market(val iso2: String)`, so a new ISO code is config, not code. Open-ended axes are checked at release time by the [coverage gate](./variant-resolution.md#coverage-gate) rather than by the compiler.

| Axis | Type | Values |
| --- | --- | --- |
| `paymentMethod` | closed | `enum PaymentMethod { PUSH, PULL }` |
| `market` | open-ended | ISO-3166 alpha-2 (`GB`, `US`, `MX`, …) — modelled as `@JvmInline value class Market(val iso2: String)` |
| `accountType` | closed | `enum AccountType { CONSUMER, CORPORATE }` |
| `frequency` | closed | `enum Frequency { IMMEDIATE, SCHEDULED, RECURRING }` |
| `paymentState` | closed | `enum PaymentState { PENDING, SCHEDULED, ALLOCATIONS_RECEIVED, … }` (the canonical lifecycle states from [the state model](../../../design/payment-state-model.md)) |

These types live in a new `:variance-core` module so neither `:service-api` nor any `:service-impl-*` depends on the other.

## `@VariesOn` — declare the axes on the interface

A service interface advertises which axes its implementations may bind to. `Generic` services omit `@VariesOn`. The annotation is consumed by the [KSP](https://kotlinlang.org/docs/ksp-overview.html) processor that generates the per-interface [`VariantIndex`](./variant-resolution.md#the-ksp-processor).

```kotlin
package com.amex.billpay.service.validation

import com.amex.billpay.variance.*

@VariesOn(
    VarianceAxis.PAYMENT_METHOD,
    VarianceAxis.MARKET,
    VarianceAxis.ACCOUNT_TYPE,
    VarianceAxis.FREQUENCY,
    VarianceAxis.PAYMENT_STATE,
)
interface PaymentValidationService {
    suspend fun validate(
        ctx: PaymentContext,
        payload: PaymentPayload,
    ): Either<ValidationFailure, ValidatedPaymentResult>
}
```

Other shapes, matching the [services design reference](../../../design/services.md):

```kotlin
// Generic — no @VariesOn
interface PaymentStateTransitionService { /* … */ }

@VariesOn(VarianceAxis.MARKET)
interface PaymentClearingService { /* … */ }

@VariesOn(VarianceAxis.ACCOUNT_TYPE, VarianceAxis.MARKET)
interface PaymentPostingService { /* … */ }
```

:::tip
The `@VariesOn` set is the contract. Adding an axis to an existing interface is a **breaking change** for every existing implementation — the build will fail for impls that don't declare a value on the new axis until they are updated.
:::

## `@PaymentVariant` — declare the tuple on the implementation

Each implementation annotates itself with the values it binds to. Whatever the interface lists in `@VariesOn`, the impl may bind any **subset** — leaving an axis unbound makes the impl a fallback for any value of that axis. The annotation feeds both the [KSP-generated `VariantIndex`](./variant-resolution.md#the-ksp-processor) and the synthesised [`@Identifier`](./variant-resolution.md#identifier--the-ksp-synthesised-handle-arc--cdi-uses-to-address-impls) that ArC / CDI uses to address each impl.

```kotlin
package com.amex.billpay.service.validation.impl.push.gb

import com.amex.billpay.variance.*
import jakarta.enterprise.context.ApplicationScoped

@ApplicationScoped
@PaymentVariant(
    paymentMethod  = PaymentMethod.PUSH,
    market         = "GB",
    accountType    = AccountType.CONSUMER,
    frequency      = Frequency.RECURRING,
    paymentState   = PaymentState.PENDING,
)
class PaymentValidationServicePushUKConsumerRecurringPending(
    private val cutoffs: UkCutoffsRepository,
    private val recurringRules: RecurringRuleSet,
) : PaymentValidationService {
    override suspend fun validate(ctx: PaymentContext, payload: PaymentPayload) =
        either { /* UK Consumer Recurring Pending Push rules */ }
}
```

The annotation is the **source of truth** for routing. The class name (`PaymentValidationServicePushUKConsumerRecurringPending`) is documentation — useful for stack traces and code review — and the suffix follows the same axis order as the annotation parameters (`paymentMethod → market → accountType → frequency → paymentState`). A [Konsist](https://docs.konsist.lemonappdev.com/) test enforces that the suffix matches the annotation.

## The `Generic` fallback

A service may declare a single fallback implementation that wins when no more-specific impl matches. The fallback lives in the dedicated `:service-impl-generic` module described below — the explicit home for `@PaymentVariant(generic = true)` impls:

```kotlin
// :service-impl-generic
@ApplicationScoped
@PaymentVariant(generic = true)
class RuleBasedPaymentValidationService(/* … */) : PaymentValidationService { /* … */ }
```

If no `generic = true` impl exists and no tuple matches, the resolver throws [`NoVariantImplFoundException`](./variant-resolution.md#the-serviceresolver). See [Strategies › Failure modes](./strategies.md#failure-modes) for why failing loudly is deliberate.

## Module layout

| Module | Purpose | Depends on |
| --- | --- | --- |
| `:domain-model` *(existing)* | The hardened `Payment` sealed hierarchy, state types, money/id value classes | — |
| `:variance-core` *(new)* | [`PaymentContext`](./strategies.md#paymentcontext), axes, annotations, [`PaymentPayload`](./data-flow.md#the-two-halves-of-paymentpayload), [`WorkflowScratchpad`](./data-flow.md#the-two-halves-of-paymentpayload), [`ServiceResult`](./data-flow.md#serviceresult--the-scratchpad-marker) marker | — |
| `:service-api` *(existing)* | Service interfaces + `@VariesOn` + per-service `ServiceResult` subtypes | `:variance-core`, `:domain-model` |
| `:validation-rules` / `:execution-rules` *(new)* | Atomic `ValidationRule` / `ExecutionStep` beans, reusable across variants | `:variance-core`, `:service-api` |
| `:service-impl-<paymentMethod>-<market>` *(new, 56 total)* | Per-`(paymentMethod, market)` rulebooks and custom impls — e.g. `:service-impl-push-gb`, `:service-impl-pull-us` | `:service-api`, `:validation-rules` |
| `:service-impl-generic` *(new)* | The **default implementation** for any service when no more-specific impl matches. Hosts `@PaymentVariant(generic = true)` classes (including the generic `RuleBasedPaymentValidationService`). | `:service-api`, `:validation-rules` |
| `:realtime-worker-app`, `:batch-worker-app` *(existing)* | Deployables; depend on the impls they need and run KSP | every impl needed |

### Why per `(paymentMethod, market)`, not per impl class

`2 payment methods × 28 markets + 1 generic = 57 impl modules` — one per `(paymentMethod, market)` family plus the generic-fallback module. The integration team that owns a market typically owns both PUSH and PULL for that market (the rails, the regulators, and the cutoffs are shared), so `(paymentMethod, market)` matches team ownership cleanly. AccountType, frequency, and paymentState variance lives inside each module as rulebooks/impls.

Per-impl-class modules would explode the Gradle graph: `22 services × 28 markets × 2 payment-methods ≈ 1,232 modules`. Per-`(paymentMethod, market)` is the sweet spot.

The proposal targets **28 live markets at launch**; the live-market list is maintained as `live-markets.txt` consumed by the [coverage gate](./variant-resolution.md#coverage-gate).

## Naming convention

`PaymentXxxService` — interface and implementations:

- `PaymentValidationService` (interface)
- `PaymentValidationServiceUKConsumer` (`@PaymentVariant(market="GB", accountType=CONSUMER)`)
- `PaymentValidationServicePushUKConsumerRecurringPending` (`@PaymentVariant(paymentMethod=PUSH, market="GB", accountType=CONSUMER, frequency=RECURRING, paymentState=PENDING)`)
- `PaymentValidationServiceUSCorporate` (`@PaymentVariant(market="US", accountType=CORPORATE)`)

The suffix is mechanical — it spells out the bound axes in the same order they are declared on `@VariesOn` and `@PaymentVariant`: **payment-method → market → account-type → frequency → payment-state**. The `Impl` suffix is dropped; the variant suffix is identification enough. A Konsist test enforces the convention.

## Checklist — adding a new service implementation

- [ ] Decide whether the impl is purely rule-driven (no class needed — just a rulebook, see [Rule Engine](./rule-engine.md#variation-1-pure-rule-based)) or needs custom code.
- [ ] Pick the existing `:service-impl-<paymentMethod>-<market>` module, or create one if the `(paymentMethod, market)` pair is new. Generic-fallback impls go in `:service-impl-generic`.
- [ ] If writing a class: name it `Payment<Service><Suffix>` following the **payment-method → market → account-type → frequency → payment-state** suffix order; annotate `@ApplicationScoped` and `@PaymentVariant(...)`. Constructor takes only its own dependencies; the resolver wires itself.
- [ ] If writing a rulebook only: declare a top-level `val …Rulebook = rulebook { … }` annotated `@Rulebook(service, paymentMethod?, market?, accountType?, frequency?, paymentState?)`.
- [ ] Confirm the annotation values match the class-name suffix (Konsist test will fail otherwise).
- [ ] Run `./gradlew build` — KSP will fail the build if your tuple conflicts with an existing impl, if you bind an axis the interface doesn't declare, or if your rulebook references a rule whose `requires` isn't satisfied by the workflow's orchestration plan ([data flow](./data-flow.md#orchestrationlint)).
- [ ] No workflow change. No resolver change. No sidebar of routing config to update.

## Checklist — onboarding a new market

- [ ] Add the market constant to `Market`'s companion (e.g. `val MX = Market("MX")`) and append `MX` to `live-markets.txt` consumed by the [coverage gate](./variant-resolution.md#coverage-gate).
- [ ] Create `:service-impl-push-<market>` and `:service-impl-pull-<market>` modules (only the payment-methods the market supports — many markets are push-only or pull-only).
- [ ] For every service whose interface declares `MARKET` in its `@VariesOn`, contribute either a rulebook entry or a custom impl in the new module(s). If a market-specific impl is genuinely not yet needed, the generic-market fallback in `:service-impl-generic` carries the traffic — the [coverage gate](./variant-resolution.md#coverage-gate) then exempts that `(service, market)` pair via an explicit `falls-back-to-generic` annotation in `live-markets.txt`.
- [ ] Run the release-gate [coverage check](./variant-resolution.md#coverage-gate); it fails the build artifact if any `(market-varying service, live market)` pair is missing and not declared as a generic-fallback.
- [ ] Deploy. Routing picks up automatically — no workflow or resolver change.
