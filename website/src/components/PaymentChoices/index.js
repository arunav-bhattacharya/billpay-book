import React, {useId, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import CallChip from '../CallChip';
import TriggerTag from '../TriggerTag';
import styles from './styles.module.css';

/**
 * PaymentChoices: the Make a Payment page as three answers and one result.
 *
 * On the left, the three questions the channel's page asks: how much, when,
 * and from where. On the right, one card that follows the answers: the
 * journey the Router picks, the Temporal workflow that runs it, the calls the
 * channel makes in order, and what reaches the payment afterwards. A pink tag
 * marks anything that resumes a waiting payment from outside.
 *
 * Any combination can be picked. One the design refuses, such as a debit card
 * on a later date, shows the 422 and why, so the rule is visible instead of
 * hidden behind a disabled button.
 */

const ALL = '/docs/design/journeys/all-journeys';

const AMOUNTS = [
  {id: 'statement', label: 'Statement balance'},
  {id: 'total', label: 'Total balance'},
  {id: 'minimum', label: 'Minimum due'},
  {id: 'other', label: 'Other amount'},
];
const WHEN = [
  {id: 'today', label: 'Today'},
  {id: 'later', label: 'A later date'},
];
/* Where the customer pays from, and the source the channel passes to
   ReadBillpayInstruments.v1. MR Points alone need no instruments read. */
const SOURCES = [
  {id: 'enrolled', label: 'Enrolled instrument', source: 'EnrolledInstruments', behind: 'ReadInstruments', owner: 'Payment Instruments'},
  {id: 'debit', label: 'Debit card', source: 'DebitCard', behind: 'GET /banks', owner: 'Amex Pay with Bank Transfer', todayOnly: true},
  {id: 'transfer', label: 'Pay with Bank Transfer', source: 'PayWithBankTransfer', behind: 'GET /banks', owner: 'Amex Pay with Bank Transfer', todayOnly: true},
  {id: 'mixed', label: 'Account and MR Points', source: 'EnrolledInstruments', behind: 'ReadInstruments', owner: 'Payment Instruments', todayOnly: true},
  {id: 'points', label: 'MR Points only', todayOnly: true},
];
const SOURCE = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

const JOURNEYS = {
  today: {
    term: 'Pay my bill today',
    to: `${ALL}#pay-my-bill-today`,
    wf: 'CreateImmediatePaymentWorkflow',
    text: 'Verify decides inside the create, so the channel has ACCEPTED or DECLINED in its reply. Execute and Fulfil follow with nobody waiting.',
  },
  later: {
    term: 'Pay on a future date',
    to: `${ALL}#pay-on-a-future-date`,
    wf: 'CreateScheduledPaymentWorkflow',
    then: 'ExecuteScheduledPaymentWorkflow',
    text: 'The reply is SCHEDULED. On the due date a dispatcher starts the second workflow on the Offline cluster, which checks the payment again and runs it.',
  },
  bank: {
    term: 'Pay by Bank today',
    to: `${ALL}#pay-by-bank-today`,
    wf: 'CreatePaymentIntentWorkflow',
    text: 'The reply is PENDING with the redirect link. Once the customer is back, the channel calls again, and Billpay answers with the status. While it is pending, Billpay keeps asking, then waits for M3 before Execute.',
    after: [
      {name: 'CreateConfirmPendingPayment.v1', who: 'channel', trigger: 'update', event: 'Channel Confirm Event', note: "once the payer's bank routes the customer back. Billpay asks for the status once and replies PENDING, ACCEPTED or DECLINED; the channel's part ends there"},
      {name: 'GET /payment-status', who: 'billpay', repeat: true, note: 'Billpay asks Amex Pay with Bank Transfer again at a fixed interval while it says pending, with nobody waiting'},
      {name: 'POST /payments/{payment-id}/settlement', who: 'other', trigger: 'signal', event: 'Bank Settled Event', note: "M3's notice that the money settled"},
    ],
  },
  card: {
    term: 'Pay by Debit card',
    to: `${ALL}#pay-by-debit-card`,
    wf: 'CreatePaymentIntentWorkflow',
    text: 'The reply is PENDING with a 3D Secure challenge link, or none. The card provider calls back, and Verify authorizes the payment. No callback in 2 minutes, and it is cancelled.',
    after: [{name: 'POST /payments/{payment-id}/authentication', who: 'other', trigger: 'update', event: 'Card Authenticated Event', note: "the card provider's 3D Secure callback"}],
  },
  multi: {
    term: 'Pay with multiple instructions',
    to: `${ALL}#pay-with-multiple-instructions`,
    wf: 'CreatePaymentWithMultipleInstructionsWorkflow',
    text: 'The composite decides each instruction and replies with every decision. Each accepted instruction runs Execute and Fulfil in a child.',
  },
  points: {
    term: 'Pay with MR Points',
    to: `${ALL}#pay-with-mr-points`,
    wf: 'Pay with MR Points composite',
    text: 'A composite across Billpay and Loyalty. Its steps are still to be defined.',
  },
};

/* What the design does with one set of answers. */
function decide({when, from, pending}) {
  const src = SOURCE[from];
  if (pending) {
    return {
      kind: 'declined',
      term: 'Declined by One-Data',
      text: "One-Data finds another payment still PENDING on the account and declines this create itself: 200 with DECLINED and a reason. billpay-online is never called.",
    };
  }
  if (when === 'later' && src.todayOnly) {
    return {
      kind: 'refused',
      term: 'Turned away, 422',
      text: `${src.label} pays today only, so a future-dated create gets 422 before any workflow starts. The page doesn't offer it once a later date is picked.`,
    };
  }
  const id = {debit: 'card', transfer: 'bank', mixed: 'multi', points: 'points'}[from] || (when === 'later' ? 'later' : 'today');
  return {kind: 'pick', id, ...JOURNEYS[id]};
}

function Choice({n, term, options, value, onChange}) {
  const uid = useId();
  return (
    <div className={styles.question} role="group" aria-labelledby={uid}>
      <p className={styles.qHead} id={uid}>
        <span className={styles.badge} aria-hidden="true">
          {n}
        </span>
        {term}
      </p>
      <div className={styles.options}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className={styles.option}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Calls({a, result}) {
  const src = SOURCE[a.from];
  const calls = [
    {name: 'ReadPaymentOptions.v1', note: 'the amounts, the options with their IDs, and when the customer can pay'},
    src.source && {
      name: 'ReadBillpayInstruments.v1',
      note: (
        <>
          <code>source={src.source}</code>. Billpay calls {src.owner}&apos;s <code>{src.behind}</code>
        </>
      ),
    },
    {
      name: 'CreatePayment.v3',
      note:
        result.kind === 'declined'
          ? 'stopped at One-Data'
          : result.kind === 'refused'
            ? 'answered 422'
            : a.from === 'points'
              ? 'with no option ID, since points alone carry none. The Router picks the journey'
              : `with the ${AMOUNTS.find((x) => x.id === a.amount).label.toLowerCase()} option's ID. The Router picks the journey`,
    },
  ].filter(Boolean);
  return (
    <ol className={styles.calls}>
      {calls.map((c, i) => (
        <li key={c.name}>
          <span className={styles.callN} aria-hidden="true">
            {i + 1}
          </span>
          <span className={styles.callBody}>
            <CallChip name={c.name} />
            <span className={styles.callNote}>{c.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function After({items}) {
  return (
    <ol className={styles.after}>
      {items.map((c) => (
        <li key={c.name}>
          <span className={clsx(styles.afterMark, c.trigger && styles.afterPink)} aria-hidden="true">
            {c.repeat && (
              <span className={styles.cadence}>
                <i />
                <i />
                <i />
                <b />
              </span>
            )}
          </span>
          <span className={styles.callBody}>
            <span className={styles.afterHead}>
              <CallChip name={c.name} who={c.who} />
              {c.trigger && <TriggerTag kind={c.trigger} label={c.event} />}
            </span>
            <span className={styles.callNote}>{c.note}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Result({a}) {
  const r = decide(a);
  return (
    <section className={clsx(styles.result, r.kind !== 'pick' && styles.resultStop)} aria-live="polite">
      <p className={styles.kicker}>{r.kind === 'pick' ? 'The journey' : 'No journey'}</p>
      <h4 className={styles.resultTerm}>{r.to ? <Link to={r.to}>{r.term}</Link> : r.term}</h4>
      {r.wf && (
        <p className={styles.wfRow}>
          <span className={styles.wf}>{r.wf}</span>
          {r.then && (
            <>
              <span className={styles.then}>then, on the date</span>
              <span className={styles.wf}>{r.then}</span>
            </>
          )}
        </p>
      )}
      <p className={styles.resultText}>{r.text}</p>

      <p className={styles.kicker}>The channel&apos;s calls, in order</p>
      <Calls a={a} result={r} />

      {r.after && (
        <>
          <p className={styles.kicker}>Then, after the reply</p>
          <After items={r.after} />
        </>
      )}
    </section>
  );
}

const START = {amount: 'statement', when: 'today', from: 'transfer', pending: false};

export default function PaymentChoices() {
  const [a, setA] = useState(START);
  const set = (patch) => setA((prev) => ({...prev, ...patch}));
  return (
    <div className={styles.wrap}>
      <section className={styles.page} aria-label="The payment page">
        <p className={styles.kicker}>The payment page</p>
        <Choice n={1} term="How much" options={AMOUNTS} value={a.amount} onChange={(v) => set({amount: v})} />
        <Choice n={2} term="When" options={WHEN} value={a.when} onChange={(v) => set({when: v})} />
        <Choice n={3} term="From where" options={SOURCES} value={a.from} onChange={(v) => set({from: v})} />
        <label className={styles.check}>
          <input type="checkbox" checked={a.pending} onChange={(e) => set({pending: e.target.checked})} />
          <span>Another payment on this account is still PENDING</span>
        </label>
      </section>
      <Result a={a} />
    </div>
  );
}
