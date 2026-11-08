---
title: Composite Workflows
description: 'A composite workflow makes the decision for a request the customer sees as one payment, then hands each payment''s Execute and Fulfil to a child.'
sidebar_label: Composite
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Composite Workflows

<Lead>A composite workflow makes the decision for a request the customer sees as one payment, then hands each payment's Execute and Fulfil to a child. Composites start on the Online cluster with Update-With-Start, and their children always run on the same cluster.</Lead>

A composite exists because the customer asked for one thing. Paying now and setting up a plan, or paying with several instructions at once, is one request to them, so it gets one answer and one workflow that owns it. Pay with MR Points, which spans Billpay and Loyalty, is the third composite the design names, as `PayWithMrPointsWorkflow` (Proposed, 2026-11-07), with the workflow ID `{paymentId}-points` (agreed 2026-11-07); its steps are still to be described.

## Why the composite decides

The caller waits for an answer, and the answer is Verify's decision. If each child made its own decision, the composite would hear it only when the child ended, after Execute and Fulfil. A workflow can't send an update to another workflow, and payment workflows take no signals, so there is no earlier way for a child to report back. The caller would mostly hear `PENDING` at 2.5 s and learn the outcome later.

So the composite runs Capture and Verify for each of its payments itself, replies with the decisions, and hands only Execute and Fulfil to its children (agreed 2026-11-07). Each child is `CreateImmediatePaymentWorkflow`, started with the composite's decision, so it skips Capture and Verify and goes straight to Execute and Fulfil (agreed 2026-11-07).

The composite also calls One-Data's delete for every payment it decides, a declined one included (agreed 2026-11-07). A declined instruction gets no child, so if the children called it, a declined instruction's pending entry would stay until One-Data's hourly sweep cleared it, which takes an entry only once it is 2 hours old, and the account couldn't pay again until then.

## Create Payment & Installments

<WorkflowMeta cluster="Online" id="{paymentId}-plan" start="Update-With-Start, from POST /payment-installments" />

Pay & Plan combines a payment today with a plan of future installments, across Billpay and GAR. Its workflow type is `PayAndPlanWorkflow` (Proposed, 2026-11-07), and it takes one instruction (Proposed, 2026-11-07).

1. Capture and Verify the payment.
2. For an `ACCEPTED` payment, call the Installments API to set up the plan, and make the optional update to the customer's Autopay. A declined payment gets no plan (Proposed).
3. Reply. The reply waits for the decision, the plan and the Autopay update, so the customer hears about all three at once (agreed 2026-11-07).
4. A child runs the payment's Execute and Fulfil, as `{paymentId}-init`.

The composite's ID ends in `-plan` so that the payment's own workflow keeps `{paymentId}-init`, the ID every payment's workflow has (agreed 2026-11-07). The Installments and Autopay calls are neither Execute's nor Fulfil's, so they run on the workflow's own queue, `online-wf`. They move to a `ds-*` queue once their owners set a rate limit (Proposed, 2026-11-07).

Pay & Plan never takes bank confirmation or a debit card. A request that would need either gets 422 before any workflow starts.

## Create Payment with Multiple Instructions

<WorkflowMeta cluster="Online" id="{groupId}-init" start="Update-With-Start, from POST /payments with several instructions" />

`CreatePaymentWithMultipleInstructionsWorkflow` handles one request that carries several payment instructions. For each instruction, One-Data sends a payment ID and an idempotency key of its own, so the request arrives with all of them (agreed 2026-11-07).

1. Capture each instruction with its own idempotency key, so each is its own payment with its own lifecycle and outcome.
2. Verify each instruction, then reply with every decision.
3. Start a child for each accepted instruction, to run its Execute and Fulfil, and call One-Data's delete for every instruction.

The request carries one payment option ID for the whole payment (agreed 2026-11-07). The composite checks it once, for all its instructions. If the option no longer holds, every instruction is declined with `PAYMENT_OPTION_INVALID`, after each has been captured, so the customer is told and One-Data's delete runs (Proposed, 2026-11-07).

It never takes bank confirmation or a debit card, because one request would need several redirect links and several answers. A request with several instructions that would need either gets 422 before any workflow starts. To the customer, several instructions are a bank account and MR Points; a debit card doesn't combine with MR Points.

### Workflow IDs and search

One-Data makes a group ID for the whole request, a ULID like the payment IDs, and sends it with the create and on every retry. One-Data passes every ID, and Billpay derives none (agreed 2026-11-07). The proposed form (Proposed): the composite is `{groupId}-init`, and each instruction's child is `{groupId}_{paymentId}-init`. The suffix is the instruction's own payment ID, joined with `_` the way split legs are. A redelivered create carries the same IDs, so Update-With-Start joins the running workflow instead of starting a second one.

```
Group ID, from One-Data:   01JVTC2M8K4Q7R1S5T9V3W6X0Y
Composite:                 01JVTC2M8K4Q7R1S5T9V3W6X0Y-init
Instruction 1:             01JVTC2M8K4Q7R1S5T9V3W6X0Y_01JVTBBGZQ1HEM0W7NRMM6MSQ1-init
Instruction 2:             01JVTC2M8K4Q7R1S5T9V3W6X0Y_01JVTBBGZQ1HEM0W7NRMM6MSQ2-init
```

The composite's `PaymentId` search attribute is the group ID, and each child sets `ParentPaymentId` to it, as legs do. So `PaymentId = groupId` finds the composite and `ParentPaymentId = groupId` finds its children (Proposed, 2026-11-07). The steps that come later, such as a return, still key on each payment's own ID.

Each instruction stays its own payment row in Oracle, and no row stores the group ID: it lives only in the workflow IDs and the search attributes (agreed 2026-11-07).
