---
title: Variant Resolution
sidebar_position: 6
---

# Variant Resolution — Technical Reference

**The resolver is data; the data is generated.** A [KSP](https://kotlinlang.org/docs/ksp-overview.html) processor scans every `@PaymentVariant` and `@Rulebook` at build time, validates them against the interface's `@VariesOn`, and emits a per-interface `VariantIndex` and `RulebookIndex` that the runtime consumes. This page covers the generated artefacts, the conflict-detection rules, the bit-weighted specificity algorithm, and the two adoption paths (recommended KSP-driven; incremental ArC / CDI-only).

The author-facing surface is on [Interfaces](./interfaces.md); the runtime behaviour is on [Strategies](./strategies.md).

## The `VariantTuple`

```kotlin
data class VariantTuple(
    val paymentMethod: PaymentMethod? = null,
    val market:        Market? = null,
    val accountType:   AccountType? = null,
    val frequency:     Frequency? = null,
    val paymentState:  PaymentState? = null,
    val generic:       Boolean = false,
) {
    /**
     * Bit-weighted specificity. The weights are distinct powers of two so that
     * no two combinations of bound axes can tie. The order encodes our policy:
     * paymentState > frequency > accountType > market > paymentMethod.
     *
     *   paymentState  = 16
     *   frequency     = 8
     *   accountType   = 4
     *   market        = 2
     *   paymentMethod = 1
     *
     * A generic tuple has score 0 and matches any context.
     */
    val specificity: Int =
        (if (paymentState  != null) 16 else 0) or
        (if (frequency     != null)  8 else 0) or
        (if (accountType   != null)  4 else 0) or
        (if (market        != null)  2 else 0) or
        (if (paymentMethod != null)  1 else 0)

    fun matches(ctx: PaymentContext): Boolean =
        (paymentMethod == null || paymentMethod == ctx.paymentMethod) &&
        (market        == null || market        == ctx.market) &&
        (accountType   == null || accountType   == ctx.accountType) &&
        (frequency     == null || frequency     == ctx.frequency) &&
        (paymentState  == null || paymentState  == ctx.paymentState)
}
```

**Why bit weights, not a count.** With "count of bound axes" as the score, `(market, accountType)` (2 axes) would tie `(paymentState)` (1 axis-but-more-specific) — we'd need a tiebreaker. Bit weights produce a unique total ordering: `(paymentState)` scores 16, `(market, accountType)` scores 6, `(paymentState, accountType)` scores 20, etc. The policy is encoded in the weights, not in tiebreaker code.

## The `ServiceResolver`

One per service interface, populated from the KSP-generated `VariantIndex<I>`:

```kotlin
class ServiceResolver<I : Any>(
    private val serviceInterface: KClass<I>,
    private val entries: List<IndexEntry<I>>,   // build-time-generated, immutable
    private val lookup: (String) -> I,          // delegates to ArC / CDI: instance.select(@Identifier(key)).get()
) {
    data class IndexEntry<I>(val tuple: VariantTuple, val identifierKey: String)

    fun resolve(ctx: PaymentContext): I {
        val matches = entries.asSequence()
            .filter { it.tuple.matches(ctx) }
            .sortedByDescending { it.tuple.specificity }
            .toList()

        if (matches.isNotEmpty()) return lookup(matches.first().identifierKey)

        val fallback = entries.firstOrNull { it.tuple.generic }
            ?: throw NoVariantImplFoundException(serviceInterface, ctx, entries)

        return lookup(fallback.identifierKey)
    }
}
```

## The KSP processor

The processor runs in the **deployable application module** (`:realtime-worker-app`, `:batch-worker-app`) against the union classpath of `:service-api` plus every `:service-impl-*` dependency it needs. That is the only place where every implementation is visible at once.

### Inputs

- Every class annotated `@PaymentVariant(...)`.
- Every top-level `val` annotated `@Rulebook(...)`.
- Every service interface annotated `@VariesOn(...)`.
- Every `@OrchestrationPlan` object.

### Outputs

Per service interface `I`, the processor emits:

```kotlin
// Generated. Do not edit.
// build/generated/ksp/main/.../PaymentValidationServiceVariantIndex.kt
object PaymentValidationServiceVariantIndex : VariantIndex<PaymentValidationService> {
    override val entries = listOf(
        IndexEntry(VariantTuple(generic = true),
                   "PaymentValidationService::generic"),
        IndexEntry(VariantTuple(market = Market("GB"), accountType = AccountType.CONSUMER),
                   "PaymentValidationService::market=GB,accountType=CONSUMER"),
        IndexEntry(VariantTuple(paymentMethod = PaymentMethod.PUSH, market = Market("GB"),
                                accountType = AccountType.CONSUMER, frequency = Frequency.RECURRING,
                                paymentState = PaymentState.PENDING),
                   "PaymentValidationService::paymentMethod=PUSH,market=GB,accountType=CONSUMER,frequency=RECURRING,paymentState=PENDING"),
        // …
    )
}

// build/generated/ksp/main/.../PaymentValidationServiceRulebookIndex.kt
object PaymentValidationServiceRulebookIndex : RulebookIndex<PaymentValidationService> {
    override val entries = listOf(
        RulebookEntry(VariantTuple(market = Market("GB"), accountType = AccountType.CONSUMER),
                      UkConsumerBaseRulebook),
        RulebookEntry(VariantTuple(paymentMethod = PaymentMethod.PUSH, market = Market("GB"),
                                   accountType = AccountType.CONSUMER, frequency = Frequency.RECURRING,
                                   paymentState = PaymentState.PENDING),
                      UkConsumerRecurringPendingPushRulebook),
        // …
    )
}
```

Plus a `ResolverFactory` (one per deployable) with `@Produces` methods that wire each `ServiceResolver<I>` into ArC:

```kotlin
@ApplicationScoped
class ResolverFactory(@Any private val all: Instance<Any>) {

    @Produces @ApplicationScoped
    fun paymentValidationResolver(): ServiceResolver<PaymentValidationService> =
        ServiceResolver(
            serviceInterface = PaymentValidationService::class,
            entries          = PaymentValidationServiceVariantIndex.entries,
            lookup           = { key ->
                all.select(PaymentValidationService::class.java,
                           Identifier.Literal.of(key)).get()
            },
        )

    // … one @Produces per service interface
}
```

And, on each `@PaymentVariant`-annotated implementation, an `@Identifier(<key>)` is synthesised so ArC / CDI can address it uniquely. The next subsection unpacks what that means.

## `@Identifier` — the KSP-synthesised handle ArC / CDI uses to address impls

[`@Identifier`](https://quarkus.io/guides/cdi-reference#identifier) is a [Jakarta CDI](https://jakarta.ee/specifications/cdi/) qualifier — a bean-identification annotation ArC (Quarkus' build-time CDI implementation) uses to disambiguate beans of the same type. The proposal does **not** ask authors to write `@Identifier` themselves. The KSP processor synthesises one `@Identifier(<deterministic-key>)` on every `@PaymentVariant`-annotated class at compile time.

The deterministic key encodes the tuple — for example:

```
"PaymentValidationService::paymentMethod=PUSH,market=GB,accountType=CONSUMER,frequency=RECURRING,paymentState=PENDING"
```

so the generated [`ResolverFactory`](#outputs) can do

```kotlin
all.select(PaymentValidationService::class.java, Identifier.Literal.of(key)).get()
```

to fetch the specific impl. The author writes only `@PaymentVariant(...)`. The synthesised `@Identifier` is invisible at the source level and only appears in `build/generated/ksp/main/...`.

**Why this matters.** ArC / CDI's per-axis `@Qualifier` alternative would create one annotation per axis value (`@UK`, `@Consumer`, `@Push`, `@Recurring`, …) and force authors to remember to add each one — N annotations per new market, all reviewable by humans only. With KSP-synthesised `@Identifier`, the author writes the tuple once on `@PaymentVariant` and the lookup string is mechanical. The annotation-sprawl problem is solved at the codegen layer rather than the CDI layer.

## Conflict detection

The processor fails the build with file-pinned diagnostics in these cases:

| Diagnostic | Trigger |
| --- | --- |
| `error: duplicate variant tuple for PaymentValidationService at A.kt:12 and B.kt:9` | Two `@PaymentVariant`-annotated classes with identical tuples for the same interface |
| `error: duplicate rulebook tuple for PaymentValidationService at A.kt:30 and B.kt:14` | Two `@Rulebook`-annotated `val`s with identical tuples for the same service |
| `error: PaymentValidationService does not vary on ACCOUNT_TYPE (declared axes: PAYMENT_METHOD, MARKET, FREQUENCY, PAYMENT_STATE)` | An impl binds an axis the interface's `@VariesOn` does not list |
| `error: variant tuple is empty; mark generic = true to declare a default` | An `@PaymentVariant` with no bound axes and `generic = false` |
| `error: rulebook references rule InstrumentValidRule which is not a @ApplicationScoped ValidationRule bean` | A rulebook references a class that is not registered as a CDI bean |
| `error: rulebook RepresentmentRulebook (PaymentRepresentmentValidationService) requires RepresentmentEligibility, but the orchestration plan for workflow ProcessRepresentmentWFImpl does not run PaymentRepresentmentEligibilityService first` | [`OrchestrationLint`](./data-flow.md#orchestrationlint) — see [Data Flow](./data-flow.md#orchestrationlint) |

The single biggest reason for picking KSP over runtime ArC / CDI scanning: ambiguous beans in CDI throw `AmbiguousResolutionException` only at the first injection that hits the ambiguity. A KSP error fails CI on a feature branch.

## Coverage gate

A separate KSP check, **executed at release time** rather than every build, enumerates the live-market list against the index. For every service with `MARKET` in its `@VariesOn`, the gate confirms that at least one impl or rulebook binds to each live market.

```
error: market GB is live, but PaymentClearingService has no impl bound to market = "GB"
error: market MX is live, but PaymentValidationService has no impl bound to market = "MX"
```

The release pipeline holds the artifact until coverage is complete. New markets are added by configuration: a `live-markets.txt` consumed by the gate, gated by code review like any other config.

## Two adoption paths

### Recommended: KSP + Konsist + ArC / CDI `@Identifier`

The full architecture above. Build-time validation, fast startup, no reflection at boot, native-image-friendly. This is the target.

### Incremental: ArC / CDI-only with runtime scanning

For teams who want to start without a KSP dependency, the same shape works at runtime with two trade-offs:

```kotlin
// Manually maintain the index — duplicates and missing impls only surface at boot or first request.
@ApplicationScoped
class ManualVariantIndex<I : Any>(
    private val instances: Instance<I>,
    private val serviceInterface: KClass<I>,
) {
    // Inspect each bean's annotations at startup, build the entries list.
    // Throw on duplicates at boot rather than letting CDI throw at first injection.
}
```

| Concern | KSP path | ArC / CDI-only path |
| --- | --- | --- |
| Conflict detection | Build time, file-pinned diagnostic | Boot time, stack trace |
| Worker startup | Index pre-built, negligible overhead | One reflection scan over `Instance<I>` |
| Native image | Friendly — everything visible at build | Requires reflection hints per impl |
| Diagnostic quality | IntelliJ squiggle on the offending class | Logs |
| Cost | KSP processor maintenance | Slightly more runtime indirection |

**Migration path**: start with the ArC / CDI-only approach for the first 1–2 services you migrate, prove the shape works, then introduce the KSP processor and regenerate the indices. The runtime contract ([`ServiceResolver<I>`](#the-serviceresolver)) is identical on both paths — only the index-population mechanism differs. No call site changes.

## Native-image considerations

For Quarkus native builds:

- `kotlinx.serialization` codecs are generated at compile time → no reflection metadata needed for `@Serializable` types.
- KSP-generated `VariantIndex` and `RulebookIndex` are concrete Kotlin objects → reachable from the entry point without reflection hints.
- The only reflection-using component is ArC / CDI's `Instance.select(...)` with `@Identifier` — Quarkus handles this natively.

The ArC / CDI-only path does require reflection metadata for every impl class on native image; the KSP path does not.

## Why resolution happens at the workflow boundary, not in an activity

The natural reflex from Java/Kotlin Temporal codebases is to put DI lookups inside activities. We deliberately don't:

- Activities are normal ArC / CDI beans, but they're invoked through Temporal's task-queue plumbing. Putting routing inside an activity means **two** indirections per call (workflow → dispatch activity → resolved service) and an extra Temporal event-history entry per service call.
- Resolution is a pure data lookup. It doesn't need an activity boundary to be safe — the workflow can do it inline on the workflow thread, and Temporal replay will produce the same answer.
- Putting the resolver in the workflow makes the workflow's service dependencies explicit at construction time (each [`ServiceResolver<I>`](#the-serviceresolver) is a constructor parameter), which makes test-mocking trivial.

So the rule is: **workflows resolve, services run on the workflow thread, activities are called from inside services for I/O.** No dispatch activity layer.
