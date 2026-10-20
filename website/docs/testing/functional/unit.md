---
title: Unit Tests
description: 'A unit test checks one stage, one workflow or one activity on its own, with everything around it stubbed.'
---

import Lead from '@site/src/components/Lead';

# Unit Tests

<Lead>A unit test checks one stage, one workflow or one activity on its own, with everything around it stubbed. Most of them test stages and the checks and methods they use, because that is where behavior lives: every way one market differs from another is one of those classes, so each needs tests of its own.</Lead>

This is the innermost layer of [functional testing](./index.md). The tests use the test support that ships with the Temporal SDK, and nothing outside the unit under test runs. Real dependencies first appear in [integration tests](./integration.md).

## Stages, checks and methods

A stage makes its calls, commits once through `PaymentStore`, and returns its outcome ([Building Stages](../../build/principles/core-build/stages.md)). Its test stubs the activities and checks three things:

- The outcome for each answer the calls can give. Verify can end `ACCEPTED`, `SCHEDULED` or `DECLINED`, and a business failure such as a closed account must end in `DECLINED`, never in a retry.
- The commit it asks for: the state it expects, the state it moves to, the timeline entry with its cluster, and the Work Tracker rows it opens or closes. Verify on a corporate payment, for example, writes its `ALLOC_REQUEST` row in that same commit.
- What happens when the guarded update changes no row because another writer moved the payment first, such as a cancel that beat Reverify. The stage returns the payment as it stands and doesn't fail.

The announcement gets its own case: the RTF event names the state that was committed, and a Raven message goes out only where the market's setting turns it on. Fulfil is the one stage that announces before its commit, so its test checks that order too.

A new check or method, such as `MandateCheck` for markets that check a mandate, arrives with tests of its own: the call it makes and where it applies. For Verify, Reverify and Represent, the decision itself comes from the verification rules, which are tested on their own (below). Their stage tests check that the stage runs the checks it is given and commits the decision the rules gave.

## Verification rules

A verification rule is a plain condition over the facts the checks gathered, so its tests need no stubs and no Temporal test environment. A test builds the facts, runs the rules for one resolved profile and step, and checks the report ([Writing verification rules](../../build/principles/core-build/stages.md#writing-verification-rules)):

- Each small specification, such as `instrumentFound`, gets a table of cases once, facts in and yes or no out. Each rule then gets its own cases: the mandate rule needs one for an active mandate and one for each status that isn't.
- Priority decides. When two rules fail, the decision carries the code of the higher-priority one, and the report names both.
- A rule whose `runsWhen` is false is skipped, not failed. A payment that didn't run `MandateCheck` skips the mandate rule, and after "instrument not found", the rule that checks the instrument is open is skipped too.
- A rule runs only in the steps it lists, and only where its `appliesTo` matches. A market's rule with a shared rule's ID replaces it in that market and nowhere else.
- The time is part of the facts. A test sets it, so a rule about dates gives the same answer on every run.
- Every rule has a decline code. A test asks the rule registry for every rule it holds and fails if the table of codes has none for one, so a new rule can't ship without its code.

## The profile lookup

A workflow finds its stages through the stage resolver, and every stage, check and method says where it applies ([Building the Stage Resolver](../../build/principles/core-build/stage-resolver.md)). The registries behind the resolver are plain Kotlin, so a unit test builds them from a list of classes, without Quarkus, and checks:

- Each registry builds without a tie. Two classes level for one job fail with an error that names both and the combination.
- The most specific class wins. A market's own class beats the shared one with the same key in that market, and nowhere else, and a class that names more behaviors beats one that names fewer.
- Every behavior a step must act on is handled. Delete `MandateCheck`, and no combination with mandate authorization is in the manifest, while combinations without one are unaffected.
- Every combination in the capability manifest gets a stage, and a class for every key it must fill, for every step its journey runs.
- The classes come back sorted by key, whatever order they were given in, so a replay makes the same calls in the same order.
- The report matches the checked-in one. A change to what a combination runs fails this test until the same pull request updates the report, so the reviewer sees every row that moved.

Two more tests run against the built app. Every stage, check and method class on the classpath must be in a registry, so a module without its `META-INF/beans.xml` can't drop a class silently. And every class tied to a market must start with that market's code.

The onboarding workflow checks every market release against the manifest, so a gap the tests miss turns into a release that can't go live.

## Workflows

A workflow test runs the real workflow code in the SDK's test environment (`TestWorkflowEnvironment`, in the Java SDK), with the activities mocked. It checks the journey's order and where it stops, not what each step does:

- A corporate payment stops after Verify. Its next step is a Work Tracker row for a dispatcher, not a call the workflow makes.
- A payment that Verify declines ends `DECLINED`, and no later stage runs.
- Each announcement finishes before the next stage starts. Capture and Verify on the Online cluster are the exception: they commit back to back, and both announcements follow the reply.
- A Verify call on the Online cluster that fails its 3 tries as a local activity goes out again as a regular activity, and the payment carries on instead of failing.
- In Create Payment Intent, a timer that fires more than a minute late gives the customer one more window. The test holds the worker back past the timer, so the timer fires late, and a confirm sent in the extra window still goes through.

No workflow sleeps until a due date. Dated work waits in Oracle as a Work Tracker row until a dispatcher starts it, so most workflow tests need no timers at all.

## Activities

An activity test calls the activity with its client faked, and checks the rules every activity follows ([Building Activities](../../build/principles/core-build/activities.md)):

- Every call carries its idempotency key, such as `{paymentId}-{step}`.
- A 429 becomes `ApplicationFailure.newFailureWithCauseAndDelay(...)` carrying the `Retry-After` delay.
- A business error is non-retryable. Anything else is left to Temporal's retry policy.
- One task makes one call: the HTTP client never retries on its own.

`PaymentStore` is the exception. What matters there is the guarded update against a real database, which is the job of [integration tests](./integration.md).
