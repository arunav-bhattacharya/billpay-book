/**
 * Swizzled from @docusaurus/theme-classic DocItem/Layout.
 *
 * Adds a collapsible right-hand table of contents. When collapsed, the TOC
 * column is removed and the article reflows to use the full content width
 * (the surrounding `.container` still supplies the page margins). A small
 * floating tab on the right edge re-opens it. State persists in localStorage.
 */
import React, {useState, useEffect, useCallback} from 'react';
import clsx from 'clsx';
import {useWindowSize} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import DocItemPaginator from '@theme/DocItem/Paginator';
import DocVersionBanner from '@theme/DocVersionBanner';
import DocVersionBadge from '@theme/DocVersionBadge';
import DocItemFooter from '@theme/DocItem/Footer';
import DocItemTOCMobile from '@theme/DocItem/TOC/Mobile';
import DocItemTOCDesktop from '@theme/DocItem/TOC/Desktop';
import DocItemContent from '@theme/DocItem/Content';
import DocBreadcrumbs from '@theme/DocBreadcrumbs';
import ContentVisibility from '@theme/ContentVisibility';
import styles from './styles.module.css';

const TOC_STORAGE_KEY = 'billpay:toc-collapsed';

/* Top-level section order — the source of truth for section numbering, shared
   in spirit with the homepage cards and the numbered sidebar. */
const SECTION_ORDER = [
  'vision',
  'architecture',
  'design',
  'build',
  'testing',
  'deployment',
  'observability',
  'operations',
];

/** Derive the numbered section (01, 02, …) a doc belongs to, from its URL. */
function useDocSection() {
  const {metadata} = useDoc();
  const match = (metadata.permalink || '').match(/\/docs\/([^/]+)/);
  const slug = match ? match[1] : null;
  const index = slug ? SECTION_ORDER.indexOf(slug) : -1;
  if (index === -1) {
    return null;
  }
  return {
    slug,
    number: String(index + 1).padStart(2, '0'),
    label: slug.charAt(0).toUpperCase() + slug.slice(1),
  };
}

/**
 * Decide if the toc should be rendered, on mobile or desktop viewports
 */
function useDocTOC() {
  const {frontMatter, toc} = useDoc();
  const windowSize = useWindowSize();
  const hidden = frontMatter.hide_table_of_contents;
  const canRender = !hidden && toc.length > 0;
  const mobile = canRender ? <DocItemTOCMobile /> : undefined;
  const desktop =
    canRender && (windowSize === 'desktop' || windowSize === 'ssr') ? (
      <DocItemTOCDesktop />
    ) : undefined;
  return {
    hidden,
    mobile,
    desktop,
  };
}

function useTOCCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(TOC_STORAGE_KEY) === 'true');
    } catch {
      // localStorage unavailable — keep default
    }
  }, []);
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TOC_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return [collapsed, toggle];
}

/** A side-panel glyph with a chevron indicating the collapse direction. */
function PanelIcon({direction}) {
  return (
    <svg
      className={styles.icon}
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
      <line x1="15" y1="4" x2="15" y2="20" />
      {direction === 'right' ? (
        <polyline points="8 9 11 12 8 15" />
      ) : (
        <polyline points="10 9 7 12 10 15" />
      )}
    </svg>
  );
}

export default function DocItemLayout({children}) {
  const docTOC = useDocTOC();
  const {metadata} = useDoc();
  const section = useDocSection();
  const [tocCollapsed, toggleTOC] = useTOCCollapsed();

  const hasTOC = Boolean(docTOC.desktop);
  const showTOCColumn = hasTOC && !tocCollapsed;

  return (
    <div className="row">
      <div
        className={clsx(
          'col',
          !docTOC.hidden && showTOCColumn && styles.docItemCol,
        )}>
        <ContentVisibility metadata={metadata} />
        <DocVersionBanner />
        <div className={styles.docItemContainer}>
          <article>
            <DocBreadcrumbs />
            <DocVersionBadge />
            {docTOC.mobile}
            <DocItemContent>{children}</DocItemContent>
            <DocItemFooter />
          </article>
          <DocItemPaginator />
        </div>
      </div>

      {showTOCColumn && (
        <div className="col col--3">
          <div className={styles.tocSticky}>
            <div className={styles.tocHeader}>
              {section && (
                <div
                  className={styles.tocSection}
                  style={{'--cat': `var(--amex-cat-${section.slug})`}}>
                  <span className={styles.tocSectionNum}>{section.number}</span>
                  <span className={styles.tocSectionLabel}>{section.label}</span>
                </div>
              )}
              <button
                type="button"
                className={styles.tocToggle}
                onClick={toggleTOC}
                aria-expanded="true"
                aria-label="Hide table of contents"
                title="Hide table of contents">
                <PanelIcon direction="right" />
              </button>
            </div>
            {docTOC.desktop}
          </div>
        </div>
      )}

      {hasTOC && tocCollapsed && (
        <button
          type="button"
          className={styles.tocReopen}
          onClick={toggleTOC}
          aria-expanded="false"
          aria-label="Show table of contents"
          title="Show table of contents">
          <PanelIcon direction="left" />
        </button>
      )}
    </div>
  );
}
