---
title: Market Onboarding UI
description: 'The Market Onboarding UI, in Control Tower, is where a market is described, approved and sent live, and where a live market is paused.'
---

import Lead from '@site/src/components/Lead';

# Market Onboarding UI

<Lead>The Market Onboarding UI, in Control Tower, is where a market is described, approved and sent live, and where a live market is paused. Operators mostly use three parts of it: the Operations step, the readiness screen, and pause and resume.</Lead>

[Market Onboarding](../../onboarding/index.md) covers the whole process, from a draft to a live market. This page is the operator's view of it.

## The Operations step

The Operations step holds the settings that drive a market at runtime:

- its time zone and execution time
- its cancellation window and its cutoff
- when corporate allocations are fetched, and when a late one raises an alert
- its representment rules
- which status changes send a Raven message
- its bank-confirmation provider and window
- its expected volumes
- its BOTH rules

[Operations Settings](../../onboarding/operations-settings.md) says what each one drives.

Nobody edits these in production. A change is a new release, approved and onboarded like the first one, so the values a market runs on are always ones that were reviewed and tested.

## Readiness

There is one deployment row per release and environment, and it follows that release's onboarding workflow: requested, running, waiting for sign-off, active or failed. The readiness screen reads those rows, so what it shows is the real progress in each environment. When a release fails onboarding, readiness shows the step it failed at ([runbook](../sops.md#a-release-failed-onboarding)).

## Pause, resume and rollback

- Pause stops a live market's dispatchers, through the environment's Market Onboarding API. The market's due work waits in Oracle, and nothing about its config changes.
- Resume starts them again, and the waiting work is picked up at the governor's pace.
- Rollback switches the market back to its previous version, with that version's Schedules and settings. New payments use the previous version, and payments already running keep the version pinned in their plan key.

To slow one kind of work rather than stop a market, use a rate override instead ([Dispatch Controls](./dispatch-controls.md)).
