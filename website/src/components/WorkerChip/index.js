import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * WorkerChip: which Temporal worker a thing runs on.
 *
 * One prop, one string, and it normalises the case itself. Three components
 * used to make this decision, each with its own `=== 'offline'` test and its
 * own pair of hexes, and one of them made the page author write the value in
 * lowercase to make its test pass. Parsing a compound value like "Online /
 * Offline" stays with the caller; the colour is here.
 *
 * Callers retune the shape through the chip tokens, never the colour.
 */
export default function WorkerChip({worker, children, className}) {
  const offline = String(worker).trim().toLowerCase() === 'offline';
  return (
    <span className={clsx(styles.chip, offline && styles.offline, className)}>
      {children ?? worker}
    </span>
  );
}
