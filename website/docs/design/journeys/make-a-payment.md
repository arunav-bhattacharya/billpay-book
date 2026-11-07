---
title: Make a Payment Journey
description: 'A customer answers three questions on a payment page: how much, when, and from where. Two reads fill the page, and the Router turns the answers into one journey and starts the Temporal workflow that runs it.'
sidebar_label: Make a Payment Journey
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import PaymentChoices from '@site/src/components/PaymentChoices';

# Make a Payment Journey

<Lead>A customer answers three questions on a payment page: how much, when, and from where. Two reads fill the page, and the Router turns the answers into one journey and starts the Temporal workflow that runs it.</Lead>

A page that listed every instrument on file would let the customer pick one this payment can't use, and they would only find out when the payment came back `DECLINED`. The usual case is an instrument enrolled through Autopay that is still pending verification. It can carry its Autopay payments, but not a payment the customer makes now. So the page gets the customer's options from Payment Options, and their instruments through Billpay, which keeps only what the market's rules allow. The model below is that page. Change an answer and watch which calls run and which journey the Router picks.

<PaymentChoices />

## Three calls, in this order

1. **`ReadPaymentOptions.v1`**, from Payment Options. It returns what the customer owes and the options to pay it: Statement Balance, Total Balance, Minimum Due and Other Amount. Each option carries a payment option ID, unique to that option and the balance it pays. It also says whether the customer can pay today, on a future date, or both, and the range of dates a future payment can take. If nothing is owed, the payment journey never starts and the channel calls nothing else.
2. **`ReadBillpayInstruments.v1`**, once the customer picks where to pay from. It is a One-Data function in front of a billpay-core endpoint, and billpay-core makes the one read that source needs:
   - Enrolled Instruments: Payment Instruments' `ReadInstruments`, for the instruments the customer has enrolled;
   - Pay with Bank Transfer or a debit card: `ReadBanksForRealtimePayments.v1`, for the list of banks the customer can pay from in real time;
   - a wallet: `ReadEligibleWallets.v1`, for the wallets the customer can pay with.

   It replaces the channel's own call to Payment Instruments.
3. **`CreatePayment.v3`**, when the customer reviews and pays. It carries the ID of the option the customer chose, and it is the only call that starts anything.

A debit card adds one more call, in the other direction. Billpay gives the market's card provider a callback URL when it starts 3D Secure, and the provider calls billpay-core back directly once the card is authenticated, not through One-Data and not from the channel.

The reads only guide the page. Verify calls Payment Options and Payment Instruments again once the payment is created, and those calls decide. Verify's Options check validates the chosen option through Payment Options' `ReadPaymentOptionById.v1`. A scheduled payment is checked again on its due date: Reverify calls `ReadPaymentOptions.v1` to confirm the customer still owes money and the option still holds, and declines the payment if not. A Statement Balance or Total Balance payment pays what the option gives that day, which can differ from the amount at the create. A payment with several instructions, such as a bank account plus MR Points, carries one option ID for the whole payment. Payments from Accounts Receivable, corporate payments and Pay with MR Points alone carry none, and their Verify skips the Options check. The Router and Verify also check the payment against the market's release that is active when it arrives, so a release that goes live while the customer is on the page can't let through a payment it would refuse.

## What decides what the page offers

The amounts, the payment options and the dates come from Payment Options, for this customer. The instruments come through Billpay, filtered by the market's rules, so an Autopay instrument still pending verification never shows up for a payment made now. Pay with Bank Transfer, a debit card and a US payment confirmed through Plaid pay today only, so once the customer picks a later date the page doesn't offer them, and a future-dated create with one gets 422 before any workflow starts. Who will own the bank and wallet reads isn't decided yet; it will probably be the Instruments domain.

Where the page gets the rest is still open: the ways to pay the market offers, its limits such as the largest payment, the cancellation window, whether it offers Pay & Plan and Pay with MR Points, and a payment already pending on the account, which the page can show. `ReadPaymentOptions.v1` is one option. [Market Profile](../../onboarding/market-profile.md#what-the-customer-is-offered) maps the profile's settings that the Router and Verify check.

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

The table follows the order customers meet these journeys. The Router checks them in a different order, and the first that matches wins: a wait comes first, because a payment that waits for the customer has to run in the one workflow that can wait for them. Then a later date, then several instructions, then MR Points alone, and pay today last. The ordered list is Proposed, and so is MR Points' place in it.

## When another payment is still pending

A customer who isn't sure a payment went through may pay again, and pay twice. So One-Data checks every create before billpay-core sees it. It keeps each card account's pending payments in Redis, and if the account already has one in `PENDING`, it declines the new create there and then: the channel gets 200 with `DECLINED` and a reason, such as `ANOTHER_PAYMENT_PENDING` (the name is Proposed). billpay-core is never called, so no journey starts and Billpay holds no record of the attempt.

A payment stays on the account's pending list only until it is decided. Once it is `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED`, billpay-core calls One-Data's delete API, `DeletePendingPayment.v1`, and the customer can pay again. So a scheduled payment never blocks the next one, and a payment that waits for bank confirmation or 3D Secure blocks it only while it waits: usually the market's confirmation window, up to 10 minutes, or the 2 minutes of 3D Secure.

- The check and the add are one atomic call to Redis (Proposed), so two creates that arrive together can't both get through.
- It covers payments from channels: creates through `CreatePayment.v3`, and Pay & Plan's through `CreatePaymentInstallment.v1`. Payments Accounts Receivable raises, push payments from third parties and refunds never go through it.
- When Redis is down, One-Data asks `ReadPayments.v1` instead, which then reads billpay-core alone. A create billpay-core hasn't captured yet can slip past that read, and the design accepts the gap.
- If a delete never lands, the entry would block the account for good. So every hour One-Data sweeps the entries more than 2 hours old and asks billpay-core about each one. It removes those whose payment is decided or that billpay-core never got, keeps those still `PENDING`, and raises one alert listing both.

## Debit card

A debit card is its own way to pay, apart from a bank account. Every debit card payment goes through 3D Secure, the card schemes' check that the customer is the cardholder, and then an authorization that takes the money:

1. The Router starts `CreatePaymentIntentWorkflow`. Amex's own checks run first: the Instrument, Options and Mandate checks. A payment that fails them is `DECLINED` at once, and 3D Secure never starts. Otherwise RequestConfirmation asks the market's card provider (Checkout.com in the UK) to start 3D Secure, and gives it Billpay's callback URL.
2. When the card's bank wants a challenge, such as a one-time code or a banking-app approval, the reply is `PENDING` with the challenge link. When it needs none, the reply is `PENDING` with no link (Proposed).
3. The card provider calls `POST /payments/{payment-id}/authentication` (Proposed) once the card is authenticated, or authentication has failed. The waiting workflow takes the call as an update.
4. Amex's own checks already passed, so Verify now only authorizes the payment (the check is Proposed). The authorization debits the customer's account if it holds enough money; the card's bank declines it if not, and the payment is `DECLINED`.
5. Execute makes no clearing call, because the money has moved. Billpay creates the settlement event itself and hands it to One-Data, dated when the money moved (Proposed), and the payment is `PAID` once that event and Accounts Receivable's posting are both in.

If no callback comes within 2 minutes, the workflow cancels the payment, and nothing has been taken. Consumer and business travel payments can pay by debit card; corporate payments can't. A debit card pays today only, with one instruction, never with MR Points and never through Pay & Plan: a create that breaks this, or a corporate one, gets 422 before any workflow starts.

Pay with Bank Transfer works the same way at the end: its money moves at the bank, during the customer's bank connection, so it has no clearing step either, and Billpay creates its settlement event too.

## Pay & Plan

Pay & Plan is not on this list because it doesn't come through this door. A customer who sets up a plan sends `CreatePaymentInstallment.v1`, and the Router starts the Pay & Plan composite. One-Data's pending check covers that create too: a Pay & Plan request on an account with a payment already `PENDING` is declined the same way.

## MR Points

The customer can tick Pay with MR Points next to the way to pay, to pay with their Membership Rewards points. Points alone run the Pay with MR Points composite, across Billpay and Loyalty. Points with a bank account are two instructions, so they run as Pay with multiple instructions. A debit card doesn't combine with points.

Points pay today only. Once they are ticked, the page offers no later date, and a future-dated create that carries points gets 422 before any workflow starts (Proposed). The same happens in a market whose Pay with MR Points setting is off.

## Still to be defined

- Where the page gets the ways to pay the market offers, its limits, the cancellation window, whether it offers Pay & Plan and MR Points, and a payment already pending. `ReadPaymentOptions.v1` is one option.
- The contract of `ReadBillpayInstruments.v1`, and the path of the billpay-core endpoint behind it.
- Who owns `ReadBanksForRealtimePayments.v1` and `ReadEligibleWallets.v1`, and their contracts.
- The contracts of `ReadPaymentOptions.v1` and `ReadPaymentOptionById.v1`, and the decline code for an option that no longer holds.
- Whether the market's Proposed scheduling horizon setting stays, now that `ReadPaymentOptions.v1` gives each customer's date range.
- The steps of the Pay with MR Points composite, and its calls to Loyalty.
- Wallet: which instrument it is, and whether it needs a bank step. The page can read eligible wallets, but no journey takes one yet, and wallets appear on this page only.
