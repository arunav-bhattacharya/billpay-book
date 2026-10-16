import React from 'react';
import styles from './styles.module.css';

/**
 * ClusterMap: the two Temporal clusters and the one thing that joins them.
 *
 * Callers at the top, the Router under them, the Online and Offline clusters
 * side by side, Oracle across the full width under both, and the shared
 * downstream systems at the bottom. The hand-off is drawn as the only path
 * between the clusters: down from Online into Oracle, and back up out of it
 * into Offline, so the picture makes the rule without a "no calls" label.
 *
 * A CSS box diagram rather than coordinate SVG: the content is boxes in
 * groups with a few short connectors, and as HTML it reflows to a single
 * column on a narrow screen instead of shrinking its type.
 *
 * Takes no props; the content is the arrays below.
 */

const CALLERS = [
  {tone: 'online', term: 'Channels', desc: 'Someone is waiting for the answer'},
  {tone: 'offline', term: 'AR, returns, inbound, allocation callbacks', desc: 'Nobody is waiting'},
];

const CLUSTERS = [
  {
    tone: 'online',
    name: 'Online cluster',
    shards: '2K shards',
    desc: 'Journeys where a caller waits',
    start: 'Update-With-Start',
    startNote: 'Started with Update-With-Start',
    runs: ['Pay today', 'Schedule', 'Update', 'Cancel', 'Intent', 'Refunds', 'Composites'],
    replies: ['PENDING', 'ACCEPTED', 'SCHEDULED', 'DECLINED', 'CANCELLED'],
  },
  {
    tone: 'offline',
    name: 'Offline cluster',
    shards: '4K shards',
    desc: 'Work that can be paced',
    start: 'Async start, then 202',
    startNote: 'Started async; the API replies 202',
    runs: ['Execution', 'Allocations', 'Corporate legs', 'AR intake', 'Returns', 'Inbound', 'Representments', 'Periodic jobs', 'Provisioning'],
    control: ['Dispatchers', 'Governor'],
  },
];

const ORACLE = ['Payments', 'Work Tracker', 'Inbox'];

const DOWNSTREAM = [
  'Clearing',
  'Accounts Receivable',
  'Authorization (OTB)',
  'Accounting',
  'eBNC',
  'Risk',
  'Raven (comms)',
  'RTF (events)',
  'Allocations manager',
];

const LABEL =
  'Two Temporal clusters joined only through Oracle. At the top, channels, where someone is waiting for the answer, and Accounts Receivable, returns, inbound payments and allocation callbacks, where nobody is. Both go through the Billpay core APIs and the Router, which admits each request, picks the journey, resolves the behaviors, pins the plan key, places the work and starts it. Journeys with a caller waiting start on the Online cluster with Update-With-Start: pay today, schedule, update, cancel, intent, refunds and composites, and the cluster responds back to the caller as PENDING, ACCEPTED, SCHEDULED, DECLINED or CANCELLED. Work that can be paced starts on the Offline cluster with an async start and a 202: scheduled execution, allocations, corporate legs, AR intake, returns, inbound, representments, periodic jobs and provisioning, paced by the dispatchers and the governor. Each cluster has its own Aurora PostgreSQL database and OpenSearch 2 visibility store; Online has 2,000 history shards and Offline 4,000. Oracle runs under both clusters and holds payments, the Work Tracker and the inbox. The only hand-off runs through it: a commit on the Online cluster writes a Work Tracker row, and a dispatcher on the Offline cluster claims the row when it falls due. Below, both clusters call the same downstream systems: clearing, Accounts Receivable, authorization, accounting, eBNC, risk, Raven for customer messages, RTF for lifecycle events, and the allocations manager. The governor watches Oracle and the downstreams, so pressure there slows offline work, never online traffic.';

function Chips({items, quiet}) {
  return (
    <ul className={styles.chips}>
      {items.map((it) => (
        <li key={it} className={quiet ? styles.chipQuiet : styles.chip}>
          {it}
        </li>
      ))}
    </ul>
  );
}

/* A drum and a magnifier, drawn in currentColor, for the cluster's two stores. */
function StoreGlyph({kind}) {
  return (
    <svg viewBox="0 0 16 16" className={styles.glyph} aria-hidden="true">
      {kind === 'db' ? (
        <>
          <ellipse cx="8" cy="3.6" rx="5.6" ry="2.1" />
          <path d="M2.4,3.6 V12.4 C2.4,13.6 4.9,14.5 8,14.5 C11.1,14.5 13.6,13.6 13.6,12.4 V3.6" />
          <path d="M2.4,8 C2.4,9.2 4.9,10.1 8,10.1 C11.1,10.1 13.6,9.2 13.6,8" />
        </>
      ) : (
        <>
          <circle cx="6.8" cy="6.8" r="4.4" />
          <path d="M10.1,10.1 L14,14" />
        </>
      )}
    </svg>
  );
}

function Cluster({c}) {
  return (
    <section className={styles.cluster} data-tone={c.tone}>
      <header className={styles.clusterHead}>
        <span className={styles.clusterName}>{c.name}</span>
        <span className={styles.clusterShards}>{c.shards}</span>
      </header>
      <div className={styles.clusterBody}>
        <p className={styles.clusterDesc}>{c.desc}</p>
        <p className={styles.startNote}>{c.startNote}</p>
        <Chips items={c.runs} />
        {c.replies && (
          <>
            <p className={styles.subLabel}>Responds back to caller as</p>
            <Chips items={c.replies} quiet />
          </>
        )}
        {c.control && (
          <>
            <p className={styles.subLabel}>Paced by</p>
            <Chips items={c.control} quiet />
          </>
        )}
        <p className={styles.stores}>
          <span>
            <StoreGlyph kind="db" /> Aurora PostgreSQL
          </span>
          <span>
            <StoreGlyph kind="search" /> OpenSearch 2
          </span>
        </p>
      </div>
    </section>
  );
}

export default function ClusterMap() {
  const [online, offline] = CLUSTERS;
  return (
    <figure className={styles.wrap} role="img" aria-label={LABEL}>
      <div className={styles.grid} aria-hidden="true">
        {/* callers, each over the cluster its traffic lands on */}
        {CALLERS.map((c) => (
          <div key={c.term} className={styles.caller} data-tone={c.tone}>
            <span className={styles.callerTerm}>{c.term}</span>
            <span className={styles.callerDesc}>{c.desc}</span>
          </div>
        ))}

        <div className={styles.stemIn} data-col="online" />
        <div className={styles.stemIn} data-col="offline" />

        <div className={styles.router}>
          <span className={styles.routerTerm}>Billpay core APIs · Router</span>
          <span className={styles.routerSteps}>admit · pick the journey · resolve behaviors · pin the plan key · place · start</span>
        </div>

        {/* the router's two ways out, each labelled with its start mode */}
        {[online, offline].map((c) => (
          <div key={c.tone} className={styles.start} data-col={c.tone}>
            <span className={styles.startLabel}>{c.start}</span>
          </div>
        ))}

        <Cluster c={online} />
        <Cluster c={offline} />

        <div className={styles.handoff} data-step="1">
          <span className={styles.badge}>1</span>
        </div>
        <div className={styles.handoff} data-step="2">
          <span className={styles.badge}>2</span>
        </div>

        <section className={styles.oracle}>
          <div className={styles.oracleWhat}>
            <span className={styles.oracleKicker}>The only hand-off</span>
            <span className={styles.oracleName}>Oracle</span>
            <Chips items={ORACLE} quiet />
          </div>
          <ol className={styles.steps}>
            <li>
              <span className={styles.badge}>1</span>A commit on Online writes a Work Tracker row
            </li>
            <li>
              <span className={styles.badge}>2</span>A dispatcher on Offline claims it when it falls due
            </li>
          </ol>
        </section>

        <div className={styles.downstream}>
          <span className={styles.downTerm}>Downstream systems, shared by both clusters</span>
          <Chips items={DOWNSTREAM} />
        </div>
      </div>

      <figcaption className={styles.caption}>
        Only Oracle and the downstream systems are shared. The governor watches both, so pressure there slows offline
        work, never online traffic.
      </figcaption>
    </figure>
  );
}
