import React from 'react';
import WorkerChip from '../WorkerChip';
import styles from './styles.module.css';

// The four processing behaviors, rendered as the exact spec field names so the
// page stays grounded.
const ALL = [
  'accountType',
  'requiresArPosting',
  'requiresRealtimeClearing',
  'requiresMandateAuthorization',
];

/**
 * Meta block for a workflow, in two labelled rows:
 *   Worker      the Temporal worker(s) it runs on
 *   Behaviors   the behaviors that select its stage / activity-group impls
 *
 * Props:
 *   worker      'Online' | 'Offline' | 'Online / Offline'
 *   behaviors   'all' (the four) | 'generic' (none) | string[] of field names
 */
export default function WorkflowMeta({worker = 'Online', behaviors = []}) {
  const workers = String(worker)
    .split('/')
    .map((w) => w.trim())
    .filter(Boolean);

  const list =
    behaviors === 'all' ? ALL : behaviors === 'generic' ? [] : behaviors;

  return (
    <div className={styles.meta}>
      <div className={styles.row}>
        <span className={styles.label}>Worker</span>
        <div className={styles.values}>
          {workers.map((w) => (
            <WorkerChip key={w} worker={w} className={styles.worker}>
              {w} worker
            </WorkerChip>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Behaviors</span>
        <div className={styles.values}>
          {list.length === 0 ? (
            <span className={styles.generic}>Generic, no behaviors</span>
          ) : (
            list.map((b) => (
              <code key={b} className={styles.behavior}>
                {b}
              </code>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
