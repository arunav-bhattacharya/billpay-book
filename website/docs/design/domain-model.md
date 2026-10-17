---
title: Domain Model
description: "In Billpay's code, a payment's class is its state, and the only way from one state to the next is one of 26 functions."
sidebar_label: Domain Model
---

import Lead from '@site/src/components/Lead';
import DomainModelMap from '@site/src/components/DomainModelMap';

# Domain Model

<Lead>In Billpay's code, a payment's class is its state, and the only way from one state to the next is one of 26 functions. A `PaidFullPayment` can't be built without a tokenized account, a verified instrument and a clearing date, so no paid payment is ever missing one.</Lead>

A common way to model a payment is a status column beside fields that may or may not be filled in. That leaves room for a `PAID` payment with no clearing date, or a `RETURNED` one that can't say why it came back. Billpay's model leaves no room for either, because the compiler refuses to build them. It doesn't cover the whole [lifecycle](./payment-state-model.md) yet, and the gaps are listed at the end.

## The map

Each box is a class. Rows are the lifecycle states, read top to bottom, and columns are the two shapes a payment comes in: a full payment on the left, a leg of a split payment on the right. Point at a class to see the functions that move it on, or use the buttons above the map to light up one part of it.

<DomainModelMap />

## The class is the state

There are eleven sealed classes, one per state, from `PendingPayment` to `RepresentedPayment`, plus `CancelledPayment` and `DeclinedPayment` for a payment that stops. Each one fixes its own `status`. The status isn't a field anyone sets: it comes with the class, so it can't drift away from the data.

There is no `setStatus` either. Each allowed move is an extension function that takes one class and returns the next, such as `ProcessedFullPayment.toPaidFullPayment()`. A move without a function can't happen, which is why the gaps at the end matter.

The [stages](./component-model/stages.md) are where these moves run. Verify moves a payment out of `PENDING`, Settle moves it from `PROCESSED` to `PAID`, and each stage commits the result through `PaymentStore`.

## Full payments and legs

Two shapes cross the states. A `FullPayment` settles as one amount. A `SplitPayment` is a leg: it carries its parent's ID as `originalPaymentId`, a `sequenceNumber` and its own amount. A leg's ID is its parent's plus the sequence number, `{paymentId}_{seq}`, which is also how One-Data pairs a leg's Accounts Receivable (AR) posting with the settlement of its parent: it reads the part before the `_`.

That makes eighteen classes in all. A full payment has every state. A leg has seven, because it starts at `ACCEPTED`: it is made from a parent Verify has already passed, by `toAcceptedSplitPayment(splitSlice)`, so a pending or scheduled leg can't exist. The parent can be `ACCEPTED` or already `PROCESSING` when that happens. The second case is the corporate one, where allocations can arrive while the company's payment is clearing. [Corporate Allocations](./corporate-allocations.md) covers that track.

## What each state guarantees

Two traits narrow what a class has to hold.

Every class from `SCHEDULED` to `REPRESENTED` is a `VerifiedPayment`. It has a `TokenizedAccount`, an amount that isn't null, a `VerifiedPaymentOption`, a `VerifiedInstrument` and an `ExecutableTimeline`. Nothing moves money until Verify has resolved all five, and the types enforce it: there's no way to hand an unverified instrument to a class that needs a verified one.

`RETURNED`, `REPRESENTING` and `REPRESENTED` are also a `RepresentmentPayment`, which means they carry `returnedInfo`: when the return took effect, why, where it came from, and which payment, presentment and date it returned. A returned payment can always explain itself. Which of those fields are required is still being confirmed.

`PENDING`, `CANCELLED` and `DECLINED` carry neither trait. A pending payment may not know its amount yet, so `PendingFullPayment` checks the amount when it's built. If the customer named the amount (an other amount, or an initial payment amount) or the option is already verified, the amount must be there. For any other option it must be empty, because the amount is worked out later. A declined payment carries a `declineCode` and has no confirmation code.

## Moving between states

The 26 functions, grouped by the class they start from. Leg classes mirror the full ones from `ACCEPTED` down.

| From | Functions |
| --- | --- |
| `PendingFullPayment` | `toAcceptedFullPayment(account, amount, timeline, option, instrument)`, `toScheduledFullPayment(...)` with a `ScheduledTimeline`, `toDeclinedFullPayment(option, instrument, declineCode)` |
| `ScheduledFullPayment` | `toAcceptedFullPayment()`, `toDeclinedFullPayment(declineCode)`, `toCancelledFullPayment()` |
| `AcceptedFullPayment` | `toProcessingFullPayment()`, `toAcceptedSplitPayment(splitSlice)` |
| `ProcessingFullPayment` | `toProcessedFullPayment()`, `toAcceptedSplitPayment(splitSlice)` |
| `ProcessedFullPayment` | `toPaidFullPayment()`, `toReturnedFullPayment(returnedInfo)` |
| `PaidFullPayment` | `toReturnedFullPayment(returnedInfo)` |
| `ReturnedFullPayment` | `toRepresentingFullPayment()` |
| `RepresentingFullPayment` | `toRepresentedFullPayment()`, `toReturnedFullPayment()` |
| `RepresentedFullPayment` | `toReturnedFullPayment()` |
| `AcceptedSplitPayment` to `RepresentedSplitPayment` | The same nine moves at leg level: accepted to processing, processed and paid; returned from processed or paid; then representing, represented, and back to returned |

Two of these read like a contract. The move out of `PENDING` takes exactly what Verify resolves, so Verify's results are the arguments. The move into `RETURNED` takes a `ReturnedInfo`, so a return without its details doesn't compile.

Dates live in their own small hierarchy. An `InitialTimeline` is set at capture; an `ExecutableTimeline` adds the clearing date, the execution time, the cancel cutoff and whether it runs once or recurs; a `ScheduledTimeline` adds the schedule date. Since every verified class needs an executable timeline, a payment that moves money always knows when it clears and when it can no longer be cancelled.

On the wire, every sealed type carries a `type` property with its class's simple name, such as `"type": "PaidSplitPayment"`, so the JSON says which class, and which state, it holds.

## Where the code falls short

The [Payment State Model](./payment-state-model.md) is the design. The code hasn't caught up with all of it yet, and the map draws each of these as a dashed ghost where the missing piece would go.

| The lifecycle has | The code has |
| --- | --- |
| `DISALLOWED`, for inbound payments American Express didn't accept | No class |
| `PROCESSING` → `RETURNED` | No function; a return starts from `PROCESSED` or `PAID` |
| `REPRESENTING` → `DECLINED`, when the recheck fails | No function. The code has `REPRESENTING` → `RETURNED` instead, which the lifecycle doesn't |
| Legs written while their parent is `SCHEDULED`, held until release | Legs come only from an `ACCEPTED` or `PROCESSING` parent |
| A declined or cancelled parent cancels its legs | No cancelled leg class |
| `allocation_status` on a corporate parent | No field |
| Credit balance refunds | `Refund` has no classes yet |

The Kotlin itself, with the guard code and the build-side detail, is on the [Build Domain Model](../build/domain-model/index.md) pages.
