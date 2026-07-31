import React from 'react';
import clsx from 'clsx';
import {translate} from '@docusaurus/Translate';
import SidebarFolding from '@site/src/components/SidebarFolding';
import styles from './styles.module.css';

/**
 * Swizzled. Docusaurus ships this as a full-width outlined bar pinned to the
 * bottom of the rail, which reads as a stray form control. This is the same
 * panel glyph the table of contents uses, in a small raised button at the top
 * of the sidebar, so both rails collapse from the same place and look alike.
 *
 * The theme gives the sidebar no other slot of its own, so this is also where
 * the folding control mounts (src/components/SidebarFolding). The two sit in
 * one cluster in the top-right corner: fold the sections, or put the whole
 * rail away.
 */
export default function CollapseButton({onClick}) {
  const label = translate({
    id: 'theme.docs.sidebar.collapseButtonTitle',
    message: 'Collapse sidebar',
    description: 'The title attribute for collapse button of doc sidebar',
  });

  return (
    <div className={styles.cluster}>
      <SidebarFolding />
      <button
        type="button"
        title={label}
        aria-label={label}
        className={clsx('rail-toggle', styles.collapse)}
        onClick={onClick}>
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
          <polyline points="16 9 13 12 16 15" />
        </svg>
      </button>
    </div>
  );
}
