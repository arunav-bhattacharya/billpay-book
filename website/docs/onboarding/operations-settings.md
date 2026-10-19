---
title: Operations Settings
description: 'The Operations step in billpay-ui sets how a market runs from day to day. Each setting drives something specific at runtime.'
sidebar_label: Operations Settings
---

import Lead from '@site/src/components/Lead';

# Operations Settings

<Lead>The Operations step in billpay-ui sets how a market runs from day to day: when its payments execute, how long a customer can cancel, and how hard Billpay should push to meet a cutoff. Each setting drives something specific at runtime.</Lead>

None of these settings is a code change. They travel in the market's release like the rest of its profile, and they take effect when that release is activated.

| Setting | Used by | What it controls |
| --- | --- | --- |
| Time zone and execution time | The scheduled-payments dispatcher's Schedule | When the market's due payments start executing. The Schedule takes the market's time zone, so the execution time holds across daylight saving. The US runs at 00:01 on Phoenix time (MST), which has no daylight saving |
| Cancellation window | Cancel and update | How long a customer can still change or cancel a scheduled payment. By default it closes an hour before the run, at 11 PM local time, in every market. A late request gets 409. A corporate payment closes sooner if its allocations are requested first |
| Cutoff, if any | The governor's cutoff floor and alert | The time the market's execution must finish by. SEPA markets have a cutoff of three to four hours; the US has none |
| Allocation fetch timing and alert point | The `ALLOC_REQUEST` due time, and the late-allocation alert | When to ask for a scheduled corporate payment's allocations (on the due date, or a set number of hours or days before it), and when to raise an alert if they haven't arrived. The request also ends cancel and update for that payment |
| Representment rules | The return workflow's judgment, and the representment date | Which return reasons can be presented again, how many times a payment can be represented, and when: today or later |
| Raven notifications | Every stage's announcement | Which status changes send the customer a Raven message. By default `SCHEDULED`, `DECLINED`, `CANCELLED`, `PROCESSED` and `RETURNED`. A market can change the default, and an account type can change its market's. Where both have a setting, the account type's wins. A status that is switched off sends no message, and Fulfil then waits for RTF alone |
| Bank confirmation: provider and confirmation window | RequestConfirmation, and the waiting workflow's timer | Which provider sends the customer to confirm their bank details, such as Plaid in the US or Pay with Bank Transfer in the UK, and how long the customer has to come back. A provider's link lasts about 10 minutes for now, so the window is at most 10 minutes. A payment still `PENDING` once the window and a short grace have passed is cancelled by its own workflow, and a late confirm gets 409. The same window is how long a customer has to give the go-ahead for a payment made while another was pending, which product is still to confirm |
| Go-ahead for pending payments | The Router | Whether a new payment made while another on the account is pending waits for the customer's yes. It is off by default: One-Data still sends the pending payments' IDs, and the Router ignores them. With it on, the payment waits in `CreatePaymentIntentWorkflow` for the confirmation window above |
| Verification rule settings | The verification rules in Verify, Reverify and Represent | The limits the rules check a payment against, such as the largest payment the market takes and the instrument types it accepts. The Router passes them to the workflow in the plan key, so a payment keeps the values it started with |
| Expected volumes | The governor's floors and budgets | How much execution work to plan for |
| BOTH rules, per behavior | The Router | Which journeys get Y for a behavior set to BOTH; for bank confirmation, which payment methods |

## Why some of these matter more than they look

The cancellation window and the execution time have to agree. The window must close before the dispatcher starts executing, so a cancel and an execution never race for the same payment. If they ever did, the guarded update would still let only one win, but the customer would see a 409 they didn't expect.

The cutoff decides how the governor treats a market. A SEPA market with a three-hour cutoff gets a floor rate, the remaining payments divided by the time left minus 30 minutes, so its run aims to finish half an hour before the cutoff. Online traffic usually comes first: if online response times or the shared Oracle degrade, every offline class is cut. A SEPA run is the exception. Online response times never cut it below its floor, and if online traffic would take too much of a downstream, online calls to it are capped until the cutoff ([When the cutoff wins](../design/throttling.md#when-the-cutoff-wins)). Oracle trouble still cuts the run, and the cutoff alert fires when it falls behind. The US has no cutoff, and its execution gets a fixed floor of 50 TPS instead. The [governor](../design/pacing.md#the-governor) explains how the floors are handed out.

Raven messages are the one setting with two levels. A market can change the default list, and an account type can change its market's. The two disagree when billpay-ui holds both: if the US turns the `SCHEDULED` message off for the whole market and US Corporate turns it back on, a US corporate payment follows US Corporate, because the account type's setting wins. A US consumer payment follows the market's setting, since US Consumer has none of its own.

Daylight saving deserves a test of its own: run the market's Schedules through both transition weekends before it goes live. The US needs no such test, since Phoenix time doesn't change. Execution runs every day, holidays included, so no market keeps a holiday calendar.
