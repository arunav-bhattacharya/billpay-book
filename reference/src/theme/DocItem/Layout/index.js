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

const STORAGE_KEY = 'bp.toc.collapsed';

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="12" x2="10" y2="12" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
      <circle cx="8" cy="8" r="1.6" />
      <line x1="3" y1="3" x2="13" y2="13" />
    </svg>
  );
}

function useDocTOC(collapsed) {
  const {frontMatter, toc} = useDoc();
  const windowSize = useWindowSize();
  const hidden = frontMatter.hide_table_of_contents;
  const canRender = !hidden && toc.length > 0;
  const mobile = canRender ? <DocItemTOCMobile /> : undefined;
  const isDesktop = windowSize === 'desktop' || windowSize === 'ssr';
  const desktop = canRender && isDesktop && !collapsed ? <DocItemTOCDesktop /> : undefined;
  const tocPossible = canRender && isDesktop;
  return {hidden, mobile, desktop, tocPossible};
}

export default function DocItemLayout({children}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch (e) {}
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch (e) {}
      return next;
    });
  }, []);

  const docTOC = useDocTOC(collapsed);
  const {metadata} = useDoc();

  const articleColClass = clsx(
    'col',
    !docTOC.hidden && docTOC.tocPossible && !collapsed && styles.docItemCol,
    !docTOC.hidden && docTOC.tocPossible && collapsed && styles.docItemColWide,
  );

  const ToggleBtn = docTOC.tocPossible ? (
    <button
      type="button"
      className="bp-toc__toggle"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-controls="bp-toc-body"
      aria-label={collapsed ? 'Show table of contents' : 'Hide table of contents'}
      title={collapsed ? 'Show table of contents' : 'Hide table of contents'}>
      <span className="bp-toc__toggle-icon" aria-hidden="true">
        {collapsed ? <ListIcon /> : <EyeOffIcon />}
      </span>
    </button>
  ) : null;

  return (
    <div className="row">
      <div className={articleColClass}>
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
      {docTOC.tocPossible && (
        collapsed ? (
          <div className={clsx('col', styles.docTocColCollapsed)}>
            <div className={clsx('bp-toc', 'bp-toc--collapsed')}>{ToggleBtn}</div>
          </div>
        ) : (
          <div className={clsx('col col--3', styles.docTocCol)}>
            <div className="bp-toc">
              {ToggleBtn}
              <div id="bp-toc-body" className="bp-toc__body">
                {docTOC.desktop}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
