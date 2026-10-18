---
title: Building the Stage Index
description: 'The stage index is how a workflow finds its stage classes, and how provisioning learns what the build can run.'
sidebar_label: Stage Index
---

import Lead from '@site/src/components/Lead';

# Building the Stage Index

<Lead>The stage index is how a workflow finds its stage classes, and how provisioning learns what the build can run. KSP (Kotlin Symbol Processing) writes it while the code compiles, so a mistake stops the build at the class that caused it, and nothing extra runs when a payment does.</Lead>

## What the index has to do

Three parts of Billpay depend on the index, each at a different moment:

| When | Who uses it | What it must get right |
| --- | --- | --- |
| A payment runs | The workflow, through `StageIndex.lookup(plan)` | The same classes on every replay, built on the workflow's own thread |
| A release is provisioned | Provisioning, through `GET /provisioning/capabilities` | Only the combinations the build really runs |
| The code compiles | Whoever adds or changes a stage | A mistake fails the build, pointing at the class |

The lookup runs once, at the top of the workflow's method, and hands back stage objects built inside that execution. They have to be: a stage holds activity stubs, and Temporal only lets a workflow make stubs on its own thread. [Building Stages](./stages.md#how-a-stage-gets-picked) shows the call. This page is about what answers it.

## How KSP builds it

Every module that holds stage classes, `core/lib/stages/impl` and each `market/{m}/stages`, runs the processor as part of its compile:

1. It finds every class that implements a `Payment{Step}Stage` interface, and reads its annotation and its constructor.
2. It writes that module's piece of the index: for each step, the classes in order, most specific first. The app module joins the pieces into one `StageIndex`, and writes the capability manifest from the same data.
3. It checks the result, and fails the build at the class when:
   - two classes match a combination equally;
   - a stage interface has no default;
   - a class implements a stage interface without the annotation, which would otherwise leave it out of the index without a word;
   - a class name doesn't match its annotation, under the [naming rule](../../../design/component-model/stages.md#naming-implementations).

What it writes is plain Kotlin. For Verify, it looks something like this:

```kotlin
// Written by the processor: the most specific match first, the default last.
// s holds the activity stubs the workflow has just made on its own thread.
internal fun verifyFor(plan: PlanKey, s: Stubs, rules: RuleSettings): PaymentVerifyStage = when {
    plan.requiresMandateAuthorization && plan.requiresBankConfirmation ->
        PaymentVerifyStageWithMandateAndBankConfirmation(s.instruments, s.options, s.plans, rules, s.store)
    plan.requiresMandateAuthorization ->
        PaymentVerifyStageWithMandate(s.instruments, s.options, s.plans, rules, s.store)
    plan.requiresBankConfirmation ->
        PaymentVerifyStageWithBankConfirmation(s.instruments, s.options, rules, s.store)
    else ->
        DefaultPaymentVerifyStage(s.instruments, s.options, rules, s.store)
}
```

*(A sketch of the output; the processor's real code differs. A market override would add a branch on `plan.market` at the top.)*

There is no reflection, classpath scan or container call in it. A replay runs the same `when` over the same plan key and gets the same classes, and Worker Versioning keeps a running payment on the build it started with, and so on the same index.

## The capability manifest

The same pass writes the capability manifest: every combination of behaviors the build can run. `GET /provisioning/capabilities` returns it, and provisioning checks every market release against it before anything goes live.

A default can't stand in for everything. Each stage interface lists the values its default can't handle, and a combination with one of those values makes the manifest only when a class declares it:

```kotlin
@StageInterface(
    step = VERIFY,
    ownClassFor = [MANDATE_AUTHORIZATION_Y, BANK_CONFIRMATION_Y],
)
interface PaymentVerifyStage { /* run, announce */ }
```

*(Illustrative.)*

So a market that turns on mandate authorization before `PaymentVerifyStageWithMandate` exists can't go live. Its release is refused, instead of its payments running a default Verify that never checks the mandate.

The index has unit tests of its own, listed on [Testing → Unit](../../../testing/functional/unit.md#the-plan-key-lookup).

## Why KSP

- Mistakes stop the compile, at the class. Most of the alternatives below find them later: in tests, at boot, or while a payment runs.
- Nothing extra runs with a payment. The lookup is the generated `when` above.
- It needs no container and no reflection. Quarkus's dependency injection (CDI) never sees stage objects, and if workers ever move to a GraalVM native image, the index needs no reflection config there.
- Adding a version of a stage is one edit, the annotated class, with no list to update somewhere else.

These were the alternatives:

| Option | When a mistake shows up | Why not |
| --- | --- | --- |
| A hand-written registry, as a map or a small DSL | Never: a forgotten line silently runs the default | Every class needs a second edit |
| A registry plus a test that scans for classes with ClassGraph | In tests | The close second. Simpler, but every class still needs a second edit |
| A classpath scan at startup, then reflection | At boot, in each environment | Needs reflection config, and ClassGraph finds nothing in a native image |
| A Quarkus build step over Jandex, Quarkus's index of annotations | At build, but not at a source line | A module missing from the index silently drops out, and it means two extension modules to maintain |
| CDI `Instance<T>` with qualifiers | At runtime | Stages can't be beans: their stubs must be made on the workflow's thread |
| `ServiceLoader`, Java's built-in plugin lookup | At runtime | A missing entry is skipped silently |
| kapt, Kotlin's older annotation processor | At compile | The same model as KSP, but slower, and Android's guidance lists it as in maintenance mode |

If nobody can own the processor, we would switch to the registry and its ClassGraph test.

## What to watch

- The app joins each module's piece of the index with a KSP API that is still marked experimental, so a KSP upgrade can change it.
- Check which Kotlin versions the KSP release supports against the build's Kotlin version, and check again before upgrading either one.
- Nobody has checked yet whether KSP reruns during Quarkus dev mode's live reload. Check it before relying on live reload for stage changes.
