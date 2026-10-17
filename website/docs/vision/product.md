---
title: Product Vision
description: 'Billpay is the platform American Express uses to process credit card bill payments, and the refunds that send money back the other way.'
sidebar_label: Product
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Product Vision

<Lead>Billpay is the platform American Express uses to process **credit card bill payments, and the refunds that send money back the other way**. It takes a payment from the moment a cardmember submits it to the moment the money settles, and it runs the same way in every market, however different the local rules are.</Lead>

## What Billpay is

When a cardmember pays their Amex bill, some system has to take the request, validate it, pull the money from their bank, deduct what they owe, increase their available credit card balance and open-to-buy exposure, and notify every Amex system that needs to know. That is Billpay. It handles the whole life of a bill payment, and the reverse direction too, when money goes back to the customer as a refund.

Each market used to build its own version of this. Billpay replaces them with one platform every market shares, so bringing on a new market is a matter of describing how it pays, not building the plumbing again.

## Payment journeys

Requests reach Billpay through its API gateway, the **One-Data Functions**, and its core APIs. Across those entry points the platform runs eight journeys:

<Highlights
  items={[
    {
      term: 'Pay now or later',
      desc: `Create a payment that runs straight away, or schedule it for a date the customer picks.`,
    },
    {
      term: 'Update or cancel',
      desc: `Change or withdraw a scheduled payment until the market's cancellation window closes, or for a corporate payment until its allocations are requested. After that the payment is committed, and a late request is turned away.`,
    },
    {
      term: 'Bulk intake from AR',
      desc: `Accept scheduled payments in bulk from the Accounts Receivable platform, answering each one as soon as it is safely stored, then working through them at a pace the platform can carry.`,
    },
    {
      term: 'Inbound payments',
      desc: `Take a payment that a third party starts or confirms on the customer's behalf.`,
    },
    {
      term: 'Returns and representment',
      desc: `Handle a payment the bank sends back, and present it again when the market's rules allow.`,
    },
    {
      term: 'Credit balance refunds',
      desc: `Send a credit balance back to the customer, whether they ask for it in a channel or Accounts Receivable raises it.`,
    },
    {
      term: 'Composite flows',
      desc: (
        <>
          Combine Billpay with another domain: <em>Pay &amp; Plan</em> (a payment plus an installment
          plan), or <em>Pay with MR points</em> (a payment funded by loyalty points).
        </>
      ),
    },
    {
      term: 'Payment intent',
      desc: `Record an intent to pay, which becomes a real payment only once the customer's bank confirms it.`,
    },
  ]}
/>

### Full and split payments

Every payment is either full or split. A **full payment** settles as one amount against one card account. A **split payment** is divided into **allocations**, and each allocation is processed and posted on its own before rolling back up to the original payment.

The usual case is a **corporate payment**: one payment from a company, spread across the accounts it covers. A single one can carry up to 100,000 allocations. Before any money moves, Billpay asks the allocations manager for the breakdown by account: at once for a payment made today, or on its due date or a set time before it for a scheduled one. Once the breakdown is complete, the company's payment clears with its bank once, as one amount, and then each allocation posts to its own account, in parallel. The company still sees one payment, but paid is tracked allocation by allocation: each one counts as paid once the company's payment has settled and that allocation has posted.

## Scheduled payments at midnight

Most scheduled payments fall due at the same moment: midnight in their market. In the US that can be a million payments at once, with no deadline beyond getting through them. SEPA markets (the Single Euro Payments Area, such as Germany and Italy) are stricter: each has a fixed cutoff, and every payment due that night has to be sent out before it.

Billpay keeps every scheduled payment in its database until the moment it is due, then releases them at a pace the platform and the systems behind it can carry. That pace rises while everything is healthy and drops as soon as the response times customers see start to climb. A cardmember paying their bill at 12:05 never waits behind a million scheduled payments.

## How a market describes the way it pays

A market comes onto Billpay through **onboarding** in the Market Onboarding UI, the tool the team uses to set markets up. Onboarding is done for a **market and an account type** together, because consumer, corporate and business travel payments are processed differently. A market with all three account types onboards each of them separately. Each onboarding picks the Billpay APIs it will use, then answers two kinds of question.

### Behaviors

The first kind sets the **behaviors**, the choices that change how a payment is handled. The account type is one; the other three are answered **Y**, **N** or **BOTH**. BOTH means the behavior applies to some journeys and not others, and onboarding records which ones. Realtime clearing is the clearest example: only a payment made today in a channel can clear in real time, so a market that clears today's payments in real time answers BOTH, and every future-dated payment clears in batch.

| Behavior | What it decides | Answers |
| --- | --- | --- |
| **Account type** | Which kind of card account the payment is for (`accountType`). Each is onboarded as a profile of its own, because each is processed differently, and a request for an account type the market hasn't onboarded is turned away. | Consumer, corporate or business travel |
| **Good faith credit** | Whether the cardmember gets credit for the payment before the money settles. Billpay tells Accounts Receivable, the system that tracks what they owe, to post the payment while it is still processing (`requiresArPosting`). | Y, N or BOTH |
| **Realtime clearing** | Whether the payment goes to the customer's bank straight away or waits for a periodic batch (`requiresRealtimeClearing`). | Y, N or BOTH |
| **Mandate authorization** | Whether Billpay has to verify a mandate, the standing authorization to collect the money, while the payment is processed (`requiresMandateAuthorization`). | Y, N or BOTH |

### Operations settings

The second kind is about time. The **Operations step** asks when the market's scheduled payments run, how long before that a customer can still cancel, whether there is a cutoff they must finish by, when a corporate payment's allocations should be fetched and when their lateness should raise an alert, how a returned payment may be presented again, and what volumes to expect. Every answer drives something real at runtime, from the moment a market's payments are released to the pace they run at.

### Releases

Nothing a market configures goes live straight away. Once a second person has approved the settings, they are frozen as a numbered **release**. The release moves through three environments in turn, and each one checks it against the code it runs, sends test payments through it, and waits for someone to sign it off. Production also needs an approved change request. Only then does the release go live: new payments pick it up at once, and payments already in flight finish on the version they started with.

A market whose answers are all combinations Billpay already supports goes live on configuration alone. A combination the market never onboarded cannot run at all: if a market is live only for consumer payments and a corporate request shows up, Billpay rejects it before any processing starts.

## The lifecycle states

Behaviors change how a payment is handled. They do not change what it is called. Whatever the market, the account type or the clearing rule, every payment moves through the **same set of lifecycle states**, which is what lets operations, reporting and downstream systems read a corporate payment in one market and a consumer payment in another the same way.

The main path is `PENDING` → `ACCEPTED` → `PROCESSING` → `PROCESSED` → `PAID`, with `SCHEDULED` for future-dated payments, and `RETURNED`, `REPRESENTING` / `REPRESENTED`, `DECLINED`, `CANCELLED` and `DISALLOWED` as the other outcomes. A corporate payment adds two states while it fetches its allocations, `ALLOCATING` and `ALLOCATED`, and moves money only once it is `ALLOCATED`. A payment can be cancelled only while it is `SCHEDULED`, so a corporate payment can't be cancelled once its allocations have been requested. A corporate payment stops at `PROCESSED`, and each allocation turns `PAID` on its own. What each state means, and every transition between them, is in the [Payment State Model](../design/payment-state-model.md).

## Processing a payment

Validation comes first. A payment that fails it is declined, and nothing else runs. After that, Billpay runs the steps that move the money, side by side wherever they don't depend on each other.

- Clearing sends the payment to the customer's bank so the funds actually move, in real time or in a batch.
- Accounts Receivable (AR) posting reduces the cardmember's statement balance, the amount they owe on the card.
- Authorization restores the customer's *Open-To-Buy*, the room left to spend on the card. Paying the bill frees it up again.
- Accounting, balance and control (eBNC) and risk are told about the payment.
- Last, the customer is told through Raven, the messaging platform, and the lifecycle event other Amex systems listen for goes out through RTF (the Reliable Transaction Framework).

All of these have to succeed before a payment counts as `PROCESSED`. The customer hears last, so a confirmation never goes out while an earlier step is still unfinished.

A payment reaches `PAID` only once **both** confirmations have come back: that the bank settled the funds, and that AR has confirmed the posting. They arrive separately, in either order and often in bursts, so One-Data, the gateway in front of Billpay, holds them and marks the payment ready when the second one lands. Billpay picks up ready payments in batches, at a pace it sets, and marks them `PAID`.

Which of these steps run in parallel, and on which part of the platform, is on the [Architecture Overview](../architecture/overview.md).
