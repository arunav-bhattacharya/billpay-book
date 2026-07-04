---
id: event-handlers
title: Event Handlers
sidebar_position: 4
---

# Event Handlers

Event handlers are **One-Data functions implemented as event consumers**. They
bridge external systems into Billpay's workflows or its
`External Transaction Events Tracker`.

| Handler | Listens to | Effect |
| --- | --- | --- |
| **Money Movement Event Handler** | MR / M3 events | If return → trigger `#ProcessReturnedPaymentWF`; if settled → insert into `External Transaction Events Tracker` |
| **Posted Payment Event Handler** | GAR posted events | Look up the payment; insert into `External Transaction Events Tracker` |
| **Open-To-Buy Update Event Handler** *(TBD)* | AMP events | Insert into `External Transaction Events Tracker` |
| **Unstructured Payment Event Handler** | Batch Gateway events | Enrich the payload; invoke `POST /payments` on Billpay Core |

## Money Movement Event Handler

```mermaid
flowchart LR
  MR["MR / M3<br/>events"] --> H["Money Movement<br/>Handler"]
  H -- return --> RT["POST /payments/returns<br/>→ #ProcessReturned<br/>PaymentWF"]
  H -- settled --> T["Insert into<br/>External Transaction<br/>Events Tracker"]
  T -. "waits for<br/>AR-Posted" .-> PEP["#PaidEvents<br/>ProcessingWF"]

  classDef source fill:#e5e7eb,stroke:#4b5563,stroke-width:1.5px,color:#111827;
  classDef handler fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
  classDef workflow fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;
  classDef store fill:#ede9fe,stroke:#7c3aed,stroke-width:1.5px,color:#4c1d95;

  class MR source;
  class H handler;
  class RT,PEP workflow;
  class T store;
```

## Posted Payment Event Handler

```mermaid
flowchart LR
  GAR["GAR posted<br/>events"] --> H["Posted Payment<br/>Handler"]
  H --> L["Lookup<br/>payment"]
  L --> T["Insert into<br/>External Transaction<br/>Events Tracker"]
  T -. "waits for<br/>Settlement" .-> PEP["#PaidEvents<br/>ProcessingWF"]

  classDef source fill:#e5e7eb,stroke:#4b5563,stroke-width:1.5px,color:#111827;
  classDef handler fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
  classDef step fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#7c2d12;
  classDef workflow fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;
  classDef store fill:#ede9fe,stroke:#7c3aed,stroke-width:1.5px,color:#4c1d95;

  class GAR source;
  class H handler;
  class L step;
  class T store;
  class PEP workflow;
```

## Open-To-Buy Update Handler *(TBD)*

```mermaid
flowchart LR
  AMP["AMP<br/>events"] --> H["OTB<br/>Handler"]
  H --> T["Insert into<br/>External Transaction<br/>Events Tracker"]

  classDef source fill:#e5e7eb,stroke:#4b5563,stroke-width:1.5px,color:#111827;
  classDef handler fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
  classDef store fill:#ede9fe,stroke:#7c3aed,stroke-width:1.5px,color:#4c1d95;

  class AMP source;
  class H handler;
  class T store;
```

The behaviour is still being finalised — the source spec marks this **TBD**.

## Unstructured Payment Event Handler

```mermaid
flowchart LR
  BG["Batch Gateway<br/>events"] --> H["Unstructured<br/>Payment Handler"]
  H --> E["Enrich<br/>payload"]
  E --> POST["Billpay Core<br/>POST /payments"]
  POST --> WF["Standard<br/>Create-Payment<br/>workflows"]

  classDef source fill:#e5e7eb,stroke:#4b5563,stroke-width:1.5px,color:#111827;
  classDef handler fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
  classDef step fill:#fff7ed,stroke:#ea580c,stroke-width:1.5px,color:#7c2d12;
  classDef workflow fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;

  class BG source;
  class H handler;
  class E,POST step;
  class WF workflow;
```

The handler is **the bridge** between low-fidelity, upstream events and the
fully-validated Billpay payment lifecycle. Once it has invoked
`POST /payments`, the request follows the same code path as any inbound
API call.
