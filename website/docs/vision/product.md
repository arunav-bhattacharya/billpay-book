---
title: Product Vision
sidebar_label: Product
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Product Vision

<Lead>Billpay is **American Express's platform for credit-card bill payments and refunds** — one system that carries every payment from the moment it is initiated to the moment it settles, consistently across every market Amex operates in.</Lead>

## What we're building

A single platform that orchestrates the full lifecycle of a credit-card bill payment — and its reversal as a refund — so processing stays consistent and extensible across markets, instead of being rebuilt for each one.

Requests arrive through Billpay's API gateway (**One-Data Functions**) and core APIs, and span the flows the platform supports:

- **Create** a payment — **immediate**, or **future-dated (scheduled)** for a later run.
- **Update** or **cancel** a scheduled payment before it processes.
- **Inbound** payments initiated or confirmed by a third party.
- **Returns & representment** — process a payment the bank returns, and re-attempt (represent) it when it is eligible.
- **Refunds**, including credit-balance refunds that send money back to the customer.
- **Installments** and other **composite** flows that span domains — *Pay & Plan* (Billpay + Accounts Receivable) and *Pay with MR Points* (Billpay + Loyalty).
- **Payment intent** — register an intent that becomes a payment only once the customer's financial institution confirms it.

Any of these can run as a **full** payment or be **split into allocations** — for example, a corporate payment allocated across accounts.

## Market onboarding & dimensions

New markets come onto the platform through a Billpay **onboarding journey** — a UI where the team selects which Billpay APIs the market will use and answers questions that set its **dimensions**: the processing variants that shape how each payment is handled.

Four dimensions travel with every payment:

<Highlights
  items={[
    {
      term: 'Account type',
      desc: (
        <>
          Consumer, Corporate, or Small Business (<code>accountType</code>).
        </>
      ),
    },
    {
      term: 'AR posting',
      desc: (
        <>
          Whether a processed payment must be notified to Accounts Receivable (<code>requiresArPosting</code>).
        </>
      ),
    },
    {
      term: 'Realtime clearing',
      desc: (
        <>
          Whether clearing runs realtime or non-realtime (<code>requiresRealtimeClearing</code>).
        </>
      ),
    },
    {
      term: 'Mandate authorization',
      desc: (
        <>
          Whether mandate verification is required while a payment is processed (<code>requiresMandateAuthorization</code>).
        </>
      ),
    },
  ]}
/>

A market is onboarded with one or more **profiles** — specific combinations of these dimensions — and each profile maps automatically to the exact stage and activity-group implementations a workflow should run. Behavior is selected at runtime from the market's configuration, not branched in code. And a combination a market hasn't onboarded simply can't run: if a market is live only for Consumer payments and a Corporate request arrives, it is rejected before any workflow starts.

## A consistent lifecycle, across every dimension

Dimensions change *how* a payment is handled, never *how it is described*. Whatever its account type, clearing rule, or authorization requirements, every payment moves through the **same canonical lifecycle states** — the shared vocabulary that lets operations, reporting, and downstream systems treat a corporate payment in one market and a consumer payment in another as the same kind of thing.

`PENDING` → `SCHEDULED` → `ACCEPTED` → `PROCESSING` → `PROCESSED` → `PAID`, with `RETURNED`, `REPRESENTING` / `REPRESENTED`, `DECLINED`, `CANCELLED`, and `DISALLOWED` as the other outcomes. Corporate payments add two allocation states — `ALLOCATING` and `ALLOCATED` — but the rest of the journey is identical. The full state model lives in the Design section.

## What processing a payment involves

Handling a payment runs through a few steps — validation first, then downstream coordination in parallel where it can:

- **Validation** — confirming the payment is valid before it is processed (which may mean calling other Amex systems to check); a payment that fails is declined rather than processed.
- **Clearing** — sending the payment to the funding bank, realtime or non-realtime per the market's clearing rule.
- **Accounts Receivable** — reducing the card's statement balance.
- **Authorization** — increasing the cardmember's **Open-To-Buy (OTB)**, the spendable credit that frees up once a payment is recognized.
- **Fulfillment** — notifying accounting, balance-and-control (audit), risk, and communications once the payment is processed.

A payment reaches the terminal `PAID` state only once Billpay has reconciled **both** the clearing-settlement and the AR-posted events — so "paid" always means genuinely settled and posted.

## Out of scope

Billpay orchestrates payments and drives the systems that complete them — but it does **not own** those downstream domains:

- **Statement balances & Open-To-Buy** — owned by Accounts Receivable and Authorization; Billpay notifies them.
- **Clearing & settlement** — the banking networks move and settle the funds; Billpay sends payments for clearing and tracks the outcome.
- **Fulfillment systems** — accounting, balance-and-control (audit), risk, and communications are their own domains.
- **Customer channels** — the app, web, and servicing experiences that call Billpay are owned upstream.

The [Engineering Vision](./engineering.md#what-were-explicitly-not-building) restates these boundaries as engineering commitments.
