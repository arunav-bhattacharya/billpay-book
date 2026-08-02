import React from 'react';
import clsx from 'clsx';
import DataTable from '../DataTable';
import WorkerChip from '../WorkerChip';
import styles from './styles.module.css';

function WfChip({name, worker}) {
  return (
    <span className={styles.wf}>
      <code className={styles.wfName}>{name}</code>
      <WorkerChip worker={worker || 'Online'} className={styles.worker} />
    </span>
  );
}

/** An account-type tag on a split/allocation branch, which is the routing behavior. */
function AccountTag({account}) {
  if (!account) return null;
  const key = account.toLowerCase();
  const tone =
    key === 'corporate' ? styles.corporate : key.includes('travel') ? styles.travel : styles.consumer;
  return <span className={clsx(styles.acct, tone)}>{account}</span>;
}

/** A workflow pipeline: one or more chips joined by "→" to show sequence. */
function Pipeline({workflows}) {
  return (
    <div className={styles.pipeline}>
      {workflows.map((w, j) => (
        <React.Fragment key={j}>
          {j > 0 && (
            <span className={styles.seq} aria-hidden="true">
              →
            </span>
          )}
          <WfChip name={w.name} worker={w.worker} />
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Flatten the routes into table rows, collapsing consecutive routes that share
 * a trigger into one group.
 *
 * Each group's first row carries the span for the trigger cell, and every other
 * row in it omits that cell. The two have to agree exactly: an over-long
 * rowSpan is not an error in HTML, it is clamped to the end of the row group,
 * so the trigger would silently swallow the rows of the group below it. Doing
 * the counting here, in one pass, is what keeps them in step. DataTable checks
 * the arithmetic again in development.
 */
function toRows(routes) {
  const rows = [];
  routes.forEach((r, i) => {
    const isNewGroup = i === 0 || routes[i - 1].trigger !== r.trigger;
    if (isNewGroup) {
      rows.push({
        kind: 'main',
        spanStart: true,
        groupStart: rows.length > 0,
        trigger: r.trigger,
        label: r.condition,
        workflows: r.workflows,
      });
    } else {
      rows.push({kind: 'main', label: r.condition, workflows: r.workflows});
    }
    (r.children || []).forEach((ch) =>
      rows.push({
        kind: 'child',
        label: ch.when,
        account: ch.account,
        workflows: ch.workflows,
      }),
    );
  });
  // Count each group's height only once every row of it exists.
  let start = null;
  rows.forEach((row, i) => {
    if (row.spanStart) {
      if (start !== null) {
        rows[start].span = i - start;
      }
      start = i;
    }
  });
  if (start !== null) {
    rows[start].span = rows.length - start;
  }
  return rows;
}

const COLUMNS = [
  {
    key: 'trigger',
    header: 'Trigger',
    headerClassName: styles.thTrigger,
    rowHeader: true,
    scope: 'rowgroup',
    className: styles.triggerCell,
    rowSpan: (r) => r.span,
    render: (r) => (r.spanStart ? r.trigger : undefined),
  },
  {
    key: 'condition',
    header: 'Condition',
    headerClassName: styles.thCond,
    className: styles.condCell,
    render: (r) => (
      <>
        {r.kind === 'child' && (
          <span className={styles.branch} aria-hidden="true">
            ↳
          </span>
        )}
        {r.account && <AccountTag account={r.account} />}
        {r.label}
      </>
    ),
  },
  {
    key: 'routes',
    header: 'Routes to',
    render: (r) => <Pipeline workflows={r.workflows} />,
  },
];

/**
 * RouteMap: how the Billpay Router turns a request into workflow(s), as a
 * grouped table. Consecutive routes that share a `trigger` collapse into one
 * trigger cell (rowspan); each route's `condition` is a row, and any
 * conditional `children` (splits / corporate allocations) render as indented
 * sub-rows beneath their parent condition, tagged with the account type that
 * selects them.
 *
 * rows: [{
 *   trigger, condition,
 *   workflows: [{name, worker: 'Online'|'Offline'}],
 *   children?: [{when, account?: 'Consumer'|'Corporate'|'Business Travel', workflows: [...]}]
 * }]
 */
export default function RouteMap({rows = []}) {
  const tableRows = toRows(rows);
  return (
    <DataTable
      className={styles.table}
      columns={COLUMNS}
      rows={tableRows}
      separator="rules"
      rowProps={(r) => ({
        className: clsx(
          r.kind === 'child' && styles.childRow,
          r.kind === 'main' && !r.spanStart && styles.condStart,
          r.groupStart && styles.groupStart,
        ),
      })}
    />
  );
}
