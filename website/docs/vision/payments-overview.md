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
- **Multirail Gateway** and **Money Movement (M3)** expose Type-A APIs as well, but their only caller is **Bill Pay Core**. No channel touches them.
- That is what the rail down the left edge stands for. Type-A is how a caller gets in, so it is drawn once on the edge instead of repeated on every box.
- Everything outside Amex is reached through **Money Movement (M3)**: partner banks, TPSPs, P2P networks and the payment networks.
- **Control Tower** sits outside the box, underneath all of it, because it works on all of it rather than taking calls of its own. It is where a payment gets researched, and repaired or replayed when something has gone wrong.

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
      legacy: 'One app carried the interfaces for every journey, so **each channel connected its own way**',
      modern: '**One set of Type-A APIs**, the same for every channel',
    },
    {
      what: 'Ownership',
      legacy: 'Starting a payment, clearing it and billing it sat in different places, so **each system held a part of it**',
      modern: '**One domain owns the payment orchestration** from start to finish',
    },
    {
      what: 'History',
      legacy: '**Assembled from different sources**',
      modern: '**Payment history sits in one place**',
    },
    {
      what: 'Deployments',
      legacy: 'One app, so **changes went out together**',
      modern: '**Each domain releases on its own**',
    },
    {
      what: 'Database',
      legacy: '**Shared mainframe database**, so changes and outages impact the entire ecosystem',
      modern: '**Each domain keeps its own data.** The API is the only link between them',
    },
    {
      what: 'Scaling',
      legacy: '**Everything grew together**, whether it needed to or not',
      modern: '**Each domain scales to its own traffic**',
    },
    {
      what: 'Third-party payments',
      legacy: 'Arrived as files, **processed as batches in files**',
      modern: '**Converted and processed in events**',
    },
    {
      what: 'Downstream integrations',
      legacy: 'Passed on step by step, so **a change waited for the next batch run**',
      modern: '**Sent as events**, picked up as they happen',
    },
    {
      what: 'Traceability',
      legacy: 'The trail was **split across systems**, so following one payment meant several lookups',
      modern: '**One lifecycle, one set of states**',
    },
  ]}
/>
