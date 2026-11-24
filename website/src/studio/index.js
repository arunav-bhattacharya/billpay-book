import React from 'react';
import Layout from '@theme/Layout';
import BrowserOnly from '@docusaurus/BrowserOnly';
import styles from './styles.module.css';

/**
 * The /studio route, added by plugins/diagram-data with the text of every
 * diagram file as `sources`. The Studio reads the journey to open from the
 * address, so it draws in the browser only: the built page would otherwise
 * show one journey and then swap to another as it loads.
 */
export default function StudioPage({sources}) {
  return (
    <Layout title="Diagram Studio" description="Change a journey diagram by clicking on it, then propose the change on GitHub.">
      <main className={styles.page}>
        <BrowserOnly fallback={<p className={styles.loading}>Opening the Studio.</p>}>
          {() => {
            const Studio = require('./Studio').default;
            return <Studio sources={sources || {}} />;
          }}
        </BrowserOnly>
      </main>
    </Layout>
  );
}
