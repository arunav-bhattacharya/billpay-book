---
title: Market Onboarding UI
description: 'The Market Onboarding UI, in Control Tower, is the market onboarding control plane: one for every environment, kept apart from payments.'
---

import Lead from '@site/src/components/Lead';

# Market Onboarding UI

<Lead>The Market Onboarding UI, in Control Tower, is the market onboarding control plane: one for every environment, kept apart from payments. Teams use it to describe a market, approve it and send it live, and it reaches each environment only through that environment's Market Onboarding API.</Lead>

It has three parts: the frontend, which is the Market Onboarding UI; the backend, which handles single sign-on, maker-checker approval, audit and versioned releases; and the authoring tables, in the control plane's own schema. [What runs where](../../onboarding/index.md#what-runs-where) sets them beside the parts that live in each environment.

## The boundary

- One backend serves E1, E2 and E3. There is no copy of the control plane per environment.
- The authoring tables (drafts, revisions, releases, approvals, deployments and audit) sit outside billpay-core. No environment reads them.
- The Market Onboarding UI never reads or writes an environment's Oracle or Temporal. Everything crosses through the Market Onboarding API, which the backend calls with its own service identity.
- Every send is idempotent: one onboarding workflow per market, account type, version and environment, so a repeated send never starts a second one.

That boundary is what lets a market and the code move on separate roads. A release is config, frozen and sent through the API. A billpay-core change is code, and goes through the [pipeline](../pipeline.md). The two meet only when a market needs a behavior combination the deployed build can't run: authoring flags it as needing a build, and the onboarding workflow stops at its first step until that build is deployed.

## Today's code

The Market Onboarding UI exists today and already has most of the flow. [Changes to today's Market Onboarding UI](../../onboarding/releases.md#changes-to-todays-market-onboarding-ui) lists what connects it to real environments.
