---
title: Unit Tests
description: 'A unit test checks one stage, one workflow or one activity on its own, with everything around it stubbed.'
---

import Lead from '@site/src/components/Lead';

# Unit Tests

<Lead>A unit test checks one stage, one workflow or one activity on its own, with everything around it stubbed. Most of them test stages, because that is where behavior lives: every way one market differs from another is a stage implementation, so every implementation needs tests of its own.</Lead>

This is the innermost layer of [functional testing](./index.md). The tests use the test support that ships with the Temporal SDK, and nothing outside the unit under test runs. Real dependencies first appear in [integration tests](./integration.md).

## Stages, one implementation at a time

A stage makes its calls, commits once through `PaymentStore`, and returns its outcome ([Building Stages](../../build/principles/core-build/stages.md)). Its test stubs the activities and checks three things:

- The outcome for each answer the calls can give. Verify can end `ACCEPTED`, `SCHEDULED` or `DECLINED`, and a business failure such as a closed account must end in `DECLINED`, never in a retry.
- The commit it asks for: the state it expects, the state it moves to, the timeline entry with its cluster, and the Work Tracker rows it opens or closes. Verify on a corporate payment, for example, writes its `ALLOC_REQUEST` row in that same commit.
- What happens when the guarded update changes no row because another writer moved the payment first, such as a cancel that beat Reverify. The stage returns the payment as it stands and doesn't fail.

The announcement gets its own case: the RTF event names the state that was committed, and a Raven message goes out only where the market's setting turns it on. Fulfil is the one stage that announces before its commit, so its test checks that order too.

A new implementation, such as `PaymentVerifyStageWithMandate` for markets that check a mandate, arrives with these tests for the behaviors it serves.

## The plan-key lookup

A workflow finds its stages through the index that KSP (Kotlin Symbol Processing) generates at build time from the plan key the Router pins. The index is code like any other, so it is tested like any other:

- Every combination in the build's capability manifest resolves to an implementation for every step its journey runs.
- The most specific match wins. A market override in `market/{m}/stages/` beats the default for its own market, and nowhere else.
- A combination with no implementation can't be onboarded, so it must not appear in the manifest.

Provisioning checks every market release against that manifest, so a gap the tests miss turns into a release that can't go live.

## Workflows

A workflow test runs the real workflow code in the SDK's test environment (`TestWorkflowEnvironment`, in the Java SDK), with the activities mocked. It checks the journey's order and where it stops, not what each step does:

- A corporate payment stops after Verify. Its next step is a Work Tracker row for a dispatcher, not a call the workflow makes.
- A payment that Verify declines ends `DECLINED`, and no later stage runs.
- Each announcement finishes before the next stage starts. Capture and Verify on the Online cluster are the exception: they commit back to back, and both announcements follow the reply.

No workflow sleeps until a due date. Dated work waits in Oracle as a Work Tracker row until a dispatcher starts it, so most workflow tests need no timers at all.

## Activities

An activity test calls the activity with its client faked, and checks the rules every activity follows ([Building Activities](../../build/principles/core-build/activities.md)):

- Every call carries its idempotency key, such as `{paymentId}-{step}`.
- A 429 becomes `ApplicationFailure.newFailureWithCauseAndDelay(...)` carrying the `Retry-After` delay.
- A business error is non-retryable. Anything else is left to Temporal's retry policy.
- One task makes one call: the HTTP client never retries on its own.

`PaymentStore` is the exception. What matters there is the guarded update against a real database, which is the job of [integration tests](./integration.md).
