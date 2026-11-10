import React, { useId, useState } from "react";
import clsx from "clsx";
import styles from "./styles.module.css";

/**
 * InstrumentContexts: one customer's enrolled instruments, seen through the
 * two journey contexts a channel can pass to ReadBillpayInstruments.v1.
 *
 * The two columns are the same list, placed identically, so the only thing
 * that changes between them is which instruments are offered. The market's
 * enrolledInstrumentStatuses setting decides: by default every context offers
 * ACTIVE instruments alone; the DE example lets a recurring direct debit
 * (Autopay) take one still pending verification as well. The status names
 * are placeholders until Payment Instruments' contract arrives.
 */

const INSTRUMENTS = [
  { label: "Girokonto ••4417", status: "ACTIVE" },
  { label: "Sparkonto ••0932", status: "ACTIVE" },
  { label: "Tagesgeld ••7781", status: "PENDING_VERIFICATION" },
];

const SETTINGS = {
  default: {
    term: "Default",
    ONE_TIME_DIRECT_DEBIT: ["ACTIVE"],
    RECURRING_DIRECT_DEBIT: ["ACTIVE"],
    line: "No market setting: every context offers ACTIVE instruments alone.",
  },
  de: {
    term: "DE example",
    ONE_TIME_DIRECT_DEBIT: ["ACTIVE"],
    RECURRING_DIRECT_DEBIT: ["ACTIVE", "PENDING_VERIFICATION"],
    line: "DE keeps a one-time direct debit to ACTIVE instruments, and lets Autopay take one still pending verification.",
  },
};

const CONTEXTS = [
  { id: "ONE_TIME_DIRECT_DEBIT", call: "CreatePayment.v3", who: "Billpay's create" },
  { id: "RECURRING_DIRECT_DEBIT", call: "CreatePaymentPlan.v1", who: "Autopay's own API, not Billpay's" },
];

export default function InstrumentContexts() {
  const uid = useId();
  const [setting, setSetting] = useState("de");
  const cfg = SETTINGS[setting];
  return (
    <figure className={styles.wrap} role="group" aria-labelledby={`${uid}-cap`}>
      <figcaption className={styles.srOnly} id={`${uid}-cap`}>
        One DE customer&apos;s three enrolled instruments under the two journey
        contexts. {cfg.line}
      </figcaption>

      <div className={styles.top}>
        <p className={styles.kicker}>One DE customer, two journey contexts</p>
        <div className={styles.toggle} role="group" aria-label="The market setting">
          {Object.entries(SETTINGS).map(([id, s]) => (
            <button
              key={id}
              type="button"
              className={styles.seg}
              aria-pressed={setting === id}
              onClick={() => setSetting(id)}
            >
              {s.term}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.cols}>
        {CONTEXTS.map((c) => {
          const allowed = new Set(cfg[c.id]);
          return (
            <section key={c.id} className={styles.col} aria-label={c.id}>
              <p className={styles.colHead}>
                <span className={styles.chip}>
                  <span className={styles.key} aria-hidden="true" />
                  {c.id}
                </span>
              </p>
              <p className={styles.then}>
                <span>then</span>
                <span className={styles.callChip}>
                  <span className={styles.callKey} aria-hidden="true" />
                  <span className={styles.srOnly}>a call the channel makes: </span>
                  {c.call}
                </span>
                <span className={styles.who}>{c.who}</span>
              </p>
              <ul className={styles.list}>
                {INSTRUMENTS.map((i) => {
                  const on = allowed.has(i.status);
                  return (
                    <li key={i.label} className={clsx(styles.inst, !on && styles.instOff)}>
                      <span className={styles.sq} aria-hidden="true" />
                      <span className={styles.label}>{i.label}</span>
                      <span className={styles.status}>{i.status}</span>
                      <span className={styles.srOnly}>{on ? " offered" : " not offered"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className={styles.setting}>
        <p className={styles.settingHead}>
          The market setting, Billpay&apos;s own
          <span className={styles.settingWhere}>DE consumer release</span>
        </p>
        <pre className={styles.code}>
          <span className={styles.codeKey}>enrolledInstrumentStatuses</span>
          {"\n"}
          {`  ONE_TIME_DIRECT_DEBIT    [ ${cfg.ONE_TIME_DIRECT_DEBIT.join(", ")} ]`}
          {"\n"}
          {`  RECURRING_DIRECT_DEBIT   [ ${cfg.RECURRING_DIRECT_DEBIT.join(", ")} ]`}
        </pre>
        <p className={styles.line}>{cfg.line}</p>
      </div>

      <p className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.sqOn} aria-hidden="true" />
          Offered on the page
        </span>
        <span className={styles.legendItem}>
          <span className={styles.sqOff} aria-hidden="true" />
          Left out for this context
        </span>
        <span className={styles.legendItem}>
          <span className={styles.chipSwatch} aria-hidden="true" />
          The value the channel passes
        </span>
      </p>
    </figure>
  );
}
