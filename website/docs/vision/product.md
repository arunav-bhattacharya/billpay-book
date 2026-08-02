---
title: Product Vision
sidebar_label: Product
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Product Vision

<Lead>Billpay is the platform American Express uses to process **credit card bill payments, and the refunds that send money back the other way**. It takes a payment from the moment a cardmember submits it to the moment the money settles, and it runs the same way in every market, however different the local rules are.</Lead>

## What Billpay is

When a cardmember pays their Amex bill, something has to take the request, check it, pull the money from their bank, cut what they owe, and tell the Amex systems that need to know. That is Billpay. It handles the whole life of a bill payment, and the reverse direction too, when money goes back to the customer as a refund.

Each market used to build its own version of this. Billpay replaces them with one platform every market shares, so bringing on a new market means configuring it rather than building the plumbing again.

## Payment Journeys

Requests reach Billpay through its API gateway, the **One-Data Functions**, and its core APIs. Across those entry points the platform handles:

- Create a payment, run now or scheduled for a date the customer picks.
- Update or cancel a scheduled payment before it runs.
- Take an inbound payment that a third party starts or confirms for the customer.
- Handle a payment the bank sends back, and re-attempt it when the customer is eligible.
- Send money back to the customer as a refund, including a refund on a credit balance.
- Run composite flows that combine Billpay with another domain: *Pay & Plan* (a payment plus an installment plan), or *Pay with MR points* (a payment funded by loyalty points).
- Record a payment intent, which becomes a real payment only once the customer's bank confirms it.

### Full and split payments

Every payment is either full or split. A **full payment** settles as one amount against one card account. A **split payment** is divided into **allocations**, and each allocation is validated, processed, and settled on its own before rolling back up to the original payment. The usual case is a **corporate payment**: one payment from a company, spread across the several accounts it covers. Each allocation clears and posts independently, and the customer still sees one payment.

## Behaviors in a market

A market comes onto Billpay through an **onboarding journey**: a UI where the team picks which Billpay APIs the market will use, then answers a short set of questions about how payments should be processed.

Those questions are answered for a **market and an account type** together, not for the market on its own. Consumer, corporate, and business travel account payments are processed differently, so a market that runs all three answers the questions three times. Each answer sets a **behavior**, a yes or no choice that changes how a payment is handled, and the behaviors travel with every payment.

<Highlights
  items={[
    {
      term: 'Good faith credit',
      desc: (
        <>
          Whether the cardmember gets credit for the payment before the money settles. Billpay tells <strong>Accounts Receivable</strong>, the system that tracks what they owe, to post the payment while it is still processing (<code>requiresArPosting</code>).
        </>
      ),
    },
    {
      term: 'Realtime clearing',
      desc: (
        <>
          Whether the payment goes to the customer's bank straight away or waits for a periodic <strong>batch</strong> (<code>requiresRealtimeClearing</code>).
        </>
      ),
    },
    {
      term: 'Mandate authorization',
      desc: (
        <>
          Whether Billpay has to verify a <strong>mandate</strong>, the standing authorization to collect the money, while the payment is processed (<code>requiresMandateAuthorization</code>).
        </>
      ),
    },
    {
      term: 'Representable return',
      desc: (
        <>
          Whether a payment the bank sends back can be re-attempted. If it can, Billpay creates a new presentment and runs it on the next eligible date. If not, the return is where the payment ends.
        </>
      ),
    },
  ]}
/>

The team captures a market as one or more **profiles**: specific combinations of these answers. When a payment arrives, its profile decides which version of each processing step runs. Nothing is branched by hand in code. Billpay looks the behavior up from the market's configuration, and a combination the market never onboarded cannot run at all. If a market is live only for consumer payments and a corporate request shows up, Billpay rejects it before any processing starts.

## The lifecycle states

Behaviors change how a payment is handled. They do not change what it is called. Whatever the market, the account type, or the clearing rule, every payment moves through the **same set of lifecycle states**. That is what lets operations, reporting, and downstream systems read a corporate payment in one market and a consumer payment in another the same way.

The main path is `PENDING` → `ACCEPTED` → `PROCESSING` → `PROCESSED` → `PAID`, with `SCHEDULED` for future-dated payments, and `RETURNED`, `REPRESENTING` / `REPRESENTED`, `DECLINED`, `CANCELLED`, and `DISALLOWED` as the other outcomes. Corporate payments add two states while their allocations are worked out, `ALLOCATING` and `ALLOCATED`, but the rest of the journey is identical. What each state means, and every transition between them, is in the [Payment State Model](../design/payment-state-model.md).

## Processing a payment

Validation comes first. The steps after it run together wherever the market allows.

- Validation confirms the payment is good before any money moves, which can mean calling other Amex systems to check the account and the request. A payment that fails validation is declined, not processed.
- Clearing sends the payment to the customer's bank so the funds actually move, in realtime or in a batch.
- Accounts Receivable (AR) posting reduces the cardmember's statement balance, the amount they owe on the card.
- Authorization restores the customer's *Open-To-Buy*, the room left to spend on the card. Paying the bill frees it up again.
- Fulfillment tells the systems that need to know once the payment is processed: accounting, balance and control (audit), risk, and customer communications.

A payment reaches `PAID` only once Billpay has seen **both** confirmations come back: that the bank settled the funds, and that AR posted the payment. Until both arrive, the payment is not paid.

Which of these steps run in parallel, and in what order, is on the [Architecture Overview](../architecture/overview.md).
