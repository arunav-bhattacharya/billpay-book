import React from 'react';
import clsx from 'clsx';
import DataTable from '../DataTable';
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

/* No explicit column widths. The first two columns are nowrap, so auto layout
   sizes them to exactly what they need and gives the remainder to the
   description, which is the only column that can wrap. Pinning them to
   percentages let the browser inflate both and starved the description. */
const columnsFor = (base) => [
  {
    key: 'fn',
    header: 'One-Data function',
    rowHeader: true,
    className: styles.fnCell,
    render: (r) => (
      <>
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
      </>
    ),
  },
  {
    key: 'api',
    header: 'Core API',
    className: styles.apiCell,
    render: (r) => (
      <>
        <span className={clsx(styles.verb, VERB[r.method])}>{r.method}</span>
        <code className={styles.path}>{r.path}</code>
      </>
    ),
  },
  {
    key: 'purpose',
    header: 'What it does',
    className: styles.whatCell,
  },
];

export default function ApiTable({rows = [], base = BASE}) {
  return (
    <DataTable
      className={styles.table}
      columns={columnsFor(base)}
      rows={rows}
      rowKey={(r) => r.fn}
    />
  );
}
