import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
import DataTable from '../DataTable';
import {ticks} from '../../lib/inlineMarkup';
import styles from './styles.module.css';

/**
 * ActivityTable: the activity catalogue, one row per system, with the task
 * queue each one runs on.
 *
 * Activities are shared across markets and none of them vary by behavior, so
 * the useful question is no longer "which of these change per market" but
 * "which of these are throttled". The filter answers that: every row is one of
 * three kinds of queue, worked out from its queue unless the row says so.
 *
 *   local     a local activity, in the workflow task itself (PaymentStore)
 *   limited   a rate-limited `ds-*` queue, one per downstream
 *   workflow  the workflow's own queue, for calls nobody throttles
 *
 * rows: [{name, system, queue, kind?, calledBy}]
 *       Backticks in system, queue and calledBy render as code.
 */

const KINDS = {
  local: 'Local',
  limited: 'Rate-limited queue',
  workflow: "Workflow's own queue",
};
const ALL = 'all';

const kindOf = (r) =>
  r.kind ||
  (/^ds-/.test(r.queue) ? 'limited' : /local/i.test(r.queue) ? 'local' : 'workflow');

export default function ActivityTable({rows = []}) {
  const [active, setActive] = useState(ALL);

  const filters = useMemo(() => {
    const counts = new Map([[ALL, rows.length]]);
    rows.forEach((r) => {
      const k = kindOf(r);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    return [ALL, ...Object.keys(KINDS).filter((k) => counts.has(k))].map((key) => ({
      key,
      label: key === ALL ? 'All' : KINDS[key],
      count: counts.get(key) || 0,
    }));
  }, [rows]);

  const shown = useMemo(
    () => rows.filter((r) => active === ALL || kindOf(r) === active),
    [rows, active],
  );

  const columns = [
    {
      key: 'name',
      header: 'Activity interface',
      headerClassName: styles.thName,
      rowHeader: true,
      className: styles.nameCell,
      render: (r) => <code>{r.name}</code>,
    },
    {
      key: 'system',
      header: 'System',
      headerClassName: styles.thSystem,
      render: (r) => ticks(r.system),
    },
    {
      key: 'queue',
      header: 'Task queue',
      headerClassName: styles.thQueue,
      className: styles.queueCell,
      render: (r) =>
        /^ds-/.test(r.queue) ? (
          <span className={clsx(styles.queue, styles.queueLimited)}>{r.queue}</span>
        ) : (
          <span className={styles.queueText}>{ticks(r.queue)}</span>
        ),
    },
    {
      key: 'calledBy',
      header: 'Called by',
      render: (r) => ticks(r.calledBy),
    },
  ];

  return (
    <DataTable
      className={styles.table}
      columns={columns}
      rows={shown}
      rowKey={(r) => r.name}
      separator="both"
      toolbar={
        <div className={styles.bar} role="group" aria-label="Filter by queue">
          <span className={styles.barLabel}>Runs on</span>
          {filters.map(({key, label, count}) => (
            <button
              key={key}
              type="button"
              className={clsx(styles.chip, active === key && styles.chipOn)}
              aria-pressed={active === key}
              onClick={() => setActive(key)}>
              {label}
              <span className={styles.count}>{count}</span>
            </button>
          ))}
        </div>
      }
      footer={
        <p className={styles.foot}>
          {active === ALL
            ? `All ${shown.length} activity interfaces.`
            : `${shown.length} of ${rows.length} run ${
                active === 'local'
                  ? 'as local activities, inside the workflow task.'
                  : active === 'limited'
                    ? 'on a rate-limited queue of their own.'
                    : "on the workflow's own queue, because nobody throttles them."
              }`}
        </p>
      }
    />
  );
}
