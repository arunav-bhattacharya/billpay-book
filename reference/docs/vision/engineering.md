---
title: Engineering
sidebar_position: 2
---

# Engineering Vision

BillPay is a **Temporal-orchestrated, configuration-driven platform** focused on simplifying payment execution through consistent workflows across channels and markets. The engineering vision is to build resilient, scalable, and market-extensible orchestration that is fault-tolerant, self-healing, operationally observable, and easy to evolve as business and regulatory needs change.

## Core Engineering Principles

- **Workflows drive orchestration; activities encapsulate market variation.** Each payment lifecycle — immediate, scheduled, recurring, pull, or push — is modeled as a Temporal Workflow defining the canonical execution path. Market, product, channel, and payment-method specific behavior is implemented through service activities, enabling extensibility without duplicating workflow logic.
- **Resilient and durable by design.** Payment processing must remain reliable under failures and long-running execution scenarios. Temporal provides durable workflow state, replay-safe execution, retries, timers, signals, and recovery semantics as native platform capabilities.
- **A single canonical payment lifecycle.** All payments progress through a standardized lifecycle model (for example: `PENDING`, `ACCEPTED`, `PROCESSED`, `PAID`, `RETURNED`, `CANCELLED`). This creates consistency across channels, operations, reporting, and downstream integrations.
- **Stable, versioned platform contracts.** Platform entry points and APIs are contract-versioned to allow internal evolution without disrupting upstream channels or consumers.
- **Configuration-driven market enablement.** Market-specific behavior — including cutoffs, retry policies, settlement windows, and regulatory rules — is externalized into runtime configuration, enabling faster adaptation without deployment-driven changes.
- **Realtime and event-driven by default.** The platform prioritizes event-driven, near real-time processing wherever supported by downstream systems and payment rails. Batch-only integrations are isolated behind orchestration boundaries to prevent downstream latency models from impacting the broader payment lifecycle.

## How we run

- **Realtime workers** drive immediate / API-triggered workflows.
- **Batch workers** handle high-volume corporate file flows.
- **Temporal Schedules** drive cron-style executors (settlement sweeps, retry sweeps, recurring-payment triggers).
- **Event handlers** abstracts away downstream domain-specific events and integration complexity, converting them into standardized payment signals that drive the appropriate workflow state transitions within BillPay.
- **One-Data Functions** sit at the edge as the gateway to channels.

## What we optimize for

| | |
| --- | --- |
| **Correctness** | Idempotency, deterministic workflows, replay tests. Wrong > slow. |
| **Latency** | Drive payments toward realtime by replacing batch-bound legacy integrations (balance, OTB, clearing) with event-driven paths; isolate any remaining batch hops so they don't taint the end-to-end flow. |
| **Observability** | Every payment must be traceable across One-Data → workflow → activity → downstream, within seconds, from a single surface. |
| **Change safety** | New markets, rules, methods land behind workflow versioning and configuration — not by editing live orchestrations. |
| **Operability** | Operators are first-class users. The platform is designed to be *operated*, not just deployed. |

## What we're explicitly NOT building

Mirroring the **out-of-scope** section of the [Product Vision](./product.md#out-of-scope), engineering decisions should reinforce clear platform boundaries and ownership responsibilities.

- **A general-purpose payments engine.** BillPay is focused on orchestrating customer bill payment lifecycles across Amex products and services. The platform is intentionally optimized for that domain rather than expanding into unrelated payment flows such as purchases, transfers, or payouts.
- **A custom workflow orchestration framework.** BillPay adopts Temporal's native orchestration patterns — workflows, activities, signals, queries, and schedules — instead of building proprietary orchestration layers or custom workflow engines.
- **A ledger or balance system of record.** BillPay integrates with enterprise systems that own account balances, Open-To-Buy, funding-source ledgers, and financial records. The platform orchestrates payment execution and lifecycle state, but does not own the authoritative financial source of truth.
- **A clearing or settlement network.** BillPay coordinates with existing payment and settlement networks to initiate and track payment execution while those systems continue to own the movement and settlement of funds.
- **A statementing or billing platform.** Billing cycles, statement generation, and customer account statementing remain within the systems that own those business capabilities.
- **A customer-facing channel experience.** BillPay provides orchestration and operational capabilities, while customer-facing experiences — including mobile, web, voice-assisted servicing, and partner integrations — remain owned by the respective channel platforms integrating with BillPay services and APIs.
