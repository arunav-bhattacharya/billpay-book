---
title: Design FAQs
sidebar_position: 9
---

# Design FAQs

This page collects design questions that come up in review. Each answer is short and links to the page where the mechanism is fully documented.

## Routing & scoring

### Why bit weights, instead of a count of bound axes?

The natural first instinct is **count how many axes a tuple binds and pick the highest count**. That works for trivial cases but breaks the moment two impls bind the same number of axes. Bit-weighted scoring solves two distinct problems at once: it kills ties, and it encodes the resolution policy as data.

#### Problem 1 — count-based scoring produces ties

Suppose three impls of `PaymentValidationService` are registered:

| Impl | Tuple | Axes bound |
| --- | --- | ---: |
| `…UKConsumer` | `(*, GB, CONSUMER, *, *)` | 2 |
| `…PullUK` | `(PULL, GB, *, *, *)` | 2 |
| `…UKRecurring` | `(*, GB, *, RECURRING, *)` | 2 |

For a context `(PULL, GB, CONSUMER, RECURRING, PENDING)`, **all three match**. Count-based scoring gives all three a score of `2` — a three-way tie. The resolver has to pick. Any picking rule (alphabetical class name, declaration order, manual priority list) hides the decision *outside* the variant declaration — readers can't tell from `@PaymentVariant(...)` alone which impl will win.

#### Problem 2 — without a weight policy, "more specific" has no meaning

Even if we could break ties, "(`market` + `accountType`)" and "(`market` + `frequency`)" are conceptually different. The first scopes a *customer-product family* in a market; the second scopes a *transaction cadence* in a market. Treating them as "equally specific" because they each bind two axes loses the information about *which kind* of specificity matters more. The proposal's claim is that **a frequency-bound impl is more situational than an accountType-bound impl**, because cadence is a stronger fingerprint for routing decisions than the broad consumer-vs-corporate split. That policy needs to live *somewhere*.

#### The fix — assign each axis a power of two

Weights `1, 2, 4, 8, 16` from least to most specific:

1. **`paymentMethod` (weight 1)** — push vs pull. A binary world-split that applies to every payment in the system. Least situational; should fall back behind every other axis.
2. **`market` (weight 2)** — regulator, currency, clearing network. More specific than method-only.
3. **`accountType` (weight 4)** — consumer vs corporate. Captures the customer-side product distinction.
4. **`frequency` (weight 8)** — immediate vs scheduled vs recurring. The transaction's cadence — a stronger routing fingerprint than the broad consumer/corporate split.
5. **`paymentState` (weight 16)** — which exact lifecycle moment we're handling (`PENDING` vs `ALLOCATIONS_RECEIVED` vs `ACCEPTED` vs …). The most situation-specific context — captures the workflow's current step, which is the strongest hint about what behaviour the variant should embody.

Every subset of bound axes now produces a **different sum** — that's the property of binary encoding. Re-scoring the three tied impls above:

| Impl | Tuple | Score |
| --- | --- | ---: |
| `…UKConsumer` | `(*, GB, CONSUMER, *, *)` | `2 + 4 = 6` |
| `…PullUK` | `(PULL, GB, *, *, *)` | `1 + 2 = 3` |
| `…UKRecurring` | `(*, GB, *, RECURRING, *)` | `2 + 8 = 10` |

`…UKRecurring` wins because the frequency-binding (weight 8) outranks the accountType-binding (weight 4) — exactly the policy the weight order encodes. No tiebreaker code; the score *is* the tiebreaker.

#### Why doubling, specifically

Each weight is double the sum of every lower weight: `16 > 8+4+2+1`, `8 > 4+2+1`, `4 > 2+1`, `2 > 1`. That means **a single binding of a higher-weight axis always beats every combination of lower-weight axes**:

- `(*, *, *, *, PENDING)` (score 16) beats `(PULL, GB, CONSUMER, RECURRING, *)` (score 15).
- `(*, *, *, RECURRING, *)` (score 8) beats `(PULL, GB, CONSUMER, *, *)` (score 7).

This is the design statement at the heart of the proposal: *which lifecycle moment you're in trumps everything else combined*. The weights make that statement explicit and machine-checkable; without doubling, the comparison would be just a numeric coincidence that could shift if a new axis were added.

#### What this buys

- **No tiebreaker code.** The resolver is a single sorted-by-specificity walk; the score is the total ordering.
- **The policy is the declaration.** A reviewer reading `paymentState = 16, frequency = 8, accountType = 4, market = 2, paymentMethod = 1` understands the priority order at a glance.
- **Re-ordering the policy is a one-line diff.** If business reasoning ever says "market should outrank accountType", swap `market = 4, accountType = 2`. Every variant's score re-orders correctly without touching service or resolver code.
- **The build enforces uniqueness.** [KSP rejects two impls with identical tuples](./variant-resolution.md#conflict-detection) precisely because the score is the index key — duplicates would collide on the same key.

#### Alternatives we rejected

| Alternative | Reason rejected |
| --- | --- |
| Count of bound axes + alphabetical tiebreaker on class name | Policy lives outside the variant declaration; a rename re-orders resolution silently. |
| Count + manual priority list (`["paymentState", "frequency", …]` config file) | Two sources of truth that drift. Same information as the weights, but stringly-typed and outside `:variance-core`. |
| Pure source-order priority (first declared wins) | Order across modules is undefined under Gradle parallel builds; routing becomes non-deterministic on rebuild. |
| Linear weights (`1, 2, 3, 4, 5`) | Sums tie (`2 + 3 = 5`). Doesn't solve Problem 1. |
| Non-power-of-2 spacing (`1, 10, 100, 1000, 10000`) | Removes ties but a single higher-axis bind no longer strictly beats the combined lower-axis sum (`10000 > 1000 + 100 + 10 + 1 = 1111`, so it works coincidentally — but the policy becomes a number-magnitude argument, not an algebraic guarantee). Powers of two make the strict-dominance property obvious. |

### Why scoring, and not pattern-based matching?

A "pattern matching" approach would let each impl declare a *pattern* — explicit wildcards in a tuple, a glob, a regex, a closure — and the resolver picks the "best match" pattern for a given context. This is the most natural alternative an engineer would propose, and the two approaches end up with **identical expressivity** — the matching set is the same, the resolution outcome is the same. They differ in *how the "best match" tiebreaker is encoded*.

#### Pattern-matching styles, briefly

| Style | What an impl declares | How the resolver picks |
| --- | --- | --- |
| **Wildcard tuples + count** | `(PULL, GB, *, *, *)` with explicit `*` | Impl with the fewest wildcards that matches |
| **Declaration order** (nginx, route tables) | Impls listed specific-first | First match wins |
| **Regex over stringified context** | `"PULL\|GB\|.*\|.*\|.*"` | Longest non-wildcard prefix |
| **Predicate function** | `fun matches(ctx): Boolean` + `val priority: Int` | Highest-priority predicate that returns true |
| **Trie / decision tree** | Tree rooted at one axis; impls at leaves | Walk the tree following context values |
| **`@Order` / `@Priority` integers** | Hand-assigned integer per impl | Highest priority that matches |

Each of these still needs the same three pieces of machinery the weighted-score approach has:

1. **A wildcard syntax** — every pattern style above admits axis-level wildcards (explicit `*`, default values, "match-anything" branches). Our `@PaymentVariant` provides this via per-axis `UNBOUND` sentinel defaults.
2. **A specificity rule** — once multiple patterns match, *something* has to rank them. That's exactly what the bit-weighted score does.
3. **A uniqueness check** — two impls cannot bind the same pattern. Our [KSP processor](./variant-resolution.md#conflict-detection) gets this for free because the score is the index key.

#### Why each alternative loses to scoring

**Wildcard tuples + count of non-wildcards** — same syntax as ours, but the score is just a count, so it ties exactly like the count-based approach above. Breaking ties requires an additional priority signal — which lands back at weights.

**Declaration order (first match wins, declared specific-first)** — humans are responsible for the global ordering across modules. A new variant has to be inserted at the right position; reviewers have to verify it; under Gradle parallel builds, the order across modules is undefined and routing becomes non-deterministic on rebuild. KSP would have to invent a stable order during indexing, which collapses back to scoring.

**Regex / glob matching** — adds a string grammar with no compile-time guarantees. `"PULL\|GB\|*\|*\|*"` carries no type information about which position is which axis; a typo (`"PUL\|GB\|*\|*\|*"`) silently fails to match at runtime instead of failing the build. We deliberately trade regex's flexibility for the strictness of typed enum values.

**Predicate / closure matching** (each impl ships a `fun matches(ctx): Boolean`) — maximally expressive, but **opaque to static analysis**. KSP can't introspect a lambda body, so duplicate detection, [coverage checking](./variant-resolution.md#coverage-gate), and [`OrchestrationLint`](./data-flow.md#orchestrationlint) would all degrade to runtime — we'd lose the file-pinned diagnostics that make the proposal scalable.

**Trie / decision tree** rooted at one axis — equivalent to weighted scoring, but the tree shape *bakes in* the priority order at the structural level. Adding a new axis (e.g. `merchantCategory` later) or re-ordering existing ones means restructuring every variant's path through the tree. Weighted scoring collapses that tree into a single integer; swapping two weight constants re-orders the whole policy with a one-line diff.

**`@Order` / `@Priority` integers** — every variant author has to pick a number that doesn't clash with any existing variant. Coordinating across teams is painful, numeric gaps proliferate, and the priority doesn't follow from the tuple — so a reader can't predict resolution from `@PaymentVariant(...)` alone. Weighted scoring *derives* the priority from the tuple; there is nothing to coordinate.

#### What weighted scoring uniquely buys

- **The tuple is the pattern.** No separate pattern language. `@PaymentVariant(market = "GB", accountType = AccountType.CONSUMER)` is both the declaration and the pattern.
- **Strict dominance is algebraic, not numeric coincidence.** `2^n > 2^(n-1) + 2^(n-2) + … + 2^0` is a proof, not a magic-number argument. Any future contributor reading the weights table can verify "yes, `paymentState` alone always beats every combination of lower axes".
- **Build-time uniqueness is automatic.** The score is the index key; two impls with the same tuple collide on the same key and KSP rejects the build.
- **Policy is data, not structure.** Re-ordering the axis priority is two integer literals changing in `:variance-core` — every variant re-ranks; no tree to restructure, no priority numbers to renumber.
- **Static analysis stays open.** KSP computes every impl's score statically, can emit diagnostics on duplicates, axis-mismatches, and coverage gaps before any code runs.

The TL;DR: scoring **is** pattern matching — it's just the encoding that keeps the policy explicit (in the weight table), the uniqueness automatic (the score is the index key), and the static analysis tractable (the score is a pure function of annotation values). The other encodings give up one of those three properties in exchange for either flexibility (predicates, regex) or human-ordering discipline (declaration order, `@Order`).

### Why does `paymentState` get the highest weight?

Because it answers the most situation-specific question the resolver can ask: *"which step of the lifecycle are we processing right now?"* — and the answer dictates almost everything the variant should do. A `PENDING → ACCEPTED` validation pass cares about funding-instrument lookups and amount caps; a `RETURNED → REPRESENTING` validation pass cares about return-reason recognisability and clearing-window eligibility. They are *different bodies of logic*, and a `paymentState`-bound impl is the right place to express that.

The other axes are routing dimensions *within* a given lifecycle step. Two `(PULL, GB, CONSUMER, RECURRING, PENDING)` and `(PULL, GB, CONSUMER, RECURRING, ALLOCATIONS_RECEIVED)` impls share market, account-type, frequency, and payment-method — but they implement *fundamentally different operations* because they sit at different lifecycle moments. Giving `paymentState` the top weight makes the resolver treat the lifecycle moment as the most binding signal, so adding a state-specific impl never accidentally tied with a method/market/type/frequency-bound impl.

### Can two variants share a rulebook?

Not directly — each `@Rulebook` `val` binds one tuple, and binding the same tuple twice fails the build with a `duplicate rulebook tuple` diagnostic. But the **rules** inside rulebooks are reused freely: `InstrumentValidRule` is one `@ApplicationScoped` bean, and every rulebook that needs it just lists `rule(InstrumentValidRule)` in its body. The thing that varies per tuple is the *list* of rules (and any per-rule parameters), not the rule code. See [Rule Engine › How different variants of one service pick different rules](./rule-engine.md#how-different-variants-of-one-service-pick-different-rules) for a worked walkthrough.

### What if we need a sixth variance axis later?

Add it. The mechanism is designed for this:

1. Append a new value to `VarianceAxis` (e.g. `MERCHANT_CATEGORY`).
2. Add a new field with an `UNBOUND` default to `@PaymentVariant` and `@Rulebook`.
3. Pick a new weight — **double the current largest** (so `32` next, then `64`). The doubling guarantees the existing strict-dominance property carries over.
4. Update interfaces that should bind on the new axis to include it in their `@VariesOn`.
5. KSP regenerates indices; existing variants score the same (the new axis is unbound, contributes `0`); new variants that bind the new axis outscore the existing ones at the same level of other-axis specificity.

No service code changes. No resolver changes. The bit-weighted approach makes growth additive — you cannot accidentally re-order the existing policy when adding a new axis, because the existing axes' relative ordering is preserved.

### Why must the generic fallback be opt-in (an explicit `@PaymentVariant(generic = true)`) rather than always-on?

Money movement that silently runs a default validator in an unsupported market is worse than failing loudly. If a new market goes live without anyone realising the validation service has no market-specific impl for it, an opt-in fallback ensures the resolver throws `NoVariantImplFoundException` and the workflow transitions to `DECLINED (routing_unsupported)` — a noisy, traceable failure mode. An always-on fallback would silently route to whatever generic logic happens to be there, and the gap would only be noticed after some hard-to-debug downstream confusion.

The escape valve is the explicit declaration: any service that *does* want a default impl ships a single `@PaymentVariant(generic = true)` class in `:service-impl-generic`. The declaration is a deliberate "yes, generic behaviour is correct here" statement, reviewable in code. See [Strategies › Failure modes](./strategies.md#failure-modes) for the runtime behaviour.

## Rules & variants

### Why are rules ArC / CDI beans (`@ApplicationScoped`) instead of plain Kotlin `object`s?

Three reasons:

1. **Mocking in tests** — CDI lets us swap a real `MandateValidRule` for a stub in integration tests by registering a `@Alternative` bean. With Kotlin `object`s we'd need either compile-time substitution or test-only re-implementation.
2. **Interceptors and observability** — ArC / CDI interceptors can wrap every rule's `evaluate(...)` call to emit `rule.evaluate.duration` metrics, log entry/exit, or apply error boundaries uniformly. The `@ApplicationScoped` bean shape is the integration point.
3. **Lifecycle and resources** — some rules (e.g. one that reads a per-market rate-limit config at boot) need `@PostConstruct` initialization. Kotlin `object`s have no DI-aware lifecycle hook.

The cost is small — one `@ApplicationScoped` annotation per rule — and ArC's build-time bean registration means no runtime reflection overhead.

### Why does the proposal allow custom impl classes (Variations 2 + 3) instead of forcing every variant to be a `@Rulebook`?

Because real variance has a long tail. ~80% of validation variants fit the "ordered chain of independent checks" shape that the rulebook DSL expresses cleanly. The remaining 20% are genuinely different in shape — iterating over allocation legs, taking a snapshot before the chain runs, or implementing a single market's idiosyncratic flow. Forcing those into the DSL would either limit the DSL's value (it grows to express every possible shape) or limit the variants we can support (we declare some markets out-of-scope for political reasons rather than technical ones).

The resolver doesn't care which variation a variant uses — specificity wins regardless. See [Rule Engine › The three impl variations](./rule-engine.md#the-three-impl-variations) for the side-by-side comparison.

## Domain vs workflow state

### Why a separate `WorkflowScratchpad` rather than putting transient state on `Payment`?

Two failure modes get ruled out by the type system instead of by code review:

1. **Accidental persistence of ephemeral state.** Anything added to `Payment` lands in `trans_dtl` / `trans_lfcyc_event` and lives forever in the customer-visible audit trail. A clearing trace id or a Customer360 risk score don't belong there. The `ServiceResult` marker interface is structurally separate from the `Payment` sealed hierarchy, so a service author who tries to fold scratchpad data into the persisted Payment gets a compile error.
2. **Workflow replays seeing stale "live" state.** Temporal replays the entire workflow on worker restart. If a service result lived on `Payment`, replays would re-fetch it (defeating the determinism story) or re-use a stale value. Keeping it in the scratchpad — which is just data passed through the workflow signature — sidesteps both problems.

The asymmetry between Domain and scratchpad is deliberate: promoting a scratchpad field to `Payment` is a code-reviewed DB migration; demoting a Domain field to scratchpad is a breaking change. When in doubt, default to scratchpad. See [Data Flow › The two halves of `PaymentPayload`](./data-flow.md#the-two-halves-of-paymentpayload).

### Why does resolution happen at the workflow boundary, not inside a dispatch activity?

The natural reflex from Java/Kotlin Temporal codebases is to put DI lookups inside activities. We deliberately don't, for three reasons:

1. **Activities are normal ArC / CDI beans**, but they're invoked through Temporal's task-queue plumbing. Putting routing inside an activity means **two** indirections per call (workflow → dispatch activity → resolved service) and an extra Temporal event-history entry per service call.
2. **Resolution is a pure data lookup.** It doesn't need an activity boundary to be safe — the workflow can do it inline on the workflow thread, and Temporal replay will produce the same answer because `ServiceResolver.resolve(ctx)` is a pure function of `ctx`.
3. **Putting the resolver in the workflow makes the workflow's service dependencies explicit at construction time** — each `ServiceResolver<I>` is a constructor parameter — which makes test-mocking trivial.

So the rule is: **workflows resolve, services run on the workflow thread, activities are called from inside services for I/O.** No dispatch activity layer. See [Variant Resolution › Why resolution happens at the workflow boundary](./variant-resolution.md#why-resolution-happens-at-the-workflow-boundary-not-in-an-activity).

## Tooling

### Why KSP + ArC, instead of plain runtime reflection?

Three properties we'd lose with runtime reflection:

| Property | KSP + ArC | Runtime reflection |
| --- | --- | --- |
| Conflict detection | Build time, file-pinned diagnostic | Boot time, stack trace (or worse, first request) |
| Worker startup | Index pre-built; negligible overhead | One reflection scan over every impl class |
| Native image readiness | Friendly — everything visible at build | Requires per-impl reflection metadata hints |

The single biggest reason is **build-time uniqueness**: ambiguous beans in pure CDI throw `AmbiguousResolutionException` only at the first injection that hits the ambiguity. A KSP error fails CI on a feature branch instead of an incident in production. See [Tooling Rationale › KSP](./tooling-rationale.md#codegen-ksp-not-kapt--reflection--hand-written).

### Why per-`(paymentMethod, market)` modules instead of one module per impl class?

`2 payment-methods × 28 markets + 1 generic = 57 impl modules`. One module per impl class would explode the Gradle graph to roughly `22 services × 28 markets × 2 payment-methods ≈ 1,232 modules` — buildable but painful, and most of those modules would carry one or two `@Rulebook` `val`s plus boilerplate.

The chosen grain matches **how teams own integration work**: the team that owns push and pull for a market is usually the same team (same regulators, same clearing rails, same on-call). One module per `(paymentMethod, market)` puts everything that team owns in one place. AccountType, frequency, and paymentState variance lives inside each module as separate rulebooks/impls. See [Interfaces › Module layout](./interfaces.md#module-layout).

### What's the migration path for services that aren't yet on the resolver?

The proposal doesn't require a big-bang switchover. The realtime and batch workers can run a mix of resolver-driven services and bespoke selection logic during rollout:

1. Services not yet migrated keep their existing selection logic.
2. Migrated services get a `ServiceResolver<I>` bean produced by the KSP-generated `ResolverFactory`.
3. A workflow can use either path — it just injects `ServiceResolver<I>` for migrated services and the legacy selector for the rest. No global switch flag.

Recommended order: **Generic services first** (smallest blast radius — single impl, no routing), then market-only services (1 axis), then 2-axis, then 3-axis. By the time `PaymentValidationService` (5 axes) is migrated, the resolver and KSP plumbing has been exercised by ~18 simpler services. See [Strategies › Per-service migration](./strategies.md#per-service-migration).

## Operations

### What happens when a rule throws at runtime?

It bubbles to the validation service as a regular exception. The service wraps it in `Either.Left(ValidationFailure(rule = "instrument-valid", code = "RULE_EXCEPTION", message = e.message))` and returns to the workflow, which then transitions the payment to `DECLINED` with the same routing-unsupported-style reason. The rule's stack trace lands in `notification_tracker` along with the `PaymentContext` so operations can identify which `(market, accountType, frequency, paymentState)` tuple is impacted.

Telemetry-wise: every rule's `evaluate.duration` metric is tagged with the rule id and all five context axes, so a sudden spike in `rule.evaluate.failure{rule.id="instrument-valid", market="GB", …}` shows up on the per-market validation dashboard without any rule-specific instrumentation.

### What if KSP fails the build over a coverage gap mid-release?

The release-time [coverage gate](./variant-resolution.md#coverage-gate) is intentionally distinct from the per-build KSP processor. Per-build KSP catches `(interface, impl)` mismatches and orchestration-lint errors. The coverage gate runs only when assembling a deployment artifact and reads `live-markets.txt` to confirm each market has an impl (or an explicit `falls-back-to-generic` annotation) for each market-varying service.

If a market launch surfaces an impl gap mid-release, the answer is **add the impl or annotate the market as a generic-fallback in `live-markets.txt`** — both are code-reviewed changes. The release artifact rebuilds, the gate passes, and the deploy goes ahead. The mechanism is designed to surface gaps before code ships, not to block deploys after the fact.
