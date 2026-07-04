---
title: Vision
---

import Lead from '@site/src/components/Lead';
import Highlights from '@site/src/components/Highlights';

# Vision

<Lead>American Express's platform for credit-card **bill payments and refunds** — one core that processes every payment the same way across markets, while absorbing how markets, account types, and processing rules differ.</Lead>

## The Big Picture

<Highlights
  items={[
    {
      term: 'What it is',
      desc: `Billpay runs the full life of a credit-card bill payment, and its reversal as a refund, from the moment it is initiated to the moment it settles — in every market Amex operates in.`,
    },
    {
      term: 'The core idea',
      desc: `The lifecycle of a payment is the same everywhere. What changes between markets — account type, clearing, posting rules — is configuration on a shared core, not a new codebase per market.`,
    },
    {
      term: 'One lifecycle, everywhere',
      desc: (
        <>
          Every payment moves through the same states (<code>PENDING</code> → <code>ACCEPTED</code> → <code>PROCESSING</code> → <code>PROCESSED</code> → <code>PAID</code>, plus the return and terminal states), so it is described identically in every market.
        </>
      ),
    },
    {
      term: 'Durable by design',
      desc: `Each payment runs as a durable, resumable process. It survives failures and long waits, retries safely, and never loses its place. Correctness comes before speed.`,
    },
    {
      term: 'Traceable end to end',
      desc: `Every state transition is persisted and published as an event, so any payment can be followed from its entry point, through its workflow and stages, to each downstream system.`,
    },
    {
      term: 'What it coordinates',
      desc: `Validation, clearing at the bank, the statement balance (Accounts Receivable), Open-To-Buy, and fulfillment — accounting, audit, risk, and communications. A payment counts as paid only once settlement and posting are both confirmed.`,
    },
  ]}
/>
