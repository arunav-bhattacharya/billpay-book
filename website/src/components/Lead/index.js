import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * Lead: a prominent thesis statement for the top of a page.
 * Carries the "one larger message"; **bold** spans stand out further.
 *
 * Straight after the page's H1 it is the lower half of the page banner:
 * custom.css (section 12) finds it there through the global `doc-lead` class
 * and sets it on the same field as the title, beside the blue block that
 * carries the section number. Anywhere else it sits on a soft Bright Blue
 * panel, from this module.
 *
 * The banner carries the section, so the Lead takes no colour or props of
 * its own.
 */
export default function Lead({children}) {
  return <p className={clsx('doc-lead', styles.lead)}>{children}</p>;
}
