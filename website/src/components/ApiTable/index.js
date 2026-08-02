import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * ApiTable: the One-Data functions and the core API each one delegates to.
 *
 * The function name links to its contract in the One-Data explorer. The HTTP
 * verb is a badge rather than part of the path string, so the set of methods
 * is readable down the column.
 *
 * rows: [{fn, method, path, purpose, tag?}]
 * base: URL the function name is appended to (defaults to the explorer)
 */
const BASE = 'https://explorer.aexp.com/functions/';

const VERB = {
  POST: styles.post,
  PUT: styles.put,
  DELETE: styles.del,
  GET: styles.get,
};

export default function ApiTable({rows = [], base = BASE}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>One-Data function</th>
            <th>Core API</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fn}>
              <th scope="row" className={styles.fnCell}>
                <a
                  className={styles.fn}
                  href={`${base}${r.fn}`}
                  target="_blank"
                  rel="noopener noreferrer">
                  {r.fn}
                  <span className={styles.out} aria-hidden="true">
                    ↗
                  </span>
                </a>
                {r.tag && <span className={styles.tag}>{r.tag}</span>}
              </th>
              <td className={styles.apiCell}>
                <span className={clsx(styles.verb, VERB[r.method])}>{r.method}</span>
                <code className={styles.path}>{r.path}</code>
              </td>
              <td className={styles.whatCell}>{r.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
