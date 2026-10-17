import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * WorkerChip: which Temporal cluster a thing runs on, Online or Offline.
 *
 * One prop, one string, and it normalises the case itself. `cluster` is the
 * name to use; `worker` is the older name for the same value, kept so a page
 * written before the two clusters still renders. Parsing a compound value like
 * "Online / Offline" stays with the caller; the colour is here.
 *
 * Callers retune the shape through the chip tokens, never the colour.
 */
export default function WorkerChip({cluster, worker, children, className}) {
  const value = cluster ?? worker;
  const offline = String(value).trim().toLowerCase() === 'offline';
  return (
    <span className={clsx(styles.chip, offline && styles.offline, className)}>
      {children ?? value}
    </span>
  );
}
