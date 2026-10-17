---
title: Domain Model
description: "In Billpay's code, a payment's class is its state, and the only way from one state to the next is one of 36 functions."
sidebar_label: Domain Model
---

import Lead from '@site/src/components/Lead';
import DomainModelMap from '@site/src/components/DomainModelMap';

# Domain Model

<Lead>In Billpay's code, a payment's class is its state, and the only way from one state to the next is one of 36 functions. A `PaidFullPayment` can't be built without a tokenized account, a verified instrument and a clearing date, so no paid payment is ever missing one.</Lead>

A common way to model a payment is a status column beside fields that may or may not be filled in. That leaves room for a `PAID` payment with no clearing date, or a `RETURNED` one that can't say why it came back. Billpay's model leaves no room for either, because the compiler refuses to build them.

This page shows the model agreed on 2026-10-17, which covers the whole [lifecycle](./payment-state-model.md). The Kotlin supplied on 2026-10-16 doesn't have all of it yet. The map dashes what's missing, and [the last two sections](#what-the-code-still-needs) list it with the questions still open.

## The map

Each box is a class. Rows are the lifecycle states, read top to bottom, and columns are the two shapes a payment comes in: a full payment in the middle, a leg of a split payment on the right. Point at a class to see the functions that move it on, or use the buttons above the map to light up one part of it.

<DomainModelMap />

## The class is the state

There are fourteen sealed classes, one for each state. Eleven sit along the path from `PendingPayment` to `RepresentedPayment`, and two of those, `AllocatingPayment` and `AllocatedPayment`, belong to corporate payments only. `CancelledPayment`, `DeclinedPayment` and `DisallowedPayment` are for a payment that stops. Each one fixes its own `status`. The status isn't a field anyone sets: it comes with the class, so it can't drift away from the data.

There is no `setStatus` either. Each allowed move is an extension function that takes one class and returns the next, such as `ProcessedFullPayment.toPaidFullPayment()`. A move without a function can't happen. That is why the corporate path can't run on the supplied code yet: nothing in it moves a payment to `ALLOCATING`.

The [stages](./component-model/stages.md) are where these moves run. Verify moves a payment out of `PENDING`, Settle moves it from `PROCESSED` to `PAID`, and each stage commits the result through `PaymentStore`.

## Full payments and legs

Two shapes cross the states. A `FullPayment` settles as one amount. A `SplitPayment` is a leg: it carries its parent's ID as `originalPaymentId`, a `sequenceNumber` and its own amount. A leg's ID is its parent's plus the sequence number, `{paymentId}_{seq}`, which is also how One-Data pairs a leg's Accounts Receivable (AR) posting with the settlement of its parent: it reads the part before the `_`.

That makes twenty-two classes in all. A full payment has a class for each of the fourteen states. A leg has eight. It starts at `ACCEPTED`: it is made from a parent Verify has already passed, by `toAcceptedSplitPayment(splitSlice)`, so there's no pending, scheduled, allocating or allocated leg. From there it has the same seven states as any payment that moves money, plus `DeclinedSplitPayment`, because a leg's representment can fail its recheck. A leg is never cancelled.

The `SplitSlice` carries what the leg needs: its sequence number, its amount, its ID (`splitPaymentId`) and the card account it pays, so each leg can pay its own card account instead of its parent's. The parent can be `ACCEPTED` or already `PROCESSING` when its legs are made. A corporate parent is always `PROCESSING` by then, because its legs are written only once its Execute has cleared it. [Corporate Allocations](./corporate-allocations.md) covers that path.

## What each state guarantees

Two traits narrow what a class has to hold.

Every class from `SCHEDULED` to `REPRESENTED`, `ALLOCATING` and `ALLOCATED` included, is a `VerifiedPayment`. It has a `TokenizedAccount`, an amount that isn't null, a `VerifiedPaymentOption`, a `VerifiedInstrument` and an `ExecutableTimeline`. Nothing moves money until Verify has resolved all five, and the types enforce it: there's no way to hand an unverified instrument to a class that needs a verified one.

`RETURNED`, `REPRESENTING` and `REPRESENTED` are also a `RepresentmentPayment`, which means they carry `returnedInfo`: when the return took effect, why, where it came from, and which payment, presentment and date it returned. Which of those fields are required is still being confirmed.

`PENDING`, `CANCELLED`, `DECLINED` and `DISALLOWED` carry neither trait.

- A pending payment may not know its amount yet, so `PendingFullPayment` checks the amount when it's built. If the customer named the amount (an other amount, or an initial payment amount) or the option is already verified, the amount must be there. For any other option it must be empty, because Verify works the amount out.
- A pending payment that waits for the customer's bank also holds `bankConfirmation`, with the provider's reference.
- A cancelled payment, like a declined one, may have no amount and only a plain `Timeline`, because a payment cancelled while `PENDING` was never verified.
- A declined payment carries a `declineCode` and has no confirmation code. A leg is declined only when its representment fails the recheck.
- Only a push payment, one a third party sends in, can end `DISALLOWED`.

## Presentments

A payment can go to the customer's bank more than once. Each time is a [presentment](./payment-state-model.md#presentments), with its own row and its own `presentmentSequence`, starting at 1.

The model follows the rows. `toRepresentingFullPayment()` doesn't move the returned payment: it builds the next presentment, a `RepresentingFullPayment` numbered one higher, and the `ReturnedFullPayment` it came from stays as it is. Every other move keeps the number.

That is also why a second return takes its own `ReturnedInfo`. A payment returned twice ends with two `RETURNED` rows, presentments 1 and 2, each with the details of its own return. If a representment fails its recheck, its own row turns `DECLINED`, and the presentment before it stays `RETURNED`.

## Moving between states

The 36 functions, grouped by the class they start from. Leg classes mirror the full ones from `ACCEPTED` down.

| From | Functions |
| --- | --- |
| `PendingFullPayment` | `toAcceptedFullPayment(account, amount, timeline, option, instrument)`, `toScheduledFullPayment(...)` with a `ScheduledTimeline`, `toDeclinedFullPayment(option, instrument, declineCode)`, `toCancelledFullPayment()` when its confirmation window closes, and for a push payment Verify doesn't accept, `toDisallowedFullPayment(...)` |
| `ScheduledFullPayment` | `toAcceptedFullPayment()`, `toDeclinedFullPayment(declineCode)`, `toCancelledFullPayment()`, and for a corporate payment at its fetch time, `toAllocatingFullPayment()` |
| `AcceptedFullPayment` | `toProcessingFullPayment()`, `toAcceptedSplitPayment(splitSlice)`, and for a corporate payment paid today, `toAllocatingFullPayment()` |
| `AllocatingFullPayment` | `toAllocatedFullPayment()`, once the batches add up |
| `AllocatedFullPayment` | `toProcessingFullPayment()` for a payment paid today; for a scheduled one, Reverify's `toAcceptedFullPayment()` or `toDeclinedFullPayment(declineCode)` |
| `ProcessingFullPayment` | `toProcessedFullPayment()`, `toAcceptedSplitPayment(splitSlice)`, `toReturnedFullPayment(returnedInfo)` |
| `ProcessedFullPayment` | `toPaidFullPayment()`, `toReturnedFullPayment(returnedInfo)` |
| `PaidFullPayment` | `toReturnedFullPayment(returnedInfo)` |
| `ReturnedFullPayment` | `toRepresentingFullPayment()`, which builds the next presentment |
| `RepresentingFullPayment` | `toRepresentedFullPayment()`, `toDeclinedFullPayment(declineCode)` when the recheck fails |
| `RepresentedFullPayment` | `toReturnedFullPayment(returnedInfo)` |
| `AcceptedSplitPayment` to `RepresentedSplitPayment` | The same ten moves at leg level: accepted to processing; processing to processed or returned; processed to paid or returned; paid to returned; returned to the next presentment; representing to represented, or declined when the recheck fails; represented to returned |

The arguments say what each move needs. The move out of `PENDING` takes exactly what Verify resolves, so Verify's results are the arguments. Every move that records a return takes a `ReturnedInfo`, so a return without its details doesn't compile.

Dates live in their own small hierarchy. An `InitialTimeline` is set at capture; an `ExecutableTimeline` adds the clearing date, the execution time, the cancel cutoff and whether it runs once or recurs; a `ScheduledTimeline` adds the schedule date. Since every verified class needs an executable timeline, a payment that moves money always knows when it clears and when it can no longer be cancelled.

On the wire, every sealed type carries a `type` property with its class's simple name, such as `"type": "PaidSplitPayment"`, so the JSON says which class, and which state, it holds.

## What the code still needs

These were agreed on 2026-10-17 and aren't in the supplied Kotlin yet. The map dashes the classes and moves among them.

1. `PROCESSING` → `RETURNED`, for a payment and a leg: `toReturnedFullPayment(returnedInfo)` and `toReturnedSplitPayment(returnedInfo)`.
2. The corporate states: `AllocatingPayment` and `AllocatedPayment`, their two full classes, the six moves into and out of them, and the two status values.
3. `PENDING` → `CANCELLED`, for a payment never confirmed at its bank, with `CancelledFullPayment` accepting a missing amount and a plain `Timeline`.
4. `bankConfirmation` on `PendingFullPayment`, holding the provider's reference.
5. `DisallowedFullPayment`, for push payments only.
6. A second return's details: `RepresentedFullPayment.toReturnedFullPayment(returnedInfo)`, and the same for a leg. Today that move keeps the first return's.
7. The presentment number: `toRepresentingFullPayment()` and the leg's version build the next presentment, numbered one higher. Today every move copies `presentmentSequence`.
8. A representment that fails its recheck turns the new presentment's row `DECLINED`: `RepresentingFullPayment.toDeclinedFullPayment(declineCode)`, plus `DeclinedSplitPayment` and its move for a leg. The supplied code's moves from `REPRESENTING` back to `RETURNED` go.
9. `SplitSlice` gains `splitPaymentId` and `account`, and a leg takes its ID and card account from the slice. Today the code builds the ID with `paymentId.withSplit(seq)` and copies the parent's account.

## Still open

| Question | What the model does for now |
| --- | --- |
| The next presentment's dates | Copied from the returned presentment. Whether a representment should carry its own clearing date is still to be decided |
| Credit balance refunds | Skipped for now. `Refund` has no classes yet, and the refund steps are still to be defined |

The supplied Kotlin, with the guard code and the build-side detail, is on the [Build Domain Model](../build/domain-model/index.md) pages.
