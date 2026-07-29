---
title: Payments Overview
sidebar_label: Payments Overview
---

import Lead from '@site/src/components/Lead';
import LandscapeMap from '@site/src/components/LandscapeMap';
import LegacyEstateMap from '@site/src/components/LegacyEstateMap';

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

## Legacy Payments Landscape

<LegacyEstateMap />

- Every channel arrived at the same place. **Arrangement Manager**, the legacy billpay app, sat behind Voice Response, MYCA, CSP, ACE, ORMB and a dozen others, each coming in over its own interface: DataPower, MQ, MQ over REST, Connect:Direct, web services.
- From there one payment fanned out across the estate. **GPP** cleared it and exchanged ACH files with the bank. IL, IGOR and TL turned it into files. **FTN** pushed it into the mainframe batch chain of FINCAP, TRIUMPH, CRS and Global Billing.
- Payment history was assembled rather than owned. **GPHDB** was fed from AM over a web service on one side and from FTN by mainframe batch on the other, so both had to agree before anyone could answer what a customer had paid.
- Traceability broke in the middle of all this. AM, GPP, GPHDB, IL and the DataPower and APIGEE hops each dropped the thread. Once a payment crossed one, following it end to end meant reading logs in several systems.
- A modernisation layer was later put in front. A **Service Facade** took the routing decision off the channels, and an **Eligibility** service with two caches added a check on the requested amount before a payment went through. The facade still handed the request on to AM, so none of it replaced the app underneath.

There was no payments domain to call. There was Arrangement Manager, and behind it an estate of clearing, file and batch systems that each held part of a payment. Answering a question about one payment meant knowing which of them to ask.

<details>
<summary>What that cost us</summary>

- A channel team had to know which interface AM expected. At least five were in use, so integrating meant picking one and living with that choice.
- Nothing owned the payment end to end. AM started it, GPP cleared it, FTN filed it, the mainframe chain billed it. No single system could say where a payment had got to.
- History came from two directions. When the AM feed and the FTN batch disagreed, the gap only surfaced in GPHDB, after the fact.
- The mainframe chain ran on batch. FINCAP, TRIUMPH, CRS and Global Billing each waited on the one before it, so a correction near the front took a full cycle to reach DSTO and the statement.
- Reporting hung off the clearing database. WEBFOCUS read GPP's secondary copy over JDBC, so replication lag showed up as wrong numbers in a report.
- The systems with traceability gaps were the busiest ones. AM, GPP and GPHDB carry every payment, so the gaps sat on the highest-volume paths.

</details>

## Legacy vs modern

<div className="compareTable">

| What changed | Legacy | Modern |
|---|---|---|
| Channel contract | **Five interfaces** into one app | **One Type-A API**, learned once |
| Ownership | AM starts it, GPP clears it, FTN files it, the mainframe bills it. **Nobody owns it** | **Bill Pay Core owns the payment** end to end |
| History | **Merged** from an AM feed and an FTN batch | **One owner, one source** |
| Deployables | One app, one schema, **one release train** | **Three domains, three release trains** |
| Blast radius | Shared schema, so **a defect crosses domains** | **Own store per domain**, contract is the only coupling |
| Scaling | **Everything scales together** | **Each domain to its own load shape** |
| Third-party payments | Arrive as **files**, on their own path | **Same lifecycle**, validated on the way in |
| Latency | FINCAP to TRIUMPH to CRS to Global Billing: **a full batch cycle** | **Events**, not a nightly chain |
| Traceability | **Breaks** at AM, GPP, GPHDB, IL and the DataPower and APIGEE hops | **One lifecycle, one set of states** |

</div>
