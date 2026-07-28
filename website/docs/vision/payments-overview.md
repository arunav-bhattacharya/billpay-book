---
title: Payments Overview
sidebar_label: Payments Overview
---

import Lead from '@site/src/components/Lead';
import LandscapeMap from '@site/src/components/LandscapeMap';
import LegacyMap from '@site/src/components/LegacyMap';

# Payments Overview

<Lead highlight>Billpay sits at the centre of the modern payments platform. Channels come to it, and it runs a payment to completion by calling the domains around it, some inside the payments estate and some outside Amex altogether.</Lead>

## Payments Landscape

<LandscapeMap />

### How the pieces connect

- Channels reach **four domains and no others**: Bill Pay Core, Plans, Payment Instruments and Mandates. Each exposes a **Type-A API**, the house standard for what a domain's interface looks like.
- **Multirail Gateway** and **Payments Clearing** expose Type-A APIs as well, but their only caller is **Bill Pay Core**. No channel touches them.
- Everything outside Amex is reached through **Payments Clearing**: partner banks, TPSPs, P2P networks and the payment networks.
- **3rd Party Account Verification** is the exception. It answers to Payments Clearing and to Payment Instruments.

### What Billpay owns

| Billpay | A neighbour |
|---|---|
| The payment lifecycle and its states | The instruments a payment draws on (Payment Instruments) |
| Recurring and autopay schedules (Plans) | The standing authorization behind a collection (Mandates) |
| Third-party payments, on the same lifecycle (Inbound Processor) | Splitting a corporate payment across accounts (Allocation Manager) |
| A payment's own history | Rails, clearing and settlement (Multirail Gateway, Payments Clearing) |
| Operational state for a payment in flight | The statement balance and the ledger (Accounts Receivable, Finance) |

Same boundary the [Engineering Vision](./engineering.md) draws around what the platform is not building.

## Before the split

<LegacyMap />

- One application held **instruments**, **arrangements** (mandates and autopays) and **payments** over a single schema.
- Payments were divided again by who started them. Amex-initiated ones ran inside that application. **Third-party-initiated ones lived in a separate estate**, with their own contracts and their own stores.
- A third application existed only to **merge the two histories**, so that something could answer "what has this customer paid?"

A channel could not ask the payments domain for anything, because there was no payments domain to ask. It had to know which application held the answer, and each one had grown its own contract.

<details>
<summary>What that cost us</summary>

- A channel integrating with payments integrated with several applications, and picking the wrong one was a routing decision it should never have had to make.
- No application could answer what a customer had paid. An extra service merged two sources, so a whole class of gaps only showed up in the merged view.
- Instruments, arrangements and payments shipped together, because they were one deployable. A change to how a funding account is stored sat in the same release as a change to how a payment clears.
- The shared schema meant a defect in one domain could take the others down with it. That coupling was structural, so care in the code did not remove it.
- Payment volume and instrument lookups have different load shapes but ran in the same JVM, so scaling for the busier one over-provisioned the other.
- The same payment was modelled twice depending on who initiated it. Two lifecycles, two state vocabularies, two sets of operational tooling.

</details>

## Legacy vs modern

| Legacy | Modern |
|---|---|
| A channel integrated with each application separately | Four domains expose a Type-A API, so a channel learns the interface once |
| A separate service merged two payment histories | The domain that owns payments owns their history, and there is no second source to reconcile |
| Three domains on one release train | Three domains, three deployables, three release trains |
| A shared schema carried defects across domains | Each domain owns its own store, and the contract is the only coupling |
| Everything scaled together | Each domain scales to its own load shape |
| Two models for what a customer sees as one payment | The Inbound Processor puts third-party payments on the same lifecycle, validated and enriched on the way in |
