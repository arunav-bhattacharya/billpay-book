---
title: API Spec
description: 'Two contract layers stand between a channel and a workflow.'
sidebar_label: API Spec
---

import Lead from '@site/src/components/Lead';
import SectionIndex from '@site/src/components/SectionIndex';

# API Spec

<Lead>Two contract layers stand between a channel and a workflow. <strong>One-Data functions</strong> are the versioned contracts the rest of Amex calls. Most of them front a <strong>billpay-core REST API</strong>, where the Router admits the request and starts its workflow. The rest keep work nobody waits for in One-Data's inbox, and Billpay's dispatchers pull it from there.</Lead>

Each layer has its own job. One-Data makes the payment ID, runs the check for other pending payments, and holds a create while billpay-core is slow. billpay-core decides what happens to the payment.

## In this section

<SectionIndex
  items={[
    {
      term: 'One-Data Functions',
      to: '/docs/build/api-spec/one-data',
      desc: `Every function and the billpay-core API behind it, the pending check in Redis, the event handlers, and the inbox functions Billpay pulls work through.`,
    },
    {
      term: 'Billpay Core APIs',
      to: '/docs/build/api-spec/billpay-core',
      desc: `Every endpoint with its start mode and reply, what the Router refuses before a workflow starts, why a repeated request is safe, and the Market Onboarding API.`,
    },
  ]}
/>
