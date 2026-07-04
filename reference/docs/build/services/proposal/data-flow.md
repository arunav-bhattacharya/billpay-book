---
title: Data Flow
sidebar_position: 4
---

# Data Flow

**Domain Model and workflow scratchpad are two different things, and the type system enforces it.** The hardened `Payment` domain model carries only fields relevant for processing and persistence — what `trans_dtl` / `trans_lfcyc_event` already store. Intermediate service outputs that *help the workflow proceed* but are not part of the audit trail (clearing trace id, validation rules-passed list, fulfillment notification stamps, …) live in a [**`WorkflowScratchpad`**](#the-two-halves-of-paymentpayload) that is never persisted and is discarded at workflow completion.

This page is the contract for how services exchange data without leaking workflow-only state into the domain.

## `ServiceResult` — the scratchpad marker

```kotlin
package com.amex.billpay.variance

// Marker — every per-service typed result implements this.
// Lives in WorkflowScratchpad only; never folded into the persisted Payment.
sealed interface ServiceResult
```

Each non-state-transitioning service declares a concrete `ServiceResult` subtype it returns. The marker interface is the type-system pin that prevents scratchpad data being assigned to a `Payment` field — `ServiceResult` and `Payment` are different types, so a service author who tries to fold scratchpad data into the persisted Payment gets a compile error. The "should this go on `Payment`?" question is answered by the type, not by code review.

## The two halves of `PaymentPayload`

```kotlin
package com.amex.billpay.variance

@Serializable
data class WorkflowScratchpad(
    private val results: PersistentMap<KClass<out ServiceResult>, ServiceResult> = persistentMapOf(),
) {
    inline fun <reified T : ServiceResult> require(): T =
        results[T::class] as? T
            ?: error("WorkflowScratchpad missing required ${T::class.simpleName}; check orchestration order")

    inline fun <reified T : ServiceResult> optional(): T? = results[T::class] as? T

    fun with(result: ServiceResult): WorkflowScratchpad =
        copy(results = results.put(result::class, result))
}

@Serializable
data class PaymentPayload(
    val payment:    Payment,                             // hardened Domain Model from :domain-model
    val scratchpad: WorkflowScratchpad = WorkflowScratchpad(),
) {
    inline fun <reified T : ServiceResult> require(): T = scratchpad.require()
    inline fun <reified T : ServiceResult> optional(): T? = scratchpad.optional()

    fun withScratchpad(result: ServiceResult): PaymentPayload =
        copy(scratchpad = scratchpad.with(result))

    fun withPayment(updated: Payment): PaymentPayload =  // only state-transition services call this
        copy(payment = updated)
}
```

| Half | Source | Persisted? | Lifetime | Who can mutate it |
| --- | --- | --- | --- | --- |
| `payment: Payment` | `:domain-model` sealed hierarchy (`PendingPayment`, `ScheduledPayment`, …, `ProcessedPayment`) | Yes — `trans_dtl` + `trans_lfcyc_event` | The lifetime of the payment (forever in `trans_lfcyc_event`) | `PaymentStateTransitionService` only |
| `scratchpad: WorkflowScratchpad` | `ServiceResult` instances returned by non-state-transitioning services | **No** | Workflow execution only | Any service can `.with(result)` to append |

### What every method does

| Member | Returns | Behaviour |
| --- | --- | --- |
| `WorkflowScratchpad.require<T>()` | `T` (non-null) | Returns the `ServiceResult` of type `T` stored earlier. Throws `IllegalStateException` if absent — use when the calling rule lists `T` in `requires` and [`OrchestrationLint`](#orchestrationlint) has verified the prerequisite at build time. |
| `WorkflowScratchpad.optional<T>()` | `T?` | Returns the result if present; `null` otherwise. Use when enrichment is welcome but the rule has a sane no-`T` path. |
| `WorkflowScratchpad.with(result)` | new `WorkflowScratchpad` | Pure-functional append (immutable persistent map). Keyed by `result::class`, so a second `with(...)` for the same `ServiceResult` subtype **overwrites** the first — the latest value for each type wins. |
| `PaymentPayload.require<T>()` | `T` | Convenience — delegates to `scratchpad.require<T>()` so rule code doesn't have to chain through `.scratchpad`. |
| `PaymentPayload.optional<T>()` | `T?` | Convenience — delegates to `scratchpad.optional<T>()`. |
| `PaymentPayload.withScratchpad(result)` | new `PaymentPayload` | Append a `ServiceResult` to the scratchpad. Returns a new `PaymentPayload`; the original is unchanged. Every non-state-transitioning service ends with this. |
| `PaymentPayload.withPayment(updated)` | new `PaymentPayload` | Replace the domain `Payment`. **Only `PaymentStateTransitionService` should call this** — the type doesn't forbid it (any caller with a payload can swap the payment), so the discipline is a code-review convention enforced by a [Konsist](https://docs.konsist.lemonappdev.com/) rule. |

### Why methods take both `ctx` and `payload`

`PaymentContext` is the **routing key** (immutable, five primitive-ish axes); `PaymentPayload` is the **data envelope** (domain + scratchpad). They are passed as separate parameters because rules and services use them for different purposes — `ctx` resolved which variant runs, never for business decisions inside the rule (those should be data-driven from `payload`). Keeping the two apart prevents rules accidentally branching on routing axes — the variant has *already been chosen*; the rule only needs to evaluate against the payload.

## Service return-type contract

Each non-state-transitioning service interface declares its own `ServiceResult` subtype and returns it. State-transitioning services return a new-state `Payment` instead.

```kotlin
// Non-state-transitioning service interfaces — return a ServiceResult subtype.
interface PaymentValidationService {
    suspend fun validate(ctx: PaymentContext, payload: PaymentPayload)
        : Either<ValidationFailure, ValidatedPaymentResult>
}

interface PaymentExecutionService {
    suspend fun execute(ctx: PaymentContext, payload: PaymentPayload)
        : Either<ExecutionFailure, ExecutionResult>
}

interface PaymentFulfillmentService {
    suspend fun fulfill(ctx: PaymentContext, payload: PaymentPayload)
        : Either<FulfillmentFailure, FulfillmentResult>
}

// State-transitioning service interface — returns the new-state Payment.
interface PaymentStateTransitionService {
    suspend fun transition(
        ctx: PaymentContext,
        payload: PaymentPayload,
        to: PaymentState,
        reason: String? = null,
    ): Either<TransitionFailure, Payment>                // ← new-state Payment, NOT a ServiceResult
}
```

The matching `ServiceResult` subtypes live in `:service-api` next to their interfaces:

```kotlin
// ServiceResult subtypes — scratchpad-only, never on Payment.
@Serializable
data class ValidatedPaymentResult(
    val validatedAt: Instant,
    val rulesPassed: List<String>,
    val mandateId:   MandateId?,
) : ServiceResult

@Serializable
data class ExecutionResult(
    val clearingTraceId: ClearingTraceId,
    val executedAt:      Instant,
) : ServiceResult

@Serializable
data class FulfillmentResult(
    val accountingNotifiedAt:     Instant,
    val communicationsDispatched: Boolean,
    val billingCycleStamp:        BillingCycleId,
) : ServiceResult
```

**Why the type system, not a convention.** Because `ServiceResult` is a marker interface and `Payment` is a separate sealed hierarchy from `:domain-model`, a service author who tries to fold scratchpad data into the persisted Payment gets a compile error. The "should this go on `Payment`?" question is answered by the type, not by code review.

## Reading data inside a service or rule

A `ValidationRule` calls **clients** for external lookups — Instruments, Mandates, PaymentOptions. Each client is wrapped in a `*ClientActivity` so Temporal records the call in the event history and replays deterministically. Clients are deliberately not named `*Service` to avoid confusion with the [Payment Services catalogue](../../../design/services.md) — they are integrations with external/sibling systems, not Billpay services.

```kotlin
@ApplicationScoped
class InstrumentValidRule : ValidationRule {
    override val id = "instrument-valid"

    override suspend fun evaluate(ctx: PaymentContext, payload: PaymentPayload): RuleResult {
        // InstrumentsClient wraps the upstream Instruments service.
        // To preserve Temporal determinism, the call is dispatched through an activity:
        val instruments = Workflow.newActivityStub(
            InstrumentsClientActivity::class.java,
            ActivityOptions.newBuilder().setStartToCloseTimeout(Duration.ofSeconds(2)).build(),
        )
        val amount = payload.payment.amount                          // from Domain Model
        return if (instruments.isValid(payload.payment.instrumentId, amount)) RuleResult.Pass
               else RuleResult.Fail("INSTRUMENT_INVALID", "Instrument not valid")
    }
}
```

The three clients the proposal commits to today are `InstrumentsClient`, `MandatesClient`, and `PaymentOptionsClient`. New clients follow the same shape: a Kotlin class wrapping the upstream API, plus a `*ClientActivity` interface that Temporal stubs. Rules call the activity, never the client directly — that's what keeps replay deterministic.

| Pattern | Accessor | When to use |
| --- | --- | --- |
| Read Domain field | `payload.payment.<field>` | The value is part of the persisted payment (amount, instrument, account, state, clearing date, …) |
| Read scratchpad, required | `payload.require<T>()` | The rule cannot proceed without this prior result. Declare it in `requires` so the build verifies prerequisite ordering via [`OrchestrationLint`](#orchestrationlint). |
| Read scratchpad, optional | `payload.optional<T>()` | Useful enrichment when present, but the rule has sane behaviour without it. |
| Call an external system | `Workflow.newActivityStub(<Name>ClientActivity::class.java, …)` | Any cross-network I/O. The activity dispatches to a `<Name>Client` bean; the result is recorded in Temporal's event history. |

## `@OrchestrationPlan` — workflow declares the order

### How `@OrchestrationPlan` is declared

`@OrchestrationPlan` is a [KSP](https://kotlinlang.org/docs/ksp-overview.html)-discoverable annotation applied to a Kotlin `object` that pairs a workflow class with a `planFor(ctx: PaymentContext): List<KClass<out Any>>` function. The annotation itself does nothing at runtime — its purpose is to be **machine-readable**. KSP picks every `@OrchestrationPlan` object up at compile time, evaluates `planFor` against every reachable variant of every service the plan references, and feeds that order into [`OrchestrationLint`](#orchestrationlint) to verify each rule's `requires` is produced upstream. The annotation lives in the workflow's module so it's reviewed alongside the workflow it governs.

The annotation accepts one mandatory parameter — the `workflow` class. The annotated `object` must declare a `planFor` function with the signature shown; the KSP processor fails the build with a file-pinned error if it doesn't. The function body is plain Kotlin — `when (ctx.accountType) { … }` branching is supported because KSP folds the constant inputs at processor time. No DI lookups, no clock, no random — so the workflow that consults the plan remains deterministic.

### Example — `#CreateImmediatePaymentWF`

The plan mirrors the workflow definition in [`#CreateImmediatePaymentWF`](../../../design/workflows/core.md#1-createimmediatepaymentwf): idempotency → validation → state transition → execution → state transition → fulfillment → state transition. External lookups (Customer360, Instruments, Mandates, PaymentOptions) are **client** calls inside the services that need them, so they do not appear in the orchestration plan — only Payment Services do.

```kotlin
@OrchestrationPlan(workflow = CreateImmediatePaymentWF::class)
object CreateImmediatePaymentOrchestration {
    // Linear "Full payment, accepted" happy path. Splits and declines branch from this
    // prefix; each branch destination (#GetCorporatePaymentAllocationsWF,
    // #ExecuteSplitPaymentWF) declares its own @OrchestrationPlan.
    fun planFor(ctx: PaymentContext): List<KClass<out Any>> = listOf(
        IdempotencyService::class,                    // Input → PENDING
        PaymentValidationService::class,              // calls InstrumentsClient + MandatesClient
                                                      // + Customer360Client internally
        PaymentStateTransitionService::class,         // PENDING → ACCEPTED (or DECLINED)
        PaymentExecutionService::class,               // Clearing + AR posting + OTB in parallel
        PaymentStateTransitionService::class,         // ACCEPTED → PROCESSING
        PaymentFulfillmentService::class,             // Notify Accounting, B&C, Communications
        PaymentStateTransitionService::class,         // PROCESSING → PROCESSED
    )

    // Branch overrides (illustrative — final shape lives in the workflow module):
    //   Split (Corporate)  → trigger #GetCorporatePaymentAllocationsWF
    //   Split (Consumer)   → PaymentSplitsCreationService → #ExecuteSplitPaymentWF
    //   Declined           → PaymentStateTransitionService → EventNotificationService
}
```

The order encodes the contract every rulebook reachable from `CreateImmediatePaymentWF` is checked against. Adding a new cross-service rule (one that declares `requires`) updates this plan or the rule's rulebook — never both silently.

## OrchestrationLint

KSP cross-references **every rulebook reachable for every context** against the `@OrchestrationPlan` for the workflow that runs that rulebook. For each rule in each rulebook, the lint checks that the services producing the rule's `requires` types appear in the plan **before** the service that runs the rule.

If the check fails:

```
error: rulebook RepresentmentRulebook (PaymentRepresentmentValidationService) requires
       RepresentmentEligibility, but workflow ProcessRepresentmentWFImpl does not run
       PaymentRepresentmentEligibilityService before PaymentRepresentmentValidationService.
       Add it to ProcessRepresentmentOrchestration.planFor((…)) or remove the rule
       from the rulebook.
```

Missing-prior-result errors fail the build, not the first request in production. Adding a new cross-service rule is a build-time exercise in keeping the plan honest.

## Workflow walkthrough

End-to-end for `CreateImmediatePaymentWFImpl` with context `(PUSH, US, CORPORATE, IMMEDIATE, PENDING)` and payment amount `$6,200`. Comments inline.

```kotlin
override fun run(req: CreatePaymentRequest): PaymentResult = runBlocking {
    val ctx = PaymentContext(req.paymentMethod, req.market, req.accountType, req.frequency, req.paymentState)

    // Start with the hardened Domain Model in its initial state.
    var payload = PaymentPayload(payment = PendingPayment.from(req))

    // 1. Idempotency — guards against duplicate POST /payments. No scratchpad write.
    idempotencyResolver.resolve(ctx).check(ctx, payload).bindOrDecline(ctx)

    // 2. Validation — rules walk InstrumentsClient + MandatesClient + Customer360Client
    //    *inside* the service via *ClientActivity stubs. Rules also read Domain via
    //    payload.payment.<field>. ValidatedPaymentResult goes into SCRATCHPAD — NOT
    //    folded into the Payment.
    val validated = validationResolver.resolve(ctx).validate(ctx, payload).bindOrDecline(ctx)
    payload = payload.withScratchpad(validated)

    // 3. DOMAIN STATE TRANSITION — the only path that mutates the Payment. Persists to trans_dtl.
    val accepted = stateResolver.resolve(ctx)
        .transition(ctx, payload, to = PaymentState.ACCEPTED).bindOrDecline(ctx)
    payload = payload.withPayment(accepted)

    // 4. Execution — Clearing + AR + OTB in parallel inside the service.
    //    ExecutionResult (clearing trace id, executed-at) goes into SCRATCHPAD.
    val executed = executionResolver.resolve(ctx).execute(ctx, payload).bindOrDecline(ctx)
    payload = payload.withScratchpad(executed)

    // 5. DOMAIN STATE TRANSITION — ACCEPTED → PROCESSING, persisted.
    val processing = stateResolver.resolve(ctx)
        .transition(ctx, payload, to = PaymentState.PROCESSING).bindOrDecline(ctx)
    payload = payload.withPayment(processing)

    // 6. Fulfillment — Accounting, B&C, Communications notifications in parallel.
    //    FulfillmentResult goes into SCRATCHPAD.
    val fulfilled = fulfillmentResolver.resolve(ctx).fulfill(ctx, payload).bindOrDecline(ctx)
    payload = payload.withScratchpad(fulfilled)

    // 7. DOMAIN STATE TRANSITION — PROCESSING → PROCESSED, persisted.
    val processed = stateResolver.resolve(ctx)
        .transition(ctx, payload, to = PaymentState.PROCESSED).bindOrDecline(ctx)
    payload = payload.withPayment(processed)

    PaymentResult.ok(payload.payment)                       // return the hardened Domain Model only
}

private fun <F, R> Either<F, R>.bindOrDecline(ctx: PaymentContext): R =
    getOrElse { failure ->
        runBlocking {
            stateResolver.resolve(ctx).transition(ctx, payload, to = PaymentState.DECLINED, reason = failure.toString())
        }
        throw Workflow.wrap(NonRetryableFailure(failure.toString()))
    }
```

Rules read both halves — domain via `payload.payment.<field>`, scratchpad via `payload.require<T>()` / `payload.optional<T>()`. Client calls (Instruments, Mandates, PaymentOptions, Customer360) happen inside the service that needs the data, not as separate workflow steps. The full rulebook trace is in [Rule Engine › Worked example](./rule-engine.md#worked-example).

## Decision checklist — domain field or scratchpad?

| Question | Yes → | No → |
| --- | --- | --- |
| Is it persisted in `trans_dtl` or `trans_lfcyc_event`? | Domain | Scratchpad |
| Does it need to survive across workflow runs? | Domain | Scratchpad |
| Is it part of the customer-visible audit trail? | Domain | Scratchpad |
| Could the workflow legitimately run without it on replay? | Scratchpad | Domain |
| Does any other workflow or query read it? | Probably Domain | Scratchpad |

When in doubt, default to **Scratchpad**. Promoting a scratchpad value to a Domain field is a code-reviewed change to `:domain-model` and a database migration. Demoting a Domain field to a scratchpad is a breaking change. The asymmetry should bias the call.

## Serialization

`PaymentPayload`, `WorkflowScratchpad`, every `ServiceResult` subtype, and every `Payment` subtype must be `@Serializable` ([`kotlinx.serialization`](https://github.com/Kotlin/kotlinx.serialization)). Temporal's data converter is configured (in `:codec-server-app`) to use `kotlinx.serialization.json.Json` — there is no Jackson on the workflow path. The proposal commits to a full migration off Jackson; see [Tooling Rationale › Kotlinx serialization](./tooling-rationale.md#kotlinx-serialization-not-jackson) for the migration plan.
