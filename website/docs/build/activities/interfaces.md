---
title: Activity Interfaces
sidebar_label: Interfaces
---

import Lead from '@site/src/components/Lead';

# Activity Interfaces

<Lead>An activity is a Temporal `@ActivityInterface` — one retryable action, kept thin, delegating the protocol details to a client.</Lead>

Activities are shared across markets, so an activity is passed only the fields it needs, never the whole `Payment` object. Related activities are coordinated by an **ActivityGroup**, whose implementation is selected from the market's dimensions.

- **Activity** — `core/lib/activities/` (interface) + `impl/` (implementation); named `{Action}Activity` / `{Action}ActivityImpl`.
- **ActivityGroup** — `core/lib/activityGroups/` (shared) or `market/{market}/activityGroups/`; named `{Responsibility}ActivityGroup`.
- **Client** — `core/lib/clients/`; named `{System}Client`.

The full list — all 22 activities and activity groups, their state transitions, and which stage invokes each — is in [Design → ActivityGroups & Activities](../../design/activities.md). The method signatures come from the activity contracts and are not reproduced here.
