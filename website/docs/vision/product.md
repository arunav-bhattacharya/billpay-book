---
title: Product Vision
sidebar_label: Product
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Product Vision

<Lead highlight>Billpay is where American Express processes **credit-card bill payments, and the refunds that send money back the other way**. It carries a payment from the moment a customer submits it to the moment it settles, and it does so the same way in every market Amex operates in — however much the local rules differ.</Lead>

## What Billpay is

When a cardmember pays their Amex bill, something has to take that request, check it, pull the money from their bank, reduce what they owe, and tell every Amex system that needs to know. Billpay is that something. It runs the whole life of a bill payment, and the reverse direction too, when money goes back to the customer as a refund.

Historically each market built its own version of this. The aim of Billpay is one platform every market shares, so bringing on a new market is a matter of *configuring* it, not rebuilding the plumbing.

## What a payment can be

Requests reach Billpay through its API gateway, the **One-Data Functions**, and its core APIs. Across those entry points the platform handles:

- **Create** a payment, either **immediate** (run now) or **scheduled** (run on a future date the customer chooses).
- **Update** or **cancel** a scheduled payment before it runs.
- **Inbound** payments that a third party initiates or confirms on the customer's behalf.
- **Returns and representment**: handle a payment the bank sends back, and re-attempt it when the customer is eligible.
- **Refunds**, including credit-balance refunds that pay money back to the customer.
- **Composite flows** that combine Billpay with another domain, such as *Pay & Plan* (a payment plus an installment plan) or *Pay with MR points* (a payment funded by loyalty points).
- **Payment intent**: record that a customer means to pay, which becomes a real payment only once their bank confirms it.

### Full and split payments

Every payment is either full or split. A **full payment** settles as a single amount against one card account. A **split payment** is divided into **allocations**: separate legs that are each validated, processed, and settled on their own, and then roll back up to the original payment. The common split case is a **corporate payment**, where one payment a company makes is allocated across the several accounts it covers. Each allocation clears and posts independently, even though the customer still sees one payment.

## Markets and dimensions

A market comes onto Billpay through an **onboarding journey**: a UI where the team picks which Billpay APIs the market will use and answers a short set of questions. Those answers set the market's **dimensions**.

A dimension is a processing variant, a yes/no or either/or choice that changes *how* a payment is handled in that market. Four dimensions travel with every payment:

<Highlights
  items={[
    {
      term: 'Account type',
      desc: (
        <>
          Whether the payment is for a <strong>Consumer</strong>, <strong>Corporate</strong>, or <strong>Small Business</strong> account (<code>accountType</code>). This shapes more of the processing than any other dimension — corporate payments, for instance, are the ones that split into allocations.
        </>
      ),
    },
    {
      term: 'AR posting',
      desc: (
        <>
          Whether a processed payment must be reported to <strong>Accounts Receivable</strong>, the system that tracks what the cardmember owes (<code>requiresArPosting</code>).
        </>
      ),
    },
    {
      term: 'Realtime clearing',
      desc: (
        <>
          Whether the payment clears the customer's bank in <strong>realtime</strong> or in a periodic <strong>batch</strong> (<code>requiresRealtimeClearing</code>).
        </>
      ),
    },
    {
      term: 'Mandate authorization',
      desc: (
        <>
          Whether a <strong>mandate</strong> — a standing authorization to collect the payment — has to be verified while the payment is processed (<code>requiresMandateAuthorization</code>).
        </>
      ),
    },
  ]}
/>

The team captures a market as one or more **profiles**: specific combinations of these dimensions. When a payment arrives, its profile decides which version of each processing step runs. Nothing is branched by hand in code; the behaviour is looked up from the market's configuration. And a combination a market never onboarded simply cannot run. If a market is live only for consumer payments and a corporate request shows up, Billpay rejects it before any processing starts.

## The same lifecycle, every time

Dimensions change how a payment is handled. They never change how it is *described*. Whatever the market, account type, or clearing rule, every payment moves through the **same set of lifecycle states**. That shared vocabulary is what lets operations, reporting, and downstream systems treat a corporate payment in one market and a consumer payment in another as the same kind of thing.

The main path is `PENDING` → `ACCEPTED` → `PROCESSING` → `PROCESSED` → `PAID`, with `SCHEDULED` for future-dated payments, and `RETURNED`, `REPRESENTING` / `REPRESENTED`, `DECLINED`, `CANCELLED`, and `DISALLOWED` as the other outcomes. Corporate payments add two states while their allocations are worked out, `ALLOCATING` and `ALLOCATED`, but the rest of the journey is identical. The full state model lives in the Design section.

## What processing a payment involves

Handling a payment is a sequence of steps. Validation comes first; the downstream steps then run together wherever they can.

- **Validation** — confirm the payment is good before any money moves. This can mean calling other Amex systems to check the account and the request. A payment that fails validation is declined, not processed.
- **Clearing** — send the payment to the customer's bank so the funds actually move. Depending on the market's rule, clearing happens in realtime or in a batch.
- **Accounts Receivable (AR)** — reduce the cardmember's statement balance, the amount they owe on the card.
- **Authorization (Open-To-Buy)** — restore the customer's spendable credit. *Open-To-Buy* is how much room is left to spend on the card; paying the bill frees it up again.
- **Fulfillment** — once the payment is processed, notify the systems that need to know: accounting, balance-and-control (audit), risk, and customer communications.

A payment only reaches the final `PAID` state once Billpay has seen **both** confirmations come back: that the bank settled the funds, and that AR posted the payment. Until both arrive it is not called paid, so "paid" always means genuinely settled and booked.
