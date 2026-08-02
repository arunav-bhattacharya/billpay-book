import React from 'react';
import {useLocation} from '@docusaurus/router';
import {accentFromPath} from '../../lib/sections';
import styles from './styles.module.css';

/**
 * Lead: a prominent thesis statement for the top of a page.
 * Carries the "one larger message"; **bold** spans stand out further.
 *
 * The rule down its left edge takes the hue of whichever section the page is
 * in, worked out from the URL. It used to default to the Vision hue and take
 * an accent prop to say otherwise, which meant 83 of the 84 pages that use it
 * were quietly wearing Vision blue whatever section they were in. Deriving it
 * is one less thing every new page has to remember to pass.
 *
 * The prop still overrides, for a page that wants a hue its URL does not imply.
 */
export default function Lead({children, accent}) {
  const {pathname} = useLocation();
  return (
    <p className={styles.lead} style={{'--lead-accent': accent || accentFromPath(pathname)}}>
      {children}
    </p>
  );
}
