---
title: Market Profile
description: 'A market profile is one market and one account type: the APIs it takes, and five answers about how its payments behave.'
sidebar_label: Market Profile
---

import Lead from '@site/src/components/Lead';

# Market Profile

<Lead>A market profile is one market and one account type: the APIs it takes, and five answers about how its payments behave. Those answers decide which stage implementations its payments run, so the same workflow code serves every market.</Lead>

Consumer accounts and corporate accounts in the same market are two profiles, because they behave differently: a corporate payment's legs come from allocations that arrive later by callback, while a consumer split writes its legs with the payment itself. Each profile is authored, released and switched on separately.

## The APIs it takes

Onboarding picks which Billpay APIs the profile accepts: paying today, scheduling, updates and cancels, refunds and so on. A request for an API, or a combination of behaviors, that the market hasn't onboarded is turned away with 422 by the Router's admit step, before any workflow starts. Senders don't retry a 422.

## The five behaviors

These are the payment dimensions. Every stage that varies between markets varies by one or more of them.

| Behavior | Values | What it decides |
| --- | --- | --- |
| `accountType` | `CONSUMER`, `CORPORATE`, `BUSINESS_TRAVEL` | Who is paying, which shapes everything from splits to allocations |
| `requiresArPosting` | Y, N or BOTH | Whether the processed payment is posted to Accounts Receivable |
| `requiresRealtimeClearing` | Y, N or BOTH | Whether clearing is realtime or batch |
| `requiresMandateAuthorization` | Y, N or BOTH | Whether the payment's mandate is checked, with its details from Plans, at Verify and again at Reverify on the due date. A mandate that fails its check declines the payment |
| `requiresBankConfirmation` | Y, N or BOTH | Whether the customer confirms their bank details on the market's provider's site, such as Plaid in the US or Pay with Bank Transfer in the UK, before the payment is processed |

## BOTH, resolved per journey

BOTH means a behavior applies to some journeys and not others. Onboarding stores which journeys get Y, and the Router turns BOTH into Y or N for each request, before it pins the plan key. A running payment never sees BOTH; it sees the answer for its own journey.

Realtime clearing shows how this works. Only a pay-today payment from a channel gets Y. Every future-dated payment clears in batch, whether it came from a channel or from Accounts Receivable.

Bank confirmation is resolved by how the customer pays rather than by the journey. Set to BOTH, it is Y for a payment method that needs the customer to confirm at their bank, and N for the rest. Only consumer payments made today take bank confirmation, and only one payment at a time: a request with several instructions, or a Pay & Plan request, that would need it gets 422.

## What the build can run

Each combination of behaviors needs stage implementations that handle it. Every stage has a default, but a default can't handle everything: the default Verify doesn't check a mandate, so a combination with mandate authorization runs only once a Verify that does is in the build. The build lists the combinations it can run in its **capability manifest**, which the provisioning API returns from `GET /provisioning/capabilities`. The manifest comes from the same compile-time index the workflows use to look up their stages, so the two can't disagree.

- A profile built only from combinations in the manifest goes live with config alone, no deploy needed.
- A new combination is flagged as needing a build while it is being authored, so the gap shows up early.
- If a release still reaches an environment without the build it needs, provisioning stops at its first step, the check against the manifest, until that build is deployed.

Whether a return can be represented isn't one of these behaviors. It is a market rule, set with the market's other representment rules in its [operations settings](./operations-settings.md): which return reasons can be represented, and how many times a payment can be.
