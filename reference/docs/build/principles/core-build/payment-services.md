---
title: Payment Services
sidebar_position: 2
---

# Payment Services

**Services are the variance.** Where [Temporal Workflows](./temporal-workflows.md) say *what must happen and in what order*, services say *how it happens here* — for this market, this account-type, this origination source.

A service has a single responsibility — validate, transition state, call clearing, fulfil, notify — and is selected at runtime from a pluggable set of implementations.

## Where the service sits

The layering is **Workflow → Service → Activity (one or more)**:

- A **Payment Service** encompasses **one or multiple [Temporal Activities](./temporal-activities.md)** that together accomplish the service's business operation. A simple service may map to a single activity; a richer service (e.g. `PaymentExecutionService` doing Clearing + AR + OTB in parallel) composes several.
- **Activity options are owned by the service layer.** Start-to-close timeout, schedule-to-close timeout, heartbeat interval, retry policy — all of these are *chosen by the service* when it invokes an activity, not defaulted at the activity-implementation level. This is what lets different services use the *same* activity with different SLAs (e.g. a fast realtime call vs. a long-running batch call).
- The service is the place where **business rule** + **activity orchestration** + **activity tuning** meet. Workflows do not see activities directly; activities do not see business rules. The service is the seam.

## Build-time rules

- **One interface per responsibility.** `PaymentValidationService`, `PaymentExecutionService`, `PaymentFulfillmentService`, … Each interface is a `:service-api` module, depended on by workflows. Implementations live in separate `:service-impl-<variant>` modules.
- **Implementations are pluggable.** A `ServiceResolver` selects the right implementation at runtime based on the dimensions documented in the [Payment Services Variance Reason column](../../../design/services.md) — `market`, `acct-type`, `frequency`, `payment-state`, `payment-method`, `workflow-type` or `api-identifier`, or any combination.
- **Generic vs. variant.** A service is either `Generic` (one implementation, everywhere) or pluggable on one-or-more variance axes. The variance axes are *fixed by the interface*; adding a new axis is a breaking change.
- **State transitions are paired.** Any service that changes state runs alongside `PaymentStateTransitionService` (or its split-level twin). This pairing is the contract that keeps `trans_dtl`, `trans_lfcyc_event`, and the lifecycle event stream in sync.
- **Idempotency in the activities the service composes.** Temporal *will* retry activities. A service must either pick idempotent activities, or be written so that re-invoking the service after a partial failure produces the same outcome.
- **Activity options live in the service, not in the activity.** When a service chooses to invoke an activity, it constructs the `ActivityOptions` (timeouts + retry policy) for that call. Different services calling the same activity will pass different options.

## Naming convention

`PaymentXxxService` — interface and implementations.
- `PaymentValidationService` (interface)
- `PaymentValidationServiceUKConsumerImpl` (implementation)
- `PaymentValidationServiceUSCorporateImpl` (implementation)

The variant suffix on impls is mechanical — it documents the variance axes the impl is selected on.

## Where new market work usually lands

Onboarding a new market = **writing new service implementations**, not editing workflows. If a workflow change is needed to onboard a market, that is a signal that the variance is being modelled at the wrong layer — push back and refactor the service interface first.

:::tip
Before adding a new service, check the [Payment Services reference](../../../design/services.md) — there are 22 services covering most of the lifecycle. The next-best move is often to add a new *implementation* of an existing service, not a new service.
:::
