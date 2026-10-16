import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * Lead: a prominent thesis statement for the top of a page.
 * Carries the "one larger message"; **bold** spans stand out further.
 *
 * Straight after the page's H1 it is the lower half of the page banner:
 * custom.css (section 12) finds it there through the global `doc-lead` class
 * and sets it on the same Deep Blue field as the title and the section badge.
 * Anywhere else it sits on a soft Bright Blue panel, from this module.
 *
 * It used to take its colour from the section in the URL, as a rule down its
 * left edge. The banner carries the section now, as a numbered badge, so the
 * colour has nothing left to say and the prop is gone.
 */
export default function Lead({children}) {
  return <p className={clsx('doc-lead', styles.lead)}>{children}</p>;
}
