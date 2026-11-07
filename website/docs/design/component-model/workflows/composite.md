---
title: Composite Workflows
description: 'A composite workflow is a parent that runs core workflows as children, sometimes across domains.'
sidebar_label: Composite
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Composite Workflows

<Lead>A composite workflow is a parent that runs core workflows as children, sometimes across domains. Composites start on the Online cluster with Update-With-Start, and their children always run on the same cluster.</Lead>

A composite exists because the customer asked for one thing. Paying now and setting up a plan, or paying with several instructions at once, is one request to them, so it gets one answer and one workflow that owns it. Pay with MR Points, which spans Billpay and Loyalty, is the third composite the design names, as `PayWithMrPointsWorkflow` (Proposed, 2026-11-07); its steps are still to be described.

## Create Payment & Installments

<WorkflowMeta cluster="Online" id="{paymentId}-init" start="Update-With-Start, from POST /payment-installments" />

Pay & Plan combines a payment today with a plan of future installments, across Billpay and GAR. Its workflow type is `PayAndPlanWorkflow` (Proposed, 2026-11-07). It runs three steps in order:

1. `CreateImmediatePaymentWorkflow` as a child, for the payment itself.
2. The Installments API, to set up the plan.
3. An optional update to the customer's Autopay.

Pay & Plan never takes bank confirmation or a debit card. A request that would need either gets 422 before any workflow starts.

## Create Payment with Multiple Instructions

<WorkflowMeta cluster="Online" id="{groupId}-init" start="Update-With-Start, from POST /payments with several instructions" />

`CreatePaymentWithMultipleInstructionsWorkflow` handles one request that carries several payment instructions. One-Data sends one payment ID for each instruction, so the request arrives with all of them (agreed 2026-11-07). The composite's own workflow ID is unique to it, and each instruction's child workflow takes that ID with a suffix (agreed 2026-11-07).

One-Data makes a group ID for the whole request, a ULID like the payment IDs, and sends it with the create and on every retry. One-Data passes every ID, and Billpay derives none (agreed 2026-11-07). The proposed form (Proposed): the composite is `{groupId}-init`, keeping the rule that every create workflow ends in `-init`. Each instruction's child is `{groupId}_{paymentId}-init`: the suffix is the instruction's own payment ID, joined with `_` the way split legs are. A redelivered create carries the same IDs, so Update-With-Start joins the running workflow instead of starting a second one. Each child sets `ParentPaymentId` to the group ID, as legs do, so one search finds the whole request, and the steps that come later, such as a return, still key on each payment's own ID.

```
Group ID, from One-Data:   01JVTC2M8K4Q7R1S5T9V3W6X0Y
Composite:                 01JVTC2M8K4Q7R1S5T9V3W6X0Y-init
Instruction 1:             01JVTC2M8K4Q7R1S5T9V3W6X0Y_01JVTBBGZQ1HEM0W7NRMM6MSQ1-init
Instruction 2:             01JVTC2M8K4Q7R1S5T9V3W6X0Y_01JVTBBGZQ1HEM0W7NRMM6MSQ2-init
```

Whether each instruction's row in Oracle stores the group ID is still open.

1. Validate the composite payment as a whole.
2. Run one `CreateImmediatePaymentWorkflow` per instruction, so each gets its own payment, its own lifecycle and its own outcome.

It never takes bank confirmation or a debit card, because one request would need several redirect links and several answers. A request with several instructions that would need either gets 422 before any workflow starts. To the customer, several instructions are a bank account and MR Points; a debit card doesn't combine with MR Points.
