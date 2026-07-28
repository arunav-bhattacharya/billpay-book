import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LandscapeMap — the Amex payments estate with the payments domain at the
 * centre. Ownership is shown by the two bands (Billpay platform / shared
 * payments services); the interface each domain exposes is shown by the Type-A
 * badges and the two rails, since the two cut across each other.
 *
 * CSS Grid rather than SVG: 18 boxes plus their capabilities in a fixed viewBox
 * would force horizontal scroll everywhere but a wide desktop. Colour comes
 * from the design tokens, so light and dark both render.
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
  {label: 'and more', icon: 'more'},
];

const BILLPAY = [
  {
    n: 2,
    title: 'Bill Pay Core',
    typeA: 'channels',
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
    hero: true,
  },
  {
    n: 3,
    title: 'Plans',
    typeA: 'channels',
    caps: ['Recurring/Autopay'],
    store: 'Plan Data',
  },
  {
    n: 4,
    title: 'Bill Pay Inbound Processor',
    caps: ['Validation', 'STP / Non-STP Decisioning', 'Enrichment', 'AML/Sanctions'],
  },
];

const SHARED = [
  {
    n: 6,
    title: 'Payment Instruments',
    typeA: 'channels',
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
    typeA: 'channels',
    caps: ['Authorization', 'Mandate Management', 'Mandate Lifecycle'],
    store: 'Mandate Data',
  },
  {
    n: 5,
    title: 'Allocation Manager',
    caps: ['Validation', 'Lifecycle'],
    store: 'Allocation Data',
  },
  {n: 9, title: 'Control Tower', caps: ['Research', 'Repair/Replay']},
];

const RAILS = [
  {
    n: 8,
    title: 'Multirail Gateway',
    typeA: 'core',
    caps: ['Core Switch', 'Web Proxy', 'Accounting', 'Routing'],
    tier: 'tech',
  },
  {
    n: 10,
    title: 'Payments Clearing',
    typeA: 'core',
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
  },
];

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
  {label: 'Partner Banks', via: 'Payments Clearing'},
  {label: 'TPSPs', via: 'Payments Clearing'},
  {label: 'P2P Networks', via: 'Payments Clearing'},
  {label: 'Payment Networks', via: 'Payments Clearing'},
  {
    label: '3rd Party Account Verification',
    via: 'Payments Clearing and Payment Instruments',
    both: true,
  },
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

function Card({n, title, caps, store, typeA, tier = 'shared', hero, compact}) {
  return (
    <article
      className={clsx(
        styles.card,
        styles[tier],
        hero && styles.hero,
        compact && styles.compact,
        typeA && styles.hasApi,
        typeA === 'core' && styles.hasApiCore,
      )}>
      <header className={styles.head}>
        <span className={styles.num}>{n}</span>
        <h4 className={styles.title}>{title}</h4>
        {typeA && (
          <span className={clsx(styles.api, typeA === 'core' && styles.apiCore)}>
            Type-A
          </span>
        )}
      </header>
      <div className={styles.caps}>
        {caps.map((c) => (
          <span key={c} className={styles.cap}>
            {c}
          </span>
        ))}
      </div>
      {store && <Store label={store} />}
    </article>
  );
}

function Rail({title, note, core}) {
  return (
    <div className={clsx(styles.rail, core && styles.railCore)}>
      <span>{title}</span>
      <em>{note}</em>
    </div>
  );
}

const LEGEND = [
  {cls: 'heroSwatch', label: 'Bill Pay Core'},
  {cls: 'billpay', label: 'Billpay platform'},
  {cls: 'shared', label: 'Shared payments services'},
  {cls: 'support', label: 'Supporting domain'},
  {cls: 'tech', label: 'Supporting tech platform'},
  {cls: 'external', label: 'External'},
];

export default function LandscapeMap() {
  return (
    <div
      className={styles.wrap}
      role="img"
      aria-label="The Amex payments estate with the payments domain at the centre. Channels (Myca, Mobile, IVR, ISP and others) call Type-A APIs on four domains only: Bill Pay Core, Plans, Payment Instruments and Mandates. Ownership splits into the Billpay platform (Bill Pay Core, Plans and the Bill Pay Inbound Processor) and the shared payments services every payment product draws on (Payment Instruments, Mandates, Allocation Manager, Control Tower, Multirail Gateway and Payments Clearing). Multirail Gateway and Payments Clearing also expose Type-A APIs, but only Bill Pay Core calls them. Payments Clearing is the route to every external party: partner banks, TPSPs, P2P networks and the payment networks. Third-party account verification is reached from both Payments Clearing and Payment Instruments. To the left sit the supporting domains and tech platforms: Accounts Receivable, Customer Info and Relationship Management, Loyalty and Benefits, Fraud and Risk, Finance, Lumi, Raven and Commercial Card Services.">
      <div className={styles.board}>
        {/* ---- channels, directly above the centre column ---- */}
        <div className={styles.channelSlot}>
          <div className={clsx(styles.card, styles.channels)}>
            <header className={styles.head}>
              <span className={styles.num}>1</span>
              <h4 className={styles.title}>Channels</h4>
            </header>
            <div className={styles.chanRow}>
              {CHANNELS.map((c) => (
                <span key={c.label} className={styles.chan}>
                  <Icon name={c.icon} />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <Rail
            title="Type-A APIs"
            note="channels call Bill Pay Core, Plans, Payment Instruments and Mandates"
          />
        </div>

        {/* ---- left flank ---- */}
        <aside className={styles.flank}>
          <div className={styles.flankLabel}>Supporting domains &amp; tech platforms</div>
          <div className={styles.flankStack}>
            {SUPPORTING.map((d) => (
              <Card key={d.n} {...d} tier={d.tier || 'support'} compact />
            ))}
          </div>
        </aside>

        {/* ---- the centre ---- */}
        <section className={styles.centre}>
          <div className={styles.centreLabel}>Payments domain</div>

          <div className={styles.groupBillpay}>
            <span className={clsx(styles.groupTag, styles.groupTagBillpay)}>
              Billpay platform
            </span>
            <div className={styles.grid}>
              {BILLPAY.map((d) => (
                <Card key={d.n} {...d} tier="billpay" />
              ))}
            </div>
          </div>

          <div className={styles.groupShared}>
            <span className={styles.groupTag}>Shared payments services</span>
            <div className={styles.grid}>
              {SHARED.map((d) => (
                <Card key={d.n} {...d} />
              ))}
            </div>
            <Rail title="Type-A APIs" note="Bill Pay Core is the only caller" core />
            <div className={styles.grid}>
              {RAILS.map((d) => (
                <Card key={d.n} {...d} />
              ))}
            </div>
          </div>
        </section>

        {/* ---- right flank ---- */}
        <aside className={styles.flank}>
          <div className={styles.flankLabel}>
            External
            <em>every one of these is reached through Payments Clearing</em>
          </div>
          <div className={styles.flankStack}>
            {EXTERNAL.map((e) => (
              <div
                key={e.label}
                className={clsx(styles.card, styles.external, styles.ext)}>
                <h4 className={styles.title}>{e.label}</h4>
                <span className={clsx(styles.via, e.both && styles.viaBoth)}>
                  via {e.via}
                </span>
              </div>
            ))}
          </div>
        </aside>
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
