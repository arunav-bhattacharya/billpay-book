import React from 'react';
import styles from './styles.module.css';

/**
 * Lead — a prominent thesis statement for the top of a page.
 * Carries the "one larger message"; **bold** spans stand out further.
 */
export default function Lead({children, accent = 'var(--amex-cat-vision)'}) {
  return (
    <p className={styles.lead} style={{'--lead-accent': accent}}>
      {children}
    </p>
  );
}
