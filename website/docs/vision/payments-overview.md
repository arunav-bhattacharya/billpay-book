---
title: Payments Overview
description: 'Billpay sits at the centre of the modern payments platform.'
sidebar_label: Payments Overview
---

import Lead from '@site/src/components/Lead';
import LandscapeMap from '@site/src/components/LandscapeMap';
import LegacyEstateMap from '@site/src/components/LegacyEstateMap';
import CompareTable from '@site/src/components/CompareTable';

# Payments Overview

<Lead>Billpay sits at the centre of the modern payments platform. Channels come to it, and it runs a payment to completion by calling the domains around it, some inside the payments estate and some outside Amex altogether.</Lead>

## The Modern Payments Landscape

<LandscapeMap />

<details>
<summary>How the pieces connect</summary>

- Channels reach **four domains and no others**: Bill Pay Core, Plans, Payment Instruments and Mandates. Each exposes a **Type-A API**, the house standard for what a domain's interface looks like.
- **Multirail Gateway** and **Money Movement (M3)** expose Type-A APIs as well, but their only caller is **Bill Pay Core**. No channel touches them.
- That is what the rail down the left edge stands for. Type-A is how a caller gets in, so it is drawn once on the edge instead of repeated on every box.
- Everything outside Amex is reached through **Money Movement (M3)**: partner banks, TPSPs, P2P networks and the payment networks.
- **Control Tower** sits outside the box, underneath all of it, because it works on all of it rather than taking calls of its own. It is where a payment gets researched, and repaired or replayed when something has gone wrong.

</details>

## The Legacy estate

<LegacyEstateMap />

There was no payments domain to call. There was Arrangement Manager, and behind it an estate of clearing, file and batch systems that each held part of a payment. Answering a question about one payment meant knowing which of them to ask.

<details>
<summary>How the estate hung together</summary>

- Every channel arrived at the same place. **Arrangement Manager**, the legacy billpay app, sat behind Voice Response, MYCA, CSP, ACE, ORMB and a dozen others, each coming in over its own interface: DataPower, MQ, MQ over REST, Connect:Direct, web services.
- From there one payment fanned out across the estate. **GPP** cleared it and exchanged ACH files with the bank. IL, IGOR and TL turned it into files. **FTN** pushed it into the mainframe batch chain of FINCAP, TRIUMPH, CRS and Global Billing.
- Payment history was assembled rather than owned. **GPHDB** was fed from AM over a web service on one side and from FTN by mainframe batch on the other, so both had to agree before anyone could answer what a customer had paid.
- Traceability broke in the middle of all this. AM, GPP, GPHDB, IL and the DataPower and APIGEE hops each dropped the thread. Once a payment crossed one, following it end to end meant reading logs in several systems.
- A modernisation layer was later put in front. A **Service Facade** took the routing decision off the channels, and an **Eligibility** service with two caches added a check on the requested amount before a payment went through. The facade still handed the request on to AM, so none of it replaced the app underneath.

</details>

## Legacy vs modern

<CompareTable
  rows={[
    {
      what: 'Channel contract',
      legacy:
        'Channels connected over different protocols (MQ, REST, One-Data functions) through different entry points for different domains, and **one app processed all of it**',
      modern:
        '**One set of Type-A APIs**, common to every channel, each managed by its own domain app',
    },
    {
      what: 'Ownership',
      legacy:
        'Processing was **split across applications**: one initiated the payment, one cleared it, one updated balances, and no system saw the whole thing',
      modern: '**One domain owns the payment orchestration** from start to finish',
    },
    {
      what: 'History',
      legacy: '**Assembled from different sources**',
      modern: '**Payment history sits in one place**',
    },
    {
      what: 'Deployments',
      legacy:
        'One app, so **changes went out together**, and a deploy took days on servers outside Amex Cloud',
      modern: '**Each domain releases on its own**, on the Amex Hydra environment',
    },
    {
      what: 'Database',
      legacy:
        '**Shared mainframe database**, so changes and outages hit the entire payments domain',
      modern: '**Each domain keeps its own data.** The API is the only link between them',
    },
    {
      what: 'Scaling',
      legacy:
        '**Everything grew together**, whether it needed to or not, by adding CPU cores and memory to the same machines',
      modern: '**Each domain scales to its own traffic**, horizontally, by adding pods',
    },
    {
      what: 'Third-party payments',
      legacy: 'Arrived as files, **processed as batches in files**',
      modern: '**Files converted and processed as events**',
    },
    {
      what: 'Downstream integrations',
      legacy: '**Legacy file integrations**, run in periodic batches',
      modern:
        '**Published as events** or notified in realtime, picked up downstream as they happen',
    },
    {
      what: 'Traceability',
      legacy:
        'The trail was **split across systems**, so following one payment meant several lookups',
      modern:
        '**One lifecycle, one set of states**, and one application provides traceability end to end',
    },
  ]}
/>
