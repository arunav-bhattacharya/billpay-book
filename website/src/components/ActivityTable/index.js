import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
import DataTable from '../DataTable';
import {ticks} from '../../lib/inlineMarkup';
import styles from './styles.module.css';

/**
 * ActivityTable: the activity and activity-group catalogue, filtered by the
 * behaviors a row varies by.
 *
 * The catalogue is 22 rows and the useful question is almost always "which of
 * these change when a market answers X differently". Filtering on the
 * behavior column answers that directly. Generic is a filter value of its own,
 * since "runs the same way everywhere" is the thing most readers want to
 * separate out first.
 *
 * One behavior at a time, not a multi-select. Rows carry two to four
 * behaviors each, so an AND of two filters is nearly always the same answer as
 * one of them alone, and an OR is not a question anyone asks.
 *
 * The filter stays here rather than moving into DataTable. Every part of it is
 * particular to this catalogue: Generic is a made-up value meaning an empty
 * list, the chips are ordered by first appearance, a row's own chip lights up
 * when it is the one being filtered on, and the footer is a three-way
 * sentence. As a general prop it would need four callbacks to say all that.
 *
 * rows: [{name, behaviors: string[], transition, does: string[]}]
 *       behaviors: [] means generic. Backticks in transition and does render as code.
 */

const GENERIC = 'Generic';
const ALL = 'All';

export default function ActivityTable({rows = []}) {
  const [active, setActive] = useState(ALL);

  const matches = (r, key) =>
    key === ALL ? true : key === GENERIC ? !(r.behaviors || []).length : (r.behaviors || []).includes(key);

  // Behaviors in the order they first appear, so the chips read in the same
  // order as the prose that introduces them rather than alphabetically.
  const filters = useMemo(() => {
    const seen = [];
    const counts = new Map([
      [ALL, rows.length],
      [GENERIC, 0],
    ]);
    rows.forEach((r) => {
      const behaviors = r.behaviors || [];
      if (!behaviors.length) {
        counts.set(GENERIC, counts.get(GENERIC) + 1);
      }
      behaviors.forEach((d) => {
        if (!seen.includes(d)) {
          seen.push(d);
        }
        counts.set(d, (counts.get(d) || 0) + 1);
      });
    });
    return [ALL, GENERIC, ...seen].map((key) => ({key, count: counts.get(key) || 0}));
  }, [rows]);

  const shown = useMemo(() => rows.filter((r) => matches(r, active)), [rows, active]);

  const columns = [
    {
      key: 'name',
      header: 'Activity / ActivityGroup',
      headerClassName: styles.thName,
      rowHeader: true,
      className: styles.nameCell,
    },
    {
      key: 'behaviors',
      header: 'Generic / Behaviors',
      headerClassName: styles.thBehaviors,
      className: styles.behaviorsCell,
      render: (r) =>
        (r.behaviors || []).length ? (
          r.behaviors.map((d) => (
            <span key={d} className={clsx(styles.behavior, active === d && styles.behaviorOn)}>
              {d}
            </span>
          ))
        ) : (
          <span className={styles.generic}>{GENERIC}</span>
        ),
    },
    {
      key: 'transition',
      header: 'State transition',
      headerClassName: styles.thState,
      className: styles.stateCell,
      render: (r) => ticks(r.transition),
    },
    {
      key: 'does',
      header: 'What it does',
      render: (r) => (
        <ul className={styles.does}>
          {(r.does || []).map((d, i) => (
            <li key={i}>{ticks(d)}</li>
          ))}
        </ul>
      ),
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
        <div className={styles.bar} role="group" aria-label="Filter by behavior">
          <span className={styles.barLabel}>Varies by</span>
          {filters.map(({key, count}) => (
            <button
              key={key}
              type="button"
              className={clsx(styles.chip, active === key && styles.chipOn)}
              aria-pressed={active === key}
              onClick={() => setActive(key)}>
              {key}
              <span className={styles.count}>{count}</span>
            </button>
          ))}
        </div>
      }
      footer={
        <p className={styles.foot}>
          {active === ALL
            ? `All ${shown.length} activities and activity groups.`
            : `${shown.length} of ${rows.length} ${
                active === GENERIC ? 'run the same way in every market.' : `vary by ${active}.`
              }`}
        </p>
      }
    />
  );
}
