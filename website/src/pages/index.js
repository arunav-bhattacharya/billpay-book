import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';
import ordinal from '../lib/ordinal';

/* The nine sections, in sidebar order. The order is the numbering, and the
   blurb is the one line each tile on the board has room for. */
const SECTIONS = [
  {to: '/docs/vision', label: 'Vision', blurb: 'Why Billpay exists'},
  {to: '/docs/architecture', label: 'Architecture', blurb: 'The shape of the platform'},
  {to: '/docs/design', label: 'Design', blurb: 'Lifecycle, routing, components'},
  {to: '/docs/onboarding', label: 'Market Onboarding', blurb: 'Profiles, releases, provisioning'},
  {to: '/docs/build', label: 'Build', blurb: 'APIs, data model and code'},
  {to: '/docs/testing', label: 'Testing', blurb: 'Correctness and performance'},
  {to: '/docs/deployment', label: 'Deployment', blurb: 'Deployables and the pipeline'},
  {to: '/docs/observability', label: 'Observability', blurb: 'Monitoring and alerts'},
  {to: '/docs/operations', label: 'Operations', blurb: 'Operator tools and procedures'},
];

/* Where each kind of reader should begin. Two sections each, so the three
   cards weigh the same. */
const PATHS = [
  {
    title: 'Leaders and product owners',
    text: 'What Billpay is for and how the platform fits together.',
    links: [
      {to: '/docs/vision', label: 'Vision'},
      {to: '/docs/architecture', label: 'Architecture'},
    ],
  },
  {
    title: 'Engineers',
    text: 'The payment lifecycle, routing and components, then the APIs and the code.',
    links: [
      {to: '/docs/design', label: 'Design'},
      {to: '/docs/build', label: 'Build'},
    ],
  },
  {
    title: 'Operators',
    text: 'Monitoring and alerts, then the tools and procedures for running Billpay.',
    links: [
      {to: '/docs/observability', label: 'Observability'},
      {to: '/docs/operations', label: 'Operations'},
    ],
  },
];

/** "Billpay Wiki" becomes "Billpay" and "Wiki", so the last word can take the accent. */
function splitTitle(title) {
  const at = title.lastIndexOf(' ');
  return at === -1 ? [title, ''] : [title.slice(0, at), title.slice(at + 1)];
}

function Hero() {
  const {siteConfig} = useDocusaurusContext();
  const [head, last] = splitTitle(siteConfig.title);
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Engineering wiki</p>
          <h1 className={styles.heroTitle}>
            {head} {last && <span className={styles.heroTitleAccent}>{last}</span>}
          </h1>
          <p className={styles.heroTagline}>{siteConfig.tagline}.</p>
          <div className={styles.heroActions}>
            <Link className={clsx('button button--lg', styles.heroPrimary)} to="/docs/intro">
              Start reading →
            </Link>
            <Link className={clsx('button button--lg', styles.heroGhost)} to="/docs/architecture">
              Explore the architecture
            </Link>
          </div>
        </div>

        <nav className={styles.board} aria-label="Sections">
          {SECTIONS.map((s, i) => (
            <Link key={s.to} to={s.to} className={styles.tile}>
              <span className={styles.badge}>{ordinal(i + 1)}</span>
              <span className={styles.tileName}>{s.label}</span>
              <span className={styles.tileBlurb}>{s.blurb}</span>
            </Link>
          ))}
        </nav>
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
        <h2 className={styles.pathsTitle}>Start here</h2>
        <div className={styles.paths}>
          {PATHS.map((p) => (
            <section key={p.title} className={styles.path}>
              <h3 className={styles.pathTitle}>{p.title}</h3>
              <p className={styles.pathText}>{p.text}</p>
              <div className={styles.pathLinks}>
                {p.links.map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label} →
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </Layout>
  );
}
