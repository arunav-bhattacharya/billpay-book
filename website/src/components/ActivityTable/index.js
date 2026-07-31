import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * ActivityTable: the activity and activity-group catalogue, filtered by the
 * dimensions a row varies by.
 *
 * The catalogue is 22 rows and the useful question is almost always "which of
 * these change when a market answers X differently". Filtering on the
 * dimension column answers that directly. Generic is a filter value of its own,
 * since "runs the same way everywhere" is the thing most readers want to
 * separate out first.
 *
 * One dimension at a time, not a multi-select. Rows carry two to four
 * dimensions each, so an AND of two filters is nearly always the same answer as
 * one of them alone, and an OR is not a question anyone asks.
 *
 * rows: [{name, dims: string[], transition, does: string[]}]
 *       dims: [] means generic. Backticks in transition and does render as code.
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

  // Dimensions in the order they first appear, so the chips read in the same
  // order as the prose that introduces them rather than alphabetically.
  const filters = useMemo(() => {
    const seen = [];
    rows.forEach((r) => (r.dims || []).forEach((d) => seen.includes(d) || seen.push(d)));
    const count = (key) =>
      rows.filter((r) =>
        key === ALL ? true : key === GENERIC ? !(r.dims || []).length : (r.dims || []).includes(key),
      ).length;
    return [ALL, GENERIC, ...seen].map((key) => ({key, count: count(key)}));
  }, [rows]);

  const shown = useMemo(
    () =>
      rows.filter((r) =>
        active === ALL
          ? true
          : active === GENERIC
            ? !(r.dims || []).length
            : (r.dims || []).includes(active),
      ),
    [rows, active],
  );

  return (
    <div className={styles.root}>
      <div className={styles.bar} role="group" aria-label="Filter by dimension">
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
              <th className={styles.thDims}>Generic / Dimensions</th>
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
                <td className={styles.dimsCell}>
                  {(r.dims || []).length ? (
                    (r.dims || []).map((d) => (
                      <span
                        key={d}
                        className={clsx(styles.dim, active === d && styles.dimOn)}>
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
