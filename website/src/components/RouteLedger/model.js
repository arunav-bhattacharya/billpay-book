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
  {name: 'PaymentStore', system: 'Oracle', queue: 'local first, then regular', rail: true, note: 'every stage commits here'},
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
    queue: "the workflow's queue; local in Verify on Online",
    at: ['Verify', 'Reverify', 'Execute'],
    note: 'it has no rate limit',
  },
  {
    name: 'OptionsActivities',
    system: 'Payment Options',
    fails: 'decline',
    queue: "the workflow's queue; local in Verify on Online",
    at: ['Verify', 'Reverify'],
    note: 'ReadPaymentOptionByIdentifier.v1 in Verify, ReadPaymentOptions.v1 in Reverify, only where the payment carries a payment option ID; it has no rate limit',
  },
  {
    name: 'PlansActivities',
    system: 'Plans',
    long: 'Plans, for the mandate details',
    fails: 'mandate',
    queue: "the workflow's queue; local in Verify on Online",
    at: ['Verify', 'Reverify'],
    note: 'only where the profile requires mandate authorization: never for a payment initiated as part of a plan, Pay with Bank Transfer or a debit card',
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
    name: 'OpenToBuyActivities',
    system: 'CAS',
    long: 'CAS, for open-to-buy',
    fails: 'must',
    queue: 'ds-cas',
    at: ['Execute'],
    note: 'a corporate parent leaves it to its legs; the name and the queue are Proposed',
  },
  {
    name: 'AuthorizationActivities',
    system: 'AMP',
    long: 'AMP, Authorizations, told that the payment has executed',
    fails: 'must',
    queue: 'ds-authorization',
    at: ['Fulfil'],
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
    system: 'Amex PwBT',
    long: "Amex Pay with Bank Transfer, the one bank-transfer service Billpay calls. It works with each market's provider, Plaid in the US among them",
    queue: 'local activity',
    at: ['RequestConfirmation', 'Verify'],
    note: 'only the Online cluster calls it: initiatePayment for the redirect link, PaymentSubmission at the channel\'s call, and GET /payment-status as the fallback',
  },
  {
    name: 'CardActivities',
    system: 'Card provider',
    long: "The market's card provider, for a debit card's 3D Secure and its authorization: Checkout.com in the UK",
    queue: 'local activity',
    at: ['RequestConfirmation', 'Verify'],
    note: 'only for a debit card; the authorization carries the payment ID as its idempotency key',
  },
  {
    name: 'LoyaltyActivities',
    system: 'Loyalty',
    long: 'Loyalty, which redeems MR Points',
    queue: 'local activity',
    at: ['Verify'],
    note: 'only for MR Points; the redemption carries the payment ID as its idempotency key',
  },
  {
    name: 'InboxActivities',
    system: 'One-Data',
    queue: "the workflow's queue",
    at: [],
    note: 'no stage: the PAID drain, the missing-events check, and the delete every create workflow makes',
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
    desc: 'Update-With-Start, or an update',
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
              "A consumer split writes its legs in the parent's commit, and each leg runs ExecuteSplitPayment as a child on the Online cluster. The parent stays ACCEPTED while its legs move on.",
            then: [PAID],
          },
          {
            id: 'multiple',
            wf: 'CreatePaymentWith|MultipleInstructions',
            lead: 'Pay today, with several instructions.',
            stages: CVEF,
            child: ['Execute', 'Fulfil'],
            childWf: 'CreateImmediatePayment',
            journey: 'Create payment, today, several instructions',
            wfId: '{groupId}-init (Proposed); each child is {groupId}_{paymentId}-init',
            answer: 'once Verify has decided every instruction',
            chips: five('CONSUMER', 'Y', 'N'),
            behave:
              'Example values. A request with several instructions never takes bank confirmation: one that would need it gets 422.',
            first:
              'It captures each instruction under its own idempotency key, verifies each and replies with every decision. Each accepted instruction then runs Execute and Fulfil in a child on the Online cluster.',
            exc: {
              'Verify|OptionsActivities': {kind: 'call', note: "once, by the composite, for the whole payment's one option ID; an option that no longer holds declines every instruction with PAYMENT_OPTION_INVALID (Proposed)"},
            },
            then: [{to: 'immediate', text: 'each accepted instruction runs Execute and Fulfil in a child'}],
          },
          {
            id: 'points',
            wf: 'CreateImmediatePayment',
            tag: 'MR Points',
            points: true,
            lead: 'Pay today with MR Points alone.',
            stages: CVEF,
            journey: 'Create payment, today, MR Points as the one instruction',
            wfId: '{paymentId}-init',
            answer: 'once Verify decides, with the points already redeemed',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values. The Router sets points redemption to Y when MR Points are the one instruction. There is no composite and no child workflow.',
            notes: {
              Verify: "Its checks and rules run first. Only once they pass does Loyalty redeem the points, in one call, so no later rule can decline a payment whose points are gone. A failed redemption is DECLINED with POINTS_REDEMPTION_FAILED.",
              Execute: 'No clearing call: redeeming the points paid the bill. The AR balance and the open-to-buy call to CAS go out. No settlement event: the settlement is known, so the AR posting alone makes it PAID.',
            },
            exc: {'Execute|ClearingActivities': {kind: 'skip', note: 'redeeming the points paid the bill'}},
            then: [{to: 'paid', text: 'PAID with the Posted Event from GAR, once the GAR posting joins the settlement Billpay created'}],
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
            wf: 'CreatePaymentIntent',
            tag: 'bank confirmation',
            lead: 'Pay today, once the customer confirms the payment at their bank.',
            stages: ['Capture', 'Verify'],
            own: ['RequestConfirmation'],
            move: {Verify: 'PENDING, unchanged; DECLINED with no link'},
            exc: {
              'Verify|InstrumentActivities': {kind: 'skip', note: 'a bank payment makes no Instrument check'},
              'Verify|PlansActivities': {kind: 'skip', note: 'a bank payment makes no Mandate check'},
            },
            journey: 'Create payment, today, one instruction, with bank confirmation: a payment that waits for the customer',
            wfId: '{paymentId}-init',
            answer: "with PENDING and the redirect link; DECLINED when Amex's own checks fail, or when no link comes",
            chips: five('CONSUMER', 'Y', 'Y'),
            behave:
              'Example values. A BOTH turns bank confirmation to Y when the payment method needs the customer to confirm at their bank. It is on for consumer payments made today; business travel can be turned on later.',
            notes: {
              Verify:
                "Amex's own check, before the bank step: the Options check alone, as a local activity. A bank payment makes no Instrument or Mandate check. A payment that fails it is DECLINED, with no link. One that passes stays PENDING, and nothing is committed.",
              RequestConfirmation:
                "It runs once Verify's own checks have passed. It calls Amex Pay with Bank Transfer's initiatePayment for the redirect link, with one try, and stores it on the payment, guarded on PENDING. Billpay calls no market's provider directly. The caller gets PENDING with the link, and the PENDING event goes out. With no link, the payment is DECLINED instead.",
            },
            stop: {
              title: 'The workflow waits here.',
              text: "Until the channel says the customer is back from their bank, with an update to this same workflow that Billpay answers with Amex Pay with Bank Transfer's answer, or Amex Pay with Bank Transfer sends its own confirmation. While neither has come, Billpay asks GET /payment-status itself as the fallback, from 2 minutes after the create, with a gap that doubles from 2 to 30 minutes. Until it is decided, its pending entry blocks the account.",
            },
            then: [
              {to: 'confirm', text: 'the channel says the customer is back, with the same payment ID'},
              {to: 'confirmed', text: "or Amex Pay with Bank Transfer's own confirmation comes"},
              {to: 'settled', text: "or M3's notice comes first"},
              {to: 'no', text: 'or the customer says no'},
            ],
          },
          {
            id: 'card',
            wf: 'CreatePaymentIntent',
            tag: 'debit card',
            card: true,
            lead: 'Pay today by debit card, once 3D Secure has authenticated it.',
            stages: ['Capture', 'Verify'],
            own: ['RequestConfirmation'],
            move: {Verify: 'PENDING, unchanged; DECLINED before 3D Secure'},
            exc: {
              'Verify|CardActivities': {kind: 'skip', note: 'the authorization waits for the callback'},
              'Verify|PlansActivities': {kind: 'skip', note: 'a debit card makes no Mandate check'},
            },
            journey: 'Create payment, today, one instruction, by debit card: a payment that waits for 3D Secure',
            wfId: '{paymentId}-init',
            answer: "with PENDING and the challenge link, or none; DECLINED when Amex's own checks fail, or when the provider gives no answer",
            chips: five('CONSUMER', 'Y', 'N'),
            behave:
              'Example values. Card authentication is Y: the Router sets it for every debit card, and no market chooses it. A debit card pays today only, with one instruction and no MR Points.',
            notes: {
              Verify:
                "Amex's own checks, before 3D Secure: the Instrument and Options checks, as local activities. A debit card makes no Mandate check. A payment that fails them is DECLINED, and 3D Secure never starts. One that passes stays PENDING, and nothing is committed.",
              RequestConfirmation:
                "Once Verify's own checks have passed, it asks the market's card provider to start 3D Secure, with Billpay's callback URL, one try, and stores the challenge link, or none when the card's bank needs no challenge (Proposed), guarded on PENDING. The caller gets PENDING. With no answer from the provider, the payment is DECLINED instead (Proposed).",
            },
            stop: {
              title: 'The workflow waits here.',
              text: "On its own timer: 2 minutes and a short grace. The card provider's callback arrives as an update to this same workflow. If none comes in time, the timer runs Cancel, and nothing has been taken.",
            },
            then: [{to: 'authenticated', text: 'the card provider calls back, with the same payment ID'}],
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
            wf: 'CreatePaymentIntent',
            tag: 'a no',
            update: '{paymentId}-no',
            start: 'an update to the running workflow',
            lead: 'Cancel a payment that waits for bank confirmation, when the customer says no.',
            own: ['Cancel'],
            journey: "Cancel payment, PENDING and waiting for the customer, on the customer's no",
            wfId: '{paymentId}-init',
            answer: 'CANCELLED, and CANCELLED again for a repeat',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: 'Example values. Cancel varies by account type and AR posting.',
            move: {Cancel: 'PENDING to CANCELLED'},
            notes: {
              Cancel:
                "No window check. One guarded update on PENDING. A yes and a no from two tabs are two updates to one workflow: the first one it accepts wins, and the other gets 409. For a debit card, the same Cancel runs if the timer fires with no callback. The event and message go out after the reply.",
            },
            end: 'CANCELLED is final.',
          },
        ],
      },
      {
        fn: ['CreatePayment|Submission.v1'],
        from: 'a channel',
        calls: 'A channel calls',
        does: "say the customer is back from their bank, once the payer's bank routes them back, with the same payment ID",
        api: ['POST', '/payments/{payment-id}/submission'],
        roads: [
          {
            id: 'confirm',
            wf: 'CreatePaymentIntent',
            tag: 'the customer is back',
            update: '{paymentId}-submission',
            start: 'an update to the running workflow',
            lead: "Submit a payment that waits for bank confirmation to Amex Pay with Bank Transfer once the customer is back, decide it on the answer, and answer the channel with the status.",
            stages: ['Verify'],
            journey: 'Customer back from the bank, PENDING and waiting for bank confirmation',
            wfId: '{paymentId}-init',
            answer: 'PENDING, ACCEPTED or DECLINED, from one call to PaymentSubmission; the channel\'s part ends there',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: "Example values. Bank confirmation makes Verify submit the payment to Amex Pay with Bank Transfer, makes the payment wait for M3 before Execute, and takes clearing out of Execute.",
            move: {Verify: 'PENDING to ACCEPTED or DECLINED'},
            notes: {
              Verify:
                "Calls Amex Pay with Bank Transfer's PaymentSubmission at once, and the update replies with the answer. Confirmed commits ACCEPTED and declined DECLINED, guarded on PENDING. Pending, a timeout or a 5xx replies PENDING; then Amex Pay with Bank Transfer's own confirmation, or the fallback GET /payment-status calls with a gap that doubles from 2 to 30 minutes, decide it, until the market's wait of 24 to 48 hours ends it. No token check and no funds check.",
            },
            exc: {
              'Verify|InstrumentActivities': {kind: 'skip', note: 'a bank payment makes no Instrument check'},
              'Verify|OptionsActivities': {kind: 'skip', note: 'it ran at the create, before the bank step'},
              'Verify|PlansActivities': {kind: 'skip', note: 'a bank payment makes no Mandate check'},
              'Verify|BankConfirmationActivities': {kind: 'call', note: 'PaymentSubmission once for the reply; GET /payment-status later, as the fallback, while no answer has come'},
            },
            stop: {
              title: 'An ACCEPTED payment waits here.',
              text: "For M3's notice that the bank has settled it in real time. Only then do Execute and Fulfil run. If the notice never comes, the payment goes on the exception list with an alert; how long it waits is still open.",
            },
            then: [{to: 'settled', text: "M3's settled notice"}],
          },
        ],
      },
      {
        fn: ['UpdatePayment|Confirmation.v1'],
        from: 'Amex PwBT',
        calls: 'Amex Pay with Bank Transfer calls',
        does: "give Billpay its own answer on a Pay with Bank Transfer payment, confirmed or declined, whether or not the channel called. One-Data passes it on",
        api: ['POST', '/payments/{payment-id}/confirmation'],
        roads: [
          {
            id: 'confirmed',
            wf: 'CreatePaymentIntent',
            tag: "Amex PwBT's answer",
            signal: 'confirmed',
            start: 'a signal to the running workflow',
            lead: "Decide a payment that waits for bank confirmation on Amex Pay with Bank Transfer's own answer, when the channel never said the customer was back.",
            stages: ['Verify'],
            cond: {Verify: "Only while the payment is still PENDING. A payment already ACCEPTED, or past it, ignores the answer."},
            journey: "Amex Pay with Bank Transfer's confirmation, PENDING and waiting for bank confirmation",
            wfId: '{paymentId}-init',
            answer: '202 at once',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: "Example values. Bank confirmation makes the payment take Amex Pay with Bank Transfer's own answer when the channel's call never comes.",
            move: {Verify: 'PENDING to ACCEPTED or DECLINED'},
            notes: {
              Verify:
                "Confirmed commits ACCEPTED and declined DECLINED, with BANK_CONFIRMATION_DECLINED (Proposed), guarded on PENDING, and the fallback status calls stop. No call goes out: the answer is in the signal. A confirmed answer on a payment already DECLINED or CANCELLED goes on the exception list with an alert.",
            },
            exc: {
              'Verify|InstrumentActivities': {kind: 'skip', note: 'a bank payment makes no Instrument check'},
              'Verify|OptionsActivities': {kind: 'skip', note: 'it ran at the create, before the bank step'},
              'Verify|PlansActivities': {kind: 'skip', note: 'a bank payment makes no Mandate check'},
              'Verify|BankConfirmationActivities': {kind: 'skip', note: "the answer comes in the signal, so Verify makes no call"},
            },
            stop: {
              title: 'An ACCEPTED payment waits here.',
              text: "For M3's notice that the bank has settled it in real time. Only then do Execute and Fulfil run. If the notice never comes, the payment goes on the exception list with an alert; how long it waits is still open.",
            },
            then: [{to: 'settled', text: "M3's settled notice"}],
          },
        ],
      },
      {
        fn: ['CreateBillpay|SettlementEvent.v1'],
        from: 'M3',
        calls: 'M3 calls',
        does: "tell Billpay the bank has settled a Pay with Bank Transfer payment in real time. One-Data passes the notice on, and keeps it for the PAID pairing (Proposed)",
        api: ['POST', '/payments/{payment-id}/settlement'],
        roads: [
          {
            id: 'settled',
            wf: 'CreatePaymentIntent',
            tag: 'the settled notice',
            signal: 'settled',
            start: 'a signal to the running workflow',
            lead: "Carry on with a Pay with Bank Transfer payment once M3 says the bank has settled it.",
            stages: ['Verify', 'Execute', 'Fulfil'],
            cond: {Verify: "Only when Amex Pay with Bank Transfer hasn't said success yet: it accepts the payment on M3's notice, the calls stop, and Billpay logs it."},
            journey: 'Settled notice, a Pay with Bank Transfer payment, PENDING or ACCEPTED',
            wfId: '{paymentId}-init',
            answer: '202 at once',
            chips: five('CONSUMER', 'Y', 'Y'),
            behave: "Example values. M3's notice is the payment's settlement, so Execute makes no clearing call and Billpay sends no settlement event.",
            move: {Verify: 'PENDING to ACCEPTED, before a success'},
            notes: {
              Verify: "Runs only when the payment is still PENDING: Amex Pay with Bank Transfer hasn't said success yet. One guarded commit to ACCEPTED, and a log line that names the payment ID.",
              Execute: "No clearing call: the money moved at the bank, and M3's notice is the settlement. The AR balance and open-to-buy calls go out.",
            },
            exc: {
              'Verify|InstrumentActivities': {kind: 'skip', note: 'a bank payment makes no Instrument check'},
              'Verify|OptionsActivities': {kind: 'skip', note: 'it ran at the create, before the bank step'},
              'Verify|PlansActivities': {kind: 'skip', note: 'a bank payment makes no Mandate check'},
              'Execute|ClearingActivities': {kind: 'skip', note: "the money moved at the bank; M3's notice is the settlement"},
              'Fulfil|BalanceControlActivities': {kind: 'skip', note: 'a bank payment makes no eBNC call'},
              'Fulfil|RiskActivities': {kind: 'skip', note: 'a bank payment makes no risk call'},
              'Fulfil|TransactionNotificationActivities': {kind: 'call', note: 'TFNE and GPHDB only, not B2Notifier', systems: 'TFNE, GPHDB'},
              'Fulfil|LifecycleEventActivities': {kind: 'skip', note: 'a bank payment sends no RTF event for PROCESSED'},
              'Fulfil|CommunicationActivities': {kind: 'skip', note: 'a bank payment sends no Raven message for PROCESSED'},
            },
            then: [{to: 'paid', text: "PAID with the Posted Event from GAR: the GAR posting, which Billpay pairs with M3's notice"}],
          },
        ],
      },
      {
        fn: ['3D Secure|callback'],
        from: 'the card provider',
        calls: 'The card provider calls',
        direct: true,
        does: "a debit card's 3D Secure result, once the customer is authenticated or authentication has failed",
        api: ['POST', '/payments/{payment-id}/authentication'],
        roads: [
          {
            id: 'authenticated',
            wf: 'CreatePaymentIntent',
            tag: 'the callback',
            card: true,
            update: '{paymentId}-authentication',
            start: 'an update to the running workflow',
            lead: 'Go ahead with a debit card payment once the card provider has called back with the 3D Secure result.',
            stages: ['Verify', 'Execute', 'Fulfil'],
            journey: "3D Secure callback, PENDING and waiting for a debit card's authentication, inside the 2-minute window",
            wfId: '{paymentId}-init',
            answer: 'once Verify decides',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values. Card authentication adds the card authorization check to Verify, and takes clearing out of Execute.',
            move: {Verify: 'PENDING to ACCEPTED or DECLINED'},
            notes: {
              Verify:
                "A failed 3D Secure result is DECLINED with no authorization. Otherwise, since Amex's own checks ran at the create, the card provider authorizes the payment (the check is Proposed): approved, it debits the customer's account; declined by the card's bank, the payment is DECLINED. One commit, guarded on PENDING, and the callback's reply returns here.",
              Execute: "No clearing call: the authorization moved the money. The AR balance and open-to-buy calls go out. No settlement event: the settlement is known, so the AR posting alone makes it PAID.",
            },
            exc: {
              'Verify|InstrumentActivities': {kind: 'skip', note: 'it ran at the create, before 3D Secure'},
              'Verify|OptionsActivities': {kind: 'skip', note: 'it ran at the create, before 3D Secure'},
              'Verify|PlansActivities': {kind: 'skip', note: 'a debit card makes no Mandate check'},
              'Execute|ClearingActivities': {kind: 'skip', note: 'the authorization moved the money'},
              'Fulfil|BalanceControlActivities': {kind: 'skip', note: 'a debit card payment makes no eBNC call'},
              'Fulfil|RiskActivities': {kind: 'skip', note: 'a debit card payment makes no risk call'},
              'Fulfil|TransactionNotificationActivities': {kind: 'call', note: 'TFNE and GPHDB only, not B2Notifier', systems: 'TFNE, GPHDB'},
              'Fulfil|LifecycleEventActivities': {kind: 'skip', note: 'a debit card payment sends no RTF event for PROCESSED'},
              'Fulfil|CommunicationActivities': {kind: 'skip', note: 'a debit card payment sends no Raven message for PROCESSED'},
            },
            then: [{to: 'paid', text: 'PAID with the Posted Event from GAR, once the GAR posting joins the settlement Billpay created'}],
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
            full: 'Pay & Plan, a composite workflow, PayAndPlanWorkflow (Proposed)',
            lead: 'Pay today, and create a plan of future installments.',
            stages: CVEF,
            child: ['Execute', 'Fulfil'],
            childWf: 'CreateImmediatePayment',
            journey: 'Pay & Plan',
            wfId: '{paymentId}-plan',
            answer: 'once the decision, the plan and the Autopay update are in',
            chips: five('CONSUMER', 'Y', 'N'),
            behave: 'Example values.',
            first: 'It captures and verifies its one payment itself (one instruction, Proposed).',
            after: 'For an ACCEPTED payment it calls the Installments API and makes an optional Autopay update, on online-wf until their owners set a limit, then replies. A child, CreateImmediatePayment started with the decision, runs Execute and Fulfil as {paymentId}-init. A declined payment gets no plan (Proposed).',
            then: [{to: 'immediate', text: 'Execute and Fulfil run as for pay today, in a child'}],
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
            lead: 'A payment AR raises, for a future date or for today.',
            stages: CV,
            journey: 'From Accounts Receivable, future-dated or today',
            wfId: '{paymentId}-init',
            prio: [1, '"intake"'],
            chips: five('CONSUMER', 'N', 'N'),
            behave:
              'Example values. AR never raises a corporate payment, and a future-dated payment never clears in real time.',
            notes: {Verify: 'Its SCHEDULED commit writes the SCHED_EXEC row.'},
            then: [{to: 'execute', text: 'on the due date, its SCHED_EXEC row; the same day for one dated today'}],
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
                'It checks the payment, full or split, the presentment that came back, and its status: PROCESSING, PROCESSED, PAID, or REPRESENTED when it is returned again. That presentment stays RETURNED. A Pay with Bank Transfer, debit card or MR Points payment can\'t be returned: none of them clears through MR/M3.',
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
            behave: "Example values. Verify answers ACCEPTED or DISALLOWED, and only a push payment can be disallowed.",
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
        runs: "One Schedule per market and account type, at the execution time its release sets, in its time zone",
        writer: 'CreateScheduledPayment',
        wrote: ['scheduled', 'arScheduled'],
        written: 'in its SCHEDULED commit, for a payment that is not corporate',
        origin: ['CreatePayment.v3', 'CreateBillpayTransaction|FromAccountsReceivable.v1'],
        due: "the execution time of its market and account type on the due date",
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
            behave: "Example values, from today's config. For a corporate parent, Execute only clears, once, and releases the legs.",
            move: {Reverify: 'ALLOCATED to ACCEPTED or DECLINED'},
            notes: {
              Execute:
                'It clears the parent once, at payment level, with no AR or open-to-buy call. Its commit releases the legs.',
            },
            exc: {
              'Execute|ClearingActivities': {kind: 'call', note: 'once, for the parent'},
              'Execute|ReceivablesActivities': {kind: 'skip', note: 'per leg instead'},
              'Execute|OpenToBuyActivities': {kind: 'skip', note: 'per leg instead'},
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
        runs: 'One Schedule per market, every 5 minutes (Proposed)',
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
            lead: 'The PAID drain: it reads the rows One-Data has marked READY, pairs the events and settles what is complete.',
            own: ['Settle'],
            wfId: "its Schedule's ID plus the trigger time",
            notes: {
              Settle:
                'Up to 500 READY rows a batch, read over JDBC. Settle pairs the events: the posting and a settlement, a corporate leg\'s from its payment\'s row, or the posting alone where the settlement is known (a debit card, MR Points or inbound payment, and its legs). What is complete goes from PROCESSED to PAID in one transaction, and the PAID events go to RTF. Each row is then marked DONE, WAITING or UNMATCHED. For Pay with Bank Transfer the settlement is M3\'s settled notice, which One-Data stores as such.',
            },
            then: [{to: 'returned', text: 'PAID is final, unless a return arrives; never for Pay with Bank Transfer, a debit card or MR Points'}],
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

/* How something outside starts or resumes the payment on this road, in the
   words the journeys and sequence diagrams use. A caller's own request starts
   nothing from outside, so it has no tag. */
export function roadTrigger(j) {
  if (j.signal) return 'signal';
  if (j.update) return 'update';
  if (j.band.drain) return 'events';
  if (j.band.key === 'callback') return 'callback';
  if (j.band.key === 'pulled' || j.band.key === 'due') return 'dispatcher';
  return null;
}

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

/* roads whose payments carry no payment option ID, so Verify and Reverify
   make no Options call; and roads where only some payments carry one */
const NO_OPTION_ID = {
  arScheduled: 'a payment AR raises carries no payment option ID',
  corpExecute: 'a corporate payment carries no payment option ID',
  inbound: "a push payment doesn't come from a channel, so it carries no payment option ID",
};
const OPTION_ID_SOMETIMES = {
  immediate: 'only where the create carries one: a corporate payment carries none',
  scheduled: 'only where the create carries one: a corporate payment carries none',
  execute: 'only where the payment carries an option ID: not one AR raised',
};

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
    const x = j.exc[`${s}|${f.name}`];
    if (x) {
      out[s] = x;
      return;
    }
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
    if (!(f.at || []).includes(s)) return;
    if (f.name === 'BankConfirmationActivities' && (s !== 'RequestConfirmation' || j.card)) return;
    if (f.name === 'CardActivities' && !j.card) return;
    if (f.name === 'LoyaltyActivities' && !j.points) return;
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
    if (f.name === 'CardActivities') note = s === 'Verify' ? 'last: the authorization, which debits the account' : "to start 3D Secure, with Billpay's callback URL";
    if (f.name === 'LoyaltyActivities') note = "last: the redemption, once the other checks' rules pass";
    if (f.name === 'PlansActivities') {
      note = 'only where the profile requires mandate authorization';
      if (kind === 'call') kind = 'cond';
    }
    if (f.name === 'OptionsActivities') {
      if (NO_OPTION_ID[j.id]) {
        out[s] = {kind: 'skip', note: NO_OPTION_ID[j.id]};
        return;
      }
      note = s === 'Reverify' ? 'ReadPaymentOptions.v1, to confirm the customer still owes and the option still holds' : "ReadPaymentOptionByIdentifier.v1, with the create's payment option ID";
      if (OPTION_ID_SOMETIMES[j.id]) {
        note = `${note}, ${OPTION_ID_SOMETIMES[j.id]}`;
        if (kind === 'call') kind = 'cond';
      }
    }
    if (f.name === 'InstrumentActivities' && s === 'Execute') {
      note = "first, for the clear-text details CAS's open-to-buy call and the notifications need";
    }
    out[s] = note ? {kind, note} : {kind};
  });
  return out;
}

/* roads whose workflow calls the delete API at One-Data, always after the
   caller's reply: every create workflow once Verify decides, whatever
   started it; a payment that waits, once its answer, the callback, the no
   or the timer decides it (agreed 2026-11-08) */
const DELETES = new Set(['immediate', 'scheduled', 'bank', 'card', 'confirm', 'confirmed', 'authenticated', 'no', 'refund', 'arScheduled', 'arRefund', 'multiple', 'payplan']);
/* creates One-Data never stored, so the delete finds nothing to remove */
const UNSTORED = new Set(['arScheduled', 'arRefund']);

/* how a road reaches One-Data, which no stage calls */
export function inboxUse(j) {
  if (j.band.drain) return 'reads READY rows from One-Data\'s table before Settle, over JDBC, and marks them after';
  /* an inbox dispatcher's tick reads One-Data's table itself, not through this
     interface (agreed 2026-11-08), so a pulled road lights it only for the delete */
  if (j.band.key === 'pulled') {
    return UNSTORED.has(j.id) ? 'once Verify decides, the workflow calls the delete API after its reply, which finds nothing to remove, since One-Data never stored this create' : null;
  }
  /* a payment that waits for its customer stays in One-Data's Redis until it
     is decided, and makes one delete call then (agreed 2026-11-08) */
  if (j.id === 'bank' || j.id === 'card') {
    return "calls the delete API here only for a payment declined at the create. A payment that waits keeps its pending entry, which blocks the account, and makes its one delete call once Amex Pay with Bank Transfer's answer, M3's notice, the callback, the no or the timer decides it";
  }
  if (j.id === 'confirm' || j.id === 'confirmed') {
    return "calls the delete API once Verify decides on Amex Pay with Bank Transfer's final answer, so the account's pending entry goes and the customer can pay again";
  }
  if (j.id === 'settled') {
    return "calls the delete API here only when M3's notice is what accepts the payment, before Amex Pay with Bank Transfer says success";
  }
  if (j.id === 'authenticated') {
    return "calls the delete API once Verify decides, so the account's pending entry goes. Execute hands One-Data no settlement event: the settlement is known";
  }
  if (j.id === 'no') return "calls the delete API once Cancel decides, so the account's pending entry goes";
  if (j.id === 'multiple') return "calls the delete API for every instruction it decides, a declined one included, after the reply, so each stored create and its pending entry leave One-Data's Redis";
  if (UNSTORED.has(j.id)) return 'calls the delete API once Verify decides, after the reply, as every create workflow does; it finds nothing to remove';
  if (j.id === 'refund') return 'calls the delete API once Verify decides, after the reply, as every create workflow does; for now a placeholder, until One-Data says whether it stores refunds';
  if (DELETES.has(j.id)) return "calls the delete API once Verify decides, after the reply, so the stored create and the account's pending entry leave One-Data's Redis";
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
  must: 'It must succeed: a 429 waits out Retry-After, and other errors retry from 6 seconds, doubling up to 45 minutes apart.',
  hold: 'It must succeed, so it gets a long timeout: an outage holds the payment where it is instead of failing it.',
  decline: 'A business failure found here, such as a closed account, declines the payment and is never retried.',
  mandate: 'A mandate that fails its check declines the payment and is never retried.',
};

/* the decision's calls on the Online cluster run as local activities */
function localOnOnline(j, f, s) {
  if (j.cluster !== 'Online') return false;
  if (f.name === 'BankConfirmationActivities' || f.name === 'CardActivities') return true;
  return s === 'Verify' && ['InstrumentActivities', 'OptionsActivities', 'PlansActivities'].includes(f.name);
}

/* where a call runs, on road j's cluster, at stage s */
function runsOn(j, f, s) {
  if (f.name === 'PaymentStore') {
    return 'Oracle, through a local activity on the first 2 attempts, so a healthy write has no task round trip. If both fail, it runs again as a regular activity with the full retry policy, so if Oracle is down the payment pauses and carries on when it is back.';
  }
  if (f.name === 'LifecycleEventActivities') {
    return "RTF, on the workflow's own queue, since RTF has no rate limit. The workflow sends one state change at a time, so the payment's events reach RTF in order.";
  }
  if (f.name === 'InboxActivities') {
    return "One-Data's inbox tables, read and updated over JDBC, and its handlers, on the workflow's own queue, since nobody throttles them.";
  }
  const sys = f.long || f.system;
  if (localOnOnline(j, f, s)) {
    return `${sys}, as a local activity, inside the workflow task that makes the decision, so the caller's answer needs no task round trip. It has no rate limit for a local activity to skip.`;
  }
  if (f.name === 'TransactionNotificationActivities') {
    return `One method per system, each on its own queue${j.cluster === 'Online' ? ' on the Online cluster' : ''}: TFNE on ds-tfne, GPHDB on ds-gphdb and B2Notifier on ds-b2notifier. The governor sets each queue\'s rate limit, so each system keeps its own.`;
  }
  if (j.cluster === 'Online' && f.queue.startsWith('ds-')) {
    return `${sys}, on the Online cluster\'s own ${f.queue}. The governor sets its limit for Online too, so Execute\'s and Fulfil\'s calls are always rate-limited.`;
  }
  if (j.cluster === 'Online') return `${sys}, on online-wf, the Online cluster's main task queue.`;
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
  const out = [runsOn(j, f, s)];
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
    out.push(j.childWf.startsWith('for ') ? `A child ${j.childWf} makes this call.` : `The child ${j.childWf} makes this call.`);
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
          note: "online-wf is the Online cluster's main task queue. Execute's and Fulfil's calls to a rate-limited downstream run on the Online cluster's own ds-* queues, at the limits the governor sets.",
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

  if (j.update || j.signal) {
    return [
      {name: 'Admit', ...admit},
      {
        name: 'Pick the journey',
        main: `${j.journey}.`,
        note: `Nothing to pick: the answer goes as ${j.signal ? 'a signal' : 'an update'} to the payment's running ${j.full}, on the ${j.cluster} cluster. The Router only admits it.`,
      },
      {name: 'Resolve behaviors', chips: j.chips || [], note: 'Nothing new to resolve: the workflow kept the behaviors it was started with.'},
      {name: 'Pin the resolved profile', main: 'Already pinned, when the create started the workflow.', note: 'The running workflow keeps that profile to the end.'},
      {name: 'Choose the run site', main: `Online cluster, the running ${j.wfId}.`, note: `Nothing new is placed: the ${j.signal ? 'signal' : 'update'} goes to the workflow that is already waiting.`},
      {
        name: 'Start',
        main: j.signal
          ? `No start: a signal, ${j.signal}, which needs no answer from the workflow.`
          : `No start: an update with the update ID ${j.update}.`,
        note: j.signal
          ? `billpay-online answers ${j.answer || '202'}, and a repeated signal changes nothing.`
          : `A repeat attaches to the same update and gets the same answer.${j.answer ? ` The caller's answer returns ${j.answer}.` : ''} Once the workflow no longer waits, the answer is 409, or the payment's current state for a repeat.`,
      },
    ];
  }

  return [
    {name: 'Admit', ...admit},
    {name: 'Pick the journey', main: `${j.journey}.`, note: `So ${j.full}, on the ${j.cluster} cluster.`},
    {name: 'Resolve behaviors', chips: j.chips || [], note: j.behave || ''},
    {
      name: 'Pin the resolved profile',
      main: 'The journey, the five resolved behaviors and the config version (v12, an example).',
      note: j.today
        ? "On the due date the dispatcher calls the Router again, so the payment runs with today's config. The version used at scheduling stays in its timeline for audit."
        : 'The running workflow keeps this profile to the end.',
    },
    {name: 'Choose the run site', ...place},
    {name: 'Start', ...start},
  ];
}

/* one line for the Router's outcome, where the six steps are folded away */
export function routerLine(j) {
  return `${j.cluster}, ${j.start || j.band.start}, as ${j.wfId}`;
}
