---
title: Vision
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Vision

<Lead>American Express's platform for credit-card **bill payments and refunds** — one orchestration core that processes every payment consistently across markets, while absorbing how markets, account types, and processing rules differ.</Lead>

## The Big Picture

<Highlights
  items={[
    {
      term: 'What it is',
      desc: `Billpay orchestrates the full lifecycle of a credit-card bill payment — and its reversal as a refund — from initiation through settlement, across every Amex market.`,
    },
    {
      term: 'The core idea',
      desc: `The payment lifecycle is universal; the variation — market, account type, processing rules — is configuration and pluggable strategy on a shared core, not a new codebase per market.`,
    },
    {
      term: 'One lifecycle, everywhere',
      desc: (
        <>
          Every payment moves through the same canonical states (<code>PENDING</code> → <code>ACCEPTED</code> → <code>PROCESSING</code> → <code>PROCESSED</code> → <code>PAID</code>, plus the return and terminal states), so it is described identically in every market.
        </>
      ),
    },
    {
      term: 'Durable by design',
      desc: `Each payment runs as a durable, resumable orchestration: it survives failures and long waits, retries safely, and never loses its place. Correctness comes before speed.`,
    },
    {
      term: 'Traceable end to end',
      desc: `Every state transition is persisted and published as a lifecycle event, so any payment is followable from entry, through its workflow and stages, to each downstream system — in seconds, from one place.`,
    },
    {
      term: 'What it coordinates',
      desc: `Clearing, statement balance (Accounts Receivable), Open-To-Buy, and fulfillment — accounting, audit, risk, and communications — in parallel where it can; settlement is confirmed by reconciling settlement and posting events.`,
    },
    {
      term: 'What it is not',
      desc: `Not a ledger, balance system of record, clearing or settlement network, statementing platform, or customer channel. Billpay drives those systems through a payment's lifecycle; it does not own them.`,
    },
  ]}
/>

## The detailed vision

Two complementary lenses:

- **[Product](./product.md)** — what Billpay is, the flows and variance it absorbs, how one platform serves many markets, what processing a payment involves, and what's out of scope.
- **[Engineering](./engineering.md)** — the durable, configuration-driven principles, how the platform is built, what we optimize for, and what we're explicitly not building.
