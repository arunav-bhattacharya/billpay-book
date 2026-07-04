---
title: Composite Workflows
sidebar_label: Composite
---

import Lead from '@site/src/components/Lead';

# Composite Workflows

<Lead>Composite workflows wrap one or more core workflows and add logic that spans domains. They run on the Online worker.</Lead>

## Create Payment & Installments

Runs `#CreateImmediatePaymentWF`, calls the Installments API to set up the plan, and optionally updates autopay.

## Create Payment with Multiple Instructions — `#CreatePaymentWithMultipleInstructionsWF`

Validates the composite request, then runs a separate `#CreateImmediatePaymentWF` for each instruction.
