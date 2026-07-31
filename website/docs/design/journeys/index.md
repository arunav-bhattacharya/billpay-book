---
title: Payment Journeys
sidebar_label: Journeys
---

import Lead from '@site/src/components/Lead';

# Payment Journeys

<Lead accent="var(--amex-cat-design)">Every journey through Billpay begins one of two ways. Either a customer asks for it, or an event somewhere else sets it off.</Lead>

## Customer initiated journeys

A cardmember pays a bill from the web, from the app, or by calling a servicing representative. There is a person on the other end waiting to hear back, so Billpay answers the moment it accepts the payment and finishes the work afterwards.

These are the [customer initiated](./customer-initiated.md) journeys: paying, scheduling, changing, cancelling, and looking a payment up.

## System initiated journeys

A bank sends money back. A third party pushes a payment in. A timer fires to close out settlement. Nobody is waiting on any of this, so it runs in the background, on its own schedule.

These are the [system initiated](./system-initiated.md) journeys.

## How to read the diagrams

The two kinds look different on the page before you read a word:

- A customer journey opens with a person and the Amex channels they came in through. Its early steps are marked as the customer waiting.
- A system journey opens with an event or a schedule instead, and no step is marked that way.
- The shaded region on a customer journey shows where the caller already has its answer and the rest runs unwatched. A system journey has no such region, because none of it is a request.

Both use the same diagram, so a step means the same thing on either page: what happens, which systems it calls, and the state the payment holds when it is done.
