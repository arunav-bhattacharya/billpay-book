---
title: Releases and Environments
description: 'A market goes live through a release: a frozen version of its profile that moves through three environments, tested and signed off in each.'
sidebar_label: Releases and Environments
---

import Lead from '@site/src/components/Lead';

# Releases and Environments

<Lead>A market goes live through a release: a frozen version of its profile that moves through three environments, tested and signed off in each, with a change request before production.</Lead>

A release is how a market's config earns trust. Nobody edits the config an environment runs on. Instead, a profile is approved once, frozen, and the same frozen version is proven in each environment in turn. What reaches production is byte for byte what passed testing, and the checksum says so.

## Approval, once

Onboarding uses maker-checker: the person who authors a change can't approve it. When a release is approved, the Market Onboarding UI's backend saves the draft as release vN:

- the profile's full config, as JSON
- a checksum
- the author and the approver

A release is one profile, one market and account type. It never changes after it is frozen. A later edit becomes vN+1, which goes through the same approval.

## Three environments

A release moves through E1, E2 and E3, always in that order. E3 is production, and it needs a change request (RFC) as well as a sign-off.

1. The backend sends vN to E1's Market Onboarding API, using its own service identity. Sending is idempotent: there is one onboarding workflow per market, account type, version and environment, so a repeated send doesn't start a second one.
2. A deployment row per release and environment tracks the workflow: requested, running, waiting for sign-off, active or failed. The readiness screen in the Market Onboarding UI reads those rows, so it shows real progress.
3. In each environment the workflow runs test payments against vN. Once they pass, someone signs off in the UI, and the backend sends the sign-off through the same API.
4. Once vN is active and signed off in E1, the same vN goes to E2, then to E3. In E3 the RFC must pass the ServiceNow check before the sign-off counts.
5. A new market's traffic is enabled only once its release is live in E3, so no real payment reaches it before it has passed in every environment.

Market profiles change rarely, and a change takes the same road: tested in E1 and E2 before it reaches production.

There are two human checks in all: approval once, on the content, and sign-off in each environment, after its test payments pass.

## Going live, and going back

Activation switches the market's active config to vN and applies its Schedules and settings. New payments use vN at once. Payments already running keep the version they started with, because it is pinned in their plan key.

Rollback switches the pointer back to the previous version, and its Schedules and settings with it. Nothing is deleted, so rolling back is as quick as going live.

A live market can also be paused and resumed. Pausing stops the market's dispatchers, so its due work waits in Oracle, and resuming starts them again. Neither changes the market's config.

Load-test run 7 proves the whole cycle: publish, test, activate and roll back a release in E1 while payments are running. New payments must pick up the new version, running ones must keep theirs, and rollback must restore the old one.

## Changes to today's Market Onboarding UI

The Market Onboarding UI already has most of this flow. These are the changes that connect it to real environments:

- `promote()` only moves a status in its local H2 database today. It will send vN to the next environment.
- `verifyProfile()`, the sign-off, will send the sign-off to that environment's workflow.
- `recordRfc()` stays, and becomes required before the E3 sign-off.
- `Readiness.kt` is simulated today. The deployment rows replace it.
- The behaviors gain `requiresBankConfirmation`, and `requiresRepresentableReturn` goes, since representment is now a market rule. Today's profiles hold none of the Operations step's settings yet.
- The API catalog takes the spec's names: `CreatePaymentIntent.v1` goes, `CreateConfirmPendingPayment.v1` and `CreatePaymentAllocations.v1` join, and the event handlers' names start with Create.
- The third account type is stored as `BUSINESS_TRAVEL_ACCOUNT`. Onboarding maps it to `BUSINESS_TRAVEL` (Proposed, 2026-10-18).
- Authoring will check each new behavior combination against the build's capability manifest.
