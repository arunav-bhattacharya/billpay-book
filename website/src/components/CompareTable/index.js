import React from 'react';
import styles from './styles.module.css';

/**
 * CompareTable: one dimension per row, the legacy estate on the left and the
 * modern platform on the right. Same treatment as ApiTable: a rounded panel, a
 * solid blue header band, no zebra striping, and colour only where it carries
 * meaning (here, which side of the comparison a phrase belongs to).
 *
 * rows: [{what, legacy, modern}]. Cell text may wrap a phrase in ** ** to
 * mark it as the point of the cell, the way the markdown table did.
 */

/** Render **marked** phrases as the emphasised part of a cell. */
function mark(text, cls) {
  if (typeof text !== 'string') {
    return text;
  }
  return text.split('**').map((part, i) =>
    i % 2 ? (
      <strong key={i} className={cls}>
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export default function CompareTable({rows = []}) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thWhat}>What changed</th>
            <th className={styles.thLegacy}>Legacy</th>
            <th className={styles.thModern}>Modern</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what}>
              <th scope="row" className={styles.whatCell}>
                {r.what}
              </th>
              <td className={styles.legacyCell}>{mark(r.legacy, styles.hiLegacy)}</td>
              <td className={styles.modernCell}>{mark(r.modern, styles.hiModern)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
