---
title: Building the Stage Index
description: 'The stage index is how a workflow finds its stage classes, and how provisioning learns what the build can run.'
sidebar_label: Stage Index
---

import Lead from '@site/src/components/Lead';

# Building the Stage Index

<Lead>The stage index is how a workflow finds its stage classes, and how provisioning learns what the build can run. KSP (Kotlin Symbol Processing) works out which class every combination runs while the code compiles, and writes the answers as a table. A mistake stops the build at the class that caused it, and a running payment only reads a row.</Lead>

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
2. It writes down what it found. The app module joins every module's findings, works out the winning class for every combination, and writes three things: the table the workflow reads, the capability manifest, and a report of every combination.
3. It checks the result, and fails the build at the class when:
   - two classes tie for a combination, and the error names that combination;
   - a stage interface has no default;
   - a class implements a stage interface without the annotation, which would otherwise leave it out of the table without a word;
   - a class name doesn't match its annotation, under the [naming rule](../../../design/component-model/stages.md#naming-implementations).

## How a row gets its class

Each step has its own table, keyed only by the behaviors that step's classes declare. A behavior that changes nothing about a step stays out of its key, which keeps the table small: Verify's classes declare the account type, mandate authorization, bank confirmation and the plan key's go-ahead mark, so Verify's key has those four values and 3 × 2 × 2 × 2 = 24 rows. If a Verify class ever declares AR posting, the key gains it on the next build.

KSP picks each row's class in this order:

1. A class is a candidate when everything it declares matches the row.
2. If the row has a value the step's default can't handle, such as mandate authorization for Verify, the class must declare that value. A class that doesn't would skip a check the payment needs.
3. In a market that has a class of its own, that class beats the shared ones.
4. Of the classes left, the one that declares the most wins.
5. If two are still level, the build fails and names the row. If none is left, the row isn't written, so the build can't run that combination.

## A worked example: Verify

These are Verify's classes and what each one declares. The interface also says its default can't handle mandate authorization or bank confirmation.

| Class | Declares |
| --- | --- |
| `DefaultPaymentVerifyStage` | Nothing |
| `PaymentVerifyStageWithMandate` | Mandate authorization |
| `PaymentVerifyStageWithBankConfirmation` | Bank confirmation |
| `PaymentVerifyStageWithMandateAndBankConfirmation` | Mandate authorization, bank confirmation |
| `PaymentVerifyStageForCorporateWithMandate` | Corporate, mandate authorization |
| `PaymentVerifyStageWithGoAhead` (Proposed) | The go-ahead mark |
| `PaymentVerifyStageWithBankConfirmationInGb` | Bank confirmation, in GB |

Run the rules over all 24 rows and each class wins a set of them. In this table and the next, a class goes by what follows `PaymentVerifyStage` in its name, so `WithMandate` is `PaymentVerifyStageWithMandate`, and `Default` is `DefaultPaymentVerifyStage`.

| Class | Rows it wins |
| --- | --- |
| `Default` | Any account type with no mandate, no bank confirmation and no go-ahead (3 rows) |
| `WithGoAhead` | Any account type with a go-ahead, and no mandate or bank confirmation (3 rows) |
| `WithMandate` | Consumer and business travel with a mandate and no bank confirmation, with or without a go-ahead (4 rows) |
| `ForCorporateWithMandate` | Corporate with a mandate and no bank confirmation, with or without a go-ahead (2 rows) |
| `WithBankConfirmation` | Any account type with bank confirmation and no mandate, with or without a go-ahead (6 rows) |
| `WithMandateAndBankConfirmation` | Any account type with a mandate and bank confirmation, with or without a go-ahead (6 rows) |

GB gets six rows of its own: the ones with bank confirmation and no mandate, where its class wins by rule 3. A GB payment with both stays on the shared class, because the GB class doesn't declare mandate authorization and rule 2 rules it out.

Rule 2 also settles what happens when a go-ahead meets another behavior. On count alone, `PaymentVerifyStageWithMandate` and `PaymentVerifyStageWithGoAhead` tie for a mandate payment that waited for a go-ahead, but the go-ahead class doesn't check the mandate, so rule 2 drops it. A payment that needs bank confirmation and a go-ahead gets `PaymentVerifyStageWithBankConfirmation` the same way, so the token check runs. That is the behavior the journey wants: the customer waits once, and the bank confirm is the go-ahead.

At runtime the workflow builds Verify's key from its plan key (account type, mandate, bank, go-ahead) and reads one row, looking in its market's own rows first:

| Payment | Key | Class |
| --- | --- | --- |
| A US consumer pays by bank (Plaid) | Consumer, N, Y, N | `WithBankConfirmation` |
| A GB consumer pays by bank | Consumer, N, Y, N | `WithBankConfirmationInGb` |
| A GB consumer pays while another payment is pending | Consumer, N, N, Y | `WithGoAhead` |
| A consumer in a market with mandates gives the go-ahead | Consumer, Y, N, Y | `WithMandate` |
| A corporate payment in a market with mandates | Corporate, Y, N, N | `ForCorporateWithMandate` |

The first two payments have the same key and run different classes, because only GB has rows of its own. The third is a GB payment too, but GB's rows cover only bank confirmation, so its row comes from the shared table.

## What the build writes

The table itself is data, read by one small class:

```kotlin
class StageTable<T>(
    private val keyOf: (PlanKey) -> StageKey,
    private val rows: Map<StageKey, (Stubs, PlanKey) -> T>,
    private val overrides: Map<Market, Map<StageKey, (Stubs, PlanKey) -> T>>,
) {
    fun build(plan: PlanKey, s: Stubs): T {
        val key = keyOf(plan)
        val make = overrides[plan.market]?.get(key) ?: rows.getValue(key)
        return make(s, plan)
    }
}
```

KSP writes the rest. For Verify, it looks something like this:

```kotlin
// Generated. Verify's classes declare account type, mandate, bank confirmation and go-ahead,
// so its key has those four: 3 × 2 × 2 × 2 = 24 rows, each already decided.
internal val VERIFY = StageTable<PaymentVerifyStage>(
    keyOf = { p -> key(p.accountType, p.requiresMandateAuthorization, p.requiresBankConfirmation, p.waitsForGoAhead) },
    rows = mapOf(
        key(CONSUMER,  mandate = N, bank = N, goAhead = N) to ::defaultVerify,
        key(CONSUMER,  mandate = N, bank = N, goAhead = Y) to ::verifyWithGoAhead,
        key(CONSUMER,  mandate = Y, bank = N, goAhead = Y) to ::verifyWithMandate,
        key(CORPORATE, mandate = Y, bank = N, goAhead = N) to ::verifyForCorporateWithMandate,
        key(CONSUMER,  mandate = N, bank = Y, goAhead = Y) to ::verifyWithBankConfirmation,
        // ... one line for each of the 24 rows
    ),
    overrides = mapOf(
        GB to mapOf(
            key(CONSUMER, mandate = N, bank = Y, goAhead = N) to ::verifyWithBankConfirmationInGb,
            // ... the six rows where GB's own class wins
        ),
    ),
)

// One factory per class, written from its constructor. s holds the stubs the workflow just made.
private fun verifyWithMandate(s: Stubs, p: PlanKey) =
    PaymentVerifyStageWithMandate(s.instruments, s.options, s.plans, p.ruleSettings, s.store)
```

*(A sketch: the names are illustrative, and the processor's real output differs.)*

Every decision was made while the code compiled, so at runtime nothing weighs one class against another, and the order of the rows doesn't matter. There is no reflection, classpath scan or container call either. A replay reads the same row for the same plan key and gets the same class, and Worker Versioning, Temporal's way of keeping a workflow on the build it started on, keeps a running payment on the same table.

## Why the lookup stays in the workflow

The Router builds the plan key, so it could read the table as well and hand each workflow its class names. It doesn't, because during a rolling deploy the Router and the workers can run different builds. A Router on the new build could name a class the worker's build doesn't have yet, or a worker on the new build could be told to run a class it no longer picks. When the workflow reads the table itself, the build that runs the stages is the build that chose them, and Worker Versioning keeps that pairing for the life of the payment.

## The checked-in report

The build also writes a plain text report with one line per row, for every step:

```text
VERIFY     CONSUMER         mandate=N bank=N goAhead=N  DefaultPaymentVerifyStage
VERIFY     CONSUMER         mandate=Y bank=N goAhead=Y  PaymentVerifyStageWithMandate
VERIFY     CORPORATE        mandate=Y bank=N goAhead=N  PaymentVerifyStageForCorporateWithMandate
VERIFY GB  CONSUMER         mandate=N bank=Y goAhead=N  PaymentVerifyStageWithBankConfirmationInGb
```

The report is checked in, and a test fails when the build's report differs from it. A change to which class a combination runs can't land quietly: the pull request has to update the report, and the reviewer sees exactly which rows moved. These are three changes and what the build does with each:

| Change | What happens |
| --- | --- |
| `PaymentVerifyStageWithMandate` is deleted | Four rows disappear: consumer and business travel payments with a mandate and no bank confirmation. The report's diff shows them go, and provisioning refuses any release that needs them |
| A class that declares only the corporate account type is added | For a corporate payment with no mandate that waits for a go-ahead, it and `PaymentVerifyStageWithGoAhead` each declare one thing, so they tie. The build fails: `Verify tie at CORPORATE mandate=N bank=N goAhead=Y`, naming both classes. A class that declares both settles it |
| A Verify class declares AR posting | Verify's key gains AR posting and grows to 48 rows. The report's diff shows only the rows whose class changed |

## The capability manifest

The same tables are the capability manifest: a combination the build can run has a row in every step its journey runs. `GET /provisioning/capabilities` returns it, and provisioning checks every market release against it before anything goes live.

A default can't stand in for everything. Each stage interface lists the values its default can't handle, and a row with one of those values runs only on a class that declares it:

```kotlin
@StageInterface(
    step = VERIFY,
    ownClassFor = [MANDATE_AUTHORIZATION_Y, BANK_CONFIRMATION_Y],
)
interface PaymentVerifyStage { /* run, announce */ }
```

*(Illustrative.)*

So a market that turns on mandate authorization before `PaymentVerifyStageWithMandate` exists can't go live. Its rows aren't written, so its release is refused, instead of its payments running a Verify that never checks the mandate.

The index has unit tests of its own, listed on [Testing → Unit](../../../testing/functional/unit.md#the-plan-key-lookup).

## Why KSP

- Mistakes stop the compile, at the class. Most of the alternatives below find them later: in tests, at boot, or while a payment runs.
- A payment reads one row. Every choice between classes was made while the code compiled.
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

- The app joins each module's findings with a KSP API that is still marked experimental, so a KSP upgrade can change it.
- Check which Kotlin versions the KSP release supports against the build's Kotlin version, and check again before upgrading either one.
- Nobody has checked yet whether KSP reruns during Quarkus dev mode's live reload. Check it before relying on live reload for stage changes.
