import React from 'react';
import WorkerChip from '../WorkerChip';
import {ticks} from '../../lib/inlineMarkup';
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
 * Meta block for a workflow, in labelled rows:
 *   Cluster       the Temporal cluster(s) it runs on
 *   Workflow ID   the ID it starts with, always the payment ID plus a suffix
 *   Started by    the start mode, or what starts it
 *   Stages vary   the behaviors that select its stage implementations
 *
 * Props:
 *   cluster     'Online' | 'Offline' | 'Online / Offline'
 *               (`worker` is the older name for the same value)
 *   id          workflow ID pattern, such as '{paymentId}-init'. An ID that
 *               needs words, such as '`governor`, plus its Schedule's trigger
 *               time', is set as text, with any code in backticks
 *   start       what starts it; `code` in backticks is rendered as code
 *   behaviors   'all' (the four) | 'generic' (none) | string[] of field names;
 *               leave it out to skip the row
 */
export default function WorkflowMeta({cluster, worker, id, start, behaviors}) {
  const clusters = String(cluster ?? worker ?? 'Online')
    .split('/')
    .map((c) => c.trim())
    .filter(Boolean);

  const list =
    behaviors === undefined
      ? null
      : behaviors === 'all'
        ? ALL
        : behaviors === 'generic'
          ? []
          : behaviors;

  return (
    <div className={styles.meta}>
      <div className={styles.row}>
        <span className={styles.label}>Cluster</span>
        <div className={styles.values}>
          {clusters.map((c) => (
            <WorkerChip key={c} cluster={c} className={styles.worker}>
              {c} cluster
            </WorkerChip>
          ))}
        </div>
      </div>
      {id && (
        <div className={styles.row}>
          <span className={styles.label}>Workflow ID</span>
          <div className={styles.values}>
            {/[`\s]/.test(id) ? (
              <span className={styles.start}>{ticks(id)}</span>
            ) : (
              <code className={styles.id}>{id}</code>
            )}
          </div>
        </div>
      )}
      {start && (
        <div className={styles.row}>
          <span className={styles.label}>Started by</span>
          <div className={styles.values}>
            <span className={styles.start}>{ticks(start)}</span>
          </div>
        </div>
      )}
      {list && (
        <div className={styles.row}>
          <span className={styles.label}>Stages vary by</span>
          <div className={styles.values}>
            {list.length === 0 ? (
              <span className={styles.generic}>Nothing: the same stages in every market</span>
            ) : (
              list.map((b) => (
                <code key={b} className={styles.behavior}>
                  {b}
                </code>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
