import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

function WfChip({name, worker}) {
  return (
    <span className={styles.wf}>
      <span className={styles.wfName}>{name}</span>
      <span
        className={clsx(styles.worker, worker.toLowerCase() === 'offline' ? styles.offline : styles.online)}>
        {worker}
      </span>
    </span>
  );
}

function WfList({workflows}) {
  return workflows.map((w, j) => (
    <React.Fragment key={j}>
      {j > 0 && <span className={styles.then}>then</span>}
      <WfChip name={w.name} worker={w.worker} />
    </React.Fragment>
  ));
}

/**
 * RouteMap — how the Billpay Router turns a request into workflow(s).
 * Each route: a trigger (+ condition) → one or more workflow chips (with a
 * gradient Online/Offline worker badge). Optional `children` show conditional
 * child workflows (e.g. splits / corporate allocations) with their `when`.
 *
 * routes: [{
 *   trigger, condition,
 *   workflows: [{name, worker: 'Online'|'Offline'}],
 *   children?: [{when, workflows: [{name, worker}]}]
 * }]
 */
export default function RouteMap({routes = []}) {
  return (
    <div className={styles.routes}>
      {routes.map((r, i) => {
        const tone = (r.workflows[0]?.worker || 'Online').toLowerCase();
        return (
          <div
            key={i}
            className={clsx(styles.route, tone === 'offline' ? styles.toneOffline : styles.toneOnline)}>
            <div className={styles.routeMain}>
              <div className={styles.trigger}>
                <span className={styles.triggerName}>{r.trigger}</span>
                {r.condition && <span className={styles.triggerCond}>{r.condition}</span>}
              </div>
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
              <div className={styles.targets}>
                <WfList workflows={r.workflows} />
              </div>
            </div>

            {r.children && r.children.length > 0 && (
              <div className={styles.children}>
                {r.children.map((ch, k) => (
                  <div key={k} className={styles.child}>
                    <span className={styles.when}>{ch.when}</span>
                    <span className={styles.childArrow} aria-hidden="true">
                      →
                    </span>
                    <div className={styles.childWfs}>
                      <WfList workflows={ch.workflows} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
