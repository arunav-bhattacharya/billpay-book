---
id: overview
title: Architecture Overview
sidebar_position: 1
---

# Architecture Overview

Billpay is layered so each tier has **one responsibility** and can evolve
independently. A request flows top-to-bottom through these layers — and async
events loop back through the Event Handlers on the right.

<div className="bp-arch">

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">01</span>
      <div>
        <h4>Clients & Upstream</h4>
        <p>Origin of every request and async event</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Channels / UI</span>
      <span className="bp-arch__item">Batch Gateway</span>
      <span className="bp-arch__item">RTF</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer bp-arch__layer--accent">
    <div className="bp-arch__head">
      <span className="bp-arch__num">02</span>
      <div>
        <h4>One-Data Functions</h4>
        <p>Versioned, contract-level entrypoints</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">CreatePayment.v3</span>
      <span className="bp-arch__item">UpdatePayment.v1</span>
      <span className="bp-arch__item">DeletePayment.v1</span>
      <span className="bp-arch__item">ReadPayments.v1</span>
      <span className="bp-arch__item">CreateCreditBalanceRefund.v1</span>
      <span className="bp-arch__item">CreatePaymentInstallment.v1</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">03</span>
      <div>
        <h4>Billpay Core APIs</h4>
        <p>REST surface — request shaping, idempotency</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item bp-arch__item--code">POST /payments</span>
      <span className="bp-arch__item bp-arch__item--code">PUT /payments/:id</span>
      <span className="bp-arch__item bp-arch__item--code">DELETE /payments/:id</span>
      <span className="bp-arch__item bp-arch__item--code">POST /payments/returns</span>
      <span className="bp-arch__item bp-arch__item--code">POST /payments/inbound</span>
      <span className="bp-arch__item bp-arch__item--code">POST /refunds</span>
      <span className="bp-arch__item bp-arch__item--code">GET /payments/:id</span>
      <span className="bp-arch__item bp-arch__item--code">POST /paymentInstallments</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer bp-arch__layer--accent">
    <div className="bp-arch__head">
      <span className="bp-arch__num">04</span>
      <div>
        <h4>Billpay Router</h4>
        <p>Chooses the workflow · mints the workflow-key</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">date routing</span>
      <span className="bp-arch__item">single / multi instruction</span>
      <span className="bp-arch__item">Consumer / Corporate</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">05</span>
      <div>
        <h4>Temporal Workflows</h4>
        <p>Durable orchestration · realtime + batch + scheduled</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Realtime Worker</span>
      <span className="bp-arch__item">Batch Worker</span>
      <span className="bp-arch__item">Scheduled (Temporal Schedules)</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer bp-arch__layer--accent">
    <div className="bp-arch__head">
      <span className="bp-arch__num">06</span>
      <div>
        <h4>Payment Services</h4>
        <p>Business-rule units · compose activities · own activity options</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Validation</span>
      <span className="bp-arch__item">State transitions</span>
      <span className="bp-arch__item">Clearing · Posting · Fulfillment</span>
      <span className="bp-arch__item">Notifications</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">07</span>
      <div>
        <h4>Temporal Activities</h4>
        <p>Reusable I/O units · invoked by services with per-call options</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Clearing call</span>
      <span className="bp-arch__item">AR decrement</span>
      <span className="bp-arch__item">OTB increase</span>
      <span className="bp-arch__item">Lifecycle write / publish</span>
      <span className="bp-arch__item">Notification dispatch</span>
    </div>
  </div>

  <div className="bp-arch__arrow" aria-hidden="true"></div>

  <div className="bp-arch__layer">
    <div className="bp-arch__head">
      <span className="bp-arch__num">08</span>
      <div>
        <h4>External Systems</h4>
        <p>Side-effect destinations</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Clearing</span>
      <span className="bp-arch__item">Accounts Receivable</span>
      <span className="bp-arch__item">Authorization · OTB</span>
      <span className="bp-arch__item">Accounting</span>
      <span className="bp-arch__item">Balance & Control</span>
      <span className="bp-arch__item">Communications</span>
      <span className="bp-arch__item">GPA · Allocations</span>
    </div>
  </div>

</div>

<div className="bp-arch__side">
  <div className="bp-arch__side-label">async events loop back through</div>
  <div className="bp-arch__layer bp-arch__layer--side">
    <div className="bp-arch__head">
      <span className="bp-arch__num bp-arch__num--side">⤴</span>
      <div>
        <h4>Event Handlers</h4>
        <p>One-Data functions that consume async events</p>
      </div>
    </div>
    <div className="bp-arch__items">
      <span className="bp-arch__item">Money Movement</span>
      <span className="bp-arch__item">Posted Payment</span>
      <span className="bp-arch__item">OTB Update</span>
      <span className="bp-arch__item">Unstructured Payment</span>
    </div>
  </div>
</div>

## Layer responsibilities

### 1. One-Data Functions
The **contract-level** layer that external callers integrate with. These
functions are versioned and stable. Internally they delegate to the Billpay
Core APIs.

### 2. Billpay Core APIs
REST endpoints owned by the Billpay service. They perform request shaping,
permission/idempotency checks, and hand off to the Router.

### 3. Billpay Router
A thin orchestrator that decides **which workflow to invoke** based on:

- The payment date (current → immediate; future → scheduled)
- Single vs. multiple instructions (composite payment)
- The kind of request (create, update, cancel, return, inbound)

It also **mints the workflow key** used for Temporal idempotency.

### 4. Temporal Workflows
The durable orchestration engine. Two worker types:

| Worker | Purpose | Examples |
| --- | --- | --- |
| **Realtime** | Triggered by an end-user request that awaits a response | `#CreateImmediatePaymentWF`, `#UpdatePaymentWF`, `#CancelPaymentWF` |
| **Batch** | Triggered asynchronously by events or schedules | `#ExecuteScheduledPaymentWF`, `#ProcessReturnedPaymentWF`, `#ProcessInboundPaymentWF` |

Workflows call **Payment Services**; the services in turn compose **Temporal Activities**. Workflows themselves never invoke activities directly.

### 5. Payment Services
The **business-rule units**. A service does exactly one job — validate, transition state, call clearing, fulfill, notify — and is pluggable per **source**, **account-type** or **market**. Each service **composes one or more Temporal Activities** and **owns the activity options** (timeouts, retry policy) it passes down to each call. See the [Payment Services reference](../design/services.md) for the full list.

### 6. Temporal Activities
The **reusable I/O units**. Activities are where real-world side-effects happen — calls to clearing, AR, OTB, DB writes, lifecycle event publishes, outbound notifications. The same activity is reused across multiple services; each invoking service decides the `ActivityOptions` for its call. Activities do not call other activities and do not own their own retry / timeout defaults. See [Build › Core Build › Temporal Activities](../build/principles/core-build/temporal-activities.md).

### 7. Event Handlers
Event-driven One-Data functions that bridge external systems back into
Billpay's workflows or its `External Transaction Events Tracker`. They turn
async events into either workflow triggers or state-transition records.

### 8. Schedules
Temporal Schedules that fire batch workflows in waves (e.g. 2,500 scheduled
payments / minute), plus reconciliation jobs that close out partial-event
scenarios.

## Persistence model

Billpay's state lives in a small set of Oracle tables. Each one has a focused job:

| Table | What it holds |
| --- | --- |
| **`trans_dtl`** | The **current state** of each payment — one row per payment, mutated as the workflow advances. |
| **`trans_lfcyc_event`** | **Append-only** lifecycle event log — every state transition for every payment, in order. The audit trail. |
| **`split_trans_dtl` + `split_trans_lfcyc_event`** | The same pair as above, but at the **split-instruction** level — for payments broken into multiple legs (e.g. corporate allocations). |
| **`card_acct`** | **Account-details repository** — cached card-account metadata Billpay needs to make routing and validation decisions without round-tripping to the system of record on every request. |
| **`idempotency_checker`** | Guards **duplicate requests at the API boundary** — first-write wins, retries are rejected with the original outcome. |
| **`notification_tracker`** | Durable record of **every external notification we owe** — outbound webhooks, lifecycle event publishes — with retry state. |
| **`orig_trans_refer_map`** | Maps a **replacement payment back to the original** — used by `#UpdatePaymentWF` to preserve the audit chain when a scheduled payment is replaced. |
| **`external_trans_events_tracker`** | Tracks **Clearing/Settlement** and **AR-Posted** events for each payment so the **Paid Events Processor** can close it out once both have arrived. |
| **`trans_exec_queue`** | The **scheduler work queue** — payments that are due to be picked up and executed by a batch worker (e.g. scheduled payments at their fire time). |
| **`trans_exec_context`** | The **execution context** that schedulers attach to each queued transaction — payload and resume state the batch workflow needs to pick up where the realtime side left off. |

The hot path (`trans_dtl`, `trans_lfcyc_event`, `idempotency_checker`) is what every API request touches. The reconciliation path (`external_trans_events_tracker`, `notification_tracker`) is what schedulers and event handlers churn through. The scheduler path (`trans_exec_queue` + `trans_exec_context`) is the boundary between realtime intake and batch execution.

## Why Temporal

Billpay is intentionally **Temporal-first**, not "Temporal happens to be the queue we picked." The choice is load-bearing — the architecture above assumes Temporal's guarantees at every layer.

**Scale of orchestration.** A single payment can fan out into a chain of 20+ activities: idempotency check, validation, account lookup, OTB hold, clearing, settlement, posting, notification, lifecycle publish, reconciliation. Multiply that by every market's variant (consumer vs. corporate, pull vs. push, immediate vs. scheduled vs. recurring) and you have hundreds of distinct orchestrations, each with its own retry, timeout and compensation needs. Hand-rolling that on top of a message bus would mean reinventing — badly — what Temporal already provides.

**Durability without ceremony.** Money movement must not lose state across restarts, deploys, downstream outages, or human cancellation. Temporal's event-history model gives this for free: every workflow can be **replayed** from history to a deterministic state. We don't write our own checkpoint tables; we don't reconstruct sagas from logs.

**Long-running flows are first-class.** A scheduled payment six months out is *just a workflow that's sleeping* — no `cron + DB poll` glue, no "did we miss it?" reconciliation job for that case. A recurring autopay is the same workflow that loops on a timer. Temporal makes the wall-clock a primitive.

**Native retries, timers, signals, queries.** Downstream APIs flap. Clearing networks are batch. Customer-service tools need to signal cancellations into in-flight workflows. Operators need to ask "what state is this payment in right now?" from a UI. All four are Temporal primitives, not features we have to build.

**Operability.** The Temporal Web UI gives operations a single surface to find any payment, see its full event history, replay it, signal it, cancel it. Without Temporal we would need to build that surface ourselves — across every workflow we own.

**Boundaries we accept in return.** Temporal demands **deterministic workflow code** (no `now()`, no random, no direct I/O — everything non-deterministic goes through an activity). That discipline shapes how we factor code: workflows orchestrate, services do the work. It is a constraint we lean into, because it is also what gives us replay safety.

Move to [Components](components.md) for a deeper look at each block, or jump
straight to the [State Model](../design/payment-state-model.md) to see how a payment evolves.
