---
title: Tooling Rationale
sidebar_position: 8
---

# Tooling Rationale

This page justifies every **additional** library, annotation processor, or build-time tool the proposal introduces. Kotlin and Quarkus are project defaults — already chosen, already documented in [Build › Principles](../../principles/), not re-litigated here.

Each section is structured the same way: what alternatives were considered, why each was rejected, and why this pick wins.

## Resolution within ArC / CDI: KSP-synthesised `@Identifier`, not per-axis `@Qualifier`

The native CDI reflex is to define one `@Qualifier` annotation per axis value (`@UK`, `@Consumer`, `@Autopay`) and inject `Instance<T>` with combinations of them. The proposal does not.

| Alternative | Reason rejected |
| --- | --- |
| **Per-axis `@Qualifier`** annotations injected via `Instance<T>` | Combinatorial annotation sprawl — N markets means N new annotations in a shared module. Doesn't give specificity-based fallback for free; we'd still write a selector on top. CDI ambiguity errors fire at first injection, not at build. |
| **Manual factory pattern**, no DI for impls | Loses bean lifecycle (scoping, interceptors, observability). Forces us to manually wire every impl's dependencies. |
| **Hand-rolled service locator / `Map<VariantTuple, Class<*>>`** | Loses CDI scope and lifecycle management. Conflict detection becomes a runtime startup check at best. |

**Why ArC / CDI + KSP-synthesised `@Identifier`**: ArC / CDI owns lifecycle; routing is a separate concern handled by the KSP-generated `VariantIndex` keyed by `@Identifier`. The two concerns stay decoupled and both stay build-time-validated. No new annotations per market. See [Variant Resolution › `@Identifier`](./variant-resolution.md#identifier--the-ksp-synthesised-handle-arc--cdi-uses-to-address-impls) for the synthesised-handle mechanics.

**Further reading.** [Quarkus ArC reference](https://quarkus.io/guides/cdi-reference). [Jakarta CDI 4.0 specification](https://jakarta.ee/specifications/cdi/). Stuart Douglas's deep-dive talk [*"Quarkus: Supersonic, Subatomic Java"*](https://www.youtube.com/results?search_query=quarkus+arc+stuart+douglas) on how ArC ditches the runtime reflection that classical CDI containers depend on.

## Codegen: KSP, not kapt / reflection / hand-written

The decision: use [KSP (Kotlin Symbol Processing)](https://kotlinlang.org/docs/ksp-overview.html) for variant-index generation, rulebook-index generation, conflict detection, and the `OrchestrationLint` check.

| Alternative | Reason rejected |
| --- | --- |
| **kapt** (javac annotation processing) | Slow (full Kotlin → Java stub round-trip); doesn't see Kotlin-native constructs (value classes, sealed interfaces, default args) accurately. Officially discouraged for new Kotlin code. |
| **Runtime classpath scan** (Reflections lib, ArC `BeanArchives`, etc.) | Conflicts surface at boot, not at build. Slow startup. Hostile to GraalVM native image (every impl needs reflection metadata). Errors are stack traces, not file:line diagnostics. |
| **Quarkus Build Steps alone** (no KSP) | Build steps see already-compiled bytecode; they don't do Kotlin-source-aware validation. We'd lose KSP's source-line diagnostics. (A Quarkus build step that *consumes* KSP output is great — that's exactly the recommended hybrid.) |
| **Hand-written registry** | Doesn't scale. Every new impl is two files to remember; humans forget. Conflict detection becomes "hope someone notices in code review." |

**Why KSP**: incremental, Gradle-cache friendly, native-Kotlin semantics, IDE-aware diagnostics, compatible with Quarkus build steps for the produce/transform side. The variant-tuple-to-impl mapping is a compile-time problem; KSP is the Kotlin-native way to solve it.

**Further reading.** [KSP overview](https://kotlinlang.org/docs/ksp-overview.html). [Quickstart](https://kotlinlang.org/docs/ksp-quickstart.html). KotlinConf talk [*"How to Write Your Own Symbol Processor with KSP"*](https://www.youtube.com/watch?v=bv-VyGM3HCY) by Ting-Yuan Huang & Brian Norman. [KSP API reference](https://kotlinlang.org/api/ksp/).

## Architecture tests: Konsist

[Konsist](https://docs.konsist.lemonappdev.com/) is a Kotlin-aware architecture-test library. We use it for the conventions KSP can't trivially enforce — e.g. "impl class names end with their variant suffix", "impls live in `:service-impl-*` modules".

| Alternative | Reason rejected |
| --- | --- |
| **ArchUnit** | Java-first; works on Kotlin but Konsist exposes Kotlin-aware DSL (sealed hierarchies, extension functions, suspend modifiers). For a Kotlin-only repo, Konsist is more idiomatic. |
| **Custom JUnit tests with reflection** | Reinventing Konsist. |
| **No architecture tests; rely on code review** | The 22-service × 28-market combinatorics will outgrow human review attention. Specific conventions to enforce: variant suffix matches annotation; impls live in `:service-impl-*`; `ValidationRule` beans are `@ApplicationScoped`. Code review misses these eventually. |

**Why Konsist**: cheap to add, catches the conventions KSP doesn't (KSP enforces variant tuples; Konsist enforces module placement and class-name-matches-annotation hygiene).

**Further reading.** [Konsist docs](https://docs.konsist.lemonappdev.com/). Author's [introductory article *"Konsist — Kotlin Architecture Tests"*](https://github.com/LemonAppDev/konsist). [Example test suites](https://docs.konsist.lemonappdev.com/inspiration/snippets).

## Variant declaration: annotations + Kotlin DSL, not YAML/HOCON

Routing decisions for money movement should follow the same change-control as the rest of the code.

| Alternative | Reason rejected |
| --- | --- |
| **YAML routing table** (`payment.validation.GB.CONSUMER.AUTOPAY.RECURRING = com.amex…`) | Two sources of truth (class + YAML) that drift. No type safety. No refactoring support. Hot-reloadable, which sounds nice for routing changes but is *bad* for money-movement code paths — we want code review gating. |
| **Properties / SmallRye Config** | Same drawbacks, plus stringly-typed parameters. |
| **Database-backed routing table** | Adds a runtime dependency for routing decisions; cold-start ordering hell; backup/restore complexity; horrible for native image. |

**Why annotations + DSL**: source of truth lives next to the impl, refactoring tools work, code review gates routing changes, no runtime config dependency.

**Further reading.** [Kotlin type-safe builders (DSL design)](https://kotlinlang.org/docs/type-safe-builders.html). [Roman Elizarov on writing fluent Kotlin DSLs](https://www.youtube.com/watch?v=JzTeAM8N1-o).

## Rule engine: custom Kotlin DSL + atomic ArC / CDI beans, not Drools/OPA/Easy Rules

The proposal's rule engine is ~50 lines of DSL plus an `interface ValidationRule`. We deliberately did not pull in a packaged engine.

| Alternative | Reason rejected |
| --- | --- |
| **Drools** | Heavy (multi-MB rule engine, separate DSL, separate IDE plugin). Designed for complex forward-chaining inferencing; we want a sequential chain with short-circuit and rich error reporting. Massive overkill. |
| **Easy Rules** | Lighter than Drools but still adds a runtime engine, a separate annotation set (`@Rule`, `@Condition`, `@Action`), and reflection. No build-time prerequisite checking. |
| **OPA / Open Policy Agent** | Designed for cross-language policy decisions; introduces a Rego runtime and an external process or sidecar. Wrong shape — our rules are intra-process Kotlin that call Temporal activities. |
| **JSON Schema / JSON Logic** | For dynamic, untyped rule data. We have typed Kotlin; we want type-safe parameter passing (`AmountRange(min = 1.gbp, max = 5_000.gbp)`). |
| **Plain Kotlin `if`-chain inside each impl** | The thing the proposal explicitly avoids — leads to dozens of hand-written impl classes with the same shape of code. |

**Why custom DSL + ArC / CDI beans**: minimal new concepts on top of Kotlin and ArC. Each rule is a regular CDI bean (testable, mockable, observable via standard interceptors). The DSL is ~50 lines to implement and produces type-safe rulebook declarations with IDE refactoring. The packaged-engine alternatives all bring more weight than they save.

**Further reading.** [Drools docs](https://docs.drools.org/) (for the comparison rationale). [Easy Rules](https://github.com/j-easy/easy-rules). [*Type-safe builders*](https://kotlinlang.org/docs/type-safe-builders.html) (the Kotlin idiom this DSL uses).

## Kotlinx serialization, not Jackson

Every type that crosses a Temporal workflow boundary — `PaymentContext`, `PaymentPayload`, every `ServiceResult`, every `Payment` subtype — must serialise. The project currently uses Jackson with `jackson-module-kotlin` for HTTP DTOs. **The proposal commits to a full migration off Jackson to [`kotlinx.serialization`](https://github.com/Kotlin/kotlinx.serialization)** — a single serialiser across the codebase rather than a split.

| Alternative | Reason rejected |
| --- | --- |
| **Keep Jackson with `jackson-module-kotlin`** | Reflection-based (hostile to GraalVM native image without elaborate metadata hints); `@JsonSubTypes` lists every sealed-interface subtype manually — gaps surface at runtime; value classes (`@JvmInline value class Market`) require custom serializers; data classes with default args require workarounds via `jackson-module-kotlin` whose Kotlin-feature coverage is incomplete. |
| **Split: Jackson for HTTP, kotlinx for workflow** | Two serialisation libraries to maintain; conversion glue between layers; double the test surface for any cross-boundary type (e.g. a `Payment` exposed both at the REST boundary and threaded through Temporal). |
| **Gson** | Reflection-based, no Kotlin-aware module of comparable quality. |
| **Hand-written codecs** | Tedious; same surface as kotlinx.serialization's generated code minus the safety net. |

**Why a full migration**: compiler-plugin-generated codecs (zero reflection), first-class support for `@Serializable` sealed interfaces and value classes, Temporal data-converter integration is a known pattern, and consistency across layers lowers the cost of onboarding new engineers.

**Migration plan**:

1. Add the `kotlinx.serialization` Gradle plugin + runtime to `:variance-core`, `:domain-model`, `:service-api`.
2. Annotate every workflow-boundary type with `@Serializable` (no behaviour change — Jackson keeps working).
3. Configure Temporal's data converter (in `:codec-server-app`) to use `kotlinx.serialization.json.Json`.
4. Migrate HTTP DTOs incrementally per Quarkus REST resource — Quarkus REST supports `kotlinx.serialization` via the [`quarkus-rest-kotlin-serialization`](https://quarkus.io/guides/rest-json) extension.
5. Remove `jackson-module-kotlin` once the last `@JsonSubTypes`-style declaration is gone; drop the Jackson dependency in a follow-up.

**Payoff**: zero-reflection codec generation, first-class sealed-interface and value-class support, native-image readiness, and a single serialiser to learn.

**Further reading.** [Project repo](https://github.com/Kotlin/kotlinx.serialization). [Kotlin Serialization Guide](https://kotlinlang.org/docs/serialization.html). Roman Elizarov & Leonid Startsev's [KotlinConf talk on the serialization compiler plugin](https://www.youtube.com/watch?v=Jt-c9F4uHcw). [Temporal data converters](https://docs.temporal.io/encyclopedia/data-converters).

## Error model: selective Arrow-kt `Either`

Use [Arrow-kt](https://arrow-kt.io/)'s `Either` only for services that benefit from rich, structured validation errors — primarily the consolidated `PaymentValidationService` interface. Other services use plain Kotlin exceptions caught by Temporal's retry policy.

| Alternative | Reason rejected |
| --- | --- |
| **Exceptions everywhere** | Loses structured error data — a `ValidationFailure(rule, code, message, context)` is much more useful for telemetry and customer-facing errors than a thrown exception. |
| **Kotlin stdlib `Result<T>`** | Single-error model; we want to fail fast on the first rule failure with rich context. `Result` works but Arrow's `Either` is more ergonomic for `either { … bind() … }` chains and `getOrElse`. |
| **Arrow everywhere** | Learning-curve tax on services whose only outcomes are "did it" or "threw" (e.g. `PaymentStateTransitionService`). Use it where it pays back. |

**Why selective Arrow**: rich validation chains genuinely benefit from `Either` and the `either { }` DSL; the other 21 services don't. Keep blast radius narrow.

**Further reading.** [Arrow-kt site](https://arrow-kt.io/). [Either documentation](https://arrow-kt.io/learn/typed-errors/either-and-ior/). Alejandro Serrano Mena's [*Functional Software Architecture in Kotlin* talk](https://www.youtube.com/watch?v=uGxx01yYAxk).

## Orchestration declaration: `@OrchestrationPlan` in code, not external config

The workflow's service-call order is declared in a Kotlin `object` that KSP can introspect. See [Data Flow › How `@OrchestrationPlan` is declared](./data-flow.md#how-orchestrationplan-is-declared) for the annotation mechanics.

| Alternative | Reason rejected |
| --- | --- |
| **Embed orchestration inline in the workflow body** | Works, but `OrchestrationLint` would have to parse Kotlin call expressions inside the workflow to know what runs in what order. Brittle. Explicit `@OrchestrationPlan` is a structured artefact KSP can read directly. |
| **External YAML orchestration config** | Same drift problem as YAML routing. Separates the source of truth from the workflow code it describes. |
| **Temporal child workflows for each step** | Heavyweight; one Temporal event-history entry per service call is enough — we don't need a full workflow lifecycle per service call. |

**Why `@OrchestrationPlan` declared in code**: KSP-introspectable, type-safe references to service interfaces, supports variant-aware branching (`when (ctx.accountType)`), and lives in the workflow module so it's reviewed alongside the workflow it governs.

**Further reading.** Temporal Java/Kotlin SDK [*core application* guide](https://docs.temporal.io/develop/java/core-application). [Temporal workflow determinism](https://docs.temporal.io/workflows#deterministic-constraints).

## Summary table

| Concern | Pick | One-line reason |
| --- | --- | --- |
| Resolution mapping in ArC / CDI | KSP-synthesised `@Identifier` | Build-time validation; no annotation sprawl per market |
| Build-time codegen | KSP | Kotlin-native semantics; file-pinned diagnostics; native-image friendly |
| Architecture tests | Konsist | Kotlin-idiomatic; catches conventions KSP doesn't |
| Variant declaration | Annotations + Kotlin DSL | One source of truth; code-reviewed; type-safe |
| Rule engine | Custom DSL + ArC / CDI beans | Light; testable; cross-service `requires` is build-checkable |
| Serialization | kotlinx.serialization (full migration off Jackson) | No reflection; native image; Kotlin-aware; single serialiser across layers |
| Validation error model | Arrow `Either` (validation services only) | Rich error data where it matters; no learning tax elsewhere |
| Workflow orchestration plan | `@OrchestrationPlan` in code | KSP-introspectable; type-safe; lives with the workflow |
