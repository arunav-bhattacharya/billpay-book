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
  RequestConfirmation: 'PENDING, unchanged',
  RequestAllocations: 'ALLOCATING',
  ReceiveAllocations: 'ALLOCATED',
  Return: 'RETURNED',
  QueueRepresentment: 'REPRESENTING',
  Represent: 'REPRESENTED or DECLINED',
  Settle: 'PAID',
};

/* One interface per system. `at` is every stage that calls it on some road;
   `rail` marks the two every stage calls. */
export const IFACES = [
  {name: 'PaymentStore', system: 'Oracle', queue: 'local activity', rail: true, note: 'every stage commits here'},
  {name: 'LifecycleEventActivities', system: 'RTF', queue: "the workflow's queue", rail: true, note: 'every state change'},
  {
    name: 'CommunicationActivities',
    system: 'Raven',
    queue: 'ds-comms',
    at: ['Verify', 'Reverify', 'Fulfil', 'Cancel', 'Return', 'Represent'],
    note: 'where the customer is told',
  },
  {
    name: 'InstrumentActivities',
    system: 'Payment Instruments',
    queue: "the workflow's queue",
    at: ['Verify', 'Reverify', 'Represent'],
    note: 'its own queue once it has an agreed limit',
  },
  {
    name: 'OptionsActivities',
    system: 'Payment Options',
    queue: "the workflow's queue",
    at: ['Verify', 'Reverify', 'Represent'],
    note: 'its own queue once it has an agreed limit',
  },
  {
    name: 'ClearingActivities',
    system: 'MR/M3',
    queue: 'ds-clearing',
    at: ['Execute', 'Represent'],
    note: 'a corporate leg never clears',
  },
  {
    name: 'ReceivablesActivities',
    system: 'GAR',
    queue: 'ds-receivables',
    at: ['Execute'],
    note: 'a corporate parent leaves it to its legs',
  },
  {
    name: 'AuthorizationActivities',
    system: 'AMP',
    queue: 'ds-authorization',
    at: ['Execute'],
    note: 'a corporate parent leaves it to its legs',
  },
  {name: 'AccountingActivities', system: 'Accounting', queue: 'ds-accounting', at: ['Fulfil']},
  {name: 'BalanceControlActivities', system: 'eBNC', queue: 'ds-ebnc', at: ['Fulfil']},
  {name: 'RiskActivities', system: 'Risk', queue: 'ds-risk', at: ['Fulfil']},
  {name: 'AllocationActivities', system: 'Allocations manager', queue: 'ds-allocations', at: ['RequestAllocations']},
  {
    name: 'BankConfirmationActivities',
    system: 'Bank-confirmation provider',
    queue: "the workflow's queue",
    at: ['RequestConfirmation', 'Verify'],
    note: 'a Proposed name. Only the Online cluster calls it',
  },
  {
    name: 'InboxActivities',
    system: 'One-Data',
    queue: "the workflow's queue",
    at: [],
    note: 'no stage: the PAID drain and the inbox dispatchers',
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
            journey: 'Create payment, today, several instructions',
            wfId: '{paymentId}-init',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values.',
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
            answer: 'with PENDING and the redirect link',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave:
              'Example values. A BOTH turns bank confirmation to Y when the payment method needs the customer to confirm at their bank. Only consumer payments made today take it.',
            notes: {
              RequestConfirmation:
                "It runs after Capture, in place of Verify. It gets the provider's redirect link and commits a CONFIRM_EXPIRY row, guarded on PENDING. The caller gets PENDING with the link, and the PENDING event goes out.",
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
        does: 'cancel a SCHEDULED payment, inside the cancellation window',
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
        ],
      },
      {
        fn: ['ConfirmPayment.v1'],
        from: 'a channel',
        aside: 'a placeholder name',
        calls: 'A channel calls',
        does: "go ahead with a payment that waited for the customer's bank, with the same payment ID",
        api: ['POST', '/payments/{payment-id}/confirm'],
        roads: [
          {
            id: 'confirm',
            wf: 'ConfirmPayment',
            lead: 'Go ahead with a payment once the customer has confirmed their bank details.',
            stages: ['Verify', 'Execute', 'Fulfil'],
            journey: 'Confirm payment, PENDING and waiting for bank confirmation, inside the confirmation window',
            wfId: '{paymentId}-confirm',
            answer: 'once Verify decides',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: "Example values. Bank confirmation picks Verify's bank-confirmation implementation.",
            move: {Verify: 'PENDING to ACCEPTED or DECLINED'},
            notes: {
              Verify:
                "One commit, guarded on PENDING, that also cancels the CONFIRM_EXPIRY row. The caller's update returns here. A payment no longer PENDING gets 409, such as one cancelled when its window closed.",
            },
            exc: {
              'Verify|BankConfirmationActivities': {kind: 'cond', note: 'Proposed: asks whether the customer confirmed'},
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
        fn: ['MoneyMovementEvent|Handler.v1'],
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
                'It checks the payment, full or split, and its status first: PROCESSING, PROCESSED, PAID, or REPRESENTED when it is returned again.',
              QueueRepresentment:
                'It judges whether the payment can be represented and sets the date from market rules, then commits REPRESENTING with a REPRESENT row due on that date.',
            },
            then: [{to: 'represent', text: 'on the representment date, its REPRESENT row'}],
          },
        ],
      },
      {
        fn: ['CreateInboundPayment.v1'],
        from: 'a third party',
        calls: 'A third party calls',
        does: 'a payment a third party pushed. One-Data stores it and replies 202',
        inbox: 'inbound dispatcher',
        ctl: 'ctl-inbound',
        roads: [
          {
            id: 'inbound',
            wf: 'ProcessInboundPayment',
            lead: 'A payment a third party pushed.',
            stages: CVEF,
            journey: 'Inbound payment, initiated by a third party',
            wfId: '{paymentId}-init',
            prio: [3, '"inbound"'],
            chips: five('CONSUMER', 'N', 'N'),
            behave: "Example values. Verify's inbound implementation answers ACCEPTED or DISALLOWED.",
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
        aside: 'a placeholder name',
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
        origin: ['MoneyMovementEvent|Handler.v1'],
        due: 'on the date market rules set',
        roads: [
          {
            id: 'represent',
            wf: 'ProcessRepresentment',
            lead: 'A returned payment, presented again.',
            own: ['Represent'],
            journey: 'Representment falls due, a REPRESENT row',
            wfId: '{paymentId}-represent-{seq}',
            prio: [4, 'the market'],
            chips: five('CONSUMER', 'N', 'N'),
            behave: 'Example values. Represent varies by the four behaviors other than bank confirmation.',
            notes: {
              Represent:
                'It rechecks eligibility before anything goes to clearing: REPRESENTED, or DECLINED if the recheck fails.',
            },
            then: [{to: 'returned', text: 'if it is returned again, under a new workflow ID'}],
          },
        ],
      },
      {
        row: 'CONFIRM_EXPIRY',
        by: 'confirmation-expiry dispatcher',
        ctl: 'ctl-expiry',
        runs: 'A Schedule every minute (Proposed)',
        writer: 'CreateImmediatePayment',
        wrote: ['bank'],
        written: 'at RequestConfirmation',
        origin: ['CreatePayment.v3'],
        due: "when the market's confirmation window closes",
        roads: [
          {
            id: 'expire',
            wf: 'CancelPayment',
            tag: 'expiry',
            lead: 'A payment the customer never confirmed at their bank.',
            own: ['Cancel'],
            journey: 'Confirmation window closes, a CONFIRM_EXPIRY row and the payment still PENDING',
            wfId: '{paymentId}-cancel',
            prio: [5, '"expiry"', 'Both are Proposed.'],
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: 'Example values. Cancel varies by account type and AR posting.',
            move: {Cancel: 'PENDING to CANCELLED'},
            notes: {Cancel: 'No window check. The guard is on PENDING, so a payment confirmed first is left alone.'},
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
        fn: ['MoneyMovementEvent|Handler.v1', 'AccountsReceivable|TransactionEventHandler.v1'],
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

/* Raven at Verify: a scheduled payment is always told; a payment made today
   only when it declines; an inbound one never, since DISALLOWED is not one
   of the states the customer is told about. */
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
    out[s] = note ? {kind, note} : {kind};
  });
  return out;
}

/* how a road reaches One-Data's inbox, which no stage calls */
export function inboxUse(j) {
  if (j.band.drain) return 'fetches READY rows before Settle, and marks them after';
  if (j.band.key === 'pulled') return 'its dispatcher reads the request, and marks it once started';
  return null;
}

/* does road j call interface f, at any stage */
export function uses(j, f) {
  if (f.name === 'InboxActivities') return Boolean(inboxUse(j));
  return Object.values(calls(j, f)).some((c) => c.kind !== 'skip');
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
          note: "online-wf is the Online cluster's one task queue. Online traffic is never throttled.",
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
