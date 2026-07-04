---
title: Composite Workflows
sidebar_label: Composite
---

import Lead from '@site/src/components/Lead';
import WorkflowMeta from '@site/src/components/WorkflowMeta';

# Composite Workflows

<Lead>Composite workflows wrap one or more core workflows and add logic that spans domains. They run on the Online worker and take their dimensions from the create workflow they wrap.</Lead>

## Create Payment & Installments

<WorkflowMeta worker="Online" dimensions="generic" />

Combines a one-time payment with an installment plan, so the customer pays now and sets up a plan in the same request.

1. Run Create Immediate Payment for the payment itself.
2. If the payment is accepted, call the Installments API to set up the plan.
3. Optionally update autopay, if the request asked for it.
4. If the inner payment is declined, the composite stops here — no plan is created, and autopay is left unchanged.

## Create Payment with Multiple Instructions

<WorkflowMeta worker="Online" dimensions="generic" />

Handles a request that carries several payment instructions at once — for example, paying more than one account in a single call.

1. Validate the composite request as a whole.
2. Run a separate Create Immediate Payment for each instruction, so each one gets its own payment, its own lifecycle, and its own outcome.
