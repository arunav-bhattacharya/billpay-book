import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * Lead — a prominent thesis statement for the top of a page.
 * Carries the "one larger message"; **bold** spans stand out further.
 * Pass `highlight` to colour the whole statement in the accent.
 */
export default function Lead({children, accent = 'var(--amex-cat-vision)', highlight = false}) {
  return (
    <p
      className={clsx(styles.lead, highlight && styles.highlight)}
      style={{'--lead-accent': accent}}>
      {children}
    </p>
  );
}
