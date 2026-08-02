import React from 'react';
import DataTable from '../DataTable';
import {bold} from '../../lib/inlineMarkup';
import styles from './styles.module.css';

/**
 * CompareTable: one dimension per row, the legacy estate on the left and the
 * modern platform on the right. Colour is used only where it carries meaning,
 * which here is which side of the comparison a phrase belongs to.
 *
 * rows: [{what, legacy, modern}]. Cell text may wrap a phrase in ** ** to mark
 * it as the point of the cell, the way the markdown table did.
 */
const COLUMNS = [
  {
    key: 'what',
    header: 'What changed',
    width: '17%',
    rowHeader: true,
    className: styles.whatCell,
  },
  {
    key: 'legacy',
    header: 'Legacy',
    width: '41.5%',
    className: styles.legacyCell,
    render: (r) => bold(r.legacy, styles.hiLegacy),
  },
  {
    key: 'modern',
    header: 'Modern',
    width: '41.5%',
    className: styles.modernCell,
    render: (r) => bold(r.modern, styles.hiModern),
  },
];

export default function CompareTable({rows = []}) {
  return (
    <DataTable
      className={styles.table}
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.what}
    />
  );
}
