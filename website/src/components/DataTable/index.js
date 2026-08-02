import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * DataTable: the house table.
 *
 * A rounded panel that clips its corners and scrolls sideways, a solid
 * Amex-blue header band, and one type size through the body so a row reads as
 * one tier rather than three.
 *
 * Everything that varies between tables is a custom property set on the shell,
 * so a caller resizes or retunes a table by overriding a token rather than by
 * restating the chrome. The list is in styles.module.css.
 *
 * columns: [{
 *   key,                  unique; also the default accessor for the cell value
 *   header,               node for the header cell
 *   render?(row, i),      node for the body cell. Return undefined to emit no
 *                         cell at all, which is how a rowSpan above covers it
 *   rowSpan?(row, i),     how many rows this cell covers
 *   rowHeader?,           render as <th scope="row"> rather than <td>
 *   scope?,               override that scope ('rowgroup' for a spanning cell)
 *   className?, headerClassName?, width?
 * }]
 *
 * separator: how one row is told from the next.
 *   'zebra'  alternating fill        'rules'  a hairline between rows
 *   'both'   fill and hairline       'none'
 */

/**
 * The panel and the header band, without the rendering. Markdown tables arrive
 * from MDX already built, so they can use the chrome but not the columns.
 */
export function TableShell({className, separator = 'zebra', children}) {
  return (
    <div className={clsx(styles.shell, separator !== 'none' && styles[separator], className)}>
      {children}
    </div>
  );
}

/**
 * A spanning cell has to be omitted on exactly the rows it covers, and HTML
 * gives no error when the arithmetic is wrong: an over-long rowSpan is clamped
 * to the end of the row group, so the cell silently swallows the next group's
 * rows. Catch it while authoring instead.
 */
function assertSpans(columns, rows) {
  columns.forEach((c) => {
    if (!c.rowSpan) {
      return;
    }
    let covered = 0;
    rows.forEach((row, i) => {
      const emitted = (c.render ? c.render(row, i) : row[c.key]) !== undefined;
      if (emitted) {
        covered += c.rowSpan(row, i) || 1;
      }
    });
    if (covered !== rows.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `DataTable: column "${c.key}" spans ${covered} rows, but the table has ${rows.length}.`,
      );
    }
  });
}

export default function DataTable({
  columns = [],
  rows = [],
  rowKey,
  rowProps,
  separator = 'zebra',
  className,
  caption,
  toolbar,
  footer,
}) {
  if (process.env.NODE_ENV !== 'production') {
    assertSpans(columns, rows);
  }

  const table = (
    <TableShell separator={separator} className={className}>
      <table>
        {caption && <caption className={styles.caption}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.headerClassName}
                style={c.width ? {width: c.width} : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row, i) : i} {...(rowProps ? rowProps(row, i) : null)}>
              {columns.map((c) => {
                const content = c.render ? c.render(row, i) : row[c.key];
                if (content === undefined) {
                  return null;
                }
                const span = c.rowSpan ? c.rowSpan(row, i) : undefined;
                const cell = {
                  key: c.key,
                  className: c.className,
                  // 0 means "to the end of the row group" in HTML, and 1 is the
                  // default, so neither is worth an attribute.
                  rowSpan: span > 1 ? span : undefined,
                };
                return c.rowHeader ? (
                  <th scope={c.scope || 'row'} {...cell}>
                    {content}
                  </th>
                ) : (
                  <td {...cell}>{content}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );

  if (!toolbar && !footer) {
    return table;
  }
  return (
    <div className={styles.root}>
      {toolbar}
      {table}
      {footer}
    </div>
  );
}
