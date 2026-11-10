---
title: Make a Payment Journey
description: 'A customer answers three questions on a payment page: how much, when, and from where. Two reads fill the page, and the Router turns the answers into one journey and starts the Temporal workflow that runs it.'
sidebar_label: Make a Payment Journey
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import PaymentChoices from '@site/src/components/PaymentChoices';
import ChannelCalls from '@site/src/components/ChannelCalls';
import InstrumentContexts from '@site/src/components/InstrumentContexts';
import CallChip from '@site/src/components/CallChip';

# Make a Payment Journey

<Lead>A customer answers three questions on a payment page: how much, when, and from where. Two reads fill the page, and the Router turns the answers into one journey and starts the Temporal workflow that runs it.</Lead>

A page that listed every instrument on file would let the customer pick one this payment can't use, and they would only find out when the payment came back `DECLINED`. The usual case is an instrument still pending verification: a market may let it carry Autopay payments, but not a payment the customer makes now. So the page gets the customer's options from Payment Options, and their instruments through Billpay, which keeps only what the market's rules allow for what the instruments are for. The model below is that page. Change an answer and watch which calls run and which journey the Router picks.

<PaymentChoices />

## The calls a channel makes

A channel integrates with a short list of calls, and this site marks every one of them the same way: a navy block or chip with a bright square, like <CallChip name="CreatePayment.v3" />. Anything in a pale tint, like <CallChip who="billpay" name="ReadInstruments" />, is a call Billpay makes for the channel, or one that reaches Billpay from another system. The channel never makes those, and never has to know about them.

<ChannelCalls />

1. <CallChip name="ReadPaymentOptions.v1" />, from Payment Options, not Billpay. It returns what the customer owes and the options to pay it: Statement Balance, Total Balance, Minimum Due and Other Amount. Each option carries a payment option ID, unique to that option and the balance it pays. It also says whether the customer can pay today, on a future date, or both, and the range of dates a future payment can take. If nothing is owed, the payment journey never starts and the channel calls nothing else.
2. <CallChip name="ReadBillpayInstruments.v1" />, once the customer picks where to pay from. It is a One-Data function in front of a billpay-online endpoint, and it replaces the channel's own call to Payment Instruments. The channel passes two filters, and both are mandatory:
   - `source`, where the customer pays from. There are three for now, and Billpay makes the call each one needs:

     | `source` | Billpay calls | For |
     | --- | --- | --- |
     | `EnrolledInstruments` | Payment Instruments' `ReadInstruments` | The instruments the customer has enrolled |
     | `DebitCard` | `ReadBanksForRealtimePayments.v1` | The banks the customer can pay from by debit card |
     | `PayWithBankTransfer` | `ReadBanksForRealtimePayments.v1` | The banks the customer can pay from in real time, Plaid in the US included |

   - `journeyContext`, what the instruments are for: `ONE_TIME_DIRECT_DEBIT` for a payment made through `CreatePayment.v3`, or `RECURRING_DIRECT_DEBIT` for setting up Autopay. Autopay is set up from enrolled instruments only, so a recurring direct debit with any other source gets 400 (Proposed).
3. <CallChip name="CreatePayment.v3" />, when the customer reviews and pays. It carries the ID of the option the customer chose, and it is the only call that starts anything. Setting up Autopay ends instead with <CallChip name="CreatePaymentPlan.v1" />, which belongs to the Autopay system, not to Billpay.
4. <CallChip name="CreateConfirmPendingPayment.v1" />, for Pay with Bank Transfer only, once the customer is back from their bank. It carries the bank's answer ([below](#pay-with-bank-transfer)).

Three more calls reach billpay-online directly, and none of them comes from the channel:

- <CallChip who="other" name="POST /payments/{payment-id}/bank-confirmation" />: Amex Pay with Bank Transfer's own confirm for the same payment.
- <CallChip who="other" name="POST /payments/{payment-id}/settlement" />: M3's notice that the bank has settled a Pay with Bank Transfer payment.
- <CallChip who="other" name="POST /payments/{payment-id}/authentication" />: the card provider's 3D Secure callback for a debit card.

The reads only guide the page. Verify calls Payment Options and Payment Instruments again once the payment is created, and those calls decide. Verify's Options check validates the chosen option through Payment Options' `ReadPaymentOptionByIdentifier.v1`. A scheduled payment is checked again on its due date: Reverify calls `ReadPaymentOptions.v1` to confirm the customer still owes money and the option still holds, and declines the payment if not. A Statement Balance or Total Balance payment pays what the option gives that day, which can differ from the amount at the create. A payment with several instructions, such as a bank account plus MR Points, carries one option ID for the whole payment. Payments from Accounts Receivable, corporate payments and Pay with MR Points alone carry none, and their Verify skips the Options check. The Router and Verify also check the payment against the market's release that is active when it arrives, so a release that goes live while the customer is on the page can't let through a payment it would refuse.

## One list, two journey contexts

The same customer can see a different list of enrolled instruments depending on what they are setting up. DE is the example: a one-time direct debit takes only `ACTIVE` instruments, but Autopay may also take one still pending verification. The channel says which it is through `journeyContext`, and Billpay decides the rest from a market setting, `enrolledInstrumentStatuses`. It lists the instrument statuses each context may offer, and it lives in each market and account type's release. Every context offers `ACTIVE` instruments alone until a market says otherwise. The key's name is Proposed, and so are the status names below, until Payment Instruments' contract arrives.

<InstrumentContexts />

Switch between the default and the DE example: the lists stay in the same place, and only the instrument pending verification changes. The channel's code is the same for both, since it passes the context and draws what comes back.

## What decides what the page offers

The amounts, the payment options and the dates come from Payment Options, for this customer. The instruments come through Billpay, filtered by the market's rules for the context the channel passed. Proposed (2026-11-07): the filter takes the Router's way-to-pay rules (no bank confirmation or debit card for a corporate payment; Pay with Bank Transfer only where the market takes bank confirmation, and a debit card only where it has a card provider), the market's accepted instrument types and, for enrolled instruments, the statuses `enrolledInstrumentStatuses` gives the context. Pay with Bank Transfer, a debit card and a US payment confirmed through Plaid pay today only, so once the customer picks a later date the page doesn't offer them, and a future-dated create with one gets 422 before any workflow starts. Wallets aren't a source for now. Who will own the bank read isn't decided yet; it will probably be the Instruments domain.

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

A customer who isn't sure a payment went through may pay again, and pay twice. So One-Data checks every create before billpay-online sees it. It keeps each card account's pending payments in Redis, and if the account already has one in `PENDING`, it declines the new create there and then: the channel gets 200 with `DECLINED` and a reason, such as `ANOTHER_PAYMENT_PENDING` (the name is Proposed). billpay-online is never called, so no journey starts and Billpay holds no record of the attempt.

A payment stays on the account's pending list only until it is decided. Once it is `ACCEPTED`, `SCHEDULED`, `DECLINED` or `CANCELLED`, its workflow calls One-Data's delete API, `DeletePendingPayment.v1`, after the reply, and the customer can pay again. Every create workflow makes that call, even for a create One-Data never stored, such as one from Accounts Receivable, where it finds nothing to remove. So a scheduled payment never blocks the next one. A payment that waits for its customer stays on the list, and blocks the next one, until it is decided: up to 2 minutes for a debit card's 3D Secure, and up to the market's wait of 24 to 48 hours for Pay with Bank Transfer.

- The check and the add are one atomic call to Redis (Proposed), so two creates that arrive together can't both get through.
- It covers payments from channels: creates through `CreatePayment.v3`, and Pay & Plan's through `CreatePaymentInstallment.v1`. Payments Accounts Receivable raises, push payments from third parties and refunds never go through it.
- When Redis is down, One-Data asks `ReadPayments.v1` instead, which then reads billpay-online alone. A create billpay-online hasn't captured yet can slip past that read, and the design accepts the gap.
- If a delete never lands, the entry would block the account for good. So every hour One-Data sweeps the entries older than the market's sweep age, a market setting (`pendingSweepAfter`, 2 hours unless the market sets it; the name is Proposed), and asks billpay-online about each one. A market whose bank wait runs 48 hours sets it longer, so payments still inside their wait aren't reported. The sweep removes the entries whose payment is decided or that billpay-online never got, keeps those still `PENDING`, and raises one alert listing both.

## Pay with Bank Transfer

Billpay talks to one bank-transfer service, Amex Pay with Bank Transfer, which works with a different provider in each market, Plaid in the US among them. Billpay never calls a provider itself. A US payment confirmed through Plaid follows the same rules.

1. The Router starts `CreatePaymentIntentWorkflow`. Amex's own checks run first: the Instrument, Options and Mandate checks. A payment that fails them is `DECLINED` at once, with no link.
2. RequestConfirmation asks Amex Pay with Bank Transfer for the customer's redirect link, and the reply is `PENDING` with it. The customer confirms the payment at their bank.
3. The confirm can come from two places: the channel, through <CallChip name="CreateConfirmPendingPayment.v1" />, or Amex Pay with Bank Transfer, the PISP (Payment Initiation Service Provider) interface, straight to billpay-online. Each carries the bank's answer. Billpay acts on whichever comes first and acknowledges both: the second gets the same answer. The payment is `ACCEPTED` or `DECLINED` on the bank's answer, and nothing else is checked: no Payment Instruments token check, and no funds check.
4. An `ACCEPTED` payment waits once more. When the bank settles the payment in real time, it tells Amex; M3 intercepts that message and calls billpay-online, and only then do Execute and Fulfil run. Execute makes no clearing call, since the money moved at the bank, and M3's notice is the payment's settlement.
5. If M3's notice comes and neither confirm has, Billpay accepts the payment anyway, carries on with Execute and Fulfil, and logs that no confirm came for that payment ID.

If neither a confirm nor M3's notice comes within the market's wait, 24 to 48 hours, the payment is `DECLINED` with `CONFIRMATION_NOT_RECEIVED` (the code is Proposed). The customer can still say no while it waits, and the payment is `CANCELLED`. An `ACCEPTED` payment whose notice never comes goes on the exception list, with an alert. How long Billpay waits for it is still open, and so is what happens when money moves on a payment that was already declined: for now, the exception list and an alert.

## Debit card

A debit card is its own way to pay, apart from a bank account. Every debit card payment goes through 3D Secure, the card schemes' check that the customer is the cardholder, and then an authorization that takes the money:

1. The Router starts `CreatePaymentIntentWorkflow`. Amex's own checks run first: the Instrument, Options and Mandate checks. A payment that fails them is `DECLINED` at once, and 3D Secure never starts. Otherwise RequestConfirmation asks the market's card provider (Checkout.com in the UK) to start 3D Secure, and gives it Billpay's callback URL.
2. When the card's bank wants a challenge, such as a one-time code or a banking-app approval, the reply is `PENDING` with the challenge link. When it needs none, the reply is `PENDING` with no link (Proposed).
3. The card provider calls `POST /payments/{payment-id}/authentication` (Proposed) once the card is authenticated, or authentication has failed. The waiting workflow takes the call as an update.
4. Amex's own checks already passed, so Verify now only authorizes the payment (the check is Proposed). The authorization debits the customer's account if it holds enough money; the card's bank declines it if not, and the payment is `DECLINED`.
5. Execute makes no clearing call, because the money has moved. Billpay creates the settlement event itself and hands it to One-Data, dated when the money moved (Proposed), and the payment is `PAID` once that event and Accounts Receivable's posting are both in.

If no callback comes within 2 minutes, the workflow cancels the payment, and nothing has been taken. Consumer and business travel payments can pay by debit card; corporate payments can't. A debit card pays today only, with one instruction, never with MR Points and never through Pay & Plan: a create that breaks this, or a corporate one, gets 422 before any workflow starts.

## Pay & Plan

Pay & Plan is not on this list because it doesn't come through this door. A customer who sets up a plan sends `CreatePaymentInstallment.v1`, and the Router starts the Pay & Plan composite. One-Data's pending check covers that create too: a Pay & Plan request on an account with a payment already `PENDING` is declined the same way.

## MR Points

The customer can tick Pay with MR Points next to the way to pay, to pay with their Membership Rewards points. Points alone run the Pay with MR Points composite, across Billpay and Loyalty. Points with a bank account are two instructions, so they run as Pay with multiple instructions. A debit card doesn't combine with points.

Points pay today only. Once they are ticked, the page offers no later date, and a future-dated create that carries points gets 422 before any workflow starts (Proposed). The same happens in a market whose Pay with MR Points setting is off.

## Still to be defined

- Where the page gets the ways to pay the market offers, its limits, the cancellation window, whether it offers Pay & Plan and MR Points, and a payment already pending. `ReadPaymentOptions.v1` is one option.
- The contract of `ReadBillpayInstruments.v1`, and the path of the billpay-online endpoint behind it.
- Who owns `ReadBanksForRealtimePayments.v1`, and its contract.
- Whether Verify's `INSTRUMENT_OPEN` rule, which takes `ACTIVE` alone, follows `enrolledInstrumentStatuses` when a market adds a status for a one-time direct debit.
- For Pay with Bank Transfer: the contracts of Amex Pay with Bank Transfer's confirm and M3's settled notice, how long an `ACCEPTED` payment waits for M3, whether M3 can report a settlement that failed, and what Billpay does when money moves on a declined payment.
- Each market's bank wait, and how One-Data reads each market's sweep age.
- The contracts of `ReadPaymentOptions.v1` and `ReadPaymentOptionByIdentifier.v1`, and the decline code for an option that no longer holds.
- Whether the market's Proposed scheduling horizon setting stays, now that `ReadPaymentOptions.v1` gives each customer's date range.
- The steps of the Pay with MR Points composite, and its calls to Loyalty.
- Wallet: which instrument it is, and whether it needs a bank step. It isn't a source of `ReadBillpayInstruments.v1` for now.
