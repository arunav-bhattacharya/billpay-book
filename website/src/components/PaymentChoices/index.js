import React, { useId, useState } from "react";
import clsx from "clsx";
import Link from "@docusaurus/Link";
import styles from "./styles.module.css";

/**
 * PaymentChoices: the Make a Payment Journey page, as one working model.
 *
 * Three columns. The first is the page a channel shows a customer, with
 * working controls. The second is the calls the channel makes behind it, in
 * order, lit when this set of answers makes them. The third is the Router's
 * side: one door, CreatePayment.v3, and the journeys it can pick, each a
 * Temporal workflow. Change an answer and the picked journey moves.
 *
 * The rules follow the spec's Router: it checks for a wait first (a bank step,
 * or a go-ahead), then a later date, then several instructions, then MR Points
 * alone, then pay today. The list shows the journeys in the order customers
 * meet them, which is not the order the Router checks them in, and the
 * footnote says so. Where the spec has no answer yet (Wallet, a go-ahead on a
 * composite create, a later date with a bank step), the model says that
 * instead of picking a journey.
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
    id: "pending",
    term: "Pay while another payment is pending",
    when: ["another pending", "go-ahead on"],
    wf: "CreatePaymentIntent",
    to: `${ALL_JOURNEYS}#pay-while-another-payment-is-pending`,
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
  { id: "bank", label: "Bank account" },
  { id: "debit", label: "Debit card", note: "checked with 3D Secure" },
  { id: "wallet", label: "Wallet" },
  {
    id: "transfer",
    label: "Pay with Bank Transfer",
    note: "you confirm it at your bank",
  },
];

const RETURNS = [
  [
    "the ways to pay this market takes, which need a bank step, and that a debit card needs 3D Secure",
    "rule settings, bank confirmation",
  ],
  [
    "the dates it offers: today, or up to the scheduling horizon, 30 days by default",
    "operations settings",
  ],
  [
    "the cancellation window, and limits such as the largest payment",
    "operations and rule settings",
  ],
  ["whether it offers Pay & Plan and MR Points", "APIs it takes, a setting"],
  ["payments already pending on the account", "One-Data"],
];

const OPEN = [
  [
    "ReadPaymentChoices.v1",
    "its contract, and the billpay-core read behind it",
  ],
  ["Pay with MR Points", "its steps, and its calls to Loyalty"],
  ["Wallet", "which instrument it is, and whether it needs a bank step"],
  ["The card provider outside the UK", "Checkout.com in the UK; other markets' still to be named"],
];

/* What the Router does with one set of answers. Returns a result with a
   kind: 'none' (nothing owed), 'open' (the design has no answer yet),
   'refused' (422), or 'pick' with the journey's id. */
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
  if (a.pending) met.add("another pending");
  if (a.goAhead) met.add("go-ahead on");

  if (instructions.includes("wallet")) {
    return {
      kind: "open",
      met,
      text: "Wallet is still to be defined: which instrument it is, and whether it needs a bank step. The Router has no rule for it yet.",
    };
  }
  if (card && (several || later)) {
    return {
      kind: "refused",
      met,
      text: "A debit card pays today only, with one instruction and no MR Points, so this create gets 422 before any workflow starts.",
    };
  }
  if (card && a.pending && a.goAhead) {
    return {
      kind: "open",
      met,
      text: "Still to be decided: what the Router does with a debit card payment made while another is pending, in a market with the go-ahead on.",
    };
  }
  if (card) {
    return {
      kind: "pick",
      id: "card",
      met,
      text: `The Router starts CreatePaymentIntentWorkflow. It starts 3D Secure with the card provider and replies PENDING with the challenge link, or none. The card provider's callback brings the result, and Verify authorizes the payment last: approved, the money leaves the customer's account; declined by the card's bank, the payment is DECLINED. No callback in 2 minutes, and the payment is cancelled.${a.pending ? " One-Data sends the pending payment's ID, and the Router ignores it, because the go-ahead is off." : ""}`,
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
      kind: "open",
      met,
      text: "Only consumer payments made today take bank confirmation. What a later date with Pay with Bank Transfer does isn't in the design yet.",
    };
  }
  if (a.pending && a.goAhead && !bankStep) {
    if (several || pointsOnly) {
      return {
        kind: "open",
        met,
        text: "Still to be decided: the Router checks for a wait first, but the workflow that waits for a go-ahead runs one instruction. Whether a composite create can wait for a go-ahead is an open item.",
      };
    }
    return {
      kind: "pick",
      id: "pending",
      met,
      text: later
        ? "The Router starts CreatePaymentIntentWorkflow, which replies PENDING with the pending payments. At the customer's yes, the payment is scheduled for its date."
        : "The Router starts CreatePaymentIntentWorkflow, which replies PENDING with the pending payments and waits for the customer's yes.",
    };
  }
  const ignored =
    a.pending && !a.goAhead
      ? " One-Data sends the pending payment's ID, and the Router ignores it, because the go-ahead is off."
      : "";
  if (bankStep) {
    return {
      kind: "pick",
      id: "bank",
      met,
      text:
        a.pending && a.goAhead
          ? "The Router starts CreatePaymentIntentWorkflow. It waits once: the reply carries the provider's link and the pending payments, and the bank confirm is the go-ahead."
          : `The Router starts CreatePaymentIntentWorkflow, which replies PENDING with the provider's link and waits for the confirm.${ignored}`,
    };
  }
  if (later) {
    return {
      kind: "pick",
      id: "later",
      met,
      text: `The Router starts CreateScheduledPaymentWorkflow on the Online cluster. On the due date, ExecuteScheduledPaymentWorkflow runs it on the Offline cluster.${ignored}`,
    };
  }
  if (several) {
    return {
      kind: "pick",
      id: "multi",
      met,
      text: `The Router starts CreatePaymentWithMultipleInstructionsWorkflow, which runs one CreateImmediatePaymentWorkflow per instruction.${ignored}`,
    };
  }
  if (pointsOnly) {
    return {
      kind: "pick",
      id: "points",
      met,
      text: `The Router starts the Pay with MR Points composite, across Billpay and Loyalty. Its steps are still to be defined.${ignored}`,
    };
  }
  return {
    kind: "pick",
    id: "today",
    met,
    text: `The Router starts CreateImmediatePaymentWorkflow on the Online cluster, and the customer has an answer once Verify decides.${ignored}`,
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
        call={<CallTag n={1} name="Payment Options API" />}
      >
        <Segmented
          label="How much"
          value={a.amount}
          onChange={(v) => set({ amount: v })}
          disabled={() => !a.owed}
          options={[
            { id: "min", label: "Minimum due" },
            { id: "statement", label: "Statement balance" },
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
          term="From where"
          call={<CallTag n={2} name="ReadPaymentChoices.v1" />}
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
                  ...(e.target.value === "debit" ? { points: false, date: "today" } : {}),
                })
              }
            >
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {method.note && !pointsOnly && (
            <p className={styles.hint}>{method.note}</p>
          )}
          {(a.method === "bank" || a.method === "debit") && !pointsOnly && (
            <div className={styles.sub}>
              <div className={styles.subHead}>
                <span>{a.method === "debit" ? "Which card" : "Which account"}</span>
                <CallTag n={3} name="Payment Instruments API" />
              </div>
              <div className={styles.selectWrap}>
                {a.method === "debit" ? (
                  <select className={styles.select} aria-label="Which card" defaultValue="saved">
                    <option value="saved">Saved debit card</option>
                  </select>
                ) : (
                  <select
                    className={styles.select}
                    aria-label="Which account"
                    value={a.account}
                    onChange={(e) => set({ account: e.target.value })}
                  >
                    <option value="checking">Checking account</option>
                    <option value="savings">Savings account</option>
                  </select>
                )}
              </div>
            </div>
          )}
          <label className={clsx(styles.check, styles.checkStrong)}>
            <input
              type="checkbox"
              checked={a.points}
              disabled={a.method === "debit"}
              onChange={(e) =>
                set({
                  points: e.target.checked,
                  date: e.target.checked ? "today" : a.date,
                })
              }
            />
            <span>Pay with MR Points</span>
            <span className={styles.checkNote}>
              {a.method === "debit" ? "not with a debit card" : "where the market offers them"}
            </span>
          </label>
          {a.points && (
            <Segmented
              label="How the points pay"
              value={a.pointsMode}
              onChange={(v) => set({ pointsMode: v })}
              options={[
                { id: "with", label: "With the account above" },
                { id: "only", label: "Points only" },
              ]}
            />
          )}
        </Field>

        <Field
          n={3}
          term="When"
          call={<CallTag n={2} name="ReadPaymentChoices.v1" />}
        >
          <Segmented
            label="When"
            value={a.date}
            onChange={(v) => set({ date: v })}
            disabled={(id) => id === "later" && (a.points || a.method === "debit")}
            options={[
              { id: "today", label: "Today" },
              { id: "later", label: "A later date" },
            ]}
          />
          <p className={styles.hint}>
            {a.method === "debit"
              ? "A debit card pays today only."
              : a.points
                ? "MR Points pay today only."
                : "Up to 30 days ahead by default. A per-market horizon is Proposed."}
          </p>
        </Field>

        <div className={styles.pay}>
          <span className={styles.payButton}>Review and pay</span>
          <CallTag n={4} name="CreatePayment.v3" />
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
  const instruments = a.owed && (a.method === "bank" || a.method === "debit") && !pointsOnly;
  const calls = [
    {
      n: 1,
      name: "Payment Options API",
      line: "The amounts the customer owes. Nothing owed, nothing more.",
      on: true,
    },
    {
      n: 2,
      name: "ReadPaymentChoices.v1",
      line: "Billpay's own rules for the market: what to offer, and when.",
      on: a.owed,
      proposed: true,
    },
    {
      n: 3,
      name: "Payment Instruments API",
      line: "The customer's bank accounts, or their debit cards.",
      on: instruments,
    },
    {
      n: 4,
      name: "CreatePayment.v3",
      line: "The payment. The Router picks the journey.",
      on: a.owed,
    },
  ];
  const gates = [
    "when something is owed",
    "only when a bank account or a debit card is picked",
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
                  c.proposed && styles.callNew,
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
                        c.proposed && styles.statusNew,
                      )}
                    >
                      {c.proposed ? "Proposed" : "exists"}
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
            straight to billpay-core and not from the channel.
          </span>
        </p>
      </div>

      <div className={styles.callsMore}>
        <p className={styles.kickerQuiet}>What call 2 returns</p>
        <ul className={styles.returns}>
          {RETURNS.map(([what, from]) => (
            <li key={what}>
              <span className={styles.dotSquare} aria-hidden="true" />
              <span>
                {what}
                <span className={styles.source}>{from}</span>
              </span>
            </li>
          ))}
        </ul>

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
        <p className={styles.kickerQuiet}>What the Router also knows</p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={a.pending}
            onChange={(e) => set({ pending: e.target.checked })}
          />
          <span>Another payment is pending on the account</span>
          <span className={styles.checkNote}>One-Data finds it</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={a.goAhead}
            onChange={(e) => set({ goAhead: e.target.checked })}
          />
          <span>The market has the go-ahead turned on</span>
          <span className={styles.checkNote}>off by default</span>
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
        </p>
        <p className={styles.resultText}>{result.text}</p>
      </div>

      <ul className={styles.notes}>
        <li>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            <strong>A corporate account</strong> asks for its allocations before
            any money moves. Bank confirmation is for consumer payments only.
          </span>
        </li>
        <li>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            <strong>Pay &amp; Plan</strong> is its own call,{" "}
            <code>CreatePaymentInstallment.v1</code>, and its own composite
            workflow.
          </span>
        </li>
        <li>
          <span className={styles.hollow} aria-hidden="true" />
          <span>
            <strong>Wallet</strong> is still to be defined.
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
  goAhead: false,
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
