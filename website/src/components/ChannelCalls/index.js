import React, { useId, useState } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

/**
 * ChannelCalls: every call a channel makes on the payment page, set apart
 * from the calls Billpay makes for it.
 *
 * Each row is one channel call on the left, a solid navy block with a Bright
 * Blue key square, and on the right, in a pale tint, what Billpay does with
 * it. ReadBillpayInstruments.v1 carries its two mandatory filters as working
 * controls: the source picks Billpay's read, and the journey context picks
 * which enrolled instruments come back. A recurring direct debit takes
 * enrolled instruments only, and is then set up through the Autopay system's
 * CreatePaymentPlan.v1, not a Billpay API. Below, the calls that reach
 * Billpay from other systems, which a channel never makes, light for the
 * source that brings them.
 */

const SOURCES = [
  { id: "EnrolledInstruments", read: "ReadInstruments", what: "the instruments the customer has enrolled" },
  { id: "DebitCard", read: "ReadBanksForRealtimePayments.v1", what: "the banks the customer can pay from by debit card" },
  { id: "PayWithBankTransfer", read: "ReadBanksForRealtimePayments.v1", what: "the banks the customer can pay from in real time" },
];
const SOURCE = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const CONTEXTS = ["ONE_TIME_DIRECT_DEBIT", "RECURRING_DIRECT_DEBIT"];

function Key() {
  return <span className={styles.key} aria-hidden="true" />;
}

function Filter({ name, options, value, onChange, refuse }) {
  return (
    <div className={styles.filter}>
      <span className={styles.filterName}>{name}</span>
      <span className={styles.filterNote}>mandatory</span>
      <div className={styles.opts} role="group" aria-label={name}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={clsx(styles.opt, refuse?.(o) && styles.optRefused)}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Call({ n, name, line, off, children }) {
  return (
    <div className={clsx(styles.call, off && styles.callOff)}>
      <p className={styles.callHead}>
        <Key />
        <span className={styles.callName}>{name}</span>
        <span className={styles.callN}>{String(n).padStart(2, "0")}</span>
      </p>
      <p className={styles.callLine}>{line}</p>
      {children}
      <span className={styles.srOnly}>
        {off ? "Not made for these choices." : "A call the channel makes."}
      </span>
    </div>
  );
}

function Back({ items, note, off, refused }) {
  return (
    <div className={clsx(styles.back, off && styles.backOff, refused && styles.backRefused)}>
      {items.map((it) => (
        <p key={it.name} className={clsx(styles.backItem, it.lit && styles.backLit)}>
          <span className={styles.hollow} aria-hidden="true" />
          <span className={clsx(styles.backName, it.plain && styles.plain)}>{it.name}</span>
          {it.what && <span className={styles.backWhat}>{it.what}</span>}
        </p>
      ))}
      {note && <p className={styles.backNote}>{note}</p>}
    </div>
  );
}

/* An endpoint path that may break after each slash, never inside a word. */
function Path({ text }) {
  const parts = text.split("/");
  return (
    <span className={styles.backName}>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && "/"}
          {i > 0 && <wbr />}
          {p}
        </React.Fragment>
      ))}
    </span>
  );
}

function Thread({ off }) {
  return (
    <span className={clsx(styles.thread, off && styles.threadOff)} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function ChannelCalls() {
  const uid = useId();
  const [source, setSource] = useState("EnrolledInstruments");
  const [context, setContext] = useState("ONE_TIME_DIRECT_DEBIT");
  const recurring = context === "RECURRING_DIRECT_DEBIT";
  const refused = recurring && source !== "EnrolledInstruments";
  const bank = !recurring && source === "PayWithBankTransfer";
  const card = !recurring && source === "DebitCard";
  const read = SOURCE[source];

  return (
    <figure
      className={styles.wrap}
      role="group"
      aria-labelledby={`${uid}-cap`}
    >
      <figcaption className={styles.srOnly} id={`${uid}-cap`}>
        The calls a channel makes on the payment page, in order, each beside
        what Billpay does for it. Choose the two filters of
        ReadBillpayInstruments.v1 to see which read Billpay makes and which
        calls follow.
      </figcaption>

      <div className={styles.heads} aria-hidden="true">
        <p className={styles.head}>The channel calls</p>
        <span />
        <p className={styles.head}>Billpay, behind One-Data</p>
      </div>

      <ol className={styles.rows}>
        <li className={styles.row}>
          <Call
            n={1}
            name="ReadPaymentOptions.v1"
            line="What the customer owes, the options to pay it with their IDs, and the dates they can pay."
          />
          <Thread off />
          <Back
            off
            items={[{ name: "Not through Billpay", plain: true, what: "Payment Options answers the channel itself" }]}
          />
        </li>

        <li className={styles.row}>
          <Call
            n={2}
            name="ReadBillpayInstruments.v1"
            line="Where the customer can pay from. Both filters are mandatory."
          >
            <div className={styles.filters}>
              <Filter
                name="source"
                options={SOURCES.map((s) => s.id)}
                value={source}
                onChange={setSource}
                refuse={(o) => recurring && o !== "EnrolledInstruments"}
              />
              <Filter
                name="journeyContext"
                options={CONTEXTS}
                value={context}
                onChange={setContext}
              />
            </div>
          </Call>
          <Thread off={refused} />
          {refused ? (
            <Back
              refused
              items={[{ name: "400 INVALID_REQUEST", what: "Autopay is set up from enrolled instruments only" }]}
              note="No read is made. The channel asks again with EnrolledInstruments."
            />
          ) : (
            <Back
              items={[
                { name: "ReadInstruments", what: "for EnrolledInstruments", lit: read.read === "ReadInstruments" },
                {
                  name: "ReadBanksForRealtimePayments.v1",
                  what: "for DebitCard and PayWithBankTransfer",
                  lit: read.read !== "ReadInstruments",
                },
              ]}
              note={
                source === "EnrolledInstruments"
                  ? `Billpay keeps the instruments the market's rules allow, and the statuses enrolledInstrumentStatuses gives ${context}.`
                  : `Billpay reads ${read.what}, and keeps what the market's rules allow.`
              }
            />
          )}
        </li>

        <li className={styles.row}>
          {recurring ? (
            <>
              <Call
                n={3}
                name="CreatePaymentPlan.v1"
                line="Autopay is set up with the instrument the customer picked."
                off={refused}
              />
              <Thread off />
              <Back
                off
                items={[{ name: "Not a Billpay API", plain: true, what: "the Autopay system's own" }]}
              />
            </>
          ) : (
            <>
              <Call
                n={3}
                name="CreatePayment.v3"
                line="The payment, with the chosen option's ID. The only call that starts anything."
              />
              <Thread />
              <Back
                items={[
                  { name: "The Router", plain: true, what: "picks the journey", lit: true },
                  {
                    name: bank || card ? "CreatePaymentIntentWorkflow" : "The journey's workflow",
                    plain: !(bank || card),
                    what: bank
                      ? "replies PENDING with Amex Pay with Bank Transfer's link"
                      : card
                        ? "replies PENDING with the 3D Secure challenge link"
                        : "replies with the decision",
                    lit: true,
                  },
                ]}
              />
            </>
          )}
        </li>

        <li className={styles.row}>
          <Call
            n={4}
            name="CreateConfirmPendingPayment.v1"
            line="Pay with Bank Transfer only: the customer is back from their bank, with the bank's answer."
            off={!bank}
          />
          <Thread off={!bank} />
          <Back
            off={!bank}
            items={[
              { name: "The first confirm decides", plain: true, what: "the channel's, or Amex Pay with Bank Transfer's", lit: bank },
              { name: "ACCEPTED or DECLINED", what: "on the bank's answer, with no call", lit: bank },
              { name: "Then M3's settled notice", plain: true, what: "before Execute and Fulfil run", lit: bank },
            ]}
          />
        </li>
      </ol>

      <div className={styles.others}>
        <p className={styles.head}>Never from the channel: calls from other systems</p>
        <ul className={styles.otherList}>
          <li className={clsx(styles.other, bank && styles.otherLit)}>
            <span className={styles.hollow} aria-hidden="true" />
            <Path text="POST /payments/{payment-id}/bank-confirmation" />
            <span className={styles.backWhat}>Amex Pay with Bank Transfer&apos;s own confirm</span>
          </li>
          <li className={clsx(styles.other, bank && styles.otherLit)}>
            <span className={styles.hollow} aria-hidden="true" />
            <Path text="POST /payments/{payment-id}/settlement" />
            <span className={styles.backWhat}>M3&apos;s settled notice, before Execute runs</span>
          </li>
          <li className={clsx(styles.other, card && styles.otherLit)}>
            <span className={styles.hollow} aria-hidden="true" />
            <Path text="POST /payments/{payment-id}/authentication" />
            <span className={styles.backWhat}>the card provider&apos;s 3D Secure callback</span>
          </li>
        </ul>
      </div>

      <p className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={clsx(styles.swatch, styles.swatchChannel)} aria-hidden="true" />
          A call the channel makes
        </span>
        <span className={styles.legendItem}>
          <span className={clsx(styles.swatch, styles.swatchOther)} aria-hidden="true" />
          What Billpay does, or a call from another system
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatchChoice} aria-hidden="true" />
          The choice in force
        </span>
      </p>
    </figure>
  );
}
