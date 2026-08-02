import React from 'react';
import styles from './styles.module.css';

/**
 * StateLegend: what the three box colours on a lifecycle diagram mean.
 *
 * The colours are already in the page, drawn by the Mermaid rules in section
 * 13 of custom.css. This reads them off the same --amex-state-* tokens, so a
 * swatch here is the same colour as the box it explains, and stays that way if
 * the tokens ever move.
 *
 * Each swatch is a small state box rather than a dot: same fill, same border
 * weight, same corner. The colour is not named in the label, because the
 * swatch is the name and the in-flight box is a blue that anyone would argue
 * about.
 */

const ITEMS = [
  {tone: 'intermediate', label: 'Intermediate state'},
  {tone: 'success', label: 'Terminal state, payment executed'},
  {tone: 'failure', label: 'Terminal state, payment not executed'},
];

export default function StateLegend() {
  return (
    <p className={styles.legend}>
      {ITEMS.map((it) => (
        <span className={styles.item} key={it.tone}>
          <span className={styles.swatch} data-tone={it.tone} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </p>
  );
}
