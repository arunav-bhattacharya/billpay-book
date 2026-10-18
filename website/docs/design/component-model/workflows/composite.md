---
title: Composite Workflows
description: 'A composite workflow is a parent that runs core workflows as children, sometimes across domains.'
sidebar_label: Composite
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Composite Workflows

<Lead>A composite workflow is a parent that runs core workflows as children, sometimes across domains. Composites start on the Online cluster with Update-With-Start, and their children always run on the same cluster.</Lead>

A composite exists because the customer asked for one thing. Paying now and setting up a plan, or paying with several instructions at once, is one request to them, so it gets one answer and one workflow that owns it. Pay with MR Points, which spans Billpay and Loyalty, is the third composite the design names; its steps are still to be described.

## Create Payment & Installments

<WorkflowMeta cluster="Online" id="{paymentId}-init" start="Update-With-Start, from POST /payment-installments" />

Pay & Plan combines a payment today with a plan of future installments, across Billpay and GAR. It runs three steps in order:

1. `CreateImmediatePaymentWorkflow` as a child, for the payment itself.
2. The Installments API, to set up the plan.
3. An optional update to the customer's Autopay.

Pay & Plan never takes bank confirmation. A request that would need it gets 422 before any workflow starts.

## Create Payment with Multiple Instructions

<WorkflowMeta cluster="Online" id="{paymentId}-init" start="Update-With-Start, from POST /payments with several instructions" />

`CreatePaymentWithMultipleInstructionsWorkflow` handles one request that carries several payment instructions.

1. Validate the composite payment as a whole.
2. Run one `CreateImmediatePaymentWorkflow` per instruction, so each gets its own payment, its own lifecycle and its own outcome.

It never takes bank confirmation, because one request would need several redirect links and several confirms. A request with several instructions that would need it gets 422 before any workflow starts.
