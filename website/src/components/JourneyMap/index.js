import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

/**
 * JourneyMap: one payment journey as a business process flow.
 *
 * The diagram splits into two banded layers. The top band is what the customer
 * touches: the person, the Amex channels, and the One-Data function the
 * channels call. The lower band is Billpay core: the API, the router, and the
 * workflow drawn as a rail of steps.
 *
 * A step shows an icon, a name and the lifecycle state it reaches. Nothing else.
 * The words live in the numbered notes below the diagram, keyed to the same step
 * numbers.
 *
 * Three things the layout does on purpose:
 *   - systems fan out below a step, so Execute's parallel calls look parallel
 *   - exceptions branch above it, in their own colour, so a call and an off-ramp
 *     never read as the same thing
 *   - a persistence strip runs under the rail, because every state change is
 *     written to the payment's history and published as an event
 *
 * Passing no `steps` renders the compact form: the layers and route only, with a
 * panel saying why there is no journey to draw. That is for the APIs the spec
 * names but does not describe.
 *
 * This folder also exports `JourneyLegend` (named), which renders live chips from
 * this stylesheet so the legend cannot drift from the diagrams it explains.
 */

/* Green means the money landed, so the last pill in a journey reads as the
   payoff. Anything still in flight stays blue however far along it is, because
   PROCESSED is not finished. RETURNED is amber rather than green: it is terminal,
   but nobody should read "the money came back" as a success. */
const STATE_TONE = {
  PAID: 'good',
  REPRESENTED: 'good',
  DECLINED: 'bad',
  CANCELLED: 'bad',
  DISALLOWED: 'bad',
  RETURNED: 'warn',
};
const TERMINAL = new Set(Object.keys(STATE_TONE));
const toneFor = (state) => STATE_TONE[state] || 'flight';

/* Short names on the diagram, full names on hover. The legend lists them once. */
const SYSTEMS = {
  GAR: 'Accounts Receivable (GAR), which holds the statement balance',
  AR: 'Accounts Receivable, which holds the statement balance',
  AMP: 'Authorizations (AMP), which holds available credit',
  'MR/M3': 'MultiRail / M3, which clears the payment with the bank',
  Raven: 'Raven, customer communications',
  Lumi: 'Lumi, the analytics platform, fed via RTF',
  eBNC: 'Balance and Control (eBNC), which audits that no payment is missed',
  Accounting: 'Accounting, which matches the payment across Amex platforms',
  Risk: 'Risk platform, kept current with payment activity',
  'Payment Instruments': 'Payment Instruments, which owns and verifies the way a customer pays',
  'Payment Options': 'Payment Options, which resolves the amount a customer chose',
  Installments: 'Installments, which owns the instalment plan',
  Globestar: 'Globestar, which holds the instalment plan',
  Allocations: 'Allocations Manager, which returns a corporate breakdown',
};

const ROUTE_KIND = {
  function: {cls: 'kFunction', label: 'One-Data function'},
  api: {cls: 'kApi', label: 'Billpay core API'},
  router: {cls: 'kRouter', label: 'Billpay Router'},
  workflow: {cls: 'kWorkflow', label: 'Temporal workflow'},
  schedule: {cls: 'kSchedule', label: 'Temporal Schedule'},
  event: {cls: 'kEvent', label: 'Inbound event'},
};

const STATUS_KIND = {
  tbd: 'Still being defined',
  unmapped: 'Not yet mapped in the spec',
  'read-only': 'Read-only, no workflow',
};

/* Who set the journey off. The same two words the index at the top of the page
   uses, repeated here so a reader who scrolled straight to a diagram still
   knows which kind they are looking at. */
const JOURNEY_KIND = {
  customer: 'Customer-started',
  system: 'System-started',
};

const MODE_NOTE = {
  live: 'the customer is waiting',
  background: 'runs in the background',
  awaiting: 'awaiting events',
};

/* ------------------------------------------------------------------ *
 * Icons: monoline, 24-unit grid, stroke inherits the surrounding ink
 * ------------------------------------------------------------------ */

const PATHS = {
  user: ['M12 4.2a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8z', 'M4.6 20.4a7.4 7.4 0 0 1 14.8 0'],
  monitor: ['M3.4 5.2h17.2a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V6.2a1 1 0 0 1 1-1z', 'M9 20.4h6', 'M12 16.4v4'],
  phone: ['M8 2.8h8a2 2 0 0 1 2 2v14.4a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2z', 'M11 18h2'],
  headset: ['M5 13.4v-1.2a7 7 0 0 1 14 0v1.2', 'M3.2 13.6h2.4a.8.8 0 0 1 .8.8v3.4a.8.8 0 0 1-.8.8H3.2z', 'M18.4 13.6h2.4v5H18.4a.8.8 0 0 1-.8-.8v-3.4a.8.8 0 0 1 .8-.8z', 'M20 18.8v.6a2 2 0 0 1-2 2h-3.2'],
  // idempotency: recorded once, and only once
  fingerprint: ['M4 12a8 8 0 0 1 13.7-5.6', 'M7 12a5 5 0 0 1 10 0v2.5', 'M12 12v4a7 7 0 0 1-.8 3.2', 'M6.6 17.8A9 9 0 0 0 7.4 14'],
  shieldCheck: ['M12 3.2l7 2.8v5c0 4.3-2.9 8-7 9.8-4.1-1.8-7-5.5-7-9.8V6z', 'M9 12.1l2.2 2.2 4.1-4.6'],
  // three calls, at the same time
  parallelArrows: ['M3.5 7h8', 'M9.8 5.2L11.6 7 9.8 8.8', 'M3.5 12h12', 'M13.8 10.2L15.6 12l-1.8 1.8', 'M3.5 17h8', 'M9.8 15.2L11.6 17l-1.8 1.8'],
  broadcast: ['M8.6 8.6a4.8 4.8 0 0 0 0 6.8', 'M15.4 8.6a4.8 4.8 0 0 1 0 6.8', 'M6 6a8.5 8.5 0 0 0 0 12', 'M18 6a8.5 8.5 0 0 1 0 12'],
  // the two confirmations that close a payment
  doubleCheck: ['M2.8 12.4l3.4 3.4L12.4 8', 'M10.6 14.6l1.6 1.6L20.8 7'],
  clock: ['M12 4.2a7.8 7.8 0 1 0 0 15.6 7.8 7.8 0 0 0 0-15.6z', 'M12 7.8V12l2.8 1.8'],
  inbox: ['M3.6 13.2V6.4a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v6.8', 'M3.6 13.2h4.2l1.4 2.4h5.6l1.4-2.4h4.2v4.4a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z'],
  bank: ['M3.6 9.4L12 4.4l8.4 5', 'M5.6 9.4v8.2M10 9.4v8.2M14 9.4v8.2M18.4 9.4v8.2', 'M3.6 19.6h16.8'],
  database: ['M12 3.4c4 0 7.2 1.2 7.2 2.7S16 8.8 12 8.8 4.8 7.6 4.8 6.1 8 3.4 12 3.4z', 'M4.8 6.1v11.8c0 1.5 3.2 2.7 7.2 2.7s7.2-1.2 7.2-2.7V6.1', 'M4.8 12c0 1.5 3.2 2.7 7.2 2.7s7.2-1.2 7.2-2.7'],
  // claimed for this run, so nothing else can take it
  lock: ['M6.8 10.4h10.4a1.6 1.6 0 0 1 1.6 1.6v6.4a1.6 1.6 0 0 1-1.6 1.6H6.8a1.6 1.6 0 0 1-1.6-1.6V12a1.6 1.6 0 0 1 1.6-1.6z', 'M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8', 'M12 14.2v2.2'],
  calendar: ['M5.4 6.4h13.2a1.4 1.4 0 0 1 1.4 1.4v11a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.8v-11a1.4 1.4 0 0 1 1.4-1.4z', 'M4 10.6h16', 'M8.4 3.6v3.4', 'M15.6 3.6v3.4'],
  repeat: ['M4.4 9.6a5 5 0 0 1 5-5h9.2', 'M15.8 1.8l3 2.8-3 2.8', 'M19.6 14.4a5 5 0 0 1-5 5H5.4', 'M8.6 22.2l-3-2.8 3-2.8'],
  // money coming back the way it went out
  undo: ['M4.2 9.6h9.8a5.2 5.2 0 1 1 0 10.4H7.8', 'M8.2 5.4L4 9.6l4.2 4.2'],
  // checked again, later
  recheck: ['M20 12a8 8 0 1 1-2.5-5.8', 'M20.4 3.8v4.4H16'],
  // one thing driving several: the orchestrator
  orchestrate: ['M12 4v5.4', 'M6.5 9.4h11', 'M6.5 9.4v3.4', 'M12 9.4v3.4', 'M17.5 9.4v3.4', 'M4.8 12.8h3.4', 'M10.3 12.8h3.4', 'M15.8 12.8h3.4'],
  /* One-Data Functions, drawn for this site: many sources resolved into one
     contract, exposed as a single callable function. */
  oneData: [
    'M3.6 6.6h3',
    'M3.6 12h3',
    'M3.6 17.4h3',
    'M6.6 6.6c3.6 0 2.4 5.4 6 5.4',
    'M6.6 12h6',
    'M6.6 17.4c3.6 0 2.4-5.4 6-5.4',
    'M12.6 12h3.8',
    'M16.4 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  ],
};

/* Filled brand marks, kept apart from the stroked icon set above because they
   carry their own geometry and viewBox. The Temporal glyph is the official mark
   from temporal.io's favicon, with the gradient plate dropped so it inherits the
   surrounding ink instead of forcing its own colour. */
const BRAND_MARKS = {
  temporal: {
    viewBox: '0 0 192 192',
    d: 'M123.34 68.6596C119.655 41.0484 110.327 18 96 18C81.6731 18 72.3454 41.0484 68.6596 68.6596C41.0484 72.3454 18 81.6731 18 96C18 110.327 41.0525 119.655 68.6596 123.34C72.3454 150.948 81.6731 174 96 174C110.327 174 119.655 150.948 123.34 123.34C150.952 119.655 174 110.327 174 96C174 81.6731 150.948 72.3454 123.34 68.6596ZM67.7583 115.298C41.3151 111.479 25.893 102.737 25.893 96C25.893 89.2629 41.3151 80.5212 67.7583 76.7021C67.1764 83.0674 66.8733 89.566 66.8733 96C66.8733 102.434 67.1764 108.937 67.7583 115.298ZM96 25.893C102.737 25.893 111.479 41.3151 115.298 67.7583C108.937 67.1764 102.434 66.8733 96 66.8733C89.566 66.8733 83.0633 67.1764 76.7021 67.7583C80.5212 41.3151 89.2629 25.893 96 25.893ZM124.242 115.298C122.94 115.488 117.602 116.114 116.252 116.248C116.118 117.602 115.488 122.936 115.302 124.238C111.483 150.681 102.741 166.103 96.0041 166.103C89.267 166.103 80.5253 150.681 76.7061 124.238C76.5202 122.936 75.8898 117.598 75.7564 116.248C75.1421 109.979 74.7703 103.246 74.7703 96C74.7703 88.7537 75.1421 82.0206 75.7564 75.7483C82.0247 75.134 88.7577 74.7622 96.0041 74.7622C103.25 74.7622 109.983 75.134 116.252 75.7483C117.606 75.8817 122.94 76.5121 124.242 76.698C150.685 80.5172 166.111 89.2629 166.111 95.996C166.111 102.729 150.685 111.479 124.242 115.298Z',
  },
};

function BrandMark({name, className}) {
  const m = BRAND_MARKS[name];
  if (!m) return null;
  return (
    <svg
      className={clsx(styles.icon, className)}
      viewBox={m.viewBox}
      fill="currentColor"
      aria-hidden="true">
      <path d={m.d} />
    </svg>
  );
}

function Icon({name, className}) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={clsx(styles.icon, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      {d.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

function StatePill({state, className}) {
  if (!state) return null;
  return (
    <span
      className={clsx(
        styles.state,
        styles[toneFor(state)],
        TERMINAL.has(state) && styles.terminal,
        className,
      )}>
      {state}
    </span>
  );
}

function SystemFan({systems, parallel}) {
  if (!systems || systems.length === 0) return null;
  return (
    <div className={styles.fan}>
      <ul className={styles.fanList}>
        {systems.map((s) => (
          <li key={s}>
            <abbr className={styles.sys} title={SYSTEMS[s] || s}>
              {s}
            </abbr>
          </li>
        ))}
      </ul>
      {parallel && systems.length > 1 && <p className={styles.fanNote}>at the same time</p>}
    </div>
  );
}

function ExitBranch({exit}) {
  if (!exit) return null;
  const tone = exit.state ? toneFor(exit.state) : 'warn';
  return (
    <div className={clsx(styles.exit, styles[`x_${tone}`])}>
      <span className={styles.exitBody}>
        <span className={styles.exitIcon} aria-hidden="true">
          {exit.icon || (tone === 'bad' ? '✕' : '↩')}
        </span>
        {exit.state ? <StatePill state={exit.state} /> : null}
        {exit.label && <span className={styles.exitLabel}>{exit.label}</span>}
      </span>
    </div>
  );
}

function RouteChips({items}) {
  if (!items || items.length === 0) return null;
  return (
    <ol className={styles.route}>
      {items.map((r, i) => {
        const kind = ROUTE_KIND[r.kind] || ROUTE_KIND.api;
        return (
          <li key={i} className={styles.routeItem}>
            {i > 0 && (
              <span className={styles.routeSep} aria-hidden="true">
                ›
              </span>
            )}
            <span
              className={clsx(styles.hop, styles[kind.cls], r.logo && styles.hopWithLogo)}
              title={kind.label}>
              {r.logo && <Icon name={r.logo} className={styles.hopLogo} />}
              {r.label}
            </span>
            {r.note && <span className={styles.hopNote}>{r.note}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/* An arrow can name what travels along it: a file drop, an event, a call. */
const Arrow = ({label}) => (
  <span className={clsx(styles.arrow, label && styles.arrowLabelled)} aria-hidden="true">
    {label && <span className={styles.arrowLabel}>{label}</span>}
  </span>
);

/* ------------------------------------------------------------------ *
 * The rail
 * ------------------------------------------------------------------ */

/* A step where the flow forks: two things happening at once, rejoining later.
   Each branch can carry its own start and end state, because a branch is often
   a whole child payment with a lifecycle of its own. */
function ForkNode({step, index}) {
  return (
    <div className={clsx(styles.node, styles.nodeFork)}>
      <span className={styles.nodeNum}>{index + 1}</span>
      <span className={styles.forkLabel}>{step.forkLabel || 'in parallel'}</span>
      <div className={styles.forkBranches}>
        {step.branches.map((b) => (
          <div key={b.name} className={styles.branch}>
            <span className={styles.branchHead}>
              {b.icon && <Icon name={b.icon} className={styles.branchIcon} />}
              {b.name}
            </span>
            {b.states && (
              <span className={styles.branchStates}>
                <StatePill state={b.states[0]} />
                <span className={styles.branchArrow} aria-hidden="true">
                  →
                </span>
                <StatePill state={b.states[1]} />
              </span>
            )}
            {b.systems && b.systems.length > 0 && (
              <span className={styles.branchSystems}>
                {b.systems.map((s) => (
                  <abbr key={s} className={styles.sys} title={SYSTEMS[s] || s}>
                    {s}
                  </abbr>
                ))}
              </span>
            )}
            {b.note && <span className={styles.branchNote}>{b.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepNode({step, index}) {
  if (step.branches) return <ForkNode step={step} index={index} />;
  /* A step that waits on events rather than doing work gets a timer, so a
     long-running pause is visible instead of implied. */
  const waiting = step.waiting ?? step.mode === 'awaiting';
  return (
    <div className={clsx(styles.node, waiting && styles.nodeWaiting)}>
      <span className={styles.nodeNum}>{index + 1}</span>
      {waiting && (
        <span className={styles.timer} title="Long-running: this step waits for events to arrive">
          <Icon name="clock" />
        </span>
      )}
      <span className={styles.nodeIcon}>
        <Icon name={step.icon} />
      </span>
      <span className={styles.nodeName}>{step.name}</span>
      <StatePill state={step.state} />
      {/* Some steps don't move the payment. They touch a table instead, and
          naming it says more than repeating the state it came in with. */}
      {step.table && (
        <span className={styles.tableRef}>
          <Icon name="database" />
          {step.table}
        </span>
      )}
    </div>
  );
}

export default function JourneyMap({
  eyebrow,
  title,
  kind,
  topLayer = 'UI & API layer',
  coreLayer = 'Billpay core',
  origin,
  entry,
  entryVia,
  core,
  workflow,
  steps,
  detail,
  detailLabel = 'How this works, step by step',
  detailOpen = false,
  persist = true,
  band = true,
  reference,
  status,
}) {
  const amexLogo = useBaseUrl('/img/amex-logo.png');
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  /* A journey can span two workflows, as a scheduled payment does: one to park
     it, another to run it when the date arrives. */
  const workflows = workflow ? (Array.isArray(workflow) ? workflow : [workflow]) : [];

  /* The band covers everything from the first step that runs with no caller
     waiting. That boundary matters more than any single step, so it becomes a
     region rather than a footnote. */
  const handoffAt = hasSteps
    ? steps.findIndex((s, i) => s.handoffAfter && i < steps.length - 1)
    : -1;
  const bandFrom =
    handoffAt >= 0
      ? handoffAt + 1
      : hasSteps
        ? steps.findIndex((s) => s.mode && s.mode !== 'live')
        : -1;
  const banded = band && bandFrom > 0 && bandFrom < (steps || []).length;

  return (
    <figure className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.headText}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h3 className={styles.title}>{title}</h3>
        </div>
        {JOURNEY_KIND[kind] && (
          <span className={styles.kind} data-kind={kind}>
            <span className={styles.kindDot} aria-hidden="true" />
            {JOURNEY_KIND[kind]}
          </span>
        )}
      </header>

      <div className={styles.canvas}>
        {/* ---- what the customer touches ---- */}
        <section className={clsx(styles.layer, styles.layerTop)}>
          {topLayer && <span className={styles.layerLabel}>{topLayer}</span>}
          <div className={styles.layerBody}>
            {origin && (
              <>
                {/* Some journeys have no actor worth naming: the sources box is
                    the whole story. */}
                {origin.actor && (
                  <>
                    <div className={styles.actor}>
                      <span className={styles.actorIcon}>
                        <Icon name={origin.icon || 'user'} />
                      </span>
                      <span className={styles.actorName}>
                        {origin.actor}
                        {origin.note && (
                          <abbr className={styles.info} title={origin.note}>
                            ⓘ
                          </abbr>
                        )}
                      </span>
                    </div>
                  </>
                )}
                {/* Arrow and target travel together, so a wrap never strands an
                    arrow pointing at empty space. */}
                <span className={styles.linkGroup}>
                  {origin.actor && <Arrow label={origin.via} />}
                  <div className={styles.channels}>
                  {origin.channelsLabel !== null && (
                    <span className={styles.channelsLabel}>
                      {origin.brandLogo !== false && (
                        <img className={styles.brandLogo} src={amexLogo} alt="" aria-hidden="true" />
                      )}
                      {origin.channelsLabel || 'Channels'}
                    </span>
                  )}
                    <ul className={styles.channelList}>
                      {(origin.channels || []).map((c) => (
                        <li key={c.label} className={styles.channel}>
                          <Icon name={c.icon} />
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </span>
              </>
            )}
            {entry && entry.length > 0 && (
              <span className={styles.linkGroup}>
                <Arrow label={entryVia} />
                <RouteChips items={entry} />
              </span>
            )}
          </div>
        </section>

        <div className={styles.drop} aria-hidden="true" />

        {/* ---- what Billpay does ---- */}
        <section className={clsx(styles.layer, styles.layerCore)}>
          <span className={styles.layerLabel}>{coreLayer}</span>
          <div className={styles.layerBody}>
            <RouteChips items={core} />
          </div>

          {workflows.length > 0 && (
            <div className={styles.orchestratorRow}>
              {workflows.map((w, i) => (
                <React.Fragment key={w.label}>
                  {i > 0 && <span className={styles.wfThen}>{w.via || 'then'}</span>}
                  <span
                    className={clsx(styles.orchestrator, w.child && styles.orchestratorChild)}
                    title={
                      w.child
                        ? 'A child workflow the parent starts'
                        : 'The Temporal workflow that orchestrates this journey'
                    }>
                    <BrandMark name="temporal" className={styles.wfLogo} />
                    {w.label}
                  </span>
                  {w.note && <span className={styles.hopNote}>{w.note}</span>}
                </React.Fragment>
              ))}
            </div>
          )}

          {!hasSteps && status && (
            <div className={clsx(styles.panel, status.kind === 'tbd' && styles.panelTbd)}>
              <p className={styles.panelLabel}>{STATUS_KIND[status.kind] || status.kind}</p>
              <p className={styles.panelNote}>{status.note}</p>
            </div>
          )}

          {hasSteps && (
            <div
              className={clsx(styles.rail, steps.length >= 6 && styles.dense)}
              style={{'--steps': steps.length, '--band-from': bandFrom + 1}}
              role="img"
              aria-label={`${title}: ${steps
                .map(
                  (s, i) =>
                    `step ${i + 1}, ${s.name}${s.state ? `, reaches ${s.state}` : ''}${
                      s.table ? `, working in the ${s.table}` : ''
                    }${
                      s.systems && s.systems.length ? `, calling ${s.systems.join(', ')}` : ''
                    }${s.exit ? `; exception ${s.exit.state || s.exit.label}` : ''}`,
                )
                .join('. ')}.`}>
              {banded && (
                <div className={styles.band} aria-hidden="true">
                  <span className={styles.bandLabel}>async process</span>
                </div>
              )}

              {steps.map((step, i) => (
                <React.Fragment key={step.name}>
                  <div className={styles.exitCell} style={{'--col': i + 1}}>
                    <ExitBranch exit={step.exit} />
                  </div>
                  <div
                    className={clsx(styles.nodeCell, i < steps.length - 1 && styles.linked)}
                    style={{'--col': i + 1}}>
                    <StepNode step={step} index={i} />
                    {/* A fork says what it is on its own label, so it needs no
                        caption underneath. */}
                    {!step.branches && (
                      <span className={styles.modeNote}>
                        {step.caption || MODE_NOTE[step.mode || 'live']}
                      </span>
                    )}
                  </div>
                  {persist && (
                    <div className={styles.tickCell} style={{'--col': i + 1}} aria-hidden="true">
                      <span className={styles.tick} />
                    </div>
                  )}
                  <div className={styles.fanCell} style={{'--col': i + 1}}>
                    <SystemFan systems={step.systems} parallel={step.parallel} />
                  </div>
                </React.Fragment>
              ))}

              {persist && (
                <p className={styles.persist}>
                  <span className={styles.persistChip}>
                    <Icon name="database" />
                    Every state change is saved and published as an event
                  </span>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {(detail || reference) && (
        <figcaption className={styles.foot}>
          {detail && detail.length > 0 && (
            <details className={styles.detail} open={detailOpen}>
              <summary>{detailLabel}</summary>
              <ul>
                {detail.map((d, i) => (
                  <li key={i}>
                    {d.step ? (
                      <span className={styles.detailNum}>{d.step}</span>
                    ) : (
                      <span className={clsx(styles.detailNum, styles.detailDot)} aria-hidden="true" />
                    )}
                    <span>{d.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {reference && (
            <Link className={styles.reference} to={reference.to}>
              {reference.label || 'Sequence diagram'} →
            </Link>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ *
 * JourneyLegend: how to read a diagram, in one compact block.
 * ------------------------------------------------------------------ */

export function JourneyLegend({channelNote}) {
  return (
    <div className={styles.legend}>
      <ul className={styles.legendKeys}>
        <li>
          <StatePill state="PROCESSING" />
          <span>in flight, not finished</span>
        </li>
        <li>
          <StatePill state="PAID" />
          <span>done, and the money landed</span>
        </li>
        <li>
          <StatePill state="RETURNED" />
          <span>done, but the money came back</span>
        </li>
        <li>
          <StatePill state="DECLINED" />
          <span>done, and the payment never happened</span>
        </li>
      </ul>
      <ul className={styles.legendKeys}>
        <li>
          <span className={styles.legendFan} aria-hidden="true" />
          <span>systems a step calls. Hover a name for what it does</span>
        </li>
        <li>
          <span className={styles.legendExit} aria-hidden="true" />
          <span>an exception, branching above the step it leaves from</span>
        </li>
        <li>
          <span className={styles.legendBand} aria-hidden="true" />
          <span>shaded steps run in the background, with nobody waiting</span>
        </li>
        <li>
          <span className={styles.legendNum} aria-hidden="true">
            1
          </span>
          <span>step numbers match the numbered notes under each diagram</span>
        </li>
      </ul>
      {channelNote && <p className={styles.legendNote}>{channelNote}</p>}
    </div>
  );
}
