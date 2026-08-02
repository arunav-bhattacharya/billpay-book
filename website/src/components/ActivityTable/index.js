import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
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
 * rows: [{name, behaviors: string[], transition, does: string[]}]
 *       behaviors: [] means generic. Backticks in transition and does render as code.
 */

const GENERIC = 'Generic';
const ALL = 'All';

/** Inline `code` spans, so row data stays plain readable strings. */
function Ticks({children}) {
  const parts = String(children).split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <code key={i}>{part}</code> : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </>
  );
}

export default function ActivityTable({rows = []}) {
  const [active, setActive] = useState(ALL);

  // Behaviors in the order they first appear, so the chips read in the same
  // order as the prose that introduces them rather than alphabetically.
  const filters = useMemo(() => {
    const seen = [];
    rows.forEach((r) => (r.behaviors || []).forEach((d) => seen.includes(d) || seen.push(d)));
    const count = (key) =>
      rows.filter((r) =>
        key === ALL ? true : key === GENERIC ? !(r.behaviors || []).length : (r.behaviors || []).includes(key),
      ).length;
    return [ALL, GENERIC, ...seen].map((key) => ({key, count: count(key)}));
  }, [rows]);

  const shown = useMemo(
    () =>
      rows.filter((r) =>
        active === ALL
          ? true
          : active === GENERIC
            ? !(r.behaviors || []).length
            : (r.behaviors || []).includes(active),
      ),
    [rows, active],
  );

  return (
    <div className={styles.root}>
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

      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thName}>Activity / ActivityGroup</th>
              <th className={styles.thBehaviors}>Generic / Behaviors</th>
              <th className={styles.thState}>State transition</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.name}>
                <th scope="row" className={styles.nameCell}>
                  {r.name}
                </th>
                <td className={styles.behaviorsCell}>
                  {(r.behaviors || []).length ? (
                    (r.behaviors || []).map((d) => (
                      <span
                        key={d}
                        className={clsx(styles.behavior, active === d && styles.behaviorOn)}>
                        {d}
                      </span>
                    ))
                  ) : (
                    <span className={styles.generic}>{GENERIC}</span>
                  )}
                </td>
                <td className={styles.stateCell}>
                  <Ticks>{r.transition}</Ticks>
                </td>
                <td>
                  <ul className={styles.does}>
                    {(r.does || []).map((d, i) => (
                      <li key={i}>
                        <Ticks>{d}</Ticks>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.foot}>
        {active === ALL
          ? `All ${shown.length} activities and activity groups.`
          : `${shown.length} of ${rows.length} ${
              active === GENERIC
                ? 'run the same way in every market.'
                : `vary by ${active}.`
            }`}
      </p>
    </div>
  );
}
