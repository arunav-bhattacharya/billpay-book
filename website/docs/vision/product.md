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

When a cardmember pays their Amex bill, something has to take the request, check it, pull the money from their bank, cut what they owe, and tell every Amex system that needs to know. That is Billpay. It handles the whole life of a bill payment, and the reverse direction too, when money goes back to the customer as a refund.

Each market used to build its own version of this. Billpay replaces them with one platform every market shares, so bringing on a new market is a matter of describing how it pays, not building the plumbing again.

## Payment journeys

Requests reach Billpay through its API gateway, the **One-Data Functions**, and its core APIs. Across those entry points the platform can:

- Create a payment, run now or scheduled for a date the customer picks.
- Update or cancel a scheduled payment until the market's cancellation window closes. After that the payment is committed, and a late request is turned away.
- Accept scheduled payments in bulk from the Accounts Receivable platform, answering each one as soon as its processing has safely started.
- Take an inbound payment that a third party starts or confirms for the customer.
- Handle a payment the bank sends back, and present it again when the market's rules allow.
- Refund a credit balance, whether the customer asks in a channel or Accounts Receivable raises it.
- Run composite flows that combine Billpay with another domain: *Pay & Plan* (a payment plus an installment plan), or *Pay with MR points* (a payment funded by loyalty points).
- Record a payment intent, which becomes a real payment only once the customer's bank confirms it.

### Full and split payments

Every payment is either full or split. A **full payment** settles as one amount against one card account. A **split payment** is divided into **allocations**, and each allocation is processed and posted on its own before rolling back up to the original payment.

The usual case is a **corporate payment**: one payment from a company, spread across the accounts it covers. A single one can carry up to 100,000 allocations. The company's payment clears with its bank once, as one amount, on its due date. The breakdown by account arrives separately, from the allocations manager. From the due date on, each allocation posts to its own account as it arrives, in parallel with the clearing. The company still sees one payment, and it counts as paid once it has settled and every allocation has posted.

## Scheduled payments at midnight

Most scheduled payments fall due at the same moment: midnight in their market. In the US that can be a million payments at once, with no deadline beyond getting through them. In Germany and Italy it can be 250,000 each, and those have to be through within a cutoff three to four hours away.

Billpay keeps every scheduled payment in its database until the moment it is due, then releases them at a pace the platform and the systems behind it can carry. That pace rises while everything is healthy and drops as soon as the response times customers see start to climb. A cardmember paying their bill at 12:05 never waits behind a million scheduled payments.

## How a market describes the way it pays

A market comes onto Billpay through **onboarding** in billpay-ui, the tool the team uses to set markets up. Onboarding is done for a **market and an account type** together, because consumer, corporate and business travel payments are processed differently. A market that runs all three is onboarded three times. Each one picks the Billpay APIs it will use, then answers two kinds of question.

### Behaviors

The first kind sets the **behaviors**, the choices that change how a payment is handled. The account type is one; the other three are answered **Y**, **N** or **BOTH**. BOTH means the behavior applies to some journeys and not others, and onboarding records which ones. Realtime clearing is the clearest example: only a payment made today in a channel can clear in real time, so a market that clears today's payments in real time answers BOTH, and every future-dated payment clears in batch.

<Highlights
  items={[
    {
      term: 'Account type',
      desc: (
        <>
          Consumer, corporate or business travel (<code>accountType</code>). Each is onboarded as a profile of its own, because each is processed differently, and a request for an account type the market hasn't onboarded is turned away.
        </>
      ),
    },
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
  ]}
/>

### Operations settings

The second kind is about time. The **Operations step** asks when the market's scheduled payments run, how long before that a customer can still cancel, whether there is a cutoff they must finish by, when a corporate payment's allocations should be fetched and when their lateness should raise an alert, how a returned payment may be presented again, and what volumes to expect. Every answer drives something real at runtime, from the moment a market's payments are released to the pace they run at.

### Releases

Nothing a market configures goes live straight away. Once a second person has approved the settings, they are frozen as a numbered **release**. The release moves through three environments in turn, and each one checks it against the code it runs, sends test payments through it, and waits for someone to sign it off. Production also needs an approved change request. Only then does the release go live: new payments pick it up at once, and payments already in flight finish on the version they started with.

A market whose answers are all combinations Billpay already supports goes live on configuration alone. A combination the market never onboarded cannot run at all: if a market is live only for consumer payments and a corporate request shows up, Billpay rejects it before any processing starts.

## The lifecycle states

Behaviors change how a payment is handled. They do not change what it is called. Whatever the market, the account type or the clearing rule, every payment moves through the **same set of lifecycle states**, which is what lets operations, reporting and downstream systems read a corporate payment in one market and a consumer payment in another the same way.

The main path is `PENDING` → `ACCEPTED` → `PROCESSING` → `PROCESSED` → `PAID`, with `SCHEDULED` for future-dated payments, and `RETURNED`, `REPRESENTING` / `REPRESENTED`, `DECLINED`, `CANCELLED` and `DISALLOWED` as the other outcomes. A payment can be cancelled only while it is `SCHEDULED`. A corporate payment uses the same states, and tracks its allocations on a separate **allocation status**, so a late breakdown never holds up the payment itself. What each state means, and every transition between them, is in the [Payment State Model](../design/payment-state-model.md).

## Processing a payment

Validation comes first. A payment that fails it is declined, and nothing else runs. After that, Billpay runs the steps that move the money, side by side wherever they don't depend on each other.

- Clearing sends the payment to the customer's bank so the funds actually move, in real time or in a batch.
- Accounts Receivable (AR) posting reduces the cardmember's statement balance, the amount they owe on the card.
- Authorization restores the customer's *Open-To-Buy*, the room left to spend on the card. Paying the bill frees it up again.
- Accounting, balance and control (eBNC) and risk are told about the payment.

All of these have to succeed before a payment counts as `PROCESSED`. Customer communications and the lifecycle events other systems listen for go out after that, from an outbox, so a slow messaging system never holds up a payment.

A payment reaches `PAID` only once Billpay has seen **both** confirmations come back: that the bank settled the funds, and that AR posted the payment. Until both arrive, the payment is not paid.

Which of these steps run in parallel, and on which part of the platform, is on the [Architecture Overview](../architecture/overview.md).
