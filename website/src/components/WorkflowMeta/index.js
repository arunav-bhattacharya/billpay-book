import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

// The four processing dimensions, plus instrumentType (used by Payment Intent).
// Rendered as the exact spec field names so the page stays grounded.
const ALL = [
  'accountType',
  'requiresArPosting',
  'requiresRealtimeClearing',
  'requiresMandateAuthorization',
];

/**
 * Meta block for a workflow, in two labelled rows:
 *   Worker      — which Temporal worker(s) it runs on
 *   Dimensions  — the dimensions that select its stage / activity-group impls
 *
 * Props:
 *   worker      'Online' | 'Offline' | 'Online / Offline'
 *   dimensions  'all' (the four) | 'generic' (none) | string[] of field names
 */
export default function WorkflowMeta({worker = 'Online', dimensions = []}) {
  const workers = String(worker)
    .split('/')
    .map((w) => w.trim())
    .filter(Boolean);

  const dims =
    dimensions === 'all' ? ALL : dimensions === 'generic' ? [] : dimensions;

  return (
    <div className={styles.meta}>
      <div className={styles.row}>
        <span className={styles.label}>Worker</span>
        <div className={styles.values}>
          {workers.map((w) => (
            <span
              key={w}
              className={clsx(
                styles.worker,
                w.toLowerCase() === 'offline' ? styles.offline : styles.online,
              )}>
              {w} worker
            </span>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Dimensions</span>
        <div className={styles.values}>
          {dims.length === 0 ? (
            <span className={styles.generic}>Generic — no dimensions</span>
          ) : (
            dims.map((d) => (
              <code key={d} className={styles.dim}>
                {d}
              </code>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
