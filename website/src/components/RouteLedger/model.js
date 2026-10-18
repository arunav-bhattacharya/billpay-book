/**
 * RouteLedger's content: every road through Billpay, from the spec's
 * workflow, routing, stage and activity tables. index.js draws it.
 *
 * A band groups requests by how work arrives. A request is one trigger: a
 * One-Data function or event handler, a Work Tracker row, or the READY rows
 * the PAID drain reads. A road is one workflow a request can start. A road's
 * card is built from the road, its request and its band, so most of the
 * Router's six steps come from the rules at the bottom and only what differs
 * is written on the road.
 *
 * `|` in a name marks where it may break onto a second line.
 */

export const STAGES = ['Capture', 'Verify', 'Reverify', 'Execute', 'Fulfil'];
export const OWN = [
  'Cancel',
  'RequestConfirmation',
  'RequestAllocations',
  'ReceiveAllocations',
  'Return',
  'QueueRepresentment',
  'Represent',
  'Settle',
];
export const ALL = [...STAGES, ...OWN];

/* the state each stage moves a payment to */
export const MOVE = {
  Capture: 'PENDING',
  Verify: 'ACCEPTED, SCHEDULED or DECLINED',
  Reverify: 'ACCEPTED or DECLINED',
  Execute: 'PROCESSING',
  Fulfil: 'PROCESSED',
  Cancel: 'CANCELLED',
  RequestConfirmation: 'PENDING, unchanged; DECLINED with no link',
  RequestAllocations: 'ALLOCATING',
  ReceiveAllocations: 'ALLOCATED',
  Return: 'RETURNED',
  QueueRepresentment: 'REPRESENTING, as the next presentment',
  Represent: 'REPRESENTED or DECLINED',
  Settle: 'PAID',
};

/* One interface per system. `at` is every stage that calls it on some road;
   `rail` marks the two every stage calls. */
export const IFACES = [
  {name: 'PaymentStore', system: 'Oracle', queue: 'local activity', rail: true, note: 'every stage commits here'},
  {
    name: 'LifecycleEventActivities',
    system: 'RTF',
    queue: "the workflow's queue",
    rail: true,
    fails: 'hold',
    note: 'every state change',
  },
  {
    name: 'CommunicationActivities',
    system: 'Raven',
    long: 'Raven, for customer messages',
    fails: 'hold',
    queue: 'ds-comms',
    at: ['Verify', 'Reverify', 'Fulfil', 'Cancel', 'Return', 'Represent'],
    note: 'where the market tells the customer',
  },
  {
    name: 'InstrumentActivities',
    system: 'Payment Instruments',
    fails: 'decline',
    failsAt: {Execute: 'must'},
    queue: "the workflow's queue",
    at: ['Verify', 'Reverify', 'Execute'],
    note: 'it has no rate limit',
  },
  {
    name: 'OptionsActivities',
    system: 'Payment Options',
    fails: 'decline',
    queue: "the workflow's queue",
    at: ['Verify', 'Reverify'],
    note: 'it has no rate limit',
  },
  {
    name: 'PlansActivities',
    system: 'Plans',
    long: 'Plans, for the mandate details',
    fails: 'mandate',
    queue: "the workflow's queue",
    at: ['Verify', 'Reverify'],
    note: 'only where the profile requires mandate authorization',
  },
  {
    name: 'ClearingActivities',
    system: 'MR/M3',
    long: 'MR/M3, for clearing',
    fails: 'must',
    queue: 'ds-clearing',
    at: ['Execute', 'Represent'],
    note: 'a corporate leg never clears',
  },
  {
    name: 'ReceivablesActivities',
    system: 'GAR',
    long: 'GAR, Accounts Receivable',
    fails: 'must',
    queue: 'ds-receivables',
    at: ['Execute'],
    note: 'a corporate parent leaves it to its legs',
  },
  {
    name: 'AuthorizationActivities',
    system: 'AMP',
    long: 'AMP, for open-to-buy',
    fails: 'must',
    queue: 'ds-authorization',
    at: ['Execute'],
    note: 'a corporate parent leaves it to its legs',
  },
  {name: 'AccountingActivities', system: 'Accounting', fails: 'must', queue: 'ds-accounting', at: ['Fulfil']},
  {
    name: 'BalanceControlActivities',
    system: 'eBNC',
    long: 'eBNC, Balance & Control',
    fails: 'must',
    queue: 'ds-ebnc',
    at: ['Fulfil'],
  },
  {name: 'RiskActivities', system: 'Risk', fails: 'must', queue: 'ds-risk', at: ['Fulfil']},
  {
    name: 'TransactionNotificationActivities',
    system: 'TFNE, GPHDB, B2Notifier',
    long: 'TFNE, the Transaction Notification Engine; GPHDB, the legacy Payments History Database; and B2Notifier, which tells other downstream systems',
    fails: 'must',
    queue: 'ds-tfne, ds-gphdb, ds-b2notifier',
    at: ['Fulfil'],
    note: 'one method and one queue per system',
  },
  {name: 'AllocationActivities', system: 'Allocations manager', queue: 'ds-allocations', at: ['RequestAllocations']},
  {
    name: 'BankConfirmationActivities',
    system: 'Bank-confirmation provider',
    long: "The market's bank-confirmation provider, such as Plaid in the US or Pay with Bank Transfer in the UK",
    queue: "the workflow's queue",
    at: ['RequestConfirmation'],
    note: 'only the Online cluster calls it',
  },
  {
    name: 'InboxActivities',
    system: 'One-Data',
    queue: "the workflow's queue",
    at: [],
    note: 'no stage: the PAID drain, the inbox dispatchers and the delete call that ends a create from a channel',
  },
];

/* the five behaviors, as example values on a card */
const five = (account, realtime, bank) => [
  account,
  'AR posting Y',
  `realtime clearing ${realtime}`,
  'mandate N',
  `bank confirmation ${bank}`,
];

const CV = ['Capture', 'Verify'];
const CVEF = ['Capture', 'Verify', 'Execute', 'Fulfil'];
const PAID = {to: 'paid', text: 'PAID, once One-Data has the settlement and the AR posting'};
const CANCEL_NOTE =
  'It checks the cancellation window and eligibility first, with read-only calls. Outside the window, or once the payment is no longer SCHEDULED, the answer is 409.';

export const BANDS = [
  {
    key: 'caller',
    term: 'A caller waits',
    desc: 'Update-With-Start',
    cluster: 'Online',
    start: 'Update-With-Start',
    requests: [
      {
        fn: ['CreatePayment.v3'],
        from: 'a channel',
        calls: 'A channel calls',
        does: 'create a payment for today, or schedule one',
        api: ['POST', '/payments'],
        roads: [
          {
            id: 'immediate',
            wf: 'CreateImmediatePayment',
            lead: 'Pay today, with one instruction.',
            stages: CVEF,
            journey: 'Create payment, today, one instruction',
            wfId: '{paymentId}-init',
            answer: 'once Verify decides',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values. A BOTH turns realtime clearing to Y only for pay today from a channel.',
            corp: 'today',
            after:
              "A consumer split writes its legs in the parent's commit, and each leg runs ExecuteSplitPayment as a child on the Online cluster.",
            then: [PAID],
          },
          {
            id: 'multiple',
            wf: 'CreatePaymentWith|MultipleInstructions',
            lead: 'Pay today, with several instructions.',
            stages: CVEF,
            child: CVEF,
            childWf: 'CreateImmediatePayment',
            journey: 'Create payment, today, several instructions',
            wfId: '{paymentId}-init',
            chips: five('CONSUMER', 'Y', 'N'),
            behave:
              'Example values. A request with several instructions never takes bank confirmation: one that would need it gets 422.',
            first:
              'It validates the composite payment, then runs one CreateImmediatePayment per instruction, each a child on the Online cluster.',
            then: [{to: 'immediate', text: 'each instruction runs as a child'}],
          },
          {
            id: 'scheduled',
            wf: 'CreateScheduledPayment',
            lead: 'A payment for a future date.',
            stages: CV,
            journey: 'Create payment, future-dated',
            wfId: '{paymentId}-init',
            answer: 'once Verify decides: SCHEDULED or DECLINED',
            chips: five('CONSUMER', 'N', 'N'),
            behave: 'Example values. A future-dated payment never clears in real time.',
            notes: {Verify: 'Its SCHEDULED commit writes the SCHED_EXEC row. Nothing waits in Temporal until the due date.'},
            corp: 'scheduled',
            then: [{to: 'execute', text: 'on the due date, its SCHED_EXEC row'}],
          },
          {
            id: 'bank',
            wf: 'CreateImmediatePayment',
            tag: 'bank confirmation',
            lead: 'Pay today, once the customer confirms their bank details.',
            stages: ['Capture'],
            own: ['RequestConfirmation'],
            journey:
              'Create payment, today, one instruction. A payment that needs bank confirmation takes the pay-today route',
            wfId: '{paymentId}-init',
            answer: 'with PENDING and the redirect link, or DECLINED with none',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave:
              'Example values. A BOTH turns bank confirmation to Y when the payment method needs the customer to confirm at their bank. Only consumer payments made today take it.',
            notes: {
              RequestConfirmation:
                "It runs after Capture, in place of Verify. It gets the provider's redirect link, with one try, and commits it with a CONFIRM_EXPIRY row, guarded on PENDING. The caller gets PENDING with the link, and the PENDING event goes out. With no link, the payment is DECLINED instead.",
            },
            stop: {
              title: 'The workflow ends here.',
              text: "Nothing waits in Temporal while the customer is on the provider's site. The payment waits in Oracle, PENDING.",
            },
            then: [
              {to: 'confirm', text: 'the caller confirms, with the same payment ID'},
              {to: 'expire', text: 'or the confirmation window closes first'},
            ],
          },
          {
            id: 'goahead',
            wf: 'CreateImmediatePayment',
            tag: 'go-ahead',
            lead: 'Pay today while another payment on the account is pending.',
            stages: ['Capture'],
            own: ['RequestConfirmation'],
            journey:
              'Create payment, today, one instruction. One-Data sends the IDs of the pending payments it found, and the payment waits for a go-ahead',
            wfId: '{paymentId}-init',
            answer: 'with PENDING, and One-Data adds the pending payments',
            chips: five('CONSUMER', 'Y', 'N'),
            behave:
              'Example values. A go-ahead is not a behavior: One-Data asks for it per payment, and the Router marks it on the plan key (Proposed).',
            move: {RequestConfirmation: 'PENDING, unchanged'},
            notes: {
              RequestConfirmation:
                'Its go-ahead implementation runs after Capture, in place of Verify. It commits a CONFIRM_EXPIRY row with the IDs of the payments the customer is shown, guarded on PENDING. The caller gets PENDING, and the PENDING event goes out.',
            },
            exc: {
              'RequestConfirmation|BankConfirmationActivities': {kind: 'skip', note: 'no provider call for a go-ahead'},
            },
            stop: {
              title: 'The workflow ends here.',
              text: "Nothing waits in Temporal while the customer decides. The payment waits in Oracle, PENDING, and stays on the account's pending list.",
            },
            then: [
              {to: 'confirm', text: 'the customer says yes, with the same payment ID'},
              {to: 'no', text: 'or says no'},
              {to: 'expire', text: 'or the confirmation window closes first'},
            ],
          },
        ],
      },
      {
        fn: ['UpdatePayment.v1'],
        from: 'a channel',
        calls: 'A channel calls',
        does: 'update a SCHEDULED payment, inside the cancellation window',
        api: ['PUT', '/payments/{payment-id}'],
        roads: [
          {
            id: 'update',
            wf: 'UpdatePayment',
            lead: 'Change a scheduled payment, inside the cancellation window.',
            own: ['Cancel'],
            stages: CV,
            child: CV,
            childWf: 'CreateScheduledPayment',
            journey: 'Update payment, SCHEDULED, inside the cancellation window',
            wfId: '{paymentId}-update',
            answer: "with the new payment's result",
            chips: five('CONSUMER', 'N', 'N'),
            behave: 'Example values. A corporate payment stops taking updates once its allocations are requested.',
            move: {Cancel: 'SCHEDULED to CANCELLED'},
            notes: {
              Cancel: `${CANCEL_NOTE} One guarded update cancels the old payment.`,
              Capture:
                'A child CreateScheduledPayment, {newId}-init, takes the new payment with the same confirmation number.',
            },
            after: 'It maps the old and new payment IDs in ORIG_TRANS_REFER_MAP.',
            then: [{to: 'scheduled', text: 'the replacement runs as a child'}],
          },
        ],
      },
      {
        fn: ['DeletePayment.v1'],
        from: 'a channel',
        calls: 'A channel calls',
        does: 'cancel a SCHEDULED payment inside the cancellation window, or a PENDING one the customer says no to',
        api: ['DELETE', '/payments/{payment-id}'],
        roads: [
          {
            id: 'cancel',
            wf: 'CancelPayment',
            lead: 'Cancel a scheduled payment, inside the cancellation window.',
            own: ['Cancel'],
            journey: 'Cancel payment, SCHEDULED, inside the cancellation window',
            wfId: '{paymentId}-cancel',
            answer: 'CANCELLED, and CANCELLED again for a repeat',
            chips: five('CONSUMER', 'N', 'N'),
            behave: 'Example values. Cancel varies by account type and AR posting.',
            move: {Cancel: 'SCHEDULED to CANCELLED'},
            notes: {
              Cancel: `${CANCEL_NOTE} One guarded update to CANCELLED also cancels the payment's Work Tracker rows. The event and message go out after the reply.`,
            },
            end: 'CANCELLED is final.',
          },
          {
            id: 'no',
            wf: 'CancelPayment',
            tag: 'a no',
            lead: 'Cancel a payment the customer said no to, made while another was pending.',
            own: ['Cancel'],
            journey: "Cancel payment, PENDING and waiting for a go-ahead, on the customer's no",
            wfId: '{paymentId}-cancel',
            answer: 'CANCELLED, and CANCELLED again for a repeat',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values. Cancel varies by account type and AR posting.',
            move: {Cancel: 'PENDING to CANCELLED'},
            notes: {
              Cancel:
                'No window check. One guarded update on PENDING also cancels the CONFIRM_EXPIRY row. A no and a yes from two tabs race on that guard: one wins, and the other gets 409. The event and message go out after the reply.',
            },
            end: 'CANCELLED is final.',
          },
        ],
      },
      {
        fn: ['CreateConfirm|PendingPayment.v1'],
        from: 'a channel',
        calls: 'A channel calls',
        does: 'go ahead with a payment that waited for the customer, with the same payment ID',
        api: ['POST', '/payments/{payment-id}/confirm'],
        roads: [
          {
            id: 'confirm',
            wf: 'ConfirmPayment',
            lead: 'Go ahead with a payment once the customer has confirmed their bank details, or given the go-ahead.',
            stages: ['Verify', 'Execute', 'Fulfil'],
            journey: 'Confirm payment, PENDING and waiting for bank confirmation or a go-ahead, inside the confirmation window',
            wfId: '{paymentId}-confirm',
            answer: 'once Verify decides',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: "Example values. Bank confirmation picks Verify's bank-confirmation implementation, and a go-ahead its go-ahead implementation.",
            move: {Verify: 'PENDING to ACCEPTED or DECLINED'},
            notes: {
              Verify:
                "One commit, guarded on PENDING, that also cancels the CONFIRM_EXPIRY row. The caller's update returns here. A payment no longer PENDING gets 409, such as one cancelled when its window closed.",
            },
            exc: {
              'Verify|InstrumentActivities': {kind: 'call', note: "also asks whether the instrument's verification token is valid"},
            },
            then: [PAID],
          },
        ],
      },
      {
        fn: ['CreatePayment|Installment.v1'],
        from: 'a channel',
        calls: 'A channel calls',
        does: 'pay today and create a plan of future installments',
        api: ['POST', '/payment-installments'],
        roads: [
          {
            id: 'payplan',
            wf: 'Pay & Plan',
            plain: true,
            full: 'Pay & Plan, a composite workflow',
            lead: 'Pay today, and create a plan of future installments.',
            stages: CVEF,
            child: CVEF,
            childWf: 'CreateImmediatePayment',
            journey: 'Pay & Plan',
            wfId: '{paymentId}-init',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values.',
            first: 'It runs CreateImmediatePayment as a child on the Online cluster.',
            after: 'Then it calls the Installments API, then makes an optional Autopay update.',
            then: [{to: 'immediate', text: 'the payment runs as a child'}],
          },
        ],
      },
      {
        fn: ['CreateCreditBalance|Refund.v1'],
        from: 'a channel',
        calls: 'A channel calls',
        does: 'refund a credit balance on a card account',
        api: ['POST', '/refunds'],
        roads: [
          {
            id: 'refund',
            wf: 'CreateBalanceRefund',
            lead: 'Refund a credit balance, from a channel.',
            stages: CVEF,
            journey: 'Credit balance refund, from a channel',
            wfId: '{paymentId}-init',
            answer: "with the refund's result",
            behave: 'Its detailed steps are still to be defined, so there are no example values yet.',
            tbd: 'Its detailed steps are still to be defined. It follows the payment path.',
          },
        ],
      },
    ],
  },
  {
    key: 'pulled',
    term: 'Stored by One-Data, then pulled',
    desc: 'the inbox and a dispatcher',
    cluster: 'Offline',
    start: 'dispatcher start',
    requests: [
      {
        fn: ['CreateBillpayTransaction|FromAccountsReceivable.v1'],
        from: 'AR',
        calls: 'Accounts Receivable (AR) calls',
        does: 'payments and refunds that AR raises, never a corporate payment. One-Data stores each one and replies 202',
        inbox: 'AR intake dispatcher',
        ctl: 'ctl-intake',
        roads: [
          {
            id: 'arScheduled',
            wf: 'CreateScheduledPayment',
            tag: 'from AR',
            lead: 'A payment AR raises, for a future date.',
            stages: CV,
            journey: 'From Accounts Receivable, future-dated',
            wfId: '{paymentId}-init',
            prio: [1, '"intake"'],
            chips: five('CONSUMER', 'N', 'N'),
            behave:
              'Example values. AR never raises a corporate payment, and a future-dated payment never clears in real time.',
            notes: {Verify: 'Its SCHEDULED commit writes the SCHED_EXEC row.'},
            then: [{to: 'execute', text: 'on the due date, its SCHED_EXEC row'}],
          },
          {
            id: 'arRefund',
            wf: 'CreateBalanceRefund',
            tag: 'from AR',
            lead: 'A refund AR raises.',
            stages: CVEF,
            journey: 'Credit balance refund, raised by AR',
            wfId: '{paymentId}-init',
            prio: [1, '"intake"'],
            behave: 'Its detailed steps are still to be defined, so there are no example values yet.',
            tbd: 'Its detailed steps are still to be defined. It follows the payment path.',
          },
        ],
      },
      {
        fn: ['CreateMoneyMovement|EventHandler.v1'],
        from: 'MR/M3, a return',
        calls: 'MR/M3 sends a return to',
        handler: true,
        does: 'it stores the return in the inbox',
        inbox: 'returns dispatcher',
        ctl: 'ctl-return',
        roads: [
          {
            id: 'returned',
            wf: 'ProcessReturnedPayment',
            lead: "A payment the customer's bank returned.",
            own: ['Return', 'QueueRepresentment'],
            journey: 'Money movement event, a return',
            wfId: '{paymentId}-return-{seq}',
            prio: [5, '"returns"'],
            chips: five('CONSUMER', 'N', 'N'),
            behave:
              'Example values. Return varies by account type, and QueueRepresentment by the four behaviors other than bank confirmation.',
            notes: {
              Return:
                'It checks the payment, full or split, the presentment that came back, and its status: PROCESSING, PROCESSED, PAID, or REPRESENTED when it is returned again. That presentment stays RETURNED.',
              QueueRepresentment:
                "It judges whether the payment can be represented under the market's rules (which return reasons can be represented, and how many times) and sets the date from the same rules, then writes the next presentment as a new row, numbered one higher, in REPRESENTING, with that date as its clearing date and a REPRESENT row due on it.",
            },
            then: [{to: 'represent', text: 'on the representment date, its REPRESENT row'}],
          },
        ],
      },
      {
        fn: ['CreateInboundPayment.v1'],
        from: 'a third party',
        calls: 'A third party calls',
        does: 'a push payment, sent in by a third party. One-Data stores it and replies 202',
        inbox: 'inbound dispatcher',
        ctl: 'ctl-inbound',
        roads: [
          {
            id: 'inbound',
            wf: 'ProcessInboundPayment',
            lead: 'A push payment, sent in by a third party.',
            stages: CVEF,
            journey: 'Inbound payment, initiated by a third party',
            wfId: '{paymentId}-init',
            prio: [3, '"inbound"'],
            chips: five('CONSUMER', 'N', 'N'),
            behave: "Example values. Verify's inbound implementation answers ACCEPTED or DISALLOWED; only a push payment can be disallowed.",
            move: {Verify: 'ACCEPTED or DISALLOWED'},
            then: [PAID],
          },
        ],
      },
    ],
  },
  {
    key: 'callback',
    term: 'Calls back',
    desc: 'async start',
    cluster: 'Offline',
    start: 'async start, 202',
    requests: [
      {
        fn: ['CreatePayment|Allocations.v1'],
        from: 'the allocations manager',
        calls: 'The allocations manager calls',
        does: 'one numbered batch of allocations for a corporate payment',
        api: ['POST', '/payments/{payment-id}/allocations'],
        stores: true,
        roads: [
          {
            id: 'receive',
            wf: 'ReceiveAllocations',
            lead: "One batch of a corporate payment's allocations.",
            own: ['ReceiveAllocations'],
            journey: 'Allocations callback, a corporate payment',
            wfId: '{paymentId}-allocations-{batch}',
            chips: five('CORPORATE', 'N', 'N'),
            behave: 'Example values. ReceiveAllocations varies by nothing.',
            notes: {
              ReceiveAllocations:
                'It checks the stored batch and writes no legs. The batch that completes the amount moves the payment to ALLOCATED and writes its ALLOC_EXEC row. Earlier batches change no state.',
            },
            then: [{to: 'corpExecute', text: 'once the batches add up, its ALLOC_EXEC row'}],
          },
        ],
      },
    ],
  },
  {
    key: 'due',
    term: 'Falls due',
    desc: 'a Work Tracker row and a dispatcher',
    cluster: 'Offline',
    start: 'dispatcher start',
    requests: [
      {
        row: 'SCHED_EXEC',
        by: 'scheduled-payments dispatcher',
        ctl: 'ctl-sched',
        runs: "One Schedule per market, at the market's execution time in its time zone",
        writer: 'CreateScheduledPayment',
        wrote: ['scheduled', 'arScheduled'],
        written: 'in its SCHEDULED commit, for a payment that is not corporate',
        origin: ['CreatePayment.v3', 'CreateBillpayTransaction|FromAccountsReceivable.v1'],
        due: "the market's execution time on the due date",
        roads: [
          {
            id: 'execute',
            wf: 'ExecuteScheduledPayment',
            lead: 'A scheduled payment, on its due date.',
            stages: ['Reverify', 'Execute', 'Fulfil'],
            journey: 'Create payment or from Accounts Receivable, future-dated, on the due date',
            wfId: '{paymentId}-execute',
            prio: [1, 'the market'],
            today: true,
            chips: five('CONSUMER', 'N', 'N'),
            behave: "Example values, from today's config: the dispatcher calls the Router again on the due date.",
            notes: {Reverify: 'Guarded on SCHEDULED, so a cancel and the execution can never both win.'},
            after: 'The last commit marks the SCHED_EXEC row DONE, or FAILED when retries run out.',
            then: [PAID],
          },
        ],
      },
      {
        row: 'ALLOC_REQUEST',
        by: 'allocation-request dispatcher',
        ctl: 'ctl-alloc',
        runs: 'A Schedule every minute',
        writer: 'CreateImmediatePayment or CreateScheduledPayment',
        wrote: ['immediate', 'scheduled'],
        written: "in Verify's commit, for a corporate payment",
        origin: ['CreatePayment.v3'],
        due: "at once for pay today, or at the market's fetch time",
        roads: [
          {
            id: 'request',
            wf: 'RequestAllocations',
            lead: 'A corporate payment asks for its allocations.',
            own: ['RequestAllocations'],
            journey: 'An ALLOC_REQUEST row falls due, for a corporate payment',
            wfId: '{paymentId}-allocations',
            prio: [2, 'its payment ID', "The queue's default per-key limit, so one payment can't take the whole queue."],
            chips: five('CORPORATE', 'N', 'N'),
            behave: 'Example values. RequestAllocations varies by nothing.',
            notes: {
              RequestAllocations:
                'A guarded update to ALLOCATING, from SCHEDULED or, for pay today, ACCEPTED. Then it asks the allocations manager and ends; no workflow waits for the answer. A payment cancelled first gets no request.',
            },
            then: [{to: 'receive', text: 'the allocations manager calls back, one batch at a time'}],
          },
        ],
      },
      {
        row: 'ALLOC_EXEC',
        by: 'allocated-payments dispatcher',
        ctl: 'ctl-allocated',
        runs: 'A Schedule every minute',
        writer: 'ReceiveAllocations',
        wrote: ['receive'],
        written: 'once the batches add up',
        origin: ['CreatePayment.v3'],
        due: 'at once for pay today, or at the execution time on the due date',
        roads: [
          {
            id: 'corpExecute',
            wf: 'ExecuteScheduledPayment',
            tag: 'corporate',
            lead: 'A corporate payment, once ALLOCATED.',
            stages: ['Reverify', 'Execute'],
            cond: {Reverify: 'Only when scheduled: pay today skips it.'},
            journey: 'An ALLOC_EXEC row falls due, for a corporate payment, scheduled or paid today',
            wfId: '{paymentId}-execute',
            prio: [2, 'its payment ID', "The queue's default per-key limit, so one payment can't take the whole queue."],
            today: true,
            chips: five('CORPORATE', 'N', 'N'),
            behave: "Example values, from today's config. Execute's corporate implementation runs.",
            move: {Reverify: 'ALLOCATED to ACCEPTED or DECLINED'},
            notes: {
              Execute:
                'It clears the parent once, at payment level, with no AR or open-to-buy call. Its commit releases the legs.',
            },
            exc: {
              'Execute|ClearingActivities': {kind: 'call', note: 'once, for the parent'},
              'Execute|ReceivablesActivities': {kind: 'skip', note: 'per leg instead'},
              'Execute|AuthorizationActivities': {kind: 'skip', note: 'per leg instead'},
              'Execute|InstrumentActivities': {kind: 'skip', note: 'per leg instead, before open-to-buy'},
            },
            stop: {
              title: 'No Fulfil for a corporate parent.',
              text: "The leg dispatcher's completion check sets the parent PROCESSED once every leg is PROCESSED or PAID.",
            },
            then: [{to: 'leg', text: 'the leg dispatcher writes the legs and starts one workflow per leg'}],
          },
        ],
      },
      {
        row: 'ALLOC_LEG',
        by: 'leg dispatcher',
        ctl: 'ctl-leg',
        runs: 'A Schedule every minute',
        writer: 'the leg dispatcher',
        written: "when it writes the legs, once the parent's Execute has released them",
        origin: ['CreatePayment.v3'],
        due: 'when the leg is written',
        roads: [
          {
            id: 'leg',
            wf: 'ExecuteSplitPayment',
            lead: 'One leg of a corporate payment.',
            stages: ['Execute', 'Fulfil'],
            journey: 'An ALLOC_LEG row falls due, one per leg',
            wfId: '{paymentId}_{seq}-execute',
            prio: [2, "the parent's payment ID", "A per-key limit, so one large payment can't starve the others."],
            chips: five('CORPORATE', 'N', 'N'),
            behave: 'Example values. A corporate leg never clears.',
            exc: {'Execute|ClearingActivities': {kind: 'skip', note: 'a corporate leg never clears'}},
            after:
              "The leg dispatcher's completion check sets the parent PROCESSED once every leg is PROCESSED or PAID, and sends the parent's RTF event and Raven message first.",
            then: [{to: 'paid', text: 'each leg turns PAID, and the parent stays PROCESSED'}],
          },
        ],
      },
      {
        row: 'REPRESENT',
        by: 'representment dispatcher',
        ctl: 'ctl-repr',
        runs: 'One Schedule per market, every few minutes',
        writer: 'ProcessReturnedPayment',
        wrote: ['returned'],
        written: 'at QueueRepresentment',
        origin: ['CreateMoneyMovement|EventHandler.v1'],
        due: 'on the date market rules set',
        roads: [
          {
            id: 'represent',
            wf: 'ProcessRepresentment',
            lead: "A returned payment's next presentment.",
            own: ['Represent'],
            journey: 'Representment falls due, a REPRESENT row',
            wfId: '{paymentId}-represent-{seq}',
            prio: [4, 'the market'],
            chips: five('CONSUMER', 'N', 'N'),
            behave: 'Example values. Represent varies by the four behaviors other than bank confirmation.',
            notes: {
              Represent:
                "It rechecks eligibility with checks of its own, still to be defined, not Verify's calls to Payment Instruments, Payment Options or Plans. Then it sends the new presentment: REPRESENTED, or DECLINED if the recheck fails and nothing is sent.",
            },
            then: [{to: 'returned', text: 'if this presentment is returned too, under its own workflow ID'}],
          },
        ],
      },
      {
        row: 'CONFIRM_EXPIRY',
        by: 'confirmation-expiry dispatcher',
        ctl: 'ctl-expiry',
        runs: 'A Schedule every minute',
        writer: 'CreateImmediatePayment',
        wrote: ['bank', 'goahead'],
        written: 'at RequestConfirmation',
        origin: ['CreatePayment.v3'],
        due: "when the market's confirmation window closes",
        roads: [
          {
            id: 'expire',
            wf: 'CancelPayment',
            tag: 'expiry',
            lead: 'A payment the customer never confirmed, at their bank or with a go-ahead.',
            own: ['Cancel'],
            journey: 'Confirmation window closes, a CONFIRM_EXPIRY row and the payment still PENDING',
            wfId: '{paymentId}-cancel',
            prio: [4, '"expiry"'],
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: 'Example values. Cancel varies by account type and AR posting.',
            move: {Cancel: 'PENDING to CANCELLED'},
            notes: {
              Cancel:
                'No window check. The guard is on PENDING, so a payment confirmed first is left alone. As for any cancel, the CANCELLED event goes to RTF and the message to the customer through Raven.',
            },
            end: 'CANCELLED is final. A confirm after this gets 409.',
          },
        ],
      },
    ],
  },
  {
    key: 'drain',
    term: 'Not routed',
    desc: 'a Schedule, every 30 seconds',
    cluster: 'Offline',
    start: 'a Schedule, no Router',
    drain: true,
    requests: [
      {
        fn: ['CreateMoneyMovement|EventHandler.v1', 'CreateAccountsReceivable|TransactionEventHandler.v1'],
        from: 'settlements from MR/M3, postings from GAR',
        ready: true,
        roads: [
          {
            id: 'paid',
            wf: 'ProcessPaidEvents',
            lead: 'The PAID drain: it settles what One-Data has marked READY.',
            own: ['Settle'],
            wfId: "its Schedule's ID plus the trigger time",
            notes: {
              Settle:
                'Up to 500 READY rows a batch, in one transaction: each payment or leg goes from PROCESSED to PAID. Then the PAID events go to RTF.',
            },
            then: [{to: 'returned', text: 'PAID is final, unless a return arrives'}],
          },
        ],
      },
    ],
  },
];

/* What follows when a pay-today or scheduled payment is corporate. Each step
   names the road that runs it and the state the payment reaches there. */
export const CORP = {
  today: {
    lead: 'Pay today, for a corporate payment.',
    row: "row, in Verify's commit, due at once",
    path: [
      {
        state: 'ACCEPTED',
        to: 'immediate',
        how: 'Online, Update-With-Start',
        did: 'Capture, then Verify, which writes the ALLOC_REQUEST row.',
      },
      {
        state: 'ALLOCATING',
        to: 'request',
        how: 'Offline, allocation-request dispatcher',
        did: 'It asks the allocations manager and ends. From here a cancel or an update gets 409.',
      },
      {
        state: 'ALLOCATED',
        to: 'receive',
        how: 'Offline, async start, 202',
        did: 'One run per batch. The batch that completes the amount writes the ALLOC_EXEC row.',
        quiet: "Late batches: the payment waits in ALLOCATING, and an alert fires at the market's alert point.",
      },
      {
        state: 'PROCESSING',
        to: 'corpExecute',
        how: 'Offline, allocated-payments dispatcher',
        did: 'No Reverify for pay today. Execute clears the parent once and releases the legs. No Fulfil.',
      },
      {
        state: 'PROCESSED',
        to: 'leg',
        how: 'Offline, leg dispatcher, one per leg',
        did: 'Each leg runs Execute without clearing, then Fulfil. The completion check sets the parent PROCESSED.',
      },
      {state: 'PAID, legs', to: 'paid', how: 'Offline, a Schedule', did: 'Each leg turns PAID. The parent stays PROCESSED.'},
    ],
  },
  scheduled: {
    lead: 'A payment for a future date, for a corporate payment.',
    row: "row, in Verify's commit, due at the market's fetch time",
    path: [
      {
        state: 'SCHEDULED',
        to: 'scheduled',
        how: 'Online, Update-With-Start',
        did: 'Cancel and update work inside the cancellation window, until ALLOCATING.',
      },
      {
        state: 'ALLOCATING',
        to: 'request',
        how: 'Offline, at the fetch time',
        did: 'On the due date, or a set number of hours or days before it. From here a cancel or an update gets 409.',
      },
      {
        state: 'ALLOCATED',
        to: 'receive',
        how: 'Offline, async start, 202',
        did: 'The batch that completes the amount writes the ALLOC_EXEC row, due at the execution time, or at once if it has passed.',
      },
      {
        state: 'PROCESSING',
        to: 'corpExecute',
        how: 'Offline, allocated-payments dispatcher',
        did: 'Reverify first, from ALLOCATED. Then Execute clears the parent once and releases the legs.',
      },
      {
        state: 'PROCESSED',
        to: 'leg',
        how: 'Offline, leg dispatcher, one per leg',
        did: 'Each leg runs Execute without clearing, then Fulfil.',
      },
      {state: 'PAID, legs', to: 'paid', how: 'Offline, a Schedule', did: 'Each leg turns PAID. The parent stays PROCESSED.'},
    ],
  },
};

/* ---------------------------------------------------------- the rules -- */

export const plain = (s) => s.replace(/\|/g, '');

/* every road, with what it inherits from its band and its request, in
   index order */
export const ROADS = [];
BANDS.forEach((band) => {
  band.requests.forEach((req) => {
    req.roads.forEach((r) => {
      ROADS.push({
        ...r,
        band,
        req,
        cluster: band.cluster,
        name: plain(r.wf),
        full: r.full || `${plain(r.wf)}Workflow`,
        stages: r.stages || [],
        own: r.own || [],
        child: r.child || [],
        cond: r.cond || {},
        exc: r.exc || {},
        notes: r.notes || {},
        move: r.move || {},
        then: r.then || [],
      });
    });
  });
});
export const ROAD = Object.fromEntries(ROADS.map((r) => [r.id, r]));
export const IFACE = Object.fromEntries(IFACES.map((f) => [f.name, f]));

/* The stages a road runs, in order. A road whose child does the shared
   stages runs its own first: Update cancels, then the child captures. Any
   other runs its own last: Capture, then RequestConfirmation. */
export function seq(j) {
  return j.child.length ? [...j.own, ...j.stages] : [...j.stages, ...j.own];
}

/* where the Verify move differs from the general one */
const VERIFY = {
  scheduled: 'SCHEDULED or DECLINED',
  arScheduled: 'SCHEDULED or DECLINED',
  update: 'SCHEDULED or DECLINED',
};

export function moveOf(j, s) {
  if (j.move[s]) return j.move[s];
  if (s === 'Verify') return VERIFY[j.id] || 'ACCEPTED or DECLINED';
  return MOVE[s];
}

/* Raven at Verify, under the default Raven setting: a scheduled payment is
   told; a payment made today only when it declines; an inbound one never,
   since DISALLOWED is not one of the states the customer is told about. A
   market or an account type can change the setting. */
function ravenAtVerify(j) {
  if (j.id === 'inbound') return null;
  if (VERIFY[j.id]) return '';
  return 'only if it declines';
}

/* {stage: {kind, note}} for the calls road j makes to interface f.
   kind: call; child (a child workflow makes it); cond (only in some cases);
   or skip (this road never does, though the stage usually would). */
export function calls(j, f) {
  const out = {};
  if (f.name === 'InboxActivities') return out;
  seq(j).forEach((s) => {
    const child = j.child.includes(s);
    const sometimes = Boolean(j.cond[s]);
    const base = child ? 'child' : 'call';
    if (f.rail) {
      if (f.name === 'LifecycleEventActivities') {
        if (s === 'RequestConfirmation') return;
        if (s === 'ReceiveAllocations') {
          out[s] = {kind: 'cond', note: 'only the batch that completes the amount'};
          return;
        }
        if (s === 'Fulfil') {
          out[s] = {kind: sometimes ? 'cond' : base, note: 'before the commit'};
          return;
        }
        if (s === 'Settle') {
          out[s] = {kind: 'call', note: 'the PAID events, after the batch commits'};
          return;
        }
      }
      out[s] = {kind: sometimes ? 'cond' : base};
      return;
    }
    const x = j.exc[`${s}|${f.name}`];
    if (x) {
      out[s] = x;
      return;
    }
    if (!(f.at || []).includes(s)) return;
    if (f.name === 'BankConfirmationActivities' && s !== 'RequestConfirmation') return;
    let kind = sometimes ? 'cond' : base;
    let note;
    if (f.name === 'CommunicationActivities') {
      if (s === 'Verify') {
        const rv = ravenAtVerify(j);
        if (rv === null) return;
        if (rv) {
          note = rv;
          if (kind === 'call') kind = 'cond';
        }
      } else if (s === 'Reverify' || s === 'Represent') {
        note = 'only if it declines';
        if (kind === 'call') kind = 'cond';
      } else if (s === 'Fulfil') {
        note = 'last, before the commit';
      }
    }
    if (f.name === 'BankConfirmationActivities') note = 'for the redirect link';
    if (f.name === 'PlansActivities') {
      note = 'only where the profile requires mandate authorization';
      if (kind === 'call') kind = 'cond';
    }
    if (f.name === 'InstrumentActivities' && s === 'Execute') {
      note = 'first, for the clear-text details open-to-buy and the notifications need';
    }
    out[s] = note ? {kind, note} : {kind};
  });
  return out;
}

/* roads whose workflow ends with the delete call to One-Data: a create from
   a channel, and the confirm or cancel that ends a payment's wait */
const DELETES = new Set(['immediate', 'scheduled', 'bank', 'goahead', 'confirm', 'no', 'expire']);

/* how a road reaches One-Data, which no stage calls */
export function inboxUse(j) {
  if (j.band.drain) return 'fetches READY rows before Settle, and marks them after';
  if (j.band.key === 'pulled') return 'its dispatcher reads the request, and marks it once started';
  if (DELETES.has(j.id)) return "calls the delete API at the end, so the payment leaves One-Data's Redis";
  return null;
}

/* does road j call interface f, at any stage */
export function uses(j, f) {
  if (f.name === 'InboxActivities') return Boolean(inboxUse(j));
  return Object.values(calls(j, f)).some((c) => c.kind !== 'skip');
}

/* ------------------------------------------- an activity, opened in a card -- */

/* a, b and c */
export function list(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const FAILS = {
  must: 'It must succeed: a 429 waits out Retry-After, and other errors retry from 1 second, doubling up to 60.',
  hold: 'It must succeed, so it gets a long timeout: an outage holds the payment where it is instead of failing it.',
  decline: 'A business failure found here, such as a closed account, declines the payment and is never retried.',
  mandate: 'A mandate that fails its check declines the payment and is never retried.',
};

/* where a call runs, on road j's cluster */
function runsOn(j, f) {
  if (f.name === 'PaymentStore') {
    return 'Oracle, through a local activity, so there is no task round trip. If Oracle is down, the payment pauses and carries on when it is back.';
  }
  if (f.name === 'LifecycleEventActivities') {
    return "RTF, on the workflow's own queue, since RTF has no rate limit. The workflow sends one state change at a time, so the payment's events reach RTF in order.";
  }
  if (f.name === 'InboxActivities') {
    return "One-Data's inbox functions, on the workflow's own queue, since nobody throttles them.";
  }
  const sys = f.long || f.system;
  if (f.name === 'TransactionNotificationActivities' && j.cluster !== 'Online') {
    return 'One method per system, each on its own queue: TFNE on ds-tfne, GPHDB on ds-gphdb and B2Notifier on ds-b2notifier. The governor sets each queue\'s rate limit, so each system keeps its own.';
  }
  if (j.cluster === 'Online') return `${sys}, on online-wf, the Online cluster's main task queue. Online calls are capped only while a SEPA run needs the room.`;
  if (f.queue.startsWith('ds-')) {
    return `${sys}, on ${f.queue}. The governor sets that queue's rate limit, so it is the one choke point for ${f.system}.`;
  }
  return `${sys}, on the workflow's own queue: it has no rate limit.`;
}

/* what other roads do with f, as a count */
export function otherRoads(j, f) {
  return ROADS.filter((r) => r.id !== j.id && uses(r, f)).length;
}

/* The lines an activity shows when it is opened in road j's card, at stage
   s with call c. With no stage, it is one of the calls every stage makes. */
export function callDetail(j, f, s, c) {
  const out = [runsOn(j, f)];
  if (!s) {
    if (f.name === 'PaymentStore') {
      out.push('Every stage on this road commits here: its new state, a timeline entry and any Work Tracker rows, in one guarded transaction.');
    } else if (f.name === 'LifecycleEventActivities') {
      out.push('Every state change on this road goes out as an event.');
      const cl = calls(j, f);
      seq(j).forEach((t) => {
        if (!cl[t]) out.push(`${t} changes no state, so it sends none.`);
        else if (cl[t].note) out.push(`At ${t}: ${cl[t].note}.`);
      });
    } else {
      out.push(`On this road, ${inboxUse(j)}.`);
    }
  } else if (c.kind === 'skip') {
    out.push(`This road never makes this call: ${c.note}.`);
  } else if (c.kind === 'child' && j.childWf) {
    /* the call's own note is already on its line, so it is not repeated */
    out.push(`The child ${j.childWf} makes this call.`);
  }
  const fails = (s && f.failsAt && f.failsAt[s]) || f.fails;
  if (fails && !(s && c.kind === 'skip')) out.push(FAILS[fails]);
  if (f.name === 'InstrumentActivities' && s === 'Execute' && c.kind !== 'skip') {
    out.push('The details stay in the workflow for Fulfil, and its history keeps them encrypted by the payload codec.');
  }
  if (s) {
    const cl = calls(j, f);
    const also = Object.keys(cl).filter((t) => t !== s && cl[t].kind !== 'skip');
    if (also.length) out.push(`This road also calls it at ${list(also)}.`);
  }
  return out;
}

function fairness(key) {
  return key.startsWith('"') ? `fairness key ${key}` : `${key} as fairness key`;
}

/* the Router's six steps, with this road's outcome */
export function router(j) {
  const {band, req} = j;
  const where = req.api ? `${req.api[0]} ${req.api[1]}` : null;
  const admit = {
    caller: {
      main: `Live: this market and account type take ${where} in this environment.`,
      note: 'If not, 422, and the caller does not retry.',
    },
    pulled: {
      main: 'Live: the market and account type of the stored request.',
      note: 'If not, the dispatcher marks the request REJECTED, which raises an alert. The sender is not told.',
    },
    callback: {
      main: "Live, and inside the allocations callback's traffic budget.",
      note: 'If not, 422. Over budget, 429 with Retry-After, and the allocations manager retries.',
    },
    due: {
      main: "Live: the row's market and account type.",
      note: 'A row is refused only if its market was taken out of service after the row was written. Its dispatcher marks it FAILED, which raises the retries-exhausted alert. Never 429.',
    },
  }[band.key];

  const place =
    j.cluster === 'Online'
      ? {
          main: `Online cluster, task queue online-wf, as ${j.wfId}.`,
          note: "online-wf is the Online cluster's main task queue. Online calls to a downstream are capped only while a SEPA run needs the room.",
        }
      : {
          main: j.prio
            ? `Offline cluster, task queue offline-wf, priority ${j.prio[0]}, ${fairness(j.prio[1])}, as ${j.wfId}.`
            : `Offline cluster, task queue offline-wf, as ${j.wfId}.`,
          note: j.prio
            ? j.prio[2] || 'Priority and fairness are set once at the start, and its activities inherit them.'
            : 'The workflow ID comes from the request: the payment ID and the batch number.',
        };

  const start = {
    caller: {
      main: 'Update-With-Start, conflict policy USE_EXISTING.',
      note: `A repeated request joins the same workflow.${j.answer ? ` The caller's answer returns ${j.answer}.` : ''}`,
    },
    pulled: {
      main: 'Dispatcher start, with the workflow ID from the request.',
      note: 'A start that fails as already started counts as done, and reuse policy REJECT_DUPLICATE stops a second run after it closes.',
    },
    callback: {
      main: 'Async start, before the 202 reply.',
      note: 'A repeated batch finds the same workflow: a start that fails as already started counts as done.',
    },
    due: {
      main: 'Dispatcher start, reuse policy REJECT_DUPLICATE.',
      note: 'A repeated start counts as done, so the work runs once.',
    },
  }[band.key];

  return [
    {name: 'Admit', ...admit},
    {name: 'Pick the journey', main: `${j.journey}.`, note: `So ${j.full}, on the ${j.cluster} cluster.`},
    {name: 'Resolve behaviors', chips: j.chips || [], note: j.behave || ''},
    {
      name: 'Pin the plan key',
      main: 'The journey, the five resolved behaviors and the config version (v12, an example).',
      note: j.today
        ? "On the due date the dispatcher calls the Router again, so the payment runs with today's config. The version used at scheduling stays in its timeline for audit."
        : 'The running workflow keeps this plan, and its build, to the end.',
    },
    {name: 'Place', ...place},
    {name: 'Start', ...start},
  ];
}

/* one line for the Router's outcome, where the six steps are folded away */
export function routerLine(j) {
  return `${j.cluster}, ${j.band.start}, as ${j.wfId}`;
}
