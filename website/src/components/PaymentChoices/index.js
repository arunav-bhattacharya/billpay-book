import React, { useId, useState } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

/**
 * PaymentChoices: the Make a Payment Journey page, as one working model.
 *
 * Three columns. The first is the page a channel shows a customer, with
 * working controls. The second is the calls the channel makes behind it, in
 * order, lit when this set of answers makes them: ReadPaymentOptions.v1, then
 * ReadBillpayInstruments.v1 for the source the customer picked (billpay-online
 * makes the one read that source needs), then CreatePayment.v3. The third is
 * the Router's side: one door, CreatePayment.v3, and the journeys it can
 * pick, each a Temporal workflow. Change an answer and the picked journey
 * moves.
 *
 * Before the Router, One-Data's pending check: a create on an account that
 * already has a payment in PENDING is declined there, and never reaches
 * Billpay. Then the spec's Router: it checks for a wait first (a bank step or
 * a debit card), then a later date, then several instructions, then MR Points
 * alone, then pay today. The list shows the journeys in the order customers
 * meet them, which is not the order the Router checks them in, and the
 * footnote says so. Where the spec has no answer yet, the model says that
 * instead of picking a journey. No wallet is offered until a journey takes one.
 */

const ALL_JOURNEYS = "/docs/design/journeys/all-journeys";

const JOURNEYS = [
  {
    id: "today",
    term: "Pay my bill today",
    when: ["today", "one instruction"],
    wf: "CreateImmediatePayment",
    to: `${ALL_JOURNEYS}#pay-my-bill-today`,
  },
  {
    id: "later",
    term: "Pay on a future date",
    when: ["a later date"],
    wf: "CreateScheduledPayment",
    to: `${ALL_JOURNEYS}#pay-on-a-future-date`,
  },
  {
    id: "bank",
    term: "Pay by Bank today",
    when: ["today", "a bank step"],
    wf: "CreatePaymentIntent",
    to: `${ALL_JOURNEYS}#pay-by-bank-today`,
  },
  {
    id: "card",
    term: "Pay by Debit card",
    when: ["today", "a debit card"],
    wf: "CreatePaymentIntent",
    to: `${ALL_JOURNEYS}#pay-by-debit-card`,
  },
  {
    id: "multi",
    term: "Pay with multiple instructions",
    when: ["today", "account and points"],
    wf: "CreatePaymentWithMultipleInstructions",
    to: `${ALL_JOURNEYS}#pay-with-multiple-instructions`,
  },
  {
    id: "points",
    term: "Pay with MR Points",
    when: ["today", "points only"],
    wf: "Pay with MR Points",
    composite: true,
    to: `${ALL_JOURNEYS}#pay-with-mr-points`,
  },
];
const JOURNEY = Object.fromEntries(JOURNEYS.map((j) => [j.id, j]));

const METHODS = [
  { id: "bank", label: "Enrolled Instruments" },
  {
    id: "debit",
    label: "Debit card",
    note: "checked with 3D Secure",
    todayOnly: true,
  },
  {
    id: "transfer",
    label: "Pay with Bank Transfer",
    note: "you confirm it at your bank",
    todayOnly: true,
  },
];
const TODAY_ONLY = new Set(
  METHODS.filter((m) => m.todayOnly).map((m) => m.id),
);

const OPTIONS_RETURNS = [
  "what the customer owes. Nothing owed, and the journey never starts",
  "the payment options, Statement Balance, Total Balance, Minimum Due and Other Amount, each with a payment option ID the create carries",
  "whether the customer can pay today, on a future date, or both",
  "the range of dates a future payment can take",
];

/* The read billpay-online makes behind ReadBillpayInstruments.v1, by source. */
const READS = {
  bank: {
    read: "ReadInstruments",
    what: "the instruments the customer has enrolled",
    pick: "Which instrument",
  },
  debit: {
    read: "ReadBanksForRealtimePayments.v1",
    what: "the banks the customer can pay from by debit card",
    pick: "Which bank",
  },
  transfer: {
    read: "ReadBanksForRealtimePayments.v1",
    what: "the banks the customer can pay from in real time",
    pick: "Which bank",
  },
  wallet: {
    read: "ReadEligibleWallets.v1",
    what: "the wallets the customer can pay with",
    pick: "Which wallet",
  },
};

const OPEN = [
  [
    "The rest of the page",
    "where it gets the ways to pay the market offers, its limits, the cancellation window, whether it offers Pay & Plan and MR Points, and a payment already pending. ReadPaymentOptions.v1 is one option",
  ],
  [
    "ReadBillpayInstruments.v1",
    "its contract, and the billpay-online endpoint's path",
  ],
  [
    "The bank and wallet reads",
    "who owns them, probably the Instruments domain, and their contracts",
  ],
  ["Pay with MR Points", "its steps, and its calls to Loyalty"],
  ["Wallet", "which instrument it is, and whether it needs a bank step"],
];

/* What the Router does with one set of answers. Returns a result with a
   kind: 'none' (nothing owed), 'declined' (One-Data's pending check),
   'open' (the design has no answer yet), 'refused' (422), or 'pick' with
   the journey's id. */
function decide(a) {
  if (!a.owed) {
    return {
      kind: "none",
      text: "Nothing is owed, so the page offers no payment. The channel calls nothing else, and no journey starts.",
    };
  }
  const pointsOnly = a.points && a.pointsMode === "only";
  const instructions = pointsOnly
    ? ["points"]
    : a.points
      ? [a.method, "points"]
      : [a.method];
  const several = instructions.length > 1;
  const bankStep = instructions.includes("transfer");
  const card = instructions.includes("debit");
  const later = a.date === "later";
  const met = new Set([later ? "a later date" : "today"]);
  if (several) met.add("account and points");
  else if (pointsOnly) met.add("points only");
  else met.add("one instruction");
  if (bankStep) met.add("a bank step");
  if (card) met.add("a debit card");

  if (a.pending) {
    return {
      kind: "declined",
      met,
      text: "One-Data's pending check finds the payment already PENDING on the account, and declines this one there and then: 200 with DECLINED and its reason. billpay-online is never called, so no payment exists in Billpay. The customer can pay again once the pending one is decided.",
    };
  }
  if (card && (several || later)) {
    return {
      kind: "refused",
      met,
      text: "A debit card pays today only, with one instruction and no MR Points, so this create gets 422 before any workflow starts.",
    };
  }
  if (card) {
    return {
      kind: "pick",
      id: "card",
      met,
      text: `The Router starts CreatePaymentIntentWorkflow. Amex's own checks run first, and a payment that fails them is DECLINED before 3D Secure. Then it starts 3D Secure with the card provider and replies PENDING with the challenge link, or none. The card provider's callback brings the result, and Verify authorizes the payment last: approved, the money leaves the customer's account; declined by the card's bank, the payment is DECLINED. No callback in 2 minutes, and the payment is cancelled.`,
    };
  }
  if (bankStep && several) {
    return {
      kind: "refused",
      met,
      text: "Several instructions never take bank confirmation, so this create gets 422 before any workflow starts.",
    };
  }
  if (bankStep && later) {
    return {
      kind: "refused",
      met,
      text: "Pay with Bank Transfer pays today only, so a future-dated create gets 422 before any workflow starts.",
    };
  }
  if (bankStep) {
    return {
      kind: "pick",
      id: "bank",
      met,
      text: "The Router starts CreatePaymentIntentWorkflow. Amex's own checks run first, and a payment that fails them is DECLINED with no link. Otherwise it replies PENDING with the provider's link and waits for the confirm.",
    };
  }
  if (later) {
    return {
      kind: "pick",
      id: "later",
      met,
      text: `The Router starts CreateScheduledPaymentWorkflow on the Online cluster. On the due date, ExecuteScheduledPaymentWorkflow runs it on the Offline cluster.`,
    };
  }
  if (several) {
    return {
      kind: "pick",
      id: "multi",
      met,
      text: `The Router starts CreatePaymentWithMultipleInstructionsWorkflow, which decides every instruction itself and replies, then runs each accepted instruction's Execute and Fulfil in a child.`,
    };
  }
  if (pointsOnly) {
    return {
      kind: "pick",
      id: "points",
      met,
      text: `The Router starts the Pay with MR Points composite, across Billpay and Loyalty. Its steps are still to be defined.`,
    };
  }
  return {
    kind: "pick",
    id: "today",
    met,
    text: `The Router starts CreateImmediatePaymentWorkflow on the Online cluster, and the customer has an answer once Verify decides.`,
  };
}

function Badge({ n, quiet }) {
  return (
    <span
      className={clsx(styles.badge, quiet && styles.badgeQuiet)}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}

function CallTag({ n, name }) {
  return (
    <span className={styles.callTag}>
      <Badge n={n} quiet />
      <span className={styles.mono}>{name}</span>
    </span>
  );
}

function ReadTag({ name }) {
  return (
    <span className={styles.callTag}>
      <span className={styles.readVia}>via</span>
      <span className={styles.mono}>{name}</span>
    </span>
  );
}

const SOURCE_CHOICES = {
  debit: [["listed", "A bank from the list"]],
  transfer: [["listed", "A bank from the list"]],
};

function Segmented({ label, options, value, onChange, disabled }) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={styles.seg}
          aria-pressed={value === o.id}
          disabled={disabled?.(o.id)}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ n, term, call, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldTerm}>
          <Badge n={n} />
          {term}
        </span>
        {call}
      </div>
      {children}
    </div>
  );
}

function ThePage({ a, set }) {
  const uid = useId();
  const pointsOnly = a.points && a.pointsMode === "only";
  const method = METHODS.find((m) => m.id === a.method);
  const later = a.date === "later";
  /* A later date is not offered once the customer has picked something
     that pays today only, and the reverse: no choice is undone for them. */
  const todayOnly = a.points || (!pointsOnly && TODAY_ONLY.has(a.method));
  return (
    <section
      className={clsx(styles.col, styles.colPage)}
      aria-labelledby={`${uid}-page`}
    >
      <header className={styles.colHead}>
        <p className={styles.kicker} id={`${uid}-page`}>
          Make a payment
        </p>
        <p className={styles.colSub}>
          What the channel&apos;s page asks. Try it: the other columns follow.
        </p>
      </header>

      <Field
        n={1}
        term="How much"
        call={<CallTag n={1} name="ReadPaymentOptions.v1" />}
      >
        <Segmented
          label="How much"
          value={a.amount}
          onChange={(v) => set({ amount: v })}
          disabled={() => !a.owed}
          options={[
            { id: "statement", label: "Statement balance" },
            { id: "total", label: "Total balance" },
            { id: "min", label: "Minimum due" },
            { id: "other", label: "Other amount" },
          ]}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!a.owed}
            onChange={(e) => set({ owed: !e.target.checked })}
          />
          <span>The account owes nothing</span>
        </label>
      </Field>

      <div className={clsx(styles.rest, !a.owed && styles.off)} inert={!a.owed}>
        <Field
          n={2}
          term="When"
          call={<CallTag n={1} name="ReadPaymentOptions.v1" />}
        >
          <Segmented
            label="When"
            value={a.date}
            onChange={(v) => set({ date: v })}
            disabled={(id) => id === "later" && todayOnly}
            options={[
              { id: "today", label: "Today" },
              { id: "later", label: "A later date" },
            ]}
          />
          <p className={styles.hint}>
            {todayOnly
              ? `${a.points ? "MR Points pay" : `${method.label} pays`} today only.`
              : "Today, or a date inside the range ReadPaymentOptions.v1 gives this customer."}
          </p>
        </Field>

        <Field
          n={3}
          term="From where"
          call={<CallTag n={2} name="ReadBillpayInstruments.v1" />}
        >
          <div className={styles.selectWrap}>
            <select
              className={styles.select}
              aria-label="From where"
              value={a.method}
              disabled={pointsOnly}
              onChange={(e) =>
                set({
                  method: e.target.value,
                  ...(e.target.value === "debit" ? { points: false } : {}),
                })
              }
            >
              {METHODS.map((m) => (
                <option
                  key={m.id}
                  value={m.id}
                  disabled={later && m.todayOnly}
                >
                  {m.label}
                  {later && m.todayOnly ? " (today only)" : ""}
                </option>
              ))}
            </select>
          </div>
          {later && !pointsOnly && (
            <p className={styles.hint}>
              Pay with Bank Transfer and a debit card pay today only, so a
              later date doesn&apos;t offer them.
            </p>
          )}
          {method.note && !pointsOnly && !later && (
            <p className={styles.hint}>{method.note}</p>
          )}
          {!pointsOnly && (
            <div className={styles.sub}>
              <div className={styles.subHead}>
                <span>{READS[a.method].pick}</span>
                <ReadTag name={READS[a.method].read} />
              </div>
              <div className={styles.selectWrap}>
                {a.method === "bank" ? (
                  <select
                    className={styles.select}
                    aria-label="Which instrument"
                    value={a.account}
                    onChange={(e) => set({ account: e.target.value })}
                  >
                    <option value="checking">Checking account</option>
                    <option value="savings">Savings account</option>
                  </select>
                ) : (
                  <select
                    key={a.method}
                    className={styles.select}
                    aria-label={READS[a.method].pick}
                    defaultValue={SOURCE_CHOICES[a.method][0][0]}
                  >
                    {SOURCE_CHOICES[a.method].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
          <label className={clsx(styles.check, styles.checkStrong)}>
            <input
              type="checkbox"
              checked={a.points}
              disabled={a.method === "debit" || later}
              onChange={(e) => set({ points: e.target.checked })}
            />
            <span>Pay with MR Points</span>
            <span className={styles.checkNote}>
              {a.method === "debit"
                ? "not with a debit card"
                : later
                  ? "today only"
                  : "where the market offers them"}
            </span>
          </label>
          {a.points && (
            <Segmented
              label="How the points pay"
              value={a.pointsMode}
              onChange={(v) => set({ pointsMode: v })}
              options={[
                { id: "with", label: "With the instrument above" },
                { id: "only", label: "Points only" },
              ]}
            />
          )}
        </Field>

        <div className={styles.pay}>
          <span className={styles.payButton}>Review and pay</span>
          <CallTag n={3} name="CreatePayment.v3" />
        </div>

        <div className={styles.aside}>
          <p className={styles.kickerQuiet}>Shown only when offered</p>
          <p className={styles.asideLine}>
            <span className={styles.hollow} aria-hidden="true" />
            <span>
              <strong>Pay and set up a plan.</strong> Its own call,{" "}
              <code>CreatePaymentInstallment.v1</code>, and its own journey, Pay
              &amp; Plan.
            </span>
          </p>
          <p className={styles.kickerQuiet}>On each payment in the list</p>
          <p className={styles.asideNote}>
            Change and Cancel until the window closes. Confirm and Say no while
            it waits.
          </p>
        </div>
      </div>
    </section>
  );
}

function TheCalls({ a }) {
  const uid = useId();
  const pointsOnly = a.points && a.pointsMode === "only";
  const source = a.owed && !pointsOnly ? READS[a.method] : null;
  const calls = [
    {
      n: 1,
      name: "ReadPaymentOptions.v1",
      line: "What the customer owes and the options to pay it, and when they can pay. Nothing owed, nothing more.",
      on: true,
      status: "exists",
    },
    {
      n: 2,
      name: "ReadBillpayInstruments.v1",
      line: source
        ? `billpay-online calls ${source.read} for ${source.what}, and keeps only what the market's rules allow for this payment.`
        : "Where the customer pays from. Not called when MR Points pay alone.",
      on: Boolean(source),
      status: "new",
    },
    {
      n: 3,
      name: "CreatePayment.v3",
      line: pointsOnly
        ? "The payment, with no option ID: MR Points alone carry none. The Router picks the journey."
        : "The payment, with the chosen option's ID. The Router picks the journey.",
      on: a.owed,
      status: "exists",
    },
  ];
  const gates = [
    "once the customer picks where to pay from",
    "on Review and pay",
  ];
  return (
    <section
      className={clsx(styles.col, styles.colCalls)}
      aria-labelledby={`${uid}-calls`}
    >
      <div className={styles.callsMain}>
        <header className={styles.colHead}>
          <p className={styles.kicker} id={`${uid}-calls`}>
            The calls behind this page
          </p>
          <p className={styles.colSub}>
            The channel makes them, in this order.
          </p>
        </header>
        <ol className={styles.calls}>
          {calls.map((c, i) => (
            <li key={c.n} className={styles.callItem}>
              {i > 0 && (
                <p className={clsx(styles.gate, !c.on && styles.gateOff)}>
                  <span className={styles.gateLine} aria-hidden="true" />
                  {gates[i - 1]}
                </p>
              )}
              <div
                className={clsx(
                  styles.call,
                  c.status === "new" && styles.callNew,
                  !c.on && styles.callOff,
                )}
              >
                <Badge n={c.n} />
                <div className={styles.callBody}>
                  <p className={styles.callName}>
                    <span className={styles.mono}>{c.name}</span>
                    <span
                      className={clsx(
                        styles.status,
                        c.status === "new" && styles.statusNew,
                      )}
                    >
                      {c.status}
                    </span>
                  </p>
                  <p className={styles.callLine}>{c.line}</p>
                </div>
                <span className={styles.srOnly}>
                  {c.on
                    ? "Called for these answers."
                    : "Not called for these answers."}
                </span>
              </div>
            </li>
          ))}
        </ol>
        <p className={clsx(styles.callback, a.owed && a.method === "debit" && !(a.points && a.pointsMode === "only") && styles.callbackOn)}>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            For a debit card, one more call comes in after the create: the card provider&apos;s 3D Secure callback,
            straight to billpay-online and not from the channel.
          </span>
        </p>
      </div>

      <div className={styles.callsMore}>
        <p className={styles.kickerQuiet}>What call 1 returns</p>
        <ul className={styles.returns}>
          {OPTIONS_RETURNS.map((what) => (
            <li key={what}>
              <span className={styles.dotSquare} aria-hidden="true" />
              <span>{what}</span>
            </li>
          ))}
        </ul>

        <p className={styles.kickerQuiet}>Where call 2 looks</p>
        <ul className={styles.returns}>
          {Object.entries(READS)
            .filter(([id]) => id !== "debit")
            .map(([id, r]) => (
              <li key={id}>
                <span className={styles.dotSquare} aria-hidden="true" />
                <span>
                  {id === "transfer"
                    ? "Pay with Bank Transfer or debit card"
                    : id === "wallet"
                      ? "Wallet, not offered until a journey takes one"
                      : METHODS.find((m) => m.id === id).label}
                  <span className={styles.source}>{r.read}</span>
                </span>
              </li>
            ))}
        </ul>
        <p className={styles.asideNote}>
          The market&apos;s rules filter each list. An instrument enrolled
          through Autopay that is still pending verification carries its
          Autopay payments, but isn&apos;t offered for a payment made now.
        </p>

        <p className={styles.kickerQuiet}>Still to be defined</p>
        <ul className={styles.open}>
          {OPEN.map(([term, what]) => (
            <li key={term}>
              <span className={styles.hollow} aria-hidden="true" />
              <span>
                <strong>{term}</strong>
                <span className={styles.openWhat}>{what}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TheRouter({ a, set, result }) {
  const uid = useId();
  const picked = result.kind === "pick" ? result.id : null;
  return (
    <section
      className={clsx(styles.col, styles.colRouter)}
      aria-labelledby={`${uid}-router`}
    >
      <header className={styles.colHead}>
        <p className={styles.kicker} id={`${uid}-router`}>
          How the answers become a journey
        </p>
        <p className={styles.colSub}>
          The channel sends one request. The Router reads it and picks one
          journey.
        </p>
      </header>

      <div className={styles.door}>
        <span className={clsx(styles.mono, styles.doorName)}>CreatePayment.v3</span>
        <span className={styles.doorFields}>
          amount · account · date · instructions
        </span>
      </div>

      <div className={styles.knows}>
        <p className={styles.kickerQuiet}>Before the Router: One-Data&apos;s pending check</p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={a.pending}
            onChange={(e) => set({ pending: e.target.checked })}
          />
          <span>Another payment on the account is still PENDING</span>
          <span className={styles.checkNote}>One-Data declines this one</span>
        </label>
      </div>

      <p className={styles.legend}>
        <span className={styles.wfSwatch} aria-hidden="true" />
        The Router starts each journey as one Temporal workflow.
      </p>

      <ol className={styles.journeys}>
        {JOURNEYS.map((j, i) => {
          const on = picked === j.id;
          return (
            <li
              key={j.id}
              className={clsx(
                styles.journey,
                on && styles.journeyOn,
                picked && !on && styles.journeyDim,
              )}
            >
              <span className={styles.journeyN} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.conds}>
                {j.when.map((c) => (
                  <span
                    key={c}
                    className={clsx(
                      styles.cond,
                      on && result.met?.has(c) && styles.condOn,
                    )}
                  >
                    {c}
                  </span>
                ))}
              </span>
              <span className={styles.arrow} aria-hidden="true" />
              <span className={styles.journeyMain}>
                <Link className={styles.journeyTerm} to={j.to}>
                  <span className={styles.square} aria-hidden="true" />
                  {j.term}
                  {on && <span className={styles.srOnly}> (picked)</span>}
                </Link>
                <span className={styles.wf}>
                  <span className={styles.wfDot} aria-hidden="true" />
                  {j.composite ? `${j.wf} composite` : j.wf}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div
        className={clsx(styles.result, styles[`result_${result.kind}`])}
        aria-live="polite"
      >
        <p className={styles.resultTerm}>
          {result.kind === "pick" && JOURNEY[result.id].term}
          {result.kind === "none" && "No journey"}
          {result.kind === "refused" && "Turned away, 422"}
          {result.kind === "open" && "Not in the design yet"}
          {result.kind === "declined" && "Declined by One-Data"}
        </p>
        <p className={styles.resultText}>{result.text}</p>
      </div>

      <ul className={styles.notes}>
        <li>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            <strong>A corporate account</strong> asks for its allocations before
            any money moves, and takes neither bank confirmation nor a debit
            card: a corporate create with either gets 422.
          </span>
        </li>
        <li>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            <strong>Pay &amp; Plan</strong> is its own call,{" "}
            <code>CreatePaymentInstallment.v1</code>, and its own composite
            workflow. One-Data&apos;s pending check covers it too.
          </span>
        </li>
        <li>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            <strong>Wallet</strong> isn&apos;t offered: no journey takes one
            yet, so the page shows none until one does.
          </span>
        </li>
      </ul>

      <p className={styles.footnote}>
        The list is in the order customers meet these journeys. The Router
        checks them in its own order: a wait first, then a later date, then
        several instructions, then MR Points alone, then pay today. The
        ordered list is Proposed.
      </p>
    </section>
  );
}

const START = {
  owed: true,
  amount: "statement",
  method: "bank",
  account: "checking",
  points: false,
  pointsMode: "with",
  date: "today",
  pending: false,
};

export default function PaymentChoices() {
  const [a, setA] = useState(START);
  const set = (patch) => setA((prev) => ({ ...prev, ...patch }));
  const result = decide(a);
  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <ThePage a={a} set={set} />
        <TheCalls a={a} />
        <TheRouter a={a} set={set} result={result} />
      </div>
      <div className={styles.foot}>
        <button
          type="button"
          className={styles.reset}
          onClick={() => setA(START)}
        >
          Start again
        </button>
      </div>
    </div>
  );
}
