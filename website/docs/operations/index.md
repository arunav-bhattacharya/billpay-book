---
title: Operations
description: 'Running Billpay day to day: the surfaces an operator should be comfortable with, and the standard procedures for the scenarios that come up.'
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# Operations

<Lead>Running Billpay day to day: the surfaces an operator should be comfortable with, and the standard procedures for the scenarios that come up.</Lead>

Billpay is built so that most problems wait instead of fail. A slow downstream, an Oracle patch or a lost worker pauses payments where they are, and they carry on by themselves. The operator's job is the rest: the cases where waiting has gone on too long, or where the system has done all it can and handed a payment over to a person.

## In this section

<SectionIndex
  items={[
    {
      term: 'Familiarity',
      to: '/docs/operations/familiarity',
      desc: `The surfaces an operator works with, from the two Temporal UIs and the Market Onboarding UI down to the databases and the dispatch controls.`,
    },
    {
      term: 'SOPs',
      to: '/docs/operations/sops',
      desc: `Runbooks for the scenarios that need a person: a cutoff at risk, late allocations, a failed release, a cluster down, and the rest.`,
    },
  ]}
/>
