---
title: Market Profile
description: 'A market profile is one market and one account type: the APIs it takes, and five answers about how its payments behave.'
sidebar_label: Market Profile
---

import Lead from '@site/src/components/Lead';

# Market Profile

<Lead>A market profile is one market and one account type: the APIs it takes, and five answers about how its payments behave. Those answers decide what each step of its payments does, so the same workflow code serves every market.</Lead>

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

BOTH means a behavior applies to some journeys and not others. Onboarding stores which journeys get Y, and the Router turns BOTH into Y or N for each request, before it pins the resolved profile. A running payment never sees BOTH; it sees the answer for its own journey.

Realtime clearing shows how this works. Only a pay-today payment from a channel gets Y. Every future-dated payment clears in batch, whether it came from a channel or from Accounts Receivable.

Bank confirmation is resolved by how the customer pays rather than by the journey. Set to BOTH, it is Y for a payment method that needs the customer to confirm at their bank, and N for the rest. Only consumer payments made today take bank confirmation, and only one payment at a time: a request with several instructions, or a Pay & Plan request, that would need it gets 422.

A debit card's 3D Secure is not one of the five behaviors, because there is nothing to choose: every debit card needs it. The Router sets card authentication to Y for a debit card payment, and the stages pick their classes from it as from a behavior (Proposed). What a market does choose is whether it takes debit cards at all, through the instrument types in its rule settings, and which card provider runs 3D Secure and the authorization, in its operations settings. A debit card pays today only, with one instruction and no MR Points.

## What the customer is offered

The profile also decides what a channel's payment page shows. Before the customer pays, the channel calls `ReadPaymentChoices.v1` (Proposed), which reads this profile's active release and returns:

| The page shows | The profile holds it as |
| --- | --- |
| The ways to pay | The instrument types in the verification rule settings |
| Which of them send the customer to their bank first | `requiresBankConfirmation`, and its BOTH rule for payment methods |
| That a debit card goes through 3D Secure | Nothing: every debit card does. The card provider is an operations setting |
| Today, or a later date up to the horizon | The scheduling horizon, 30 days by default (Proposed) |
| How late a scheduled payment can be changed | The cancellation window |
| The largest payment | The verification rule settings |
| Pay & Plan | Whether the profile takes `CreatePaymentInstallment.v1` |
| Pay with MR Points | The Pay with MR Points setting (Proposed) |

The read only guides the page. The Router and Verify check the payment against the release that is active when it arrives, so a release that goes live while the customer is on the page can't let through a payment it refuses. [Make a Payment Journey](../design/journeys/make-a-payment.md) shows the page and the calls behind it.

## What the build can run

Each combination of behaviors needs classes in the build that handle it. Verify, for example, handles mandate authorization with `MandateCheck`, so a combination with mandate authorization runs only once that check is in the build. The build lists the combinations it can run in its **capability manifest**, which the Market Onboarding API returns from `GET /market-onboarding/capabilities`. The manifest comes from the same lookup the workflows use to find their stages, so the two can't disagree.

- A profile built only from combinations in the manifest goes live with config alone, no deploy needed.
- A new combination is flagged as needing a build while it is being authored, so the gap shows up early.
- If a release still reaches an environment without the build it needs, the onboarding workflow stops at its first step, the check against the manifest, until that build is deployed.
- The other way round, a build can't take away what a live market uses. Before a build rolls out to an environment, the [deploy pipeline](../deployment/pipeline.md#the-capability-manifest) checks its manifest against every release live there, and stops a build that no longer covers one.

Whether a return can be represented isn't one of these behaviors. It is a market rule, set with the market's other representment rules in its [operations settings](./operations-settings.md): which return reasons can be represented, and how many times a payment can be.
