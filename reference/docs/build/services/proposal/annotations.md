---
title: Annotations & KSP Processor
sidebar_position: 5
---

# Custom Annotations & KSP Processor

**The whole proposal is held together by four custom annotations plus one CDI qualifier that the KSP processor synthesises.** This page is the formal reference for each annotation — purpose, `@Target`, `@Retention`, parameters, defaults — followed by the pseudo-code for the KSP processor that consumes them.

All five live in `:variance-core` so any module can depend on the annotations without pulling in implementation modules.

## Summary

| Annotation | Author writes? | `@Target` | `@Retention` | What it does |
| --- | --- | --- | --- | --- |
| [`@VariesOn`](#varieson) | Yes | `CLASS` | `BINARY` | Declares the variance axes a service interface allows |
| [`@PaymentVariant`](#paymentvariant) | Yes | `CLASS` | `BINARY` | Declares the tuple an implementation binds to |
| [`@Rulebook`](#rulebook) | Yes | `PROPERTY` | `BINARY` | Declares a rulebook `val` for a `(service, tuple)` pair |
| [`@OrchestrationPlan`](#orchestrationplan) | Yes | `CLASS` | `BINARY` | Pairs a workflow with its service-call order |
| [`@Identifier`](#identifier-synthesised) | **No — synthesised** | `TYPE` | `RUNTIME` | KSP-generated CDI qualifier that addresses one specific impl bean |

`BINARY` retention is the right setting for every author-written annotation: KSP reads the `.kt` source *and* the compiled class file, so binary retention is sufficient. None of these annotations need to be reflectable at runtime — variance dispatch is data-driven from the KSP-generated indices, not from runtime reflection.

`@Identifier` keeps `RUNTIME` retention because ArC / CDI selects the impl bean at runtime via `instance.select(...)`.

## Shared types

The annotations refer to two shared enums plus one value class, all in `:variance-core`:

```kotlin
package com.amex.billpay.variance

enum class VarianceAxis { PAYMENT_METHOD, MARKET, ACCOUNT_TYPE, FREQUENCY, PAYMENT_STATE }

// Each closed axis declares an UNBOUND sentinel so it can be the default
// value of an annotation parameter (Kotlin annotations forbid nullable types).
enum class PaymentMethod { PUSH, PULL,    UNBOUND }
enum class AccountType   { CONSUMER, CORPORATE, UNBOUND }
enum class Frequency     { IMMEDIATE, SCHEDULED, RECURRING, UNBOUND }
enum class PaymentState  { PENDING, SCHEDULED, ALLOCATIONS_REQUESTED, ALLOCATIONS_RECEIVED,
                           ACCEPTED, PROCESSING, PROCESSED, DECLINED, RETURNED,
                           REPRESENTING, REPRESENTED, CANCELLED, PAID, REJECTED, UNBOUND }

@JvmInline value class Market(val iso2: String) {
    companion object { val UNBOUND = Market("") }
}
```

The `UNBOUND` sentinels make a "this axis is not bound" assertion expressible in annotation default values, which is what powers wildcard matching in [variant resolution](./strategies.md#specificity-based-resolution).

## `@VariesOn`

```kotlin
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.BINARY)
@MustBeDocumented
annotation class VariesOn(vararg val axes: VarianceAxis)
```

**Purpose**: applied to a Kotlin **interface**, it advertises which variance axes its implementations may bind. The KSP processor uses this to reject impls that bind axes the interface didn't declare.

**Parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `axes` | `vararg VarianceAxis` | — | One or more axes the interface varies on. Order is irrelevant. |

**Example**

```kotlin
@VariesOn(
    VarianceAxis.PAYMENT_METHOD,
    VarianceAxis.MARKET,
    VarianceAxis.ACCOUNT_TYPE,
    VarianceAxis.FREQUENCY,
    VarianceAxis.PAYMENT_STATE,
)
interface PaymentValidationService { /* … */ }
```

**Notes**

- A service interface without `@VariesOn` is a **generic** service — exactly one impl, used everywhere ([Interfaces › Generic fallback](./interfaces.md#the-generic-fallback)).
- Adding an axis to an existing `@VariesOn` is a **breaking change**: every existing impl is re-validated against the new axis set on the next build.
- `axes` does not enforce ordering at runtime; impl naming convention and resolver scoring impose order independently.

## `@PaymentVariant`

```kotlin
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.BINARY)
@MustBeDocumented
annotation class PaymentVariant(
    val paymentMethod: PaymentMethod = PaymentMethod.UNBOUND,
    val market:        String        = "",            // ISO-3166 alpha-2; "" = unbound
    val accountType:   AccountType   = AccountType.UNBOUND,
    val frequency:     Frequency     = Frequency.UNBOUND,
    val paymentState:  PaymentState  = PaymentState.UNBOUND,
    val generic:       Boolean       = false,
)
```

**Purpose**: applied to a concrete `@ApplicationScoped` impl class, declares the tuple of axis values the impl binds to. Any axis left at its default is unbound (a wildcard).

**Parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `paymentMethod` | `PaymentMethod` | `UNBOUND` | `PUSH` or `PULL` |
| `market` | `String` | `""` | ISO-3166 alpha-2 (`"GB"`, `"US"`). Empty string is the unbound sentinel. |
| `accountType` | `AccountType` | `UNBOUND` | `CONSUMER` or `CORPORATE` |
| `frequency` | `Frequency` | `UNBOUND` | `IMMEDIATE`, `SCHEDULED`, `RECURRING` |
| `paymentState` | `PaymentState` | `UNBOUND` | Any canonical lifecycle state |
| `generic` | `Boolean` | `false` | Marks the impl as the explicit generic fallback. Cannot be combined with any bound axis. |

**Example**

```kotlin
// Bound on all 5 axes
@ApplicationScoped
@PaymentVariant(
    paymentMethod = PaymentMethod.PUSH,
    market        = "GB",
    accountType   = AccountType.CONSUMER,
    frequency     = Frequency.RECURRING,
    paymentState  = PaymentState.PENDING,
)
class PaymentValidationServicePushUKConsumerRecurringPending : PaymentValidationService { /* … */ }

// Generic fallback
@ApplicationScoped
@PaymentVariant(generic = true)
class RuleBasedPaymentValidationService : PaymentValidationService { /* … */ }
```

**Notes**

- `market` is a `String` instead of an enum because it is the only **open-ended** axis ([Interfaces › Variance axes](./interfaces.md#variance-axes)).
- An impl that binds an axis the interface's `@VariesOn` does not list is a **build error** with a file-pinned diagnostic.
- Two impls with identical tuples for the same interface is a **build error** (`duplicate variant tuple`).
- `generic = true` plus any bound axis is a **build error**.

## `@Rulebook`

```kotlin
@Target(AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.BINARY)
@MustBeDocumented
annotation class Rulebook(
    val service:       KClass<*>,
    val paymentMethod: PaymentMethod = PaymentMethod.UNBOUND,
    val market:        String        = "",
    val accountType:   AccountType   = AccountType.UNBOUND,
    val frequency:     Frequency     = Frequency.UNBOUND,
    val paymentState:  PaymentState  = PaymentState.UNBOUND,
)
```

**Purpose**: applied to a top-level `val …Rulebook = rulebook { … }`, declares which `(service, tuple)` the rulebook binds to. The KSP processor builds a per-service `RulebookIndex` from these properties; the generic [`RuleBasedPaymentValidationService`](./rule-engine.md#variation-1-pure-rule-based) consults the index for the current context.

**Parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `service` | `KClass<*>` | — | Mandatory. Points at the service interface this rulebook is for. |
| `paymentMethod` | `PaymentMethod` | `UNBOUND` | Same semantics as on `@PaymentVariant`. |
| `market` | `String` | `""` | Same. |
| `accountType` | `AccountType` | `UNBOUND` | Same. |
| `frequency` | `Frequency` | `UNBOUND` | Same. |
| `paymentState` | `PaymentState` | `UNBOUND` | Same. |

**Example**

```kotlin
@Rulebook(
    service       = PaymentValidationService::class,
    paymentMethod = PaymentMethod.PUSH,
    market        = "GB",
    accountType   = AccountType.CONSUMER,
    frequency     = Frequency.RECURRING,
    paymentState  = PaymentState.PENDING,
)
val PushUkConsumerRecurringPendingRulebook = rulebook {
    rule(InstrumentValidRule)
    rule(AmountInRangeRule, AmountRange(min = 1.gbp, max = 5_000.gbp))
    rule(MandateValidRule)
    rule(PaymentOptionsAllowedRule)
    rule(ClearingDateInFutureRule)
}
```

**Notes**

- The DSL constructs a typed `Rulebook` value at compile time; KSP needs only the annotation parameters and the `val` identifier.
- The annotation's axis values are validated against the `service` interface's `@VariesOn` — the same checks as `@PaymentVariant`.
- Two rulebooks with identical `(service, tuple)` is a **build error**.

## `@OrchestrationPlan`

```kotlin
@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.BINARY)
@MustBeDocumented
annotation class OrchestrationPlan(
    val workflow: KClass<*>,
)
```

**Purpose**: applied to a Kotlin `object` that declares a `planFor(ctx: PaymentContext): List<KClass<out Any>>` function. The annotation marks the object as the orchestration plan for the named workflow. The KSP processor uses this to drive [`OrchestrationLint`](./data-flow.md#orchestrationlint).

**Parameters**

| Name | Type | Default | Notes |
| --- | --- | --- | --- |
| `workflow` | `KClass<*>` | — | The workflow class this plan governs (e.g. `CreateImmediatePaymentWF::class`). |

**Example**

```kotlin
@OrchestrationPlan(workflow = CreateImmediatePaymentWF::class)
object CreateImmediatePaymentOrchestration {
    fun planFor(ctx: PaymentContext): List<KClass<out Any>> = listOf(
        IdempotencyService::class,
        PaymentValidationService::class,
        PaymentStateTransitionService::class,   // PENDING → ACCEPTED
        PaymentExecutionService::class,
        PaymentStateTransitionService::class,   // ACCEPTED → PROCESSING
        PaymentFulfillmentService::class,
        PaymentStateTransitionService::class,   // PROCESSING → PROCESSED
    )
}
```

**Notes**

- The annotated declaration **must** be a Kotlin `object` (singleton). Classes are rejected with a file-pinned error.
- The object **must** declare a `planFor` function whose return type is `List<KClass<out Any>>`. Wrong signature → build error.
- `planFor` may branch on `ctx` axes (`when (ctx.accountType) { … }`) — KSP folds constant inputs at processor time.
- At most one `@OrchestrationPlan` per workflow class. Two is a **build error**.

## `@Identifier` (synthesised)

```kotlin
// This annotation lives in Jakarta CDI / Quarkus ArC, NOT in :variance-core.
// Authors never write it — KSP synthesises one per @PaymentVariant class.

package io.quarkus.arc

@Target(AnnotationTarget.TYPE, AnnotationTarget.FIELD, AnnotationTarget.VALUE_PARAMETER)
@Retention(AnnotationRetention.RUNTIME)
@Qualifier
annotation class Identifier(val value: String)
```

**Purpose**: the [Jakarta CDI](https://jakarta.ee/specifications/cdi/) qualifier that ArC / CDI uses to address one specific bean among multiple beans of the same type. The proposal lets the [KSP processor](#the-ksp-processor) synthesise one per impl class so the generated [`ResolverFactory`](#outputs) can disambiguate with `instance.select(<Iface>::class.java, Identifier.Literal.of(<key>)).get()`.

**Why it is RUNTIME** — ArC / CDI's `Instance.select(...)` is a runtime API; the qualifier annotation must survive into the class file with runtime visibility.

**Why authors don't write it** — the per-axis `@Qualifier` alternative (`@UK`, `@Consumer`, `@Push`, …) would require N new annotations per market and force each impl to remember them all. With KSP-synthesised `@Identifier`, the author writes only `@PaymentVariant(...)` and the lookup string is mechanical. See [Tooling Rationale](./tooling-rationale.md#resolution-within-arc--cdi-ksp-synthesised-identifier-not-per-axis-qualifier).

**Synthesised key shape** — the deterministic key encodes the tuple in axis-declaration order, prefixed by the service interface fully-qualified name:

```
"com.amex.billpay.service.validation.PaymentValidationService::paymentMethod=PUSH,market=GB,accountType=CONSUMER,frequency=RECURRING,paymentState=PENDING"
```

For the generic fallback impl: `"<FQN>::generic"`.

## The KSP processor

### Inputs

The processor runs in the **deployable application module** (`:realtime-worker-app`, `:batch-worker-app`) — the only place where every impl is visible at once. Per build, it scans the union classpath for:

| Symbol | Resolver lookup |
| --- | --- |
| `@VariesOn` interfaces | `resolver.getSymbolsWithAnnotation("com.amex.billpay.variance.VariesOn")` |
| `@PaymentVariant` impl classes | `resolver.getSymbolsWithAnnotation("com.amex.billpay.variance.PaymentVariant")` |
| `@Rulebook` top-level `val`s | `resolver.getSymbolsWithAnnotation("com.amex.billpay.variance.Rulebook")` |
| `@OrchestrationPlan` objects | `resolver.getSymbolsWithAnnotation("com.amex.billpay.variance.OrchestrationPlan")` |

### Outputs

Per service interface `I`:

| File | Shape |
| --- | --- |
| `<I>VariantIndex.kt` | `object` extending `VariantIndex<I>` with one `IndexEntry` per discovered `@PaymentVariant` |
| `<I>RulebookIndex.kt` | `object` extending `RulebookIndex<I>` with one `RulebookEntry` per discovered `@Rulebook` |

Plus, once per deployable:

| File | Shape |
| --- | --- |
| `ResolverFactory.kt` | `@ApplicationScoped` class with `@Produces ServiceResolver<I>` methods — one per `@VariesOn` interface |

Plus, **on each `@PaymentVariant` impl class**, the processor synthesises `@Identifier(<deterministic-key>)` and writes the modified declaration into `build/generated/ksp/main/`.

### Processor pseudo-code

```kotlin
package com.amex.billpay.variance.ksp

import com.google.devtools.ksp.processing.*
import com.google.devtools.ksp.symbol.*

class BillpayVariantProcessor(
    private val codeGenerator: CodeGenerator,
    private val logger:        KSPLogger,
) : SymbolProcessor {

    // Accumulated across rounds — KSP is incremental, may be invoked multiple times.
    private val variesOnByInterface = mutableMapOf<KSClassDeclaration, Set<VarianceAxis>>()
    private val variantImpls         = mutableListOf<KSClassDeclaration>()
    private val rulebooks            = mutableListOf<KSPropertyDeclaration>()
    private val orchestrationPlans   = mutableListOf<KSClassDeclaration>()

    override fun process(resolver: Resolver): List<KSAnnotated> {
        // 1. Collect each @VariesOn interface and its declared axis set.
        resolver.getSymbolsWithAnnotation(VARIES_ON_FQN)
            .filterIsInstance<KSClassDeclaration>()
            .filter { it.classKind == ClassKind.INTERFACE }
            .forEach { iface ->
                val axes = iface.annotation<VariesOn>()?.axes?.toSet().orEmpty()
                variesOnByInterface[iface] = axes
            }

        // 2. Collect every @PaymentVariant impl class.
        resolver.getSymbolsWithAnnotation(PAYMENT_VARIANT_FQN)
            .filterIsInstance<KSClassDeclaration>()
            .forEach(variantImpls::add)

        // 3. Collect every @Rulebook top-level val.
        resolver.getSymbolsWithAnnotation(RULEBOOK_FQN)
            .filterIsInstance<KSPropertyDeclaration>()
            .forEach(rulebooks::add)

        // 4. Collect every @OrchestrationPlan object.
        resolver.getSymbolsWithAnnotation(ORCHESTRATION_PLAN_FQN)
            .filterIsInstance<KSClassDeclaration>()
            .filter { it.classKind == ClassKind.OBJECT }
            .forEach(orchestrationPlans::add)

        return emptyList()   // no deferred symbols
    }

    override fun finish() {
        // Validate first, generate second. Errors are reported via logger.error()
        // with file-pinned KSNode origins so IntelliJ shows squiggles on the
        // offending source.
        validateVariantTuples()
        validateRulebookTuples()
        runOrchestrationLint()
        if (hadErrors) return

        emitVariantIndex()
        emitRulebookIndex()
        emitResolverFactory()
        synthesiseIdentifiers()
    }

    /* ── validation passes ───────────────────────────────────────────────── */

    private fun validateVariantTuples() {
        // For each @PaymentVariant impl: check its tuple's bound axes are a subset
        // of the interface's @VariesOn axes. Reject duplicates across impls of the
        // same interface.
        val byInterface = variantImpls.groupBy { it.serviceInterface() }
        byInterface.forEach { (iface, impls) ->
            val declaredAxes = variesOnByInterface[iface]
                ?: error("impl declares @PaymentVariant for interface without @VariesOn: ${iface.qualifiedName?.asString()}")

            impls.forEach { impl ->
                val tuple = impl.annotation<PaymentVariant>() ?: return@forEach
                tuple.boundAxes().forEach { axis ->
                    if (axis !in declaredAxes) {
                        logger.error(
                            "${impl.simpleName.asString()} binds axis $axis but " +
                            "${iface.simpleName.asString()} does not declare it in @VariesOn",
                            impl,
                        )
                    }
                }
                if (tuple.generic && tuple.boundAxes().isNotEmpty()) {
                    logger.error("@PaymentVariant(generic = true) cannot combine with bound axes", impl)
                }
                if (!tuple.generic && tuple.boundAxes().isEmpty()) {
                    logger.error("@PaymentVariant with no bound axes must set generic = true", impl)
                }
            }

            val dupes = impls.groupBy { it.annotation<PaymentVariant>()?.normalisedTuple() }
                .filterValues { it.size > 1 }
            dupes.forEach { (tuple, conflictingImpls) ->
                logger.error(
                    "duplicate variant tuple $tuple for ${iface.simpleName.asString()}",
                    conflictingImpls.first(),
                )
            }
        }
    }

    private fun validateRulebookTuples() {
        rulebooks.forEach { rb ->
            val ann = rb.annotation<Rulebook>() ?: return@forEach
            val iface = ann.service.declaration as KSClassDeclaration
            val declaredAxes = variesOnByInterface[iface] ?: run {
                logger.error(
                    "@Rulebook references ${iface.simpleName.asString()} which has no @VariesOn",
                    rb,
                )
                return@forEach
            }
            ann.boundAxes().forEach { axis ->
                if (axis !in declaredAxes) {
                    logger.error("rulebook binds axis $axis not declared on interface", rb)
                }
            }
            // Also check every rule referenced inside the rulebook body resolves to
            // a class annotated @ApplicationScoped (CDI bean).
            rb.referencedRuleClasses().forEach { cls ->
                if (!cls.hasAnnotation("jakarta.enterprise.context.ApplicationScoped")) {
                    logger.error("rulebook references ${cls.simpleName.asString()} which is not @ApplicationScoped", rb)
                }
            }
        }
    }

    private fun runOrchestrationLint() {
        orchestrationPlans.forEach { plan ->
            val workflow = plan.annotation<OrchestrationPlan>()?.workflow as? KSClassDeclaration
                ?: return@forEach
            val rulebooksForWorkflow = rulebooks.filter { it.reachableFrom(workflow) }
            rulebooksForWorkflow.forEach { rb ->
                rb.referencedRuleClasses().forEach { rule ->
                    val requires = rule.requiresSet()    // from `override val requires = setOf(...)`
                    requires.forEach { producedType ->
                        val producer = findProducerOf(producedType)
                            ?: return@forEach logger.error(
                                "rule ${rule.simpleName.asString()} requires ${producedType.simpleName.asString()} " +
                                "but no service produces it",
                                rule,
                            )
                        if (!plan.planRunsBefore(producer, rb.serviceFromRulebook())) {
                            logger.error(
                                "rulebook ${rb.simpleName.asString()} (${rb.serviceFromRulebook().simpleName.asString()}) " +
                                "requires ${producedType.simpleName.asString()}, but ${workflow.simpleName.asString()} " +
                                "does not run ${producer.simpleName.asString()} before " +
                                "${rb.serviceFromRulebook().simpleName.asString()}.",
                                rb,
                            )
                        }
                    }
                }
            }
        }
    }

    /* ── code generation ─────────────────────────────────────────────────── */

    private fun emitVariantIndex() {
        variesOnByInterface.keys.forEach { iface ->
            val impls = variantImpls.filter { it.implements(iface) }
            val fileSpec = FileSpec.builder(iface.packageName, "${iface.simpleName.asString()}VariantIndex")
                .addType(
                    TypeSpec.objectBuilder("${iface.simpleName.asString()}VariantIndex")
                        .superclass(VariantIndex::class.asTypeName().parameterizedBy(iface.toClassName()))
                        .addProperty(
                            PropertySpec.builder("entries", LIST.parameterizedBy(
                                IndexEntry::class.asTypeName().parameterizedBy(iface.toClassName())))
                                .initializer(impls.joinAsIndexEntries())
                                .build()
                        )
                        .build()
                )
                .build()
            fileSpec.writeTo(codeGenerator, Dependencies(aggregating = true, *impls.sources()))
        }
    }

    private fun emitRulebookIndex()  { /* analogous to emitVariantIndex */ }
    private fun emitResolverFactory() {
        // @ApplicationScoped class ResolverFactory(@Any val all: Instance<Any>) {
        //   @Produces @ApplicationScoped
        //   fun <Iface>Resolver(): ServiceResolver<Iface> = ServiceResolver(
        //     serviceInterface = Iface::class,
        //     entries = <Iface>VariantIndex.entries,
        //     lookup = { key -> all.select(Iface::class.java, Identifier.Literal.of(key)).get() },
        //   )
        // }
    }

    private fun synthesiseIdentifiers() {
        // For each @PaymentVariant impl, regenerate the class declaration with
        // an additional @Identifier(<deterministic-key>) annotation.
        variantImpls.forEach { impl ->
            val key = identifierKeyFor(impl)
            codeGenerator.appendAnnotationToClass(impl, "io.quarkus.arc.Identifier", literalValue = key)
        }
    }

    private companion object {
        const val VARIES_ON_FQN         = "com.amex.billpay.variance.VariesOn"
        const val PAYMENT_VARIANT_FQN   = "com.amex.billpay.variance.PaymentVariant"
        const val RULEBOOK_FQN          = "com.amex.billpay.variance.Rulebook"
        const val ORCHESTRATION_PLAN_FQN = "com.amex.billpay.variance.OrchestrationPlan"
    }
}

class BillpayVariantProcessorProvider : SymbolProcessorProvider {
    override fun create(env: SymbolProcessorEnvironment): SymbolProcessor =
        BillpayVariantProcessor(env.codeGenerator, env.logger)
}
```

The provider is registered through META-INF service loader at
`src/main/resources/META-INF/services/com.google.devtools.ksp.processing.SymbolProcessorProvider`:

```
com.amex.billpay.variance.ksp.BillpayVariantProcessorProvider
```

### Diagnostic catalogue

Every failure mode resolves to a file-pinned `logger.error(message, KSNode)` call. The Gradle build aggregates these and exits non-zero. IntelliJ surfaces them inline.

| Diagnostic | Source annotation | Trigger |
| --- | --- | --- |
| `axis not declared on interface` | `@PaymentVariant` | Impl binds an axis the interface's `@VariesOn` doesn't list |
| `duplicate variant tuple` | `@PaymentVariant` | Two impls with identical tuples for the same interface |
| `empty tuple without generic=true` | `@PaymentVariant` | No bound axes and `generic = false` |
| `generic with bound axes` | `@PaymentVariant` | `generic = true` and at least one bound axis |
| `axis not on interface (rulebook)` | `@Rulebook` | Rulebook binds an axis the interface's `@VariesOn` doesn't list |
| `duplicate rulebook tuple` | `@Rulebook` | Two rulebooks with identical `(service, tuple)` |
| `rule not @ApplicationScoped` | `@Rulebook` | Rulebook references a class without CDI scope |
| `wrong planFor signature` | `@OrchestrationPlan` | Annotated object missing or has wrong `planFor` |
| `not an object` | `@OrchestrationPlan` | Annotated declaration isn't a Kotlin `object` |
| `duplicate plan` | `@OrchestrationPlan` | Two plans for the same workflow |
| `missing prerequisite` | inferred (OrchestrationLint) | Rule `requires` not produced upstream by the plan |
| `coverage gap` | release-gate KSP check | A market in `live-markets.txt` has no impl and no generic-fallback marker |

### Incremental rebuild

The processor passes `Dependencies(aggregating = true, *sources)` to `codeGenerator.createNewFile(...)` so the generated indices are recomputed only when an impl, rulebook, plan, or interface changes — not on every build. KSP's incremental layer handles file-level invalidation; the processor itself is otherwise stateless across rounds.

### Native-image readiness

The generated `VariantIndex`, `RulebookIndex`, and `ResolverFactory` are plain Kotlin objects — no reflection, no metadata hints needed for GraalVM native image. The only reflection-using component on the hot path is ArC / CDI's `instance.select(...)` with `@Identifier`, which Quarkus handles natively without extra configuration.

See [Variant Resolution › Native-image considerations](./variant-resolution.md#native-image-considerations) for the full breakdown.
