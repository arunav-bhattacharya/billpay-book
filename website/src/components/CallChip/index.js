import React from "react";
import clsx from "clsx";
import TriggerTag from "../TriggerTag";
import styles from "./styles.module.css";

/**
 * CallChip: one API call, named in running text, marked by who makes it.
 *
 * `who="channel"` (the default) is a call a channel makes: a solid navy chip
 * with a Bright Blue key square. Every call a channel makes carries this one
 * look across the site, so a reader can tell it apart from Billpay's own
 * calls at a glance. `who="billpay"` is a call Billpay makes, and
 * `who="other"` one that reaches Billpay from another system: both are a pale
 * tint, because the channel never makes them.
 *
 * `trigger` marks a call that starts or resumes a waiting payment, with the
 * mechanism as its value (`update`, `signal`, ...): a pink TriggerTag follows
 * the chip, the same mark the journeys and sequence diagrams use.
 */
const SAYS = {
  channel: "A call the channel makes: ",
  billpay: "A call Billpay makes: ",
  other: "A call from another system: ",
};

export default function CallChip({ name, who = "channel", trigger }) {
  const chip = (
    <span className={clsx(styles.chip, who === "channel" ? styles.channel : styles.other)}>
      <span className={styles.key} aria-hidden="true" />
      <span className={styles.srOnly}>{SAYS[who]}</span>
      <span className={styles.name}>{name}</span>
    </span>
  );
  if (!trigger) {
    return chip;
  }
  return (
    <span className={styles.pair}>
      {chip}
      <TriggerTag kind={trigger} />
    </span>
  );
}
