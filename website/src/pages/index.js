import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

const SECTIONS = [
  {to: '/docs/vision', label: 'Vision', blurb: 'Why Billpay exists and what we are building.'},
  {to: '/docs/architecture', label: 'Architecture', blurb: 'The layered shape of the platform.'},
  {to: '/docs/design', label: 'Design', blurb: 'Lifecycle states, workflows, and the component model.'},
  {to: '/docs/build', label: 'Build', blurb: 'APIs, data model, workflows, and activities in code.'},
  {to: '/docs/testing', label: 'Testing', blurb: 'How we verify correctness and performance.'},
  {to: '/docs/deployment', label: 'Deployment', blurb: 'Deployables, CI checks, and the pipeline.'},
  {to: '/docs/observability', label: 'Observability', blurb: 'Monitoring, SLAs, and alerts.'},
  {to: '/docs/operations', label: 'Operations', blurb: 'Operator surfaces and standard procedures.'},
];

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroInner}>
        <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
        <p className={styles.heroTagline}>{siteConfig.tagline}</p>
        <div className={styles.heroActions}>
          <Link className="button button--primary button--lg" to="/docs/intro">
            Start reading →
          </Link>
          <Link
            className={clsx('button button--lg', styles.heroGhost)}
            to="/docs/architecture">
            Explore the architecture
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="A wiki documenting American Express's Billpay payment platform.">
      <Hero />
      <main className="container">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionHeadTitle}>Browse the platform</h2>
        </div>
        <div className={styles.grid}>
          {SECTIONS.map((s, i) => (
            <Link key={s.to} to={s.to} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardIndex}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className={styles.cardTitle}>{s.label}</h3>
              </div>
              <p className={styles.cardBlurb}>{s.blurb}</p>
              <span className={styles.cardArrow} aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
