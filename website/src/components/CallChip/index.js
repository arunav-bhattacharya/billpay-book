import React from "react";
import clsx from "clsx";
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
 */
const SAYS = {
  channel: "A call the channel makes: ",
  billpay: "A call Billpay makes: ",
  other: "A call from another system: ",
};

export default function CallChip({ name, who = "channel" }) {
  return (
    <span className={clsx(styles.chip, who === "channel" ? styles.channel : styles.other)}>
      <span className={styles.key} aria-hidden="true" />
      <span className={styles.srOnly}>{SAYS[who]}</span>
      <span className={styles.name}>{name}</span>
    </span>
  );
}
