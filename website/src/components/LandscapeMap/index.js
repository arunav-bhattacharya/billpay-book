import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LandscapeMap — the Amex payments estate, read left to right the way the
 * architecture deck draws it: channels, the payments domain, then the external
 * parties. Everything the estate leans on but does not own sits under the
 * dotted line.
 *
 * Colour follows the deck's four families (payments domain, supporting domain,
 * supporting tech platform, external), with Bill Pay Core lifted out of the
 * blue family into the signature gradient. The Type-A pill marks every domain
 * that exposes one; who calls which is prose, not geometry.
 *
 * CSS Grid rather than SVG: 18 boxes plus their capabilities in a fixed viewBox
 * would force horizontal scroll everywhere but a wide desktop. Sizing is driven
 * by container queries, not the viewport, because the board sits in a doc
 * column whose width changes when the sidebar or the contents is collapsed.
 */

const ICONS = {
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2.5" />
      <path d="M2 9.5h20" />
      <path d="M5.5 14.5h4" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2" width="11" height="20" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  voice: (
    <>
      <path d="M4 13v-2a8 8 0 0 1 16 0v2" />
      <rect x="2.5" y="13" width="4" height="6" rx="1.6" />
      <rect x="17.5" y="13" width="4" height="6" rx="1.6" />
      <path d="M19.5 19v.6a2.4 2.4 0 0 1-2.4 2.4H13" />
    </>
  ),
  browser: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="M2 8.5h20" />
      <path d="M5 6.3h.01M7.6 6.3h.01M10.2 6.3h.01" />
    </>
  ),
  more: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="M8 12h.01M12 12h.01M16 12h.01" />
    </>
  ),
};

function Icon({name}) {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const CHANNELS = [
  {label: 'Myca', icon: 'card'},
  {label: 'Mobile', icon: 'phone'},
  {label: 'IVR', icon: 'voice'},
  {label: 'ISP', icon: 'browser'},
  {label: '. . .', icon: 'more'},
];

const CORE = {
  n: 2,
  title: 'Bill Pay Core',
  typeA: true,
  tier: 'domain',
  hero: true,
  caps: [
    'Execute Payment',
    'Options',
    'Validate/Auth',
    'History',
    'Balance Updates',
    'Schedule',
    'Accounting',
    'Exception Mgmnt / Servicing',
    'Stop Payment',
    'Reporting',
    'AML',
  ],
  store: 'Bill Pay Data',
};

/* the rest of the Billpay platform, in the column beside Bill Pay Core */
const PLATFORM = [
  {
    n: 3,
    title: 'Plans',
    typeA: true,
    tier: 'domain',
    caps: ['Recurring/Autopay'],
    store: 'Plan Data',
  },
  {
    n: 4,
    title: 'Bill Pay Inbound Processor',
    typeA: true,
    tier: 'domain',
    caps: ['Validation', 'STP / Non-STP Decisioning', 'Enrichment', 'AML/Sanctions'],
  },
  {
    n: 5,
    title: 'Allocation Manager',
    typeA: true,
    tier: 'domain',
    caps: ['Validation', 'Lifecycle'],
    store: 'Allocation Data',
  },
];

/* the shared services every payment product draws on */
const SHARED = [
  {
    n: 6,
    title: 'Payment Instruments',
    typeA: true,
    tier: 'domain',
    caps: [
      'Instrument Management',
      'Tokenization',
      'Verification',
      'Debtor/Creditor Profiles',
      'Lifecycle',
      'Risk Assessment',
      'Instrument Data Provider',
    ],
    store: 'Instrument Data',
  },
  {
    n: 7,
    title: 'Mandates',
    typeA: true,
    tier: 'domain',
    caps: ['Authorization', 'Mandate Management', 'Mandate Lifecycle'],
    store: 'Mandate Data',
  },
];

/* the plumbing: the switch a payment leaves on, and the desk that repairs it */
const PLUMBING = [
  {
    n: 8,
    title: 'Multirail Gateway',
    typeA: true,
    tier: 'tech',
    caps: ['Core Switch', 'Web Proxy', 'Accounting', 'Routing'],
  },
  {n: 9, title: 'Control Tower', tier: 'domain', caps: ['Research', 'Repair/Replay']},
];

const CLEARING = {
  n: 10,
  title: 'Payments Clearing',
  typeA: true,
  tier: 'domain',
  caps: [
    'Payment Routes',
    'Scheme Adapters',
    'Orchestration',
    'Bank Connectors',
    'Authorization',
    'Reconciliation',
    'Liquidity Management',
    'Batch Gateway',
    'Migration Splitter',
  ],
};

const SUPPORTING = [
  {
    n: 11,
    title: 'Accounts Receivable',
    caps: ['Product Library', 'Product Arrangement', 'Account Balance', 'Account Posting'],
  },
  {n: 12, title: 'Customer Info & Relationship Management', caps: ['Data Enrichment']},
  {n: 13, title: 'Loyalty & Benefits', caps: ['Redemption', 'Eligibility']},
  {n: 14, title: 'Fraud & Risk', caps: ['RDE', 'AMP']},
  {n: 15, title: 'Finance', caps: ['Report, Invoice Generation', 'Financial Engine']},
  {n: 16, title: 'Lumi', caps: ['Reporting', 'Analytics'], tier: 'tech'},
  {n: 17, title: 'Raven', caps: ['Customer Notifications'], tier: 'tech'},
  {
    n: 18,
    title: 'Commercial Card Services',
    caps: ['Control Account', 'Corporate Hierarchy'],
  },
];

const EXTERNAL = [
  'Partner Banks',
  'TPSPs',
  'P2P Networks',
  '3rd Party Account Verification',
  'Payment Networks',
];

function Store({label}) {
  return (
    <div className={styles.store}>
      <svg viewBox="0 0 18 20" className={styles.storeGlyph} aria-hidden="true">
        <ellipse cx="9" cy="4" rx="8" ry="3.4" />
        <path d="M1,4 V16 a8,3.4 0 0 0 16,0 V4" />
      </svg>
      {label}
    </div>
  );
}

function Card({n, title, caps, store, typeA, tier = 'domain', hero, compact}) {
  return (
    <article
      className={clsx(
        styles.card,
        styles[tier],
        hero && styles.hero,
        compact && styles.compact,
        typeA && styles.hasApi,
      )}>
      <header className={styles.head}>
        <span className={styles.num}>{n}</span>
        <div className={styles.headText}>
          {/* floated, so it holds the top right corner and the title wraps
              under it instead of being squeezed into a narrow column */}
          {typeA && <span className={styles.api}>Type-A</span>}
          <h4 className={styles.title}>{title}</h4>
        </div>
      </header>
      {compact ? (
        /* the supporting estate is context, so its capabilities run as one line
           instead of a grid of chips */
        <p className={styles.capLine}>{caps.join(' · ')}</p>
      ) : (
        <div className={styles.caps}>
          {caps.map((c) => (
            <span key={c} className={styles.cap}>
              {c}
            </span>
          ))}
        </div>
      )}
      {store && <Store label={store} />}
    </article>
  );
}

const LEGEND = [
  {cls: 'heroSwatch', label: 'Bill Pay Core'},
  {cls: 'domain', label: 'Payments domain'},
  {cls: 'channels', label: 'Channel'},
  {cls: 'support', label: 'Supporting domain'},
  {cls: 'tech', label: 'Supporting tech platform'},
  {cls: 'external', label: 'External'},
];

export default function LandscapeMap() {
  return (
    <div
      className={styles.wrap}
      role="img"
      aria-label="The Amex payments estate, left to right. Channels (Myca, Mobile, IVR, ISP and others) enter on the left. The payments domain runs across the middle: Bill Pay Core, then Plans, the Bill Pay Inbound Processor and the Allocation Manager, then Payment Instruments and Mandates, then the Multirail Gateway with Control Tower, then Payments Clearing. Every one of those exposes a Type-A API except Control Tower. Payments Clearing is the route to every external party on the right: partner banks, TPSPs, P2P networks, third-party account verification and the payment networks. Under the dotted line sit the supporting domains and tech platforms: Accounts Receivable, Customer Info and Relationship Management, Loyalty and Benefits, Fraud and Risk, Finance, Lumi, Raven and Commercial Card Services.">
      <div className={styles.board}>
        <div className={styles.flowScroll}>
          <div className={styles.main}>
            {/* ---- group 1: channels, on the left ---- */}
            <section className={clsx(styles.group, styles.groupChannels)}>
              <h4 className={styles.groupTitle}>
                <span className={styles.groupNum}>1</span>
                Channels
              </h4>
              <div className={styles.chanRow}>
                {CHANNELS.map((c) => (
                  <span key={c.label} className={styles.chan}>
                    <Icon name={c.icon} />
                    {c.label}
                  </span>
                ))}
              </div>
            </section>

            {/* ---- group 2: the payments domain, at the centre ---- */}
            <section className={clsx(styles.group, styles.groupDomain)}>
              <h4 className={styles.groupTitle}>Payments domain</h4>
              <div className={styles.domainGrid}>
                <div className={clsx(styles.col, styles.colCore)}>
                  <Card {...CORE} />
                </div>
                <div className={styles.col}>
                  {PLATFORM.map((d) => (
                    <Card key={d.n} {...d} />
                  ))}
                </div>
                <div className={styles.col}>
                  {SHARED.map((d) => (
                    <Card key={d.n} {...d} />
                  ))}
                </div>
                <div className={styles.col}>
                  {PLUMBING.map((d) => (
                    <Card key={d.n} {...d} />
                  ))}
                </div>
                <div className={styles.col}>
                  <Card {...CLEARING} />
                </div>
              </div>
            </section>

            {/* ---- group 3: outside Amex, on the right ---- */}
            <section className={clsx(styles.group, styles.groupExternal)}>
              <h4 className={styles.groupTitle}>External systems</h4>
              <div className={styles.extStack}>
                {EXTERNAL.map((label) => (
                  <div key={label} className={clsx(styles.external, styles.ext)}>
                    {label}
                  </div>
                ))}
              </div>
            </section>

            {/* ---- group 4: what the domain leans on, underneath it ---- */}
            <section className={clsx(styles.group, styles.groupSupport)}>
              <h4 className={styles.groupTitle}>Supporting domains &amp; tech platforms</h4>
              <div className={styles.supportStack}>
                {SUPPORTING.map((d) => (
                  <Card key={d.n} {...d} tier={d.tier || 'support'} compact />
                ))}
              </div>
            </section>
          </div>
        </div>

        <p className={styles.hint}>
          Scroll the row sideways for the rest of it, or collapse the contents panel to
          see the whole estate at once.
        </p>
      </div>

      <div className={styles.legend}>
        {LEGEND.map((l) => (
          <span key={l.label} className={styles.legendItem}>
            <i className={clsx(styles.swatch, styles[l.cls])} />
            {l.label}
          </span>
        ))}
        <span className={styles.legendItem}>
          <i className={clsx(styles.api, styles.legendApi)}>Type-A</i>
          exposes a Type-A API
        </span>
      </div>
    </div>
  );
}
