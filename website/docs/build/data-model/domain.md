---
title: Domain Model
sidebar_label: Domain
---

import Lead from '@site/src/components/Lead';

# Domain Model

<Lead>The core domain concept is the **payment** — its lifecycle state, the dimensions that shape its processing, and, when it is split, the allocations it fans out into.</Lead>

A payment carries:

- its **lifecycle state** (`PENDING` → `ACCEPTED` → `PROCESSING` → `PROCESSED` → `PAID`, plus the return, representment, and terminal states) — see the [state model](../../design/payment-state-model.md);
- its **dimensions** (`accountType`, `requiresArPosting`, `requiresRealtimeClearing`, `requiresMandateAuthorization`), which must be set before processing begins;
- a **confirmation number**, preserved when a scheduled payment is updated — the replacement keeps the confirmation number while getting a new payment id;
- when split, its **allocations** — separate legs (split payments) that each carry their own state and roll up to the parent.

Every state change a payment or a split makes is recorded as a **lifecycle event**, giving an append-only history. The [Database Schema](./database.md) shows the tables these map to. Detailed entity attributes are defined by the API contracts and are still being finalised.
