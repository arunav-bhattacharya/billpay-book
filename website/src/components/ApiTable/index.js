import React from 'react';
import clsx from 'clsx';
import DataTable from '../DataTable';
import {ticks} from '../../lib/inlineMarkup';
import styles from './styles.module.css';

/**
 * ApiTable: the One-Data functions and the core API each one delegates to.
 *
 * The function name links to its contract in the One-Data explorer. The HTTP
 * verb is a badge rather than part of the path string, so the set of methods
 * is readable down the column.
 *
 * rows: [{fn, method?, path?, api?, purpose, tag?, link?}]
 *   `method` and `path` are the core API the function delegates to. A function
 *   with no core API, one that stores its request in One-Data's inbox, gives
 *   `api` instead: a few words said in place of the path. `link: false` leaves
 *   the name unlinked, for a function the explorer doesn't list, such as a
 *   placeholder name. `purpose` may mark a field or a state as `code`.
 * base: URL the function name is appended to (defaults to the explorer)
 */
const BASE = 'https://explorer.aexp.com/functions/';

const VERB = {
  POST: styles.post,
  PUT: styles.put,
  DELETE: styles.del,
  GET: styles.get,
};

/* A long function name may break before a capital, and only where it must,
   so one long composite name can't take the width the description needs. */
function FnName({text}) {
  if (text.length < 30) return text;
  return text.split(/(?=[A-Z])/).map((part, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <React.Fragment key={i}>
      {i > 0 && <wbr />}
      {part}
    </React.Fragment>
  ));
}

/* A path may break before a slash, but never between the verb and the path's
   first segment, so a long callback path wraps instead of starving the
   description. */
function Path({method, path}) {
  const [head, ...rest] = path.split(/(?=\/)/);
  return (
    <>
      <span className={styles.lead}>
        <span className={clsx(styles.verb, VERB[method])}>{method}</span>
        <code className={styles.path}>{head}</code>
      </span>
      {rest.length > 0 && (
        <code className={styles.path}>
          {rest.map((part, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <React.Fragment key={i}>
              <wbr />
              {part}
            </React.Fragment>
          ))}
        </code>
      )}
    </>
  );
}

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
        {r.link === false ? (
          <span className={styles.fnPlain}>
            <FnName text={r.fn} />
          </span>
        ) : (
          <a
            className={styles.fn}
            href={`${base}${r.fn}`}
            target="_blank"
            rel="noopener noreferrer">
            <FnName text={r.fn} />
            <span className={styles.out} aria-hidden="true">
              ↗
            </span>
          </a>
        )}
        {r.tag && <span className={styles.tag}>{r.tag}</span>}
      </>
    ),
  },
  {
    key: 'api',
    header: 'Core API',
    render: (r) =>
      r.method ? (
        <Path method={r.method} path={r.path} />
      ) : (
        <span className={styles.noApi}>{r.api}</span>
      ),
  },
  {
    key: 'purpose',
    header: 'What it does',
    className: styles.whatCell,
    render: (r) => ticks(r.purpose),
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
