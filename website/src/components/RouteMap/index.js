import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

function WfChip({name, worker}) {
  const tone = (worker || 'Online').toLowerCase() === 'offline' ? styles.offline : styles.online;
  return (
    <span className={styles.wf}>
      <code className={styles.wfName}>{name}</code>
      <span className={clsx(styles.worker, tone)}>{worker}</span>
    </span>
  );
}

/** A workflow pipeline — one or more chips joined by "→" to show sequence. */
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
 * RouteMap — how the Billpay Router turns a request into workflow(s), as a
 * grouped table. Consecutive routes that share a `trigger` collapse into one
 * trigger cell (rowspan); each route's `condition` is a row, and any
 * conditional `children` (splits / corporate allocations) render as indented
 * sub-rows beneath their parent condition.
 *
 * routes: [{
 *   trigger, condition,
 *   workflows: [{name, worker: 'Online'|'Offline'}],
 *   children?: [{when, workflows: [{name, worker}]}]
 * }]
 */
export default function RouteMap({routes = []}) {
  // Collapse consecutive same-trigger routes into groups.
  const groups = [];
  routes.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.trigger === r.trigger) {
      last.routes.push(r);
    } else {
      groups.push({trigger: r.trigger, routes: [r]});
    }
  });

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thTrigger}>Trigger</th>
            <th className={styles.thCond}>Condition</th>
            <th className={styles.thRoute}>Routes to</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => {
            // Flatten the group into rows: each route's main row, then its children.
            const rows = [];
            g.routes.forEach((r) => {
              rows.push({kind: 'main', label: r.condition, workflows: r.workflows});
              (r.children || []).forEach((ch) =>
                rows.push({kind: 'child', label: ch.when, workflows: ch.workflows}),
              );
            });

            return rows.map((row, rj) => (
              <tr
                key={`${gi}-${rj}`}
                className={clsx(
                  row.kind === 'child' && styles.childRow,
                  rj === 0 && gi > 0 && styles.groupStart,
                )}>
                {rj === 0 && (
                  <th scope="rowgroup" rowSpan={rows.length} className={styles.triggerCell}>
                    {g.trigger}
                  </th>
                )}
                <td className={clsx(styles.condCell, row.kind === 'child' && styles.condChild)}>
                  {row.kind === 'child' && (
                    <span className={styles.branch} aria-hidden="true">
                      ↳
                    </span>
                  )}
                  {row.label}
                </td>
                <td className={styles.routeCell}>
                  <Pipeline workflows={row.workflows} />
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
