# Billpay Wiki Spec

> This wiki covers billpay core APIs, event-handlers & workflows, generic activities, periodic processes for payments and refunds, along with defined lifecycle states

## Table of Contents

The core components in this Billpay Wiki Spec are -

1. [Billpay API Gateway - One Data Functions](#billpay-api-gateway---one-data-functions)
2. [Billpay APIs](#billpay-apis)
3. [Billpay Workflows (Temporal)](#billpay-workflows-temporal)
4. [Payment Lifecycle States](#payment-lifecycle-states)
5. [Market Onboarding & Payment Dimensions](#market-onboarding--payment-dimensions)
6. [Core Components in Workflows](#core-components-in-workflows)
7. [Workflow Logic](#workflow-logic)
8. [Activities & ActivityGroups](#activities--activitygroups)
9. [A Bird's Eye View](#overall-payments-view)
10. [Sequence Diagrams](#sequence-diagrams)
11. [State Diagrams](#state-diagrams)

---

## Billpay API Gateway - One Data Functions

### Core:

1. [CreatePayment.v3](<[[https://explorer.aexp.com/functions/CreatePayment.v3?method=post](https://explorer.aexp.com/functions/CreatePayment.v3?method=post)](https://explorer.aexp.com/functions/CreatePayment.v3?method=post](https://explorer.aexp.com/functions/CreatePayment.v3?method=post))>) - Create a immediate payment or schedule a payment in future
2. [UpdatePayment.v1](<[[https://explorer.aexp.com/functions/UpdatePayment.v1?method=post](https://explorer.aexp.com/functions/UpdatePayment.v1?method=post)](https://explorer.aexp.com/functions/UpdatePayment.v1?method=post](https://explorer.aexp.com/functions/UpdatePayment.v1?method=post))>) - Update an existing payment
3. [DeletePayment.v1](<[[https://explorer.aexp.com/functions/DeletePayment.v1?method=post](https://explorer.aexp.com/functions/DeletePayment.v1?method=post)](https://explorer.aexp.com/functions/DeletePayment.v1?method=post](https://explorer.aexp.com/functions/DeletePayment.v1?method=post))>) - Delete an existing payment
4. [ReadPayments.v1](<[[https://explorer.aexp.com/functions/ReadPayments.v1](https://explorer.aexp.com/functions/ReadPayments.v1)](https://explorer.aexp.com/functions/ReadPayments.v1](https://explorer.aexp.com/functions/ReadPayments.v1))>) - List payments for a given card account number
5. [ReadPaymentEventsById.v1](<[[https://explorer.aexp.com/functions/ReadPaymentEventsById.v1](https://explorer.aexp.com/functions/ReadPaymentEventsById.v1)](https://explorer.aexp.com/functions/ReadPaymentEventsById.v1](https://explorer.aexp.com/functions/ReadPaymentEventsById.v1))>) - List different lifecycle states of a payment for a given payment id
6. [CreateCreditBalanceRefund.v1](<[[https://explorer.aexp.com/functions/CreateCreditBalanceRefund.v1?method=post](https://explorer.aexp.com/functions/CreateCreditBalanceRefund.v1?method=post)](https://explorer.aexp.com/functions/CreateCreditBalanceRefund.v1?method=post](https://explorer.aexp.com/functions/CreateCreditBalanceRefund.v1?method=post))>) - Initiate a refund on the credit balance amount on a credit card account
7. `CreateInboundPayment.v1` - Process a push payment that is initiated by a Third Party
8. `CreatePaymentIntent.v1` - Initiate an intent to create a payment

### Composite:

1. [CreatePaymentInstallment.v1](<[[https://explorer.aexp.com/functions/CreatePaymentInstallment.v1](https://explorer.aexp.com/functions/CreatePaymentInstallment.v1)](https://explorer.aexp.com/functions/CreatePaymentInstallment.v1](https://explorer.aexp.com/functions/CreatePaymentInstallment.v1))>) - Create payment and future installments of payment
2. `CreateBillpayTransactionFromAccountsReceivable.v1` - Processes payment and refund requests that are initiated from Accounts Receivable Platform

### Event Handlers:

1. `MoneyMovementEventHandler.v1` - Accepts money movement events (MR/M3) and if returned payment then triggers Returned Payment Workflow, if Settled Event insert into External State Transition Events table
2. `AccountsReceivableTransactionEventHandler.v1` - Accepts Accounts Receivable (GAR) posted events, and other types of transaction events. When a posted payment event is sent it looks up for the corresponding payment, and makes an entry into an External State Transition Events table
3. `OpentoBuyUpdatePaymentEventHandler.v1` - Accepts AMP events, make an entry into External State Transition Events table - TBD

[^ Top](#table-of-contents)

---

## Billpay APIs

### Core:

1. `POST /payments` - Initiates a payment immediately or schedules in future
2. `PUT /payments/{payment-id}` - Updates a `SCHEDULED` payment
3. `DELETE /payment/{payment-id}` - Cancels a `SCHEDULED` or `ACCEPTED` payment from being processed.
4. `POST /payments/returns` - Processes a `RETURNED` payment
5. `POST /payments/inbound` - Processes a payment that is initiated or confirmed by a Third-Party
6. `POST /payments/intent` - Initiates an intent to make a payment which is only processed when customer's financial institution confirms it
7. `POST /refunds` - Initiates a refund process to send money back to the customer
8. `GET /payments/account/{account-id}` - List all payments for the given account
9. `GET /payments/{payment-id}` - Provides detail of a single payment

### Composite:

1. `POST /payment-installments` - Initiates a payment immediately and also creates a plan for future installments

[^ Top](#table-of-contents)

---

## Billpay Workflows (Temporal)

Even before we dive into the functionality of the Workflows we need to know how these workflows will get executed. Primarily there are only 2 different Temporal Workers in which these workflows can be executed -

- **Online Worker** - Workflows that are triggered by an end-user (customer, representative, etc) and awaits a response back from the workflow.
- **Offline Worker** - Workflows that are asynchronously triggered by events or other async systems like RTF, and there is no end-user directly awaiting on the execution of the workflow.

There are primarily 3 types of workflows based on functionality or how they are triggered -

- [[#Core Workflows]] - These are core Billpay business process workflows which are triggered as per incoming request, and can execute in either of _Online_ or _Offline_ worker depending upon which part of the customer journey the workflow is invoked (Real customer, batch process, etc).
- [[#Composite Workflows]] - These workflows encompasses one or more core workflows, and may have additional custom logic outside of the core workflows depending upon the business requirement and can span the orchestration across domains (eg - _Pay & Plan_ which is orchestrated across Billpay & GAR, _Pay With MR Points_ - Billpay & Loyalty, etc). Currently all the known composite workflows are executed on _Online_ worker.
- [[#Periodic Workflows]] - These workflows also manages core Billpay business processes, but they are triggered by a Scheduler (Temporal Schedules) on a _Offline_ worker.

### Core Workflows

> Can execute in either _Online_ or _Offline_ Worker

#### Online Worker:

1. Create Immediate Payment #CreateImmediatePaymentWF
2. Create Schedule Payment\* #CreateSchedulePaymentWF
3. Execute Split Payment\* #ExecuteSplitPaymentWF
4. Update Payment #UpdatePaymentWF
5. Cancel Payment #CancelPaymentWF
6. Create Payment Intent #CreatePaymentIntentWF
7. Create Balance Refund\* #CreateBalanceRefundWF

#### Offline Worker:

1. Create Schedule Payment\* #CreateSchedulePaymentWF
2. Execute Scheduled Payment #ExecuteScheduledPaymentWF
3. Execute Split Payment\* #ExecuteSplitPaymentWF
4. Process Inbound Payment #ProcessInboundPaymentWF
5. Process Returned Payment #ProcessReturnedPaymentWF
6. Process Representing Payment #ProcessRepresentmentWF
7. Get Corporate Payment Allocations #GetCorporatePaymentAllocationsWF
8. Create Balance Refund\* #CreateBalanceRefundWF

> `*` - _Workflows can execute in both Online and Offline Workers_

### Composite Workflows

#### Online Worker:

1. Create Payment & Installments
2. Create Payment with multiple instructions

### Periodic Workflows

#### Offline Worker:

1. Scheduled Payments Executor
2. Corporate Allocations Processor
3. Scheduled Representment Executor
4. Paid Events Processing
5. Missing Paid Events Processing
6. Data Purger

#### A Peek into Periodic Workflows (Temporal Schedules)

1. Scheduled Payments Executor (Triggers **\*Execute Scheduled Payment** Workflow\* in batches (eg: Schedule 2500 payments over next 1 min, pick-up next 2500 payments after 1 min))
2. Corporate Allocations Processor (Triggers **\*Execute Split Payment** Workflow\* in batches (eg: Schedule 2500 allocations over next 1 min, pick-up next 2500 allocations after 1 min))
3. Scheduled Representments Executor (Triggers **\*Execute Representable Payment** Workflow\* in batches (eg: Schedule 2500 representments over next 1 min, pick-up next 2500 representments after 1 min))
4. Paid Events Processor (Checks if both Settled and GAR Posted event have arrived then update the payment status to `PAID`)
5. Missing Paid Events Processor (Checks if there are missing GAR or Settled events for payments, if so then makes enquiries into respective systems to query the current state, if they are settled or posted, then update status to `PAID`. If still missing raise alert)
6. Data purger (Purges older data from Transactional tables)

[^ Top](#table-of-contents)

---

## Payment Lifecycle States

Consumer and Corporate Payments have almost a similar set of lifecycle states, except that Corporates have couple of additional Allocations processing states.

| State          | Meaning                                                                                                                                                                                                                    | Terminal? |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `PENDING`      | The payment has been received in Billpay and is awaiting initial validation before processing it.                                                                                                                          | No        |
| `SCHEDULED`    | The payment is set to execute at a future date, after it has been validated prior to scheduling.                                                                                                                           | No        |
| `ACCEPTED`     | The payment is successfully validated by AmEx systems, and is ready to process.                                                                                                                                            | No        |
| `PROCESSING`   | The payment is currently being executed by notifying the respective systems to debit the funding account (Banks, Financial Institutions) and credit the receiving accounts (in AmEx - Accounts Receivable, Authorization). | No        |
| `PROCESSED`    | The payment has been executed and fulfilled by Billpay by notifying all the required stakeholders (Accounting, Audit, Risk, Communications, etc).                                                                          | No        |
| `REPRESENTING` | A returned payment is scheduled to be re-attempted for settlement.                                                                                                                                                         | No        |
| `PAID`         | The payment is settled and posted in accounts receivables.                                                                                                                                                                 | **Yes**   |
| `RETURNED`     | The payment did not settle; funds were returned from the customer's bank.                                                                                                                                                  | **Yes**   |
| `REPRESENTED`  | A returned payment was re-attempted and successfully settled.                                                                                                                                                              | **Yes**   |
| `DECLINED`     | The payment failed validation and hence cannot be processed further.                                                                                                                                                       | **Yes**   |
| `CANCELLED`    | The payment was withdrawn by system or customer before it can be processed.                                                                                                                                                | **Yes**   |
| `DISALLOWED`   | The third-party initiated payment was not accepted in American Express.                                                                                                                                                    | **Yes**   |

#### Additional Corporate Payment States

| State        | Meaning                                                                                                                              | Terminal ? |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `ALLOCATING` | Billpay has requested allocations from the Allocation Processing system and currently awaiting it or in the process of receiving it. | No         |
| `ALLOCATED`  | Billpay has received all the allocations corresponding to the Payment                                                                | No         |

[^ Top](#table-of-contents)

---

## Market Onboarding & Payment Dimensions

- Billpay will provide an onboarding UI for bringing in more markets into the platform. As a part of the onboarding journey the user can select which Billpay APIs will be onboarded for the market in concern.
- Apart from this the user will be asked questions about the dimensions, which are essentially the processing variants, for the said market.
- The possible dimensions for a Payment in billpay payment processing journey are -
  - `accountType` - Possible values are `CONSUMER`, `CORPORATE` and `SMALL_BUSINESS`
  - `requiresArPosting` - A boolean flag that indicates if the processed payment needs to be notified to AR
  - `requiresRealtimeClearing` - Again this is a boolean flag, that determines if clearing is Realtime or Non-Realtime.
  - `requiresMandateAuthorization` - This is again a boolean flag, that checks if mandate verification needs to be done while processing a payment.

[^ Top](#table-of-contents)

---

## Core Components in Workflows

The component model exists to separate business decision-making from transport and infrastructure concerns. Each layer should be described first by the payment-lifecycle responsibility it owns, then by the Temporal or integration constraints that shape its implementation.

### 1.Workflow

- Orchestrates a complete business journey for a cardmember payment or refund, such as initiating a payment, scheduling a payment, or processing a return
- Sequences business decision points without owning external-system mapping

### 2. Stage

- Represents a business decision point in the payment lifecycle, such as initiated to pending, pending to accepted, or returned to representing
- Implemented as a Kotlin class with a single function that performs the validations, persistence, and publications required for that decision
- Consumes one well-defined payment state and emits the next auditable payment state
- Exclusively called by workflows

### 3. Activity Group

- Coordinates a small set of related business actions that belong to one responsibility, such as payment validation, lifecycle-event publication, or statement-balance updates
- Can be called directly by workflows or stages
- Should be named after the business concern it coordinates, not the technical mechanism it uses

### 4. Activity

- Executes one retryable business action, such as publishing a lifecycle event, persisting an audit record, reading a payment option, or updating a downstream balance
- Launched exclusively by workflows, stages, or activity groups
- Should remain thin and delegate protocol-specific mapping to clients

### 5. Client

- Encapsulates communication with an external system or a reusable internal capability
- Translates between BillPay's payment-lifecycle language and the contract of a downstream system
- Called exclusively by activities

### Component Rules

Use the following rules to preserve a clear payment-lifecycle model: business sequencing belongs in Workflows, state transitions belong in Stages, cohesive business concerns belong in ActivityGroups, retryable actions belong in Activities, and external contract mapping belongs in Clients.

| Component         | May Call                                      | Must NOT Call                                                         | Location                                                                   | Naming                                             |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------- |
| **Workflow**      | Workflows, Stages, ActivityGroups, Activities | Clients, external systems                                             | `core/lib/workflows/impl/` (default), `market/{m}/workflows/` (market)     | `{Market}InitiatePaymentWorkflow`                  |
| **Stage**         | ActivityGroups, Activities                    | Workflows, other Stages, Clients, external systems                    | `core/lib/stages/impl/` (default), `market/{m}/stages/` (market)           | `{From}To{To}Stage` e.g. `InitiatedToPendingStage` |
| **ActivityGroup** | Activities                                    | Workflows, Stages, other ActivityGroups, Clients, external systems    | `core/lib/activityGroups/` (shared), `market/{m}/activityGroups/` (market) | `{Responsibility}ActivityGroup`                    |
| **Activity**      | Clients                                       | Workflows, Stages, ActivityGroups, other Activities, external systems | `core/lib/activities/` + `impl/`                                           | `{Action}Activity` / `{Action}ActivityImpl`        |
| **Client**        | Other Clients, external systems               | Workflows, Stages, ActivityGroups, Activities                         | `core/lib/clients/`                                                        | `{System}Client`                                   |

**Additional rules:**

- Workflows and Stages must **not** be `abstract` — use composition over inheritance
- There should not be any different implementations of any workflow. Workflows will be composed by different implementations of Stages and ActivityGroups.
- Activities are shared across markets; pass only required fields, not the full `Payment` object
- All Dimensions must be present in the Payment context before starting a workflow.
- Every Stage and ActivityGroup will have a default implementation for given combination of dimensions. If there is no functionality for a particular combination of dimension, for example a CorporateAccount that doesn't need AR Posting might not be possible, so we won't have any implementation for that combination.
- When a market is onboarded the profiles maps to the dimensions automatically, so that in runtime when a workflow is called, using the profile information appropriate Stage / ActivityGroup inside a workflow can be invoked. This essentially means when a profile is created with a specific set of dimensions, it automatically maps to the corresponding implementations of the Stages & ActivityGroups.
- As part of market onboarding, a market with specific set(s) of dimensions will be captured under that market profile. If a particular combination of dimension is not onboarded for a market, then a workflow cannot be started for that combination. For example, we might onboard a Consumer account -type for processing in a market, but if a request lands for a Corporate account type then the processing will be rejected even before starting the corresponding Workflow.
- Define implementations of Stages and ActivityGroups which are driven by behavior and is not market-specific. Define a proper process in place for naming implementations of Stages and ActivityGroups which is behavior driven and not market specific.

[^ Top](#table-of-contents)

---

## Workflow Logic

### Core Workflows

#### 1. Create Immediate Payment #CreateImmediatePaymentWF

> **_Dimensions:_** - _`accountType`_ - _`requiresArPosting`_ - _`requiresRealtimeClearing`_ - _`requiresMandateAuthorization`_

##### A. Core Workflow Logic

- **InitiatedToPendingStage**: Domain progresses from InputPayment -> PendingPayment
- If (!idempotentPayment) -> `return` existingPayment
- `PaymentValidationActivityGroup` validate PendingPayment
- If (!validPayment)
  - **PendingToDeclinedStage**: PendingPayment -> DeclinedPayment
  - `return` DeclinedPayment
- **PendingToAcceptedStage**: PendingPayment -> AcceptedPayment
- `return` early to the caller
- If (`CorporateAccount`)
  - **AcceptedToProcessingStage**: AcceptedPayment -> ProcessingPayment
  - Trigger #GetCorporatePaymentAllocationsWF
  - Await on _AllocationsReceived_ Signal
  - For each split, trigger #ExecuteSplitPaymentWF
- Else If (`fullPayment`)
  - **AcceptedToProcessingStage**: AcceptedPayment -> ProcessingPayment
  - **ProcessingToProcessedStage**: ProcessingPayment -> ProcessedPayment
- Else
  - `CreatePaymentSplitActivity` creates split payments in DB in Accepted State
  - For each split payment, trigger #ExecuteSplitPaymentWF

##### B. Stages (Generic)

- **InitiatedToPendingStage**:
  - Persist the payment in transaction detail, transaction lifecycle events and idempotency tables. If insert fails, because of duplicate index, that means it is not an idempotent request.
  - If succeeds it is persisted as a `PENDING` payment and generates a `PENDING` payment event for Lumi (Analytics Platform) via RTF (Reliable Transaction Framework).
- **PendingToAcceptedStage**:
  - The domain transitions from `PENDING` to `ACCEPTED`. The attributes for an AcceptedPayment are enriched appropriately.
  - The status of the transaction is updated in DB as `ACCEPTED`. Transaction Detail is updated and new lifecycle entry is done in Transaction Lifecycle Event table.
  - `ACCEPTED` payment event with the enriched data is created and notified to LUMI via RTF.
- **AcceptedToProcessingStage**: - Payment is sent for clearing to Bank (via MR/M3). - Sent to AccountsReceivable (AR) for reducing statement balance. - Sent to Authorizations (AMP) to increase open-to-buy. - In a generic process, all the above 3 processes will be triggered in parallel, but there can be variations to this depending upon the `accountType` and `requiresRealtimeClearing` - The status of the transaction is updated in DB as `PROCESSING`. While updating the data it takes care of enriching it as well. - `PROCESSING` payment event is generated and notified to LUMI via RTF.
  >     NOTE:
  >         - Logic may vary depending upon RTP vs non-RTP payments
  >         - For Corporate payments, notification to AR and AMP will not happen in this workflow.
- **ProcessingToProcessedStage**: - Payment is sent to other downstream systems (like Accounting, Audit, Risk, Communications, etc) to fulfill the transaction. - The Comms notification will be the last item in this stage. Notifications to other systems can happen in parallel. Once all are completed, the communication notification to the customer will be triggered. - Payment is sent to Audit System / Balance & Control System (eBNC) to ensure every payment is processed and not missed. - Payment is sent to Accounting System to ensure the payment is matched between different payment processing platforms across the company. - Payment is sent to Risk system to ensure the Risk rules are kept updated for the customer with every payment activity.
  Payment is sent to Communication system (Raven) to notify the customer about the processing of the payment. - The status of the transaction is updated in DB as `PROCESSED`. While updating the data it takes care of enriching it as well. - `PROCESSED` payment event is generated and notified to LUMI via RTF.
  >     NOTE:
  >         - Account-type specific implementations may have different logic to notify different systems.
- **PendingToDeclinedStage**: - The status of the transaction is updated in DB as `DECLINED`. While updating the data it takes care of enriching it as well. - `DECLINED` payment event is generated and notified to LUMI via RTF.
  >     NOTE:
  >         - Account-type specific implementations may have additional notification step to AR or other systems.

##### C. Sample Code

```kotlin
    // Check if the incoming payment is idempotent
    val pendingPayment = InitiatedToPendingStage.execute(inputPayment)
    if (!pendingPayment.isIdempotent) {
        return newActivityStub<PaymentRepository>()
		  .getExistingPayment(idempotencyKey)
    }

    // Validate the payment
    val isValidPayment = paymentValidationActivityGroup.validate(pendingPayment)

    // If payment is not valid then decline it
    if (!isValidPayment) {
        val declinedPayment = pendingToDeclinedStage(pendingPayment)
        return paymentResponse(declinedPayment)
    }

    val acceptedPayment = pendingToAcceptedStage.execute(pendingPayment)
    // This is temporal early return, workflow method will actually not return
    early_return paymentResponse(acceptedPayment)

    // Process based on Account-type and Split/Non-Split
    return when {
        // Corporate Account and the payment is split into allocations
        acceptedPayment.account.type == CORPORATE && acceptedPayment.isSplit -> {
            val processingPaymentPromise = asyncFunction {
                acceptedToProcessingStage(acceptedPayment)
            }
            val childWorkflowPromise = asyncProcedure {
                newChildWorkflowStub<CorporatePaymentAllocationsWorkflow>()
                    .fetchAllocations(acceptedPayment)
            }
            Promise.allOf(processingPaymentPromise, childWorkflowPromise).get()
            Workflow.await(duration) { allocationsReceivedPromise.isCompleted }
            allocations.forEach {
                newChildWorkflowStub<ExecuteSplitPaymentWorkflow>
                    .execute(it)
            }
            paymentResponse(processingPaymentPromise.get())
        }

        // Consumer Non-split
        acceptedPayment.isFull -> {
            val processingPayment = acceptedToProcessingStage(acceptedPayment)
            val processedPayment = processingToProcessedStage(processingPayment)
            paymentResponse(processedPayment)
        }

        // Consumer Split
        acceptedPayment.isSplit -> {
            val acceptedPaymentSplits =
                newActivityStub<CreatePaymentSplitsActivity>(acceptedPayment)
            acceptedPaymentSplits.forEach {
                newChildWorkflowStub<ExecuteSplitPaymentWorkflow>
                    .execute(it)
            }
            paymentResponse(acceptedPayment)
        }
    }
```

#### 2. Create Schedule Payment #CreateSchedulePaymentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`requiresArPosting`_
> - _`requiresMandateAuthorization`_

##### A. Core Workflow Logic

- **InitiatedToPendingStage**: Domain progresses from InputPayment -> PendingPayment
- If (!idempotentPayment) -> return existingPayment
- `PaymentValidationActivityGroup` validate PendingPayment
- If (validPayment)
  - **PendingToScheduledStage**: PendingPayment -> ScheduledPayment
  - Return early to the caller
  - If (`CorporateAccount`)
    - Trigger #GetCorporatePaymentAllocationsWF
- Else
  - **PendingToDeclinedStage**: PendingPayment -> DeclinedPayment

#### 3. Execute Scheduled Payment #ExecuteScheduledPaymentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`requiresArPosting`_
> - _`requiresRealtimeClearing`_
> - _`requiresMandateAuthorization`_

##### A. Core Workflow Logic

- `PaymentValidationOnExecutionActivityGroup` validate ScheduledPayment
- If (validPayment)
  - **ScheduledToAcceptedStage**: ScheduledPayment -> AcceptedPayment
  - If (fullPayment)
    - **AcceptedToProcessingStage**: AcceptedPayment -> ProcessingPayment
    - **ProcessingToProcessedStage**: ProcessingPayment -> ProcessedPayment
  - Else
    - If (`CorporateAccount`)
      - **AcceptedToProcessingStage**: AcceptedPayment -> ProcessingPayment
      - Trigger #GetCorporatePaymentAllocationsWF
      - Await on _AllocationsReceived_ Signal
      - For each split, trigger #ExecuteSplitPaymentWF
    - Else
      - `CreatePaymentSplitActivity` creates split payments in DB in Accepted State
      - For each split payment, trigger #ExecuteSplitPaymentWF
- Else
  - **PendingToDeclinedStage**: PendingPayment -> DeclinedPayment

#### 4. Execute Split Payment #ExecuteSplitPaymentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`requiresArPosting`_
> - _`requiresRealtimeClearing`_

##### A. Core Workflow Logic

- Below stages will be triggered - **AcceptedToProcessingStage**: AcceptedPayment -> ProcessingPayment - **ProcessingToProcessedStage**: ProcessingPayment -> ProcessedPayment
  >     NOTE:
  >         - AcceptedToProcessingStage may vary on the accountType, hence we can have different implementations at runtime depending upon the accountType.
  >         - For Corporate Account, AcceptedToProcessingStage  at Split level means only updating balances and open-to-buy.
  >         - But for Consumer Account, AcceptedToProcessingStage at Split level means clearing, as well as updating balances and open-to-buy.

#### 5. Cancel Payment #CancelPaymentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`requiresArPosting`_

##### A. Core Workflow Logic

- `IdempotencyCheckActivity` checks if the request is unique
- If !Idempotent -> return previous response
- `ValidateCancelPaymentRequestActivityGroup` validates if the cancellation request is valid & also fetches current state of the payment
- If eligible
  - If currentPaymentStatus = `SCHEDULED`
    - **ScheduledToCancelledStage**: ScheduledPayment to CancelledPayment
  - Else If currentPaymentStatus = `ACCEPTED`
    - **AcceptedToCancelledStage**: AcceptedPayment to CancelledPayment

#### 6. Update Payment #UpdatePaymentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`requiresArPosting`_
> - _`requiresRealtimeClearing`_
> - _`requiresMandateAuthorization`_

##### A. Core Workflow Logic

- `IdempotencyCheckActivity` checks if the request is unique
- If !Idempotent -> return previous response
- **ScheduledToCancelledStage**: Original payment moves from ScheduledPayment -> CancelledPayment. We can consider invoking #CancelPaymentWF here.
- Build a new payment request as PendingPayment with new paymentId but same confirmationNumber and the updated details
- Can invoke #CreateSchedulePaymentWF which will essentially do the following -
  - `ValidatePaymentActivityGroup` validates the new PendingPayment
  - If validPayment
    - **PendingToScheduledStage**: New payment moves from PendingPayment to ScheduledPayment
  - Else
    - **PendingToDeclinedStage:** New payment moves from PendingPayment to DeclinedPayment
- Finally, invoke `MapNewPaymentToOriginalPaymentActivityGroup` to map the new payment to the original payment in the DB for Audit purpose.

#### 7. Process Returned Payment #ProcessReturnedPaymentWF

> **_Dimensions:_**
>
> - _`accountType`_

##### A. Core Workflow Logic

- `IdempotencyCheckActivity` checks if the request is unique
- If !Idempotent -> return previous response
- `ReturnedPaymentValidationActivityGroup` validates the input ReturnedPayment request by looking up the payment (full or split) in DB along with its current status. Eligible statuses are `PAID`, `PROCESSING`, `PROCESSED`
- If validReturnedPayment
  - **ToReturnedStage**: (PaidToReturnedStage / ProcessingToReturnedStage / ProcessedToReturnedStage) `PAID`/ `PROCESSING`/ `PROCESSED` to ReturnedPayment
  - `RepresentmentEligibileActivityGroup` checks if the return is representable
  - If Representable
    - **ToRepresentingStage**:
      - Enrich the different attributes related to this representing payment, like next representable date, etc via `EnrichRepresentmentDetailsActivityGroup`.
      - `CreateRepresentmentActivity` will create a new presentment transaction as `REPRESENTING`

#### 8. Process Representing Payment #ProcessRepresentmentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`requiresArPosting`_
> - _`requiresRealtimeClearing`_
> - _`requiresMandateAuthorization`_

##### A. Core Workflow Logic

- `RepresentingPaymentValidationActivityGroup` validate ScheduledPayment
- If (validPayment)
  - **RepresentingToRepresentedStage**: RepresentingPayment -> RepresentedPayment
- Else
  - **RepresentingToDeclinedStage**: RepresentingPayment -> DeclinedPayment

#### 9. Get Corporate Payment Allocations #GetCorporatePaymentAllocationsWF

> **Generic**

##### A. Core Workflow Logic

- **ToAllocatingStage**:
  - Invoke appropriate Allocations Manager Service to fetch required allocations
  - Update ScheduledPayment / AcceptedPayment to AllocationsRequested
- Await on _AllocationsReady_ Signal
- **ToAllocatedStage**:
  - Update the status for the parent payment to `ALLOCATED`
  - `CreatePaymentSplitActivity` creates split payments in DB in Accepted State
  - For each split payment, trigger #ExecuteSplitPaymentWF

#### 10. Process Inbound Payment #ProcessInboundPaymentWF

> **_Dimensions:_**
>
> - `TBD`

##### A. Core Workflow Logic

- **InitiatedToPendingStage**: Domain progresses from InputPayment -> PendingPayment
- If (!idempotentPayment) -> return existingPayment
- `PaymentValidationActivityGroup` validate PendingPayment
- If (validPayment)
  - **PendingToAcceptedStage**: PendingPayment -> AcceptedPayment
  - Return early to the caller
  - If (`fullPayment`)
    - **AcceptedToProcessingStage**: AcceptedPayment -> ProcessingPayment
    - **ProcessingToProcessedStage**: ProcessingPayment -> ProcessedPayment
  - Else
    - If (`ConsumerAccount`)
      - `CreatePaymentSplitActivity` creates split payments in DB in Accepted State
      - For each split payment, trigger #ExecuteSplitPaymentWF
- Else
  - **PendingToDisallowedStage**: PendingPayment -> DisallowedPayment

#### 11. Create Payment Intent #CreatePaymentIntentWF

> **_Dimensions:_**
>
> - _`accountType`_
> - _`instrumentType`_
> - _`requiresMandateAuthorization`_ (? - Do we need it for Debit cards / non-PWBT)

##### A. Core Workflow Logic

- TBD

### Composite Workflows

#### 1. Create Payment & Installments

- Create Immediate Payment Workflow
- Call Installments API
- Update Autopay (optional)

#### 2. Create Payments with multiple instructions

- Validation of composite payment
- Execute separate Create Immediate Payment Workflows for each instruction

### Periodic Workflows

#### 1. Paid Events Processor #PaidEventsProcessingWF

- Fetch all payments from External Transaction Events Tracker for which both AR Posted and Clearing Settlement event have arrived.
- Update the status in the External Transaction Events Tracker table for all these transactions as "Picked-up-for-processing"
- Insert into Transaction Lifecycle Event table as `PAID`
- Update the status in Transaction Detail Table as `PAID`
- Publish `PAID` lifecycle event

#### 2. Missing Paid Events Processor #MissingPaidEventsProcessingWF

- Fetch all payments from External Transaction Events Tracker for which either AR Posted or Clearing Settlement or both events are missing for last 48 hours
- Invoke the respective system to fetch the latest status
  - If found, then insert the corresponding events into External Transaction Events Tracker table
  - If still missing, then raise alert

#### 3. Data purger #DataPurgingWF

- Fetch all older records from DB
- Delete those records from DB

[^ Top](#table-of-contents)

---

## Activities / ActivityGroups

| Sl No | Activity / ActivityGroups                      | Generic / Variations                                                                                                | State Transitions                                                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| :---: | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1   | `PersistPendingPaymentActivity`                | Generic                                                                                                             | Input -> `PENDING`                                                   | 1. Tries inserting into idempotency_checker, trans_dtl & trans_lfcyc_event tables<br>2. If already present then duplicate, else idempotent<br>3. If idempotent then publish`PENDING` lifecycle event<br><br>Will be invoked from **InitiatedToPendingStage**.                                                                                                                                                                                                          |
|   2   | `IdempotencyCheckActivity`                     | Generic                                                                                                             | No state transition                                                  | 1. Tries inserting into idempotency_checker table for the corresponding API<br>2. If already present then duplicate, else idempotent<br><br>Will be invoked from **Workflows** wherever there is an idempotency check.                                                                                                                                                                                                                                                 |
|   3   | `PaymentValidationActivityGroup`               | Dimensions:<br>`accountType`<br>`requiresArPosting`<br>`requiresRealtimeClearing`<br>`requiresMandateAuthorization` | `PENDING` -> `ACCEPTED` or `SCHEDULED` / `DECLINED`<br><br>          | This activity group will be responsible to make external calls (if necessary) and do an evaluation on the data fetched to check if the payment is valid or not.<br><br>Will be invoked from **CreateImmediatePayment** and **CreateScheduledPayment** Workflows.                                                                                                                                                                                                       |
|   4   | `PaymentValidationOnExecutionActivityGroup`    | Dimensions:<br>`accountType`<br>`requiresArPosting`<br>`requiresRealtimeClearing`<br>`requiresMandateAuthorization` | `SCHEDULED` / `ALLOCATED` -> `ACCEPTED` / `DECLINED`                 | This is invoked during Execute Scheduled Payment Workflow<br>1. Invokes different systems to fetch related information that might vary<br>2. Sometimes call to one system can only be done after certain information is fetched from another system<br>3. Validate **if the scheduled payment is still valid**, once all necessary information is fetched. <br>4. If valid return true else false.<br><br>Will be invoked inside **ExecuteScheduledPayment Workflow**. |
| <br>5 | `PaymentStateTransitionActivity`               | Generic                                                                                                             | Different state transitions                                          | 1. Update trans_dtl table with new status, receives current and previous states as input for a given payment-id<br>2. Add a new row in trans_lfcyc_event table for the new state.<br>3. Publish lifecycle event for corresponding state transition.<br><br>Will be invoked inside all **Stages** whenever there is a state transition at the payment level.                                                                                                            |
|   6   | `PaymentSplitStateTransitionActivity`          | Generic                                                                                                             | Different state transitions at split level                           | 1. Update split_trans_dtl table with new status, receives current and previous states as input for a given split-payment-id<br>2. Add a new row in split_trans_lfcyc_event table for the new state.<br>3. Publish lifecycle event for corresponding split state transition.<br><br>Will be invoked inside all **Stages** that involves split payments.                                                                                                                 |
|   7   | `PaymentScheduledNotificationActivityGroup`    | Dimensions:<br>`accountType`<br>`requiresArPosting`                                                                 | No state transition                                                  | Notify systems when a payment is `SCHEDULED`. <br><br>Will be invoked from **PendingToScheduledStage**.                                                                                                                                                                                                                                                                                                                                                                |
|   8   | `PaymentDeclinedNotificationActivityGroup`     | Dimensions:<br>`accountType`<br>`requiresArPosting`                                                                 | No state transition                                                  | Notify systems when a payment is `DECLINED` during immediate payment or when a payment is being `SCHEDULED`. <br><br>Will be invoked from **PendingToDeclinedStage**.                                                                                                                                                                                                                                                                                                  |
|   9   | `PaymentAllocatingActivityGroup`               | Generic                                                                                                             | `PENDING` / `SCHEDULED` -> `ALLOCATING`                              | For Corporate Immediate Payments, a payment moves to `ACCEPTED` (after `ALLOCATING` & `ALLOCATED` states) only after the allocations are fetched. If Allocations couldn't be fetched it is `DECLINED`.<br>For Corporate Scheduled Payments, a payment after it has been `SCHEDULED`, it moves to `ALLOCATING` on the day or -X days before the scheduled date.<br><br>Will be invoked from **ToAllocatingStage**.                                                      |
|  10   | `PaymentAllocatedActivityGroup`                | Generic                                                                                                             | `ALLOCATING` -> `ALLOCATED`                                          | Receive allocations from GPA<br>TBD - What kind of validation needs to happen in Billpay when allocations are received<br><br>Will be invoked from **ToAllocatedStage**.                                                                                                                                                                                                                                                                                               |
|  11   | `PaymentExecutionActivityGroup`                | Dimensions:<br>`accountType`<br>`requiresArPosting`<br>`requiresRealtimeClearing`                                   | `ACCEPTED` -> `PROCESSING`                                           | Do the following in parallel -<br> 1. Send payment to clearing system & insert in notification tracker table<br> 2. Decrease balance in Accounts Receivable & insert in notification tracker table<br> 3. Increase open-to-buy in Authorization & insert in notification tracker table<br><br>_There can be variations to these steps depending upon the variance._<br><br>Will be invoked from **AcceptedToProcessingStage**                                          |
|  12   | `PaymentFulfillmentActivityGroup`              | Dimensions:<br>`accountType`                                                                                        | `PROCESSING` -> `PROCESSED`                                          | 1. Do the following in parallel -<br> - Notify accounting & insert in notification tracker table<br> - Notify Balance & Control & insert in notification tracker table<br>2. Notify Communications & insert in notification tracker table<br><br>Will be invoked from **ProcessingToProcessedStage**.                                                                                                                                                                  |
|  13   | `PaymentSplitsCreationActivity`                | Generic                                                                                                             | `ACCEPTED` (Full) -> `ACCEPTED` (Split)                              | 1. For each split make an entry in Split trans detail and split_lfcyc_event table as `ACCEPTED`<br>2. Publish lifecycle event for corresponding state transition at split level.<br><br>Will be invoked from **CreateImmediatePayment** and **ExecuteScheduledPayment** Workflows.                                                                                                                                                                                     |
|  14   | `PaymentCancelValidationActivityGroup`         | Dimensions:<br>`accountType`                                                                                        | No state transition                                                  | 1. Check current state of payment in DB, if valid continue<br>2. Do necessary calls to external systems to validate the eligibility of cancellation request. If valid cancellation request, then return true.<br><br>Will be invoked from **CancelPaymentWorkflow**.                                                                                                                                                                                                   |
|  15   | `PaymentCancellationActivityGroup`             | Dimensions:<br>`accountType`<br>`requiresArPosting`                                                                 | `SCHEDULED` / `ACCEPTED` -> `CANCELLED`                              | 1. Notify different systems once a payment is cancelled<br><br>Will be invoked from **CancelPaymentWorkflow**.                                                                                                                                                                                                                                                                                                                                                         |
|  16   | `PaymentReturnValidationActivity`              | Generic                                                                                                             | No state transition                                                  | 1. Check current state of payment in DB, if valid continue<br><br>Will be invoked from **ReturnedPaymentWorkflow**.                                                                                                                                                                                                                                                                                                                                                    |
|  17   | `PaymentReturnExecutionActivityGroup`          | Dimensions:<br>`accountType`<br>                                                                                    | `PROCESSING` / `PROCESSED` / `PAID` -> `RETURNED`                    | 1. Notify different systems once a payment is `RETURNED` in DB<br><br>Will be invoked from **ToReturnedStage**.                                                                                                                                                                                                                                                                                                                                                        |
|  18   | `PaymentRepresentmentEligibilityActivityGroup` | Dimensions:<br>`accountType`<br>`requiresArPosting`<br>`requiresRealtimeClearing`<br>`requiresMandateAuthorization` | No state transition                                                  | 1. Do necessary calls to external systems to validate the eligibility of representment. If valid representment, then return true, else false.<br><br>Will be invoked from **ReturnedPaymentWorkflow**.                                                                                                                                                                                                                                                                 |
|  19   | `PaymentRepresentmentCreationActivityGroup`    | Generic                                                                                                             | `RETURNED` (Presentment Seq 1) -> `REPRESENTING` (Presentment Seq 2) | 1. Make a new entry in trans_dtl and trans_lfcyc_event for `REPRESENTING` status<br>2. Publish a lifecycle event<br><br>Will be invoked from **ToRepresentingStage**.                                                                                                                                                                                                                                                                                                  |
|  20   | `PaymentRepresentmentValidationActivityGroup`  | Dimensions:<br>`accountType`<br>`requiresArPosting`<br>`requiresRealtimeClearing`<br>`requiresMandateAuthorization` | No state transition                                                  | 1. Do necessary calls to external systems to validate if representment is still valid to execute on the day of processing the representment. If valid representment, then return true, else false.<br><br>Will be invoked from **ProcessingRepresentablePayment Workflow**.                                                                                                                                                                                            |
|  21   | `PaymentRepresentmentExecutionActivityGroup`   | Dimensions:<br>`accountType`<br>`requiresArPosting`<br>`requiresRealtimeClearing`<br>`requiresMandateAuthorization` | `REPRESENTING` -> `REPRESENTED`                                      | 1. Send to clearing system. <br>2. Notify different systems in parallel, once a payment is `REPRESENTED`<br><br>Will be invoked from **RepresentingToRepresentedStage**.                                                                                                                                                                                                                                                                                               |
|  22   | `MapNewPaymentIdToPreviousIdActivity`          | Generic                                                                                                             | No state transition                                                  | 1. Make an entry into `ORIG_TRANS_REFER_MAP` table with old and new payment-id<br><br>Will be invoked from **UpdatePaymentWorkflow**                                                                                                                                                                                                                                                                                                                                   |

[^ Top](#table-of-contents)

---

## Overall Payments View

### APIs & Workflows

> One data functions -> Billpay core APIs -> Billpay Router -> Billpay Workflows -> Different Stages, ActivityGroups, Activities -> Different Activities (in a Stage / ActivityGroup)

Between Billpay Core APIs and Billpay Core Workflows, sits a Billpay Router which based on the input instructions, date, and other parameters can route to appropriate workflows.

| One-Data Function                                                                      | Billpay Core API              | Billpay Router                                                                                                                                                         | Parent Workflows                                                                                | Child Workflows                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CreatePayment.v3                                                                       | POST /payments                | 1. payment-date=current-date<br>2. Fetch respective stages based on Dimensions<br>3. Invoke workflow by passing the respective stages<br>4. Single instruction         | 1. #CreateImmediatePaymentWF (Online)<br>                                                       | When Consumer - <br>1. #ExecuteSplitPaymentWF (Online)<br><br>When Corporate -<br>1. #GetCorporatePaymentAllocationsWF (Offline)<br>2. #ExecuteSplitPaymentWF (Offline)  |
|                                                                                        |                               | 1. If payment-date = current-date<br>2. Fetch respective stages based on Dimensions<br>3. Invoke workflow by passing the respective stages<br>4. Multiple instructions | 1. #CreatePaymentWithMultipleInstructionsWF (Online)                                            |                                                                                                                                                                          |
|                                                                                        |                               | 1. payment-date > current-date<br>2. Fetch respective stages based on Dimensions<br>3. Invoke workflow by passing the respective stages<br>4. Single instruction       | 1. #CreateSchedulePaymentWF (Online)<br>2. #ExecuteScheduledPaymentWF (future dated) (Offline)  | When Consumer - <br>1. #ExecuteSplitPaymentWF (Offline)<br><br>When Corporate -<br>1. #GetCorporatePaymentAllocationsWF (Offline)<br>2. #ExecuteSplitPaymentWF (Offline) |
| UpdatePayment.v1                                                                       | PUT /payments/{payment-id}    | 1. Fetch respective stages based on Dimensions<br>2. Invoke workflow by passing the respective stages                                                                  | 1. #UpdatePaymentWF (Online)                                                                    |                                                                                                                                                                          |
| DeletePayment.v1                                                                       | DELETE /payments/{payment-id} | 1. Fetch respective stages based on Dimensions<br>2. Invoke workflow by passing the respective stages                                                                  | 1. #CancelPaymentWF (Online)                                                                    |                                                                                                                                                                          |
| MoneyMovementEventListener.v1                                                          | POST /payments/returns        | 1. Fetch respective stages based on Dimensions<br>2. Invoke workflow by passing the respective stages                                                                  | 1. #ProcessReturnedPaymentWF (Offline)                                                          | 1. #ProcessRepresentmentWF (Offline)                                                                                                                                     |
| CreateInboundPayment.v1                                                                | POST /payments/inbound        | 1. Fetch respective stages based on Dimensions<br>2. Invoke workflow by passing the respective stages                                                                  | 1. #ProcessInboundPaymentWF                                                                     |                                                                                                                                                                          |
| CreatePaymentIntent.v1                                                                 | POST /payments/intent         | 1. Fetch respective stages based on Dimensions<br>2. Invoke workflow by passing the respective stages                                                                  | #CreatePaymentIntentWF (Online)                                                                 |                                                                                                                                                                          |
| CreateBillpayTransactionFromAccountsReceivable.v1 <br>(when transactionType = PAYMENT) | POST /payments                | 1. payment-date > current-date<br>2. Fetch respective stages based on Dimensions<br>3. Invoke workflow by passing the respective stages<br>4. Single instruction       | 1. #CreateSchedulePaymentWF (Offline)<br>2. #ExecuteScheduledPaymentWF (future dated) (Offline) | When Consumer - <br>1. #ExecuteSplitPaymentWF (Offline)<br><br>When Corporate -<br>1. #GetCorporatePaymentAllocationsWF (Offline)<br>2. #ExecuteSplitPaymentWF (Offline) |

### Periodic Workflows

> All Workflows will be executed in _Offline_ Worker

| Schedule                                 | Temporal Workflows             |
| ---------------------------------------- | ------------------------------ |
| Schedule Payment Executor Schedule       | #ExecuteScheduledPaymentWF     |
| Corporate Allocations Processor Schedule | #ExecuteSplitPaymentWF         |
| Paid Events Processor Schedule           | #PaidEventsProcessingWF        |
| Missing Paid Events Processor Schedule   | #MissingPaidEventsProcessingWF |
| Data Purge Schedule                      | #DataPurgingWF                 |

[^ Top](#table-of-contents)

---

## Sequence Diagrams

- Create Sequence Diagrams using Mermaid for complete billpay flows including APIs, workflows and Schedules

## State Diagrams

- Create State Diagrams using Mermaid based on different payment state transitions under State Transition in Workflows

[^ Top](#table-of-contents)
