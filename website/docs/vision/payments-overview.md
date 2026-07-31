---
title: Payments Overview
sidebar_label: Payments Overview
---

import Lead from '@site/src/components/Lead';
import LandscapeMap from '@site/src/components/LandscapeMap';
import LegacyEstateMap from '@site/src/components/LegacyEstateMap';
import CompareTable from '@site/src/components/CompareTable';

# Payments Overview

<Lead highlight>Billpay sits at the centre of the modern payments platform. Channels come to it, and it runs a payment to completion by calling the domains around it, some inside the payments estate and some outside Amex altogether.</Lead>

## The payments landscape today

<LandscapeMap />

### How the pieces connect

- Channels reach **four domains and no others**: Bill Pay Core, Plans, Payment Instruments and Mandates. Each exposes a **Type-A API**, the house standard for what a domain's interface looks like.
- **Multirail Gateway** and **Payments Clearing** expose Type-A APIs as well, but their only caller is **Bill Pay Core**. No channel touches them.
- Everything outside Amex is reached through **Payments Clearing**: partner banks, TPSPs, P2P networks and the payment networks.

## The legacy estate

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

<CompareTable
  rows={[
    {
      what: 'Channel contract',
      legacy: '**Multiple customer journey interfaces are exposed from a single app**',
      modern: '**One set of Type-A APIs per domain**',
    },
    {
      what: 'Ownership',
      legacy: 'AM starts it, GPP clears it, FTN files it, the mainframe bills it. **Ownership is shared across systems, and nobody owns tracing a payment end to end**',
      modern: '**Bill Pay Core owns the payment** end to end',
    },
    {
      what: 'History',
      legacy: '**Merged** from an AM feed and an FTN batch',
      modern: '**One owner, one source**',
    },
    {
      what: 'Deployables',
      legacy: 'One app, one schema, **one release train**',
      modern: '**Three domains, three release trains**',
    },
    {
      what: 'Blast radius',
      legacy: 'Shared schema, so **a defect crosses domains**',
      modern: '**Own store per domain**, contract is the only coupling',
    },
    {
      what: 'Scaling',
      legacy: '**Everything scales together**',
      modern: '**Each domain to its own load shape**',
    },
    {
      what: 'Third-party payments',
      legacy: 'Arrive as **files**, on their own path',
      modern: '**Same lifecycle**, validated on the way in',
    },
    {
      what: 'Latency',
      legacy: 'FINCAP to TRIUMPH to CRS to Global Billing: **a full batch cycle**',
      modern: '**Events**, not a nightly chain',
    },
    {
      what: 'Traceability',
      legacy: '**Breaks** at AM, GPP, GPHDB, IL and the DataPower and APIGEE hops',
      modern: '**One lifecycle, one set of states**',
    },
  ]}
/>
