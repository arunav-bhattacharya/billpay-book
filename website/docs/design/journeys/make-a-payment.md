---
title: Make a Payment Journey
description: 'A customer answers three questions on a payment page: how much, when, and from where. Two reads fill the page, and the Router turns the answers into one journey and starts the Temporal workflow that runs it.'
sidebar_label: Make a Payment Journey
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import PaymentChoices from '@site/src/components/PaymentChoices';
import CallChip from '@site/src/components/CallChip';
import TriggerTag from '@site/src/components/TriggerTag';

# Make a Payment Journey

<Lead>A customer answers three questions on a payment page: how much, when, and from where. Two reads fill the page, and the Router turns the answers into one journey and starts the Temporal workflow that runs it.</Lead>

A page that listed every instrument on file would let the customer pick one this payment can't use, and they would only find out when the payment came back `DECLINED`. So the page asks Payment Options what the customer owes, and asks Billpay where they can pay from, and Billpay keeps only what the market's rules allow. Pick a set of answers below and the card shows the journey they start, the calls the channel makes, and what reaches the payment afterwards.

<PaymentChoices />

## The calls a channel makes

A channel makes at most four calls. Each one is drawn as a navy chip, like <CallChip name="CreatePayment.v3" />. A pale chip, like <CallChip who="billpay" name="ReadInstruments" />, is a call Billpay makes, or one that reaches Billpay from another system; the channel never makes those. A pink tag, like <TriggerTag kind="signal" />, marks a call that resumes a payment already waiting.

1. <CallChip name="ReadPaymentOptions.v1" />, from Payment Options, not Billpay. It returns what the customer owes and the options to pay it (Statement Balance, Total Balance, Minimum Due and Other Amount), each with a payment option ID. It also says whether the customer can pay today, later, or both, and the range of dates a later payment can take. If nothing is owed, the journey never starts.
2. <CallChip name="ReadBillpayInstruments.v1" />, once the customer picks where to pay from. It is a One-Data function in front of a billpay-online endpoint. The channel passes two mandatory filters: `source`, where the customer pays from, and `journeyContext`, what the instruments are for. Billpay makes the call the source needs:

   | `source` | Billpay calls | For |
   | --- | --- | --- |
   | `EnrolledInstruments` | Payment Instruments' `ReadInstruments` | The instruments the customer has enrolled |
   | `DebitCard` | Amex Pay with Bank Transfer's `GET /banks` | The banks the customer can pay from by debit card |
   | `PayWithBankTransfer` | Amex Pay with Bank Transfer's `GET /banks` | The banks the customer can pay from in real time, Plaid in the US included |

3. <CallChip name="CreatePayment.v3" />, when the customer reviews and pays. It carries the chosen option's ID, and it is the only call that starts anything.
4. <CallChip name="CreateConfirmPendingPayment.v1" trigger="signal" />, for Pay with Bank Transfer only, once the payer's bank routes the customer back to the channel. It carries no answer. It tells Billpay the customer is back, and Billpay then asks Amex Pay with Bank Transfer for the payment's status ([below](#pay-with-bank-transfer)).

Two more calls reach billpay-online directly, never from the channel: <CallChip who="other" name="POST /payments/{payment-id}/settlement" trigger="signal" />, M3's notice that the bank has settled a Pay with Bank Transfer payment, and <CallChip who="other" name="POST /payments/{payment-id}/authentication" trigger="update" />, the card provider's 3D Secure callback for a debit card.

The reads only guide the page. Once the payment is created, Verify calls Payment Options and Payment Instruments again, and those calls decide. A scheduled payment is checked once more on its due date, when Reverify confirms the customer still owes money and the option still holds. Pay with Bank Transfer, a debit card and MR Points pay today only, so once the customer picks a later date the page doesn't offer them, and a later create with one gets 422 before any workflow starts. Wallets aren't a source for now.

## One list, two journey contexts

The same customer can see a different list of enrolled instruments depending on what they are setting up. The channel says which through `journeyContext`, and the market's `enrolledInstrumentStatuses` setting lists the instrument statuses each context may offer. Every context offers `ACTIVE` instruments alone until a market says otherwise. DE is the example: a one-time payment takes only `ACTIVE` instruments, but Autopay may also take one still pending verification.

| `journeyContext` | What it sets up | Default | DE |
| --- | --- | --- | --- |
| `ONE_TIME_DIRECT_DEBIT` | A payment, through `CreatePayment.v3` | `ACTIVE` | `ACTIVE` |
| `RECURRING_DIRECT_DEBIT` | Autopay, through `CreatePaymentPlan.v1`, which is Autopay's API, not Billpay's | `ACTIVE` | `ACTIVE`, `PENDING_VERIFICATION` |

Autopay is set up from enrolled instruments only, so a recurring direct debit with any other source gets 400. The setting's name and the status names are Proposed until Payment Instruments' contract arrives.

## How the Router picks the journey

The page sends one request to one door, `CreatePayment.v3`, whatever the customer chose. Once it is past One-Data's pending check (below), the Router reads the date, the instructions and the way to pay, then picks one journey:

| Journey | When | Temporal workflow |
| --- | --- | --- |
| [Pay my bill today](./all-journeys.md#pay-my-bill-today) | Today, one instruction | `CreateImmediatePaymentWorkflow` |
| [Pay on a future date](./all-journeys.md#pay-on-a-future-date) | A later date | `CreateScheduledPaymentWorkflow`, then `ExecuteScheduledPaymentWorkflow` on the date |
| [Pay by Bank today](./all-journeys.md#pay-by-bank-today) | Today, with a way to pay that needs a bank step | `CreatePaymentIntentWorkflow` |
| [Pay by Debit card](./all-journeys.md#pay-by-debit-card) | Today, a debit card | `CreatePaymentIntentWorkflow` |
| [Pay with multiple instructions](./all-journeys.md#pay-with-multiple-instructions) | Today, a bank account and MR Points | `CreatePaymentWithMultipleInstructionsWorkflow` |
| [Pay with MR Points](./all-journeys.md#pay-with-mr-points) | Today, MR Points only | The Pay with MR Points composite |

The Router checks them in its own order, and the first that matches wins: a wait first, because a payment that waits for the customer has to run in the one workflow that can wait for them. Then a later date, then several instructions, then MR Points alone, and pay today last. The order is Proposed, and so is MR Points' place in it.

## When another payment is still pending

A customer who isn't sure a payment went through may pay again, and pay twice. So One-Data checks every create before billpay-online sees it. It keeps each card account's pending payments in Redis, and if the account already has one in `PENDING`, it declines the new create there and then: the channel gets 200 with `DECLINED` and a reason, such as `ANOTHER_PAYMENT_PENDING` (the name is Proposed). No journey starts, and Billpay holds no record of the attempt.

A payment stays on the list only until it is decided. Once it is `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED`, its workflow calls One-Data's delete API, `DeletePendingPayment.v1`, and the customer can pay again. A payment that waits for its customer blocks the next one until it is decided: up to 2 minutes for a debit card, and for Pay with Bank Transfer until Amex Pay with Bank Transfer's status is final.

- The check and the add are one atomic call to Redis (Proposed), so two creates that arrive together can't both get through.
- It covers creates through `CreatePayment.v3` and Pay & Plan's through `CreatePaymentInstallment.v1`. Payments Accounts Receivable raises, push payments and refunds never go through it.
- When Redis is down, One-Data asks `ReadPayments.v1` instead. A create billpay-online hasn't captured yet can slip past that read, and the design accepts the gap.
- If a delete never lands, the entry would block the account for good. So every hour One-Data sweeps entries older than the market's `pendingSweepAfter` (2 hours unless the market sets it; the name is Proposed), keeps those still `PENDING`, removes the rest, and raises one alert listing both.

## Pay with Bank Transfer

Billpay talks to one bank-transfer service, Amex Pay with Bank Transfer, which works with a different provider in each market, Plaid in the US among them. Billpay never calls a provider itself.

1. The Router starts `CreatePaymentIntentWorkflow`. Amex's own checks run first: the Instrument, Options and Mandate checks. A payment that fails them is `DECLINED` at once, with no link.
2. RequestConfirmation asks Amex Pay with Bank Transfer for the customer's redirect link, and the reply is `PENDING` with it. The customer approves the payment at their bank.
3. The payer's bank routes the customer back to the channel, and the channel calls <CallChip name="CreateConfirmPendingPayment.v1" trigger="signal" />. That signals the waiting workflow and carries no answer. If the channel never calls, Billpay waits a fixed time and moves on anyway.
4. Billpay calls Amex Pay with Bank Transfer's `GET /payment-status`. Success makes the payment `ACCEPTED`, and failure makes it `DECLINED`. Pending means the bank hasn't finished, so Billpay waits a fixed interval and asks again, until the answer is success or failure. A call that times out or fails counts as pending.
5. An `ACCEPTED` payment waits once more, for M3's notice that the bank has settled the money. Only then do Execute and Fulfil run. Execute makes no clearing call, since the money moved at the bank. If M3's notice comes before the status says success, Billpay accepts the payment on it and stops asking.

The channel learns the outcome from `GET /payments/{payment-id}`. The customer can say no at any point until the payment is decided, and it ends `CANCELLED`. An `ACCEPTED` payment whose notice never comes goes on the exception list with an alert.

## Debit card

A debit card is its own way to pay, apart from a bank account. Every debit card payment goes through 3D Secure, the card schemes' check that the customer is the cardholder, and then an authorization that takes the money:

1. The Router starts `CreatePaymentIntentWorkflow`. Amex's own checks run first, and a payment that fails them is `DECLINED` before 3D Secure starts. Otherwise RequestConfirmation asks the market's card provider (Checkout.com in the UK) to start 3D Secure, and gives it Billpay's callback URL.
2. When the card's bank wants a challenge, such as a one-time code or a banking-app approval, the reply is `PENDING` with the challenge link. When it needs none, the reply is `PENDING` with no link (Proposed).
3. The card provider calls `POST /payments/{payment-id}/authentication` (Proposed) once the card is authenticated, or authentication has failed. The waiting workflow takes the call as an update.
4. Verify authorizes the payment (the check is Proposed). The authorization debits the customer's account if it holds enough money; the card's bank declines it if not, and the payment is `DECLINED`.
5. Execute makes no clearing call, because the money has moved. Billpay creates the settlement event itself and hands it to One-Data (Proposed), and the payment is `PAID` once that event and Accounts Receivable's posting are both in.

If no callback comes within 2 minutes, the workflow cancels the payment, and nothing has been taken. Consumer and business travel payments can pay by debit card; corporate payments can't. A debit card pays today only, with one instruction, never with MR Points and never through Pay & Plan.

## Pay & Plan and MR Points

Pay & Plan doesn't come through this door. A customer who sets up a plan sends `CreatePaymentInstallment.v1`, and the Router starts the Pay & Plan composite. One-Data's pending check covers that create too.

MR Points sit next to the way to pay. Points alone run the Pay with MR Points composite, across Billpay and Loyalty. Points with a bank account are two instructions, so they run as Pay with multiple instructions. Points pay today only, and a debit card doesn't combine with them. A market whose Pay with MR Points setting is off turns a points create away with 422 (Proposed).

## Still to be defined

- Where the page gets the ways to pay the market offers, its limits, the cancellation window, whether it offers Pay & Plan and MR Points, and a payment already pending. `ReadPaymentOptions.v1` is one option.
- The contract of `ReadBillpayInstruments.v1`, and the path of the billpay-online endpoint behind it.
- The contract of Amex Pay with Bank Transfer's `GET /banks`.
- For Pay with Bank Transfer: the fixed time before Billpay first asks for the status when the channel sends no signal, the interval between calls, and where both are set; whether anything caps the calls; the contract of `GET /payment-status`; and the contract of M3's notice, how long an `ACCEPTED` payment waits for it, and what Billpay does when money moves on a declined payment.
- Whether Verify's `INSTRUMENT_OPEN` rule, which takes `ACTIVE` alone, follows `enrolledInstrumentStatuses` when a market adds a status for a one-time payment.
- The contracts of `ReadPaymentOptions.v1` and `ReadPaymentOptionByIdentifier.v1`, and the decline code for an option that no longer holds.
- The steps of the Pay with MR Points composite, and its calls to Loyalty.
- Wallet: which instrument it is, and whether it needs a bank step.
