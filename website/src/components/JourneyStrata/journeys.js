/**
 * JourneyStrata's content: every journey, as the segments it passes through.
 *
 * A journey is what a customer or a system asks for. A segment is one stretch
 * of it: one workflow run (`road`, a road from RouteLedger's model, which
 * supplies the workflow, its stages, the states they commit, how the Router
 * starts it and the systems each stage calls), or a wait between runs
 * (`wait`). What the model can't know is written here: what the customer
 * does and sees, what One-Data does, the Work Tracker rows, and, for a
 * journey that waits for a date, the time ruler.
 *
 * Items in a run segment carry `at`, the stage they line up under. Customer
 * moments: `m` is 'on' (it happens), 'choice' (it can happen: the customer's
 * choice) or 'quiet' (nobody is waiting). Every fact traces to the spec.
 */

const CREATE = {c: 'CreatePayment.v3', s: 'the pending check, then the create is stored'};
const DELETE_END = {c: 'DeletePendingPayment.v1', s: 'called at the end: the stored create and its pending entry go', at: 'last'};

const PAID_SEGMENT = {
  phase: ['Settled and posted', 'when both events are in'],
  road: 'paid',
  customer: [{t: 'Sees PAID', s: 'in their payment list', st: 'PAID', m: 'on', at: 'Settle'}],
  oneData: [{c: 'inbox', s: 'settlement from MR/M3, AR posting from GAR. READY when both are in', at: 'Settle'}],
};

const paidAfter = (ruler) => (ruler ? {...PAID_SEGMENT, ruler: [{t: 'the next 30-second run', at: 'Settle'}]} : PAID_SEGMENT);

export const GROUPS = [
  {
    label: 'Make a payment',
    journeys: [
      {
        id: 'today',
        term: 'Pay my bill today',
        kind: 'customer',
        meta: ['customer initiated', 'Online, then Offline for PAID', 'an answer within 2.5 s'],
        segments: [
          {
            phase: ['The request', 'the customer waits, 2.5 s at most'],
            road: 'immediate',
            waiting: true,
            customer: [
              {t: 'Pays today', s: 'amount, account', st: 'PENDING', m: 'on', at: 'Capture'},
              {t: 'Sees the answer', s: 'ACCEPTED, or DECLINED', st: 'ACCEPTED', m: 'on', at: 'Verify'},
              {t: 'Told PROCESSED', s: 'with a Raven message', st: 'PROCESSED', m: 'on', at: 'Fulfil'},
            ],
            oneData: [{...CREATE, at: 'Capture'}, DELETE_END],
          },
          paidAfter(false),
        ],
      },
      {
        id: 'later',
        term: 'Pay on a future date',
        kind: 'customer',
        days: true,
        meta: ['customer initiated', 'Online, then Offline', 'up to 30 days between, by default'],
        segments: [
          {
            phase: ['Day 0', 'seconds, while they wait'],
            road: 'scheduled',
            waiting: true,
            customer: [
              {t: 'Pays for a later date', s: 'amount, account, date', st: 'PENDING', m: 'on', at: 'Capture'},
              {t: 'Sees SCHEDULED', s: 'with a Raven message', st: 'SCHEDULED', m: 'on', at: 'Verify'},
            ],
            oneData: [{...CREATE, at: 'Capture'}, DELETE_END],
            oracle: [{row: 'SCHED_EXEC row', st: 'SCHEDULED', s: "written in Verify's commit", at: 'Verify'}],
            ruler: [
              {t: 'Day 0 · 0 s', at: 'Capture'},
              {t: 'within 2.5 s: the answer', at: 'Verify'},
            ],
          },
          {
            phase: ['Up to 30 days', 'by default'],
            wait: 'Nothing runs in Temporal. The payment is a row in Oracle.',
            customer: [{t: 'Can change or cancel', s: 'until the window closes', m: 'choice'}],
            oracle: [{row: 'SCHED_EXEC row', s: 'waits for its due time'}],
            ruler: [{t: 'up to 30 days'}],
          },
          {
            phase: ['The due date', "the market's execution time"],
            road: 'execute',
            customer: [{t: 'Told PROCESSED', s: 'with a Raven message', st: 'PROCESSED', m: 'on', at: 'Fulfil'}],
            oracle: [
              {row: 'SCHED_EXEC row', st: 'DISPATCHED', s: 'DISPATCHING when claimed, DISPATCHED once started', at: 'Reverify'},
              {row: 'SCHED_EXEC row', st: 'DONE', s: 'the last commit', at: 'Fulfil'},
            ],
            ruler: [
              {t: 'Day N · execution time', at: 'Reverify'},
              {t: 'during the run', at: 'Execute'},
            ],
          },
          paidAfter(true),
        ],
      },
      {
        id: 'bank',
        term: 'Pay by Bank today',
        kind: 'customer',
        meta: ['customer initiated', 'Online, one workflow throughout', 'minutes at the bank'],
        segments: [
          {
            phase: ['The create', 'the customer waits for the link'],
            road: 'bank',
            waiting: true,
            customer: [
              {t: 'Pays with a bank step', s: 'Pay with Bank Transfer, say', st: 'PENDING', m: 'on', at: 'Capture'},
              {t: "Gets the provider's link", s: 'or DECLINED with none', st: 'PENDING', m: 'on', at: 'RequestConfirmation'},
            ],
            oneData: [
              {...CREATE, at: 'Capture'},
              {c: 'DeletePendingPayment.v1', s: 'after the reply: only the stored create goes', at: 'RequestConfirmation'},
            ],
          },
          {
            phase: ['At the bank', 'the confirmation window, 10 minutes at most'],
            wait: 'The workflow waits on its own timer. No confirm in time, and the timer runs Cancel: CANCELLED.',
            customer: [{t: 'Confirms at the bank', s: "on the provider's site", m: 'choice'}],
          },
          {
            phase: ['The confirm', 'the customer waits again'],
            road: 'confirm',
            waiting: true,
            customer: [
              {t: 'Comes back and confirms', s: 'the same payment ID', m: 'on', at: 'Verify'},
              {t: 'Told PROCESSED', s: 'with a Raven message', st: 'PROCESSED', m: 'on', at: 'Fulfil'},
            ],
            oneData: [
              {c: 'CreateConfirmPendingPayment.v1', s: 'the confirm', at: 'Verify'},
              {c: 'DeletePendingPayment.v1', s: 'at the end: the entry goes', at: 'last'},
            ],
          },
          paidAfter(false),
        ],
      },
      {
        id: 'multi',
        term: 'Pay with multiple instructions',
        kind: 'customer',
        meta: ['customer initiated', 'Online', 'a bank account and MR Points, today'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            road: 'multiple',
            waiting: true,
            customer: [
              {t: 'Pays from a bank account and MR Points', s: 'two instructions', m: 'on', at: 'Capture'},
              {t: 'Sees the result', st: 'ACCEPTED', m: 'on', at: 'Verify'},
            ],
            oneData: [{...CREATE, at: 'Capture'}],
          },
          paidAfter(false),
        ],
      },
      {
        id: 'pending',
        term: 'Pay while another payment is pending',
        kind: 'customer',
        meta: ['customer initiated', 'Online, one workflow throughout', 'a market with the go-ahead on'],
        segments: [
          {
            phase: ['The create', 'the customer waits'],
            road: 'goahead',
            waiting: true,
            customer: [
              {t: 'Pays while another is pending', s: 'One-Data finds the other', st: 'PENDING', m: 'on', at: 'Capture'},
            ],
            oneData: [
              {c: 'CreatePayment.v3', s: "finds the pending payments and sends their IDs", at: 'Capture'},
              {c: 'DeletePendingPayment.v1', s: 'after the reply: only the stored create goes', at: 'last'},
            ],
          },
          {
            phase: ['The customer decides', 'the same window as a bank confirmation'],
            wait: 'The workflow waits on its own timer. A no, or no answer in time, runs Cancel: CANCELLED.',
            customer: [{t: 'Says yes, or no', s: 'shown the pending payments', m: 'choice'}],
          },
          {
            phase: ['The yes', 'the customer waits again'],
            road: 'confirm',
            waiting: true,
            customer: [
              {t: 'Says yes', s: 'ACCEPTED, or SCHEDULED for a later date', st: 'ACCEPTED', m: 'on', at: 'Verify'},
              {t: 'Told PROCESSED', s: 'with a Raven message', st: 'PROCESSED', m: 'on', at: 'Fulfil'},
            ],
            oneData: [
              {c: 'CreateConfirmPendingPayment.v1', s: 'the yes', at: 'Verify'},
              {c: 'DeletePendingPayment.v1', s: 'at the end: the entry goes', at: 'last'},
            ],
          },
          paidAfter(false),
        ],
      },
      {
        id: 'points',
        term: 'Pay with MR Points',
        kind: 'customer',
        meta: ['customer initiated', 'Online', 'today only'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            card: {
              name: 'Pay with MR Points',
              composite: true,
              cluster: 'Online',
              id: '{paymentId}-init',
              tbd: 'A composite across Billpay and Loyalty. Its steps and its calls to Loyalty are still to be defined.',
            },
            entry: {c: 'POST /payments', s: 'Online · Update-With-Start'},
            waiting: true,
            customer: [{t: 'Pays with points only', s: 'today', m: 'on'}],
            oneData: [{...CREATE}],
          },
        ],
      },
      {
        id: 'payplan',
        term: 'Pay & Plan',
        kind: 'customer',
        meta: ['customer initiated', 'Online', 'pays today, plans the rest'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            road: 'payplan',
            waiting: true,
            customer: [
              {t: 'Pays today and sets up a plan', s: 'future installments', m: 'on', at: 'Capture'},
              {t: 'Sees the answer', st: 'ACCEPTED', m: 'on', at: 'Verify'},
            ],
            oneData: [{c: 'CreatePaymentInstallment.v1', s: 'Pay & Plan', at: 'Capture'}],
            after: 'Then the Installments API sets up the plan, and an optional Autopay update follows.',
          },
          paidAfter(false),
        ],
      },
    ],
  },
  {
    label: 'Change a payment',
    journeys: [
      {
        id: 'update',
        term: 'Update a payment',
        kind: 'customer',
        meta: ['customer initiated', 'Online', 'inside the cancellation window'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            road: 'update',
            waiting: true,
            customer: [
              {t: 'Changes a scheduled payment', s: 'inside the window', m: 'on', at: 'Cancel'},
              {t: "Sees the new payment's result", s: 'with the same confirmation number', st: 'SCHEDULED', m: 'on', at: 'Verify'},
            ],
            oneData: [{c: 'UpdatePayment.v1', s: '409 outside the window', at: 'Cancel'}],
            oracle: [
              {row: 'old SCHED_EXEC row', st: 'CANCELLED', s: 'with the old payment', at: 'Cancel'},
              {row: 'new SCHED_EXEC row', st: 'SCHEDULED', s: "in the child's Verify", at: 'Verify'},
            ],
            payment: {Cancel: 'old payment'},
          },
        ],
        next: {to: 'later', text: 'The new payment then waits for its date, as on Pay on a future date.'},
      },
      {
        id: 'cancel',
        term: 'Cancel a payment',
        kind: 'customer',
        meta: ['customer initiated', 'Online', 'inside the cancellation window'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            road: 'cancel',
            waiting: true,
            customer: [{t: 'Cancels a scheduled payment', s: 'inside the window; 409 after', st: 'CANCELLED', m: 'on', at: 'Cancel'}],
            oneData: [{c: 'DeletePayment.v1', s: 'a repeat gets CANCELLED again', at: 'Cancel'}],
            oracle: [{row: 'SCHED_EXEC row', st: 'CANCELLED', s: 'in the same commit', at: 'Cancel'}],
          },
        ],
      },
    ],
  },
  {
    label: 'Refund a balance',
    journeys: [
      {
        id: 'refund',
        term: 'Credit balance refund',
        kind: 'customer',
        meta: ['customer initiated', 'Online', 'its detailed steps are still to be defined'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            road: 'refund',
            waiting: true,
            customer: [{t: 'Asks for a refund', s: 'of a credit balance', m: 'on', at: 'Capture'}],
            oneData: [{c: 'CreateCreditBalanceRefund.v1', s: 'from a channel', at: 'Capture'}],
          },
        ],
      },
    ],
  },
  {
    label: 'Read payments',
    journeys: [
      {
        id: 'readAccount',
        term: 'Payments on an account',
        kind: 'customer',
        meta: ['customer initiated', 'a read', 'no workflow'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            read: 'No workflow runs. A read starts nothing.',
            entry: {c: 'GET /payments/account/{account-id}', s: 'a read: the Router has nothing to pick'},
            waiting: true,
            customer: [{t: 'Opens their payment list', s: 'web, mobile app or a servicing rep', m: 'on'}],
            oneData: [{c: 'ReadPayments.v1', s: 'reads Redis and billpay-core, removes duplicates; Oracle wins'}],
            oracle: [{row: 'payments', s: 'read, every payment on the account'}],
          },
        ],
      },
      {
        id: 'readOne',
        term: 'One payment, in detail',
        kind: 'customer',
        meta: ['customer initiated', 'a read', 'no workflow'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            read: 'No workflow runs. A read starts nothing.',
            entry: {c: 'GET /payments/{payment-id}', s: 'a read: the Router has nothing to pick'},
            waiting: true,
            customer: [{t: 'Asks what happened to a payment', s: 'often through a servicing rep', m: 'on'}],
            oneData: [{c: 'ReadPaymentEventsById.v1', s: 'the lifecycle states it went through'}],
            oracle: [{row: 'timeline', s: 'every state change, and the cluster that ran it'}],
          },
        ],
      },
    ],
  },
  {
    label: 'Corporate payments',
    journeys: [
      {
        id: 'corpToday',
        term: 'Pay a corporate bill today',
        kind: 'customer',
        meta: ['customer initiated', 'Online, then Offline', 'allocations before any money moves'],
        segments: [
          {
            phase: ['The request', 'the customer waits'],
            road: 'immediate',
            stages: ['Capture', 'Verify'],
            waiting: true,
            customer: [
              {t: 'Pays a corporate bill today', st: 'PENDING', m: 'on', at: 'Capture'},
              {t: 'Sees ACCEPTED', s: 'or DECLINED', st: 'ACCEPTED', m: 'on', at: 'Verify'},
            ],
            oneData: [{...CREATE, at: 'Capture'}, DELETE_END],
            oracle: [{row: 'ALLOC_REQUEST row', st: 'SCHEDULED', s: "in Verify's commit, due at once", at: 'Verify'}],
          },
          {
            phase: ['Moments later', 'nobody waits'],
            road: 'request',
            customer: [],
          },
          {
            phase: ['Allocations arrive', 'one callback per batch'],
            road: 'receive',
            customer: [],
            oneData: [{c: 'CreatePaymentAllocations.v1', s: 'the allocations manager calls back', at: 'ReceiveAllocations'}],
            oracle: [{row: 'ALLOC_EXEC row', st: 'SCHEDULED', s: 'by the batch that completes the amount', at: 'ReceiveAllocations'}],
          },
          {
            phase: ['Execution', 'at once, for pay today'],
            road: 'corpExecute',
            stages: ['Execute'],
            customer: [],
            oracle: [{row: 'legs', s: 'released in its commit', at: 'Execute'}],
          },
          {
            phase: ['Each leg', 'one workflow per leg'],
            road: 'leg',
            oracle: [{row: 'ALLOC_LEG row', st: 'SCHEDULED', s: 'written by the leg dispatcher at release, one per leg', at: 'Execute'}],
            customer: [{t: 'Told PROCESSED', s: 'once every leg is done', st: 'PROCESSED', m: 'on', at: 'Fulfil'}],
          },
          {...PAID_SEGMENT, customer: [{t: 'Legs turn PAID', s: 'the parent stays PROCESSED', st: 'PAID', m: 'quiet', at: 'Settle'}]},
        ],
      },
      {
        id: 'corpScheduled',
        term: 'Schedule a corporate payment',
        kind: 'customer',
        days: true,
        meta: ['customer initiated', 'Online, then Offline', 'allocations before the due date'],
        segments: [
          {
            phase: ['Day 0', 'seconds, while they wait'],
            road: 'scheduled',
            waiting: true,
            customer: [
              {t: 'Pays for a later date', st: 'PENDING', m: 'on', at: 'Capture'},
              {t: 'Sees SCHEDULED', s: 'with a Raven message', st: 'SCHEDULED', m: 'on', at: 'Verify'},
            ],
            oneData: [{...CREATE, at: 'Capture'}, DELETE_END],
            oracle: [{row: 'ALLOC_REQUEST row', st: 'SCHEDULED', s: 'due at the fetch time', at: 'Verify'}],
            ruler: [
              {t: 'Day 0 · 0 s', at: 'Capture'},
              {t: 'the answer', at: 'Verify'},
            ],
          },
          {
            phase: ['Until the fetch time', 'nothing runs'],
            wait: 'Nothing runs in Temporal.',
            customer: [{t: 'Can change or cancel', s: 'until the window closes or the fetch, whichever is first', m: 'choice'}],
            ruler: [{t: 'days'}],
          },
          {
            phase: ['The fetch time', 'on the due date, or before it'],
            road: 'request',
            customer: [{t: 'Can no longer change it', s: '409 from here', m: 'quiet', at: 'RequestAllocations'}],
            ruler: [{t: 'the fetch time', at: 'RequestAllocations'}],
          },
          {
            phase: ['Allocations arrive', 'one callback per batch'],
            road: 'receive',
            customer: [],
            oneData: [{c: 'CreatePaymentAllocations.v1', s: 'the allocations manager calls back', at: 'ReceiveAllocations'}],
            oracle: [{row: 'ALLOC_EXEC row', st: 'SCHEDULED', s: 'due at the execution time', at: 'ReceiveAllocations'}],
            ruler: [{t: 'as batches arrive', at: 'ReceiveAllocations'}],
          },
          {
            phase: ['The due date', "the market's execution time"],
            road: 'corpExecute',
            cond: {},
            customer: [],
            oracle: [{row: 'legs', s: 'released in its commit', at: 'Execute'}],
            ruler: [{t: 'Day N · execution time', at: 'Reverify'}],
          },
          {
            phase: ['Each leg', 'one workflow per leg'],
            road: 'leg',
            oracle: [{row: 'ALLOC_LEG row', st: 'SCHEDULED', s: 'written by the leg dispatcher at release, one per leg', at: 'Execute'}],
            customer: [{t: 'Told PROCESSED', s: 'once every leg is done', st: 'PROCESSED', m: 'on', at: 'Fulfil'}],
          },
          {...PAID_SEGMENT, customer: [{t: 'Legs turn PAID', s: 'the parent stays PROCESSED', st: 'PAID', m: 'quiet', at: 'Settle'}]},
        ],
      },
    ],
  },
  {
    label: 'Started by a system',
    journeys: [
      {
        id: 'allocations',
        term: 'Allocations arrive by callback',
        kind: 'system',
        meta: ['the allocations manager calls', 'Offline', 'async start, 202'],
        segments: [
          {
            phase: ['A batch arrives', 'nobody waits'],
            road: 'receive',
            customer: [{t: 'Nobody waits', s: 'the allocations manager calls back', m: 'quiet', at: 'ReceiveAllocations'}],
            oneData: [{c: 'CreatePaymentAllocations.v1', s: '202 once the batch is stored', at: 'ReceiveAllocations'}],
            oracle: [
              {row: 'allocation_batch', s: 'the batch, stored before the reply', at: 'ReceiveAllocations'},
              {row: 'ALLOC_EXEC row', st: 'SCHEDULED', s: 'by the batch that completes the amount', at: 'ReceiveAllocations'},
            ],
          },
        ],
        next: {to: 'corpToday', text: 'Then the execution and the legs, as on Pay a corporate bill today.'},
      },
      {
        id: 'paid',
        term: 'A payment is paid',
        kind: 'system',
        meta: ['MR/M3 and GAR send events', 'Offline', 'every 30 seconds, no Router'],
        segments: [
          {
            ...PAID_SEGMENT,
            phase: ['Both events are in', 'the next 30-second run'],
            customer: [{t: 'Sees PAID', s: 'in their payment list', st: 'PAID', m: 'quiet', at: 'Settle'}],
          },
        ],
      },
      {
        id: 'returned',
        term: 'A payment is returned',
        kind: 'system',
        meta: ["the customer's bank returns it", 'Offline', "pulled at the governor's pace"],
        segments: [
          {
            phase: ['The return', 'nobody waits'],
            road: 'returned',
            customer: [{t: 'Told RETURNED', s: 'with a Raven message', st: 'RETURNED', m: 'quiet', at: 'Return'}],
            oneData: [{c: 'CreateMoneyMovementEventHandler.v1', s: 'stores the return in the inbox', at: 'Return'}],
            oracle: [{row: 'REPRESENT row', st: 'SCHEDULED', s: 'due on the representment date, if it can be represented', at: 'QueueRepresentment'}],
          },
        ],
        next: {to: 'represented', text: 'If the market can represent it, the next presentment goes out on its date.'},
      },
      {
        id: 'represented',
        term: 'A payment is represented',
        kind: 'system',
        meta: ['a REPRESENT row falls due', 'Offline', 'on the date market rules set'],
        segments: [
          {
            phase: ['The representment date', 'nobody waits'],
            road: 'represent',
            customer: [{t: 'Told only if it declines', s: 'with a Raven message', m: 'quiet', at: 'Represent'}],
            oracle: [{row: 'REPRESENT row', st: 'DONE', s: 'the last commit', at: 'Represent'}],
          },
        ],
        next: {to: 'returned', text: 'If this presentment is returned too, it runs under its own workflow ID.'},
      },
      {
        id: 'inbound',
        term: 'A third party pushes a payment',
        kind: 'system',
        meta: ['a third party calls', 'Offline', "pulled at the governor's pace"],
        segments: [
          {
            phase: ['The push', 'nobody waits'],
            road: 'inbound',
            customer: [{t: 'Told PROCESSED', s: 'with a Raven message', st: 'PROCESSED', m: 'quiet', at: 'Fulfil'}],
            oneData: [{c: 'CreateInboundPayment.v1', s: 'stores it, replies 202', at: 'Capture'}],
          },
          paidAfter(false),
        ],
      },
      {
        id: 'arPayment',
        term: 'AR initiates a payment',
        kind: 'system',
        days: true,
        meta: ['Accounts Receivable calls', 'Offline', 'future-dated'],
        segments: [
          {
            phase: ['Intake', 'nobody waits'],
            road: 'arScheduled',
            customer: [{t: 'Told SCHEDULED', s: 'with a Raven message', st: 'SCHEDULED', m: 'quiet', at: 'Verify'}],
            oneData: [{c: 'CreateBillpayTransactionFromAccountsReceivable.v1', s: 'stores it, replies 202', at: 'Capture'}],
            oracle: [{row: 'SCHED_EXEC row', st: 'SCHEDULED', s: "written in Verify's commit", at: 'Verify'}],
            ruler: [{t: 'Day 0 · when it is pulled', at: 'Capture'}],
          },
          {
            phase: ['Until its date', 'nothing runs'],
            wait: 'Nothing runs in Temporal. The payment is a row in Oracle.',
            customer: [],
            oracle: [{row: 'SCHED_EXEC row', s: 'waits for its due time'}],
            ruler: [{t: 'days'}],
          },
          {
            phase: ['The due date', "the market's execution time"],
            road: 'execute',
            customer: [{t: 'Told PROCESSED', s: 'with a Raven message', st: 'PROCESSED', m: 'quiet', at: 'Fulfil'}],
            oracle: [
              {row: 'SCHED_EXEC row', st: 'DISPATCHED', s: 'DISPATCHING when claimed, DISPATCHED once started', at: 'Reverify'},
              {row: 'SCHED_EXEC row', st: 'DONE', s: 'the last commit', at: 'Fulfil'},
            ],
            ruler: [{t: 'Day N · execution time', at: 'Reverify'}],
          },
          paidAfter(true),
        ],
      },
      {
        id: 'arRefund',
        term: 'AR raises a refund',
        kind: 'system',
        meta: ['Accounts Receivable calls', 'Offline', 'its detailed steps are still to be defined'],
        segments: [
          {
            phase: ['Intake', 'nobody waits'],
            road: 'arRefund',
            customer: [],
            oneData: [{c: 'CreateBillpayTransactionFromAccountsReceivable.v1', s: 'stores it, replies 202', at: 'Capture'}],
          },
        ],
      },
    ],
  },
];

export const JOURNEYS = GROUPS.flatMap((g) => g.journeys.map((j) => ({...j, group: g.label})));
export const JOURNEY = Object.fromEntries(JOURNEYS.map((j) => [j.id, j]));
