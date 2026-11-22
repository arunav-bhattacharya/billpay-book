import React from 'react';
import clsx from 'clsx';
import {triggerKind, TRIGGER_ICON} from '../../lib/triggers';
import styles from './styles.module.css';

/**
 * TriggerTag: a small pink tag that says something outside starts or resumes
 * the payment here, and names how: Update, Signal, Callback, Dispatcher or
 * Events. It is the same mark as JourneyMap's trigger flag, for use beside a
 * call, a list item or a line of text.
 *
 * `kind` is one of the keys in src/lib/triggers.js. `label`, when given,
 * replaces the word, for a key that lists several kinds.
 */
export default function TriggerTag({kind, label, className}) {
  const k = triggerKind(kind);
  return (
    <span className={clsx(styles.tag, className)} title={`Starts or resumes the payment from outside. ${k.word}: ${k.note}.`}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {TRIGGER_ICON.map((d) => <path key={d} d={d} />)}
      </svg>
      <span className={styles.srOnly}>Starts or resumes the payment from outside: </span>
      {label || k.word}
    </span>
  );
}
