---
id: composite
title: Composite Workflows
sidebar_position: 2
---

# Composite Workflows

Composite workflows orchestrate **multiple core workflows together** so that a
single business intent (e.g. "create a payment and its installment plan") can
be expressed atomically.

All composite workflows run on the **Realtime Worker**.

## 1. Create Payment & Installments

Triggered by `POST /paymentInstallments`.

**Steps**

1. Execute child `#CreateImmediatePaymentWF`
2. Call the **Installments API** with the resulting payment-id
3. *(optional)* Call the **Update Autopay** API

```mermaid
flowchart LR
  CR["POST /paymentInstallments"] --> COMP["#CreatePaymentInstallment.v1<br/>(composite)"]
  COMP --> CIP["#CreateImmediate<br/>PaymentWF"]
  CIP --> INST["Installments API<br/>create plan"]
  INST --> AP{"autopay<br/>flag?"}
  AP -- Yes --> AUTO["Autopay API<br/>update"]
  AP -- No --> DONE["Return<br/>payment-id"]
  AUTO --> DONE

  classDef entry fill:#e5e7eb,stroke:#4b5563,stroke-width:1.5px,color:#111827;
  classDef workflow fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;
  classDef decision fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
  classDef ext fill:#ede9fe,stroke:#7c3aed,stroke-width:1.5px,color:#4c1d95;
  classDef terminal fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d;

  class CR entry;
  class COMP,CIP workflow;
  class AP decision;
  class INST,AUTO ext;
  class DONE terminal;
```

## 2. Create Payment with Multiple Instructions

Triggered when `POST /payments` carries **multiple instructions** in a single
request — for example, paying different amounts to several accounts in one shot.

**Steps**

1. Validate the composite payment as a whole
2. For each instruction → invoke a separate `#CreateImmediatePaymentWF`

```mermaid
flowchart LR
  CR["POST /payments<br/>with N instructions"] --> V["Validate<br/>composite payment"]
  V --> A["#CreateImmediate<br/>PaymentWF · #1"]
  V --> B["#CreateImmediate<br/>PaymentWF · #2"]
  V --> C["#CreateImmediate<br/>PaymentWF · #N"]

  classDef entry fill:#e5e7eb,stroke:#4b5563,stroke-width:1.5px,color:#111827;
  classDef step fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;
  classDef workflow fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;

  class CR entry;
  class V step;
  class A,B,C workflow;
```

Each child workflow runs independently — partial successes are surfaced back to
the caller per-instruction.
