---
title: Make a Payment Journey
description: 'A customer answers three questions on a payment page: how much, from where, and when. The Router turns the answers into one journey, and one read call keeps the page and the Router on the same rules.'
sidebar_label: Make a Payment Journey
hide_table_of_contents: true
---

import Lead from '@site/src/components/Lead';
import PaymentChoices from '@site/src/components/PaymentChoices';

# Make a Payment Journey

<Lead>A customer answers three questions on a payment page: how much, from where, and when. The Router turns the answers into one journey, and each journey runs as one Temporal workflow. One read call, <code>ReadPaymentChoices.v1</code>, keeps the page and the Router on the same rules.</Lead>

A channel that decided on its own what to offer would drift from what Billpay accepts. It could offer a date further out than the market allows, or a way to pay that needs a bank step the market doesn't run, and the customer would find out only when the payment came back with a 422 or `DECLINED`. So before the page shows anything, the channel asks Billpay what this market takes. The model below is that page. Change an answer and watch which calls run and which journey the Router picks.

<PaymentChoices />

## Four calls, in this order

1. **Payment Options API**, for what the customer owes. If nothing is owed, the payment journey never starts, and the channel calls nothing else.
2. **`ReadPaymentChoices.v1`** (Proposed), for Billpay's own rules: the ways to pay the market takes and which of them need a bank step, the dates it offers, the cancellation window, the limits, whether it offers Pay & Plan and MR Points, and the payments already pending on the account.
3. **Payment Instruments API**, for the customer's bank accounts and debit cards. The channel calls it only when the customer picks a bank account or debit card.
4. **`CreatePayment.v3`**, when the customer reviews and pays. This is the only call that starts anything.

The channel calls Payment Options and Payment Instruments itself, to fill the page. Verify calls them again once the payment is created, and that second call is the one that decides. The same goes for the rules: `ReadPaymentChoices.v1` only guides the page, and the Router and Verify check the payment against the release that is active when it arrives. A release that goes live while the customer is on the page can't let through a payment it would refuse.

## The market profile decides what the page offers

Everything the read call returns already lives in the market's profile: the instrument types and the largest payment in its rule settings, the bank step in `requiresBankConfirmation`, the cancellation window and the go-ahead in its operations settings, and Pay & Plan in the APIs it takes. Two Proposed settings join them: the **scheduling horizon**, how many days ahead a payment can be scheduled (30 by default), and **Pay with MR Points**, on or off. [Market Profile](../../onboarding/market-profile.md#what-the-customer-is-offered) maps each part of the page to the setting behind it.

## How the Router picks the journey

The page sends one request to one door, `CreatePayment.v3`, whatever the customer chose. The Router reads the date, the instructions and the way to pay, and what One-Data adds (the IDs of payments already pending on the account), then picks one journey:

| Journey | When | Temporal workflow |
| --- | --- | --- |
| [Pay my bill today](./all-journeys.md#pay-my-bill-today) | Today, one instruction | `CreateImmediatePaymentWorkflow` |
| [Pay on a future date](./all-journeys.md#pay-on-a-future-date) | A later date | `CreateScheduledPaymentWorkflow`, then `ExecuteScheduledPaymentWorkflow` on the date |
| [Pay by Bank today](./all-journeys.md#pay-by-bank-today) | Today, with a way to pay that needs a bank step | `CreatePaymentIntentWorkflow` |
| [Pay with multiple instructions](./all-journeys.md#pay-with-multiple-instructions) | Today, a bank account and MR Points | `CreatePaymentWithMultipleInstructionsWorkflow` |
| [Pay while another payment is pending](./all-journeys.md#pay-while-another-payment-is-pending) | Another payment is pending, in a market with the go-ahead on | `CreatePaymentIntentWorkflow` |
| [Pay with MR Points](./all-journeys.md#pay-with-mr-points) | Today, MR Points only | The Pay with MR Points composite |

The table follows the order customers meet these journeys. The Router checks them in a different order, and the first that matches wins: a wait comes first, because a payment that waits for the customer has to run in the one workflow that can wait for them. Then a later date, then several instructions, then MR Points alone, and pay today last.

Pay & Plan is not on this list because it doesn't come through this door. A customer who sets up a plan sends `CreatePaymentInstallment.v1`, and the Router starts the Pay & Plan composite.

## MR Points

The customer can tick Pay with MR Points next to the way to pay, to pay with their Membership Rewards points. Points alone run the Pay with MR Points composite, across Billpay and Loyalty. Points with a bank account are two instructions, so they run as Pay with multiple instructions.

Points pay today only. Once they are ticked, the page offers no later date, and a future-dated create that carries points gets 422 before any workflow starts (Proposed). The same happens in a market whose Pay with MR Points setting is off.

## Still to be defined

- The contract of `ReadPaymentChoices.v1`, and the billpay-core read behind it.
- The steps of the Pay with MR Points composite, and its calls to Loyalty.
- Wallet: which instrument it is, and whether it needs a bank step. It appears on this page only.
- A go-ahead on a composite create. The Router checks for a wait first, but the workflow that waits runs one instruction, so a create with several instructions or with MR Points alone has no settled path when another payment is pending in a market with the go-ahead on.
- A later date with Pay with Bank Transfer. Only payments made today take bank confirmation, and what happens to a scheduled one isn't written down yet.
