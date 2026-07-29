import React from 'react';
import clsx from 'clsx';
import {translate} from '@docusaurus/Translate';
import styles from './styles.module.css';

/**
 * Swizzled. Docusaurus ships this as a full-height strip down the left edge.
 * This is the twin of the collapse control (src/theme/DocSidebar/Desktop/
 * CollapseButton): the same raised button and glyph, parked at the top of the
 * rail so the toggle stays in one place whether the sidebar is open or shut.
 * A real <button> also fixes the shipped div's keyboard handling, which fired
 * on every key rather than Enter or Space.
 */
export default function DocRootLayoutSidebarExpandButton({toggleSidebar}) {
  const label = translate({
    id: 'theme.docs.sidebar.expandButtonTitle',
    message: 'Expand sidebar',
    description:
      'The ARIA label and title attribute for expand button of doc sidebar',
  });

  return (
    <button
      type="button"
      className={clsx('rail-toggle', styles.expand)}
      title={label}
      aria-label={label}
      onClick={toggleSidebar}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
        <polyline points="13 9 16 12 13 15" />
      </svg>
    </button>
  );
}
