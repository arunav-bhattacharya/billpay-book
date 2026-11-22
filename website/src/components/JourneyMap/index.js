import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {links} from '../../lib/inlineMarkup';
import styles from './styles.module.css';
import {TRIGGER_KIND as TRIGGERS} from '../../lib/triggers';

/**
 * JourneyMap: one payment journey, drawn as lanes.
 *
 * Every journey reads left to right in the same five lanes, and a column holds
 * one step from top to bottom:
 *
 *   Outside   what reaches the workflow from outside (pink), the request that
 *             starts it, and the reply that goes back to the caller
 *   Step      the numbered step. Bright Blue while a caller waits, Deep Blue
 *             once nobody does, pale while it waits for something outside
 *   State     the payment's lifecycle state, as one continuous field per state
 *   Calls     the systems the step calls; a repeated call is a row of small
 *             squares that ends in a solid one
 *   Ends      where the payment can leave the journey at that step
 *
 * Alignment does the work connectors used to do: a mark belongs to the step
 * above or below it. A wait between steps is a run of dots. The words live in
 * the numbered notes below the diagram, keyed to the same step numbers.
 *
 * Under 540px of its own width the lanes fold into a list, one step per row.
 *
 * Passing no `steps` renders the compact form: the route only, with a panel
 * saying why there is no journey to draw.
 */

/* How a state's field is filled. Anything still in flight is a blue tint that
   deepens as the payment moves on; the payoff is solid; an end that is not a
   success is grey, and stays in the Ends lane. */
const STATE_TONE = {
  PENDING: 'held',
  SCHEDULED: 'held',
  INPUT: 'held',
  ACCEPTED: 'flight',
  ALLOCATING: 'flight',
  ALLOCATED: 'flight',
  REPRESENTING: 'flight',
  PROCESSING: 'moving',
  PROCESSED: 'moving',
  PAID: 'done',
  REPRESENTED: 'done',
  DECLINED: 'end',
  CANCELLED: 'end',
  DISALLOWED: 'end',
  RETURNED: 'end',
};
const toneFor = (state) => STATE_TONE[state] || 'flight';

/* Short names in the lane, full names on hover. */
const SYSTEMS = {
  GAR: 'Accounts Receivable (GAR), which holds the statement balance',
  AR: 'Accounts Receivable, which holds the statement balance',
  AMP: 'Authorizations (AMP), which holds available credit',
  'MR/M3': 'MultiRail / M3, which clears the payment with the bank',
  Raven: 'Raven, customer communications',
  RTF: 'RTF, which carries lifecycle events to the systems that consume them',
  eBNC: 'Balance and Control (eBNC), which audits that no payment is missed',
  Accounting: 'Accounting, which matches the payment across Amex platforms',
  Risk: 'Risk platform, kept current with payment activity',
  TFNE: 'Transaction Notification Engine (TFNE), a legacy system told when a payment is processed',
  GPHDB: 'The legacy Payments History Database (GPHDB), told when a payment is processed',
  B2Notifier: 'B2Notifier, which tells other downstream systems when a payment is processed',
  'Payment Instruments': 'Payment Instruments, which owns and verifies the way a customer pays, and gives the clear-text details that open-to-buy and the notifications need',
  'Payment Options': 'Payment Options, which resolves the amount a customer chose',
  Plans: "Plans, which checks the payment's mandate where the market requires one",
  Installments: 'Installments, which owns the instalment plan',
  Globestar: 'Globestar, which holds the instalment plan',
  Allocations: 'Allocations Manager, which returns a corporate breakdown',
  'Amex PwBT': "Amex Pay with Bank Transfer, the one bank-transfer service Billpay calls; it works with each market's provider, Plaid in the US among them",
  'Card provider': "The market's card provider, for a debit card's 3D Secure and its authorization: Checkout.com in the UK",
};
const SHORT = {
  'Payment Instruments': 'Instruments',
  'Payment Options': 'Options',
};
/* A lane cell holds three calls at most; the rest fold into a count. */
const MAX_CALLS = 3;

const ROUTE_KIND = {
  function: 'One-Data function',
  api: 'Billpay core API',
  workflow: 'Temporal workflow',
  schedule: 'Temporal Schedule',
  event: 'Inbound event',
  inbox: "Held in One-Data's inbox until Billpay pulls it",
  dispatcher: 'A dispatcher, which starts work at the rate the governor sets',
};

const STATUS_KIND = {
  tbd: 'Still being defined',
  unmapped: 'Not yet mapped in the spec',
  'read-only': 'Read-only, no workflow',
};

const JOURNEY_KIND = {
  customer: 'Customer initiated',
  system: 'System initiated',
};

const LANES = [
  {key: 'outside', label: 'Outside'},
  {key: 'step', label: 'Step'},
  {key: 'state', label: 'State'},
  {key: 'calls', label: 'Calls'},
  {key: 'ends', label: 'Ends'},
];

const triggerOf = (step) => (step.trigger ? TRIGGERS[step.trigger.kind] || TRIGGERS.events : null);
const awaits = (step) => step.waiting ?? step.mode === 'awaiting';
/* Bright Blue while a caller waits, Deep Blue once nobody does, pale while the
   step waits on something from outside. */
const paceOf = (step) => (awaits(step) ? 'await' : step.mode === 'live' || !step.mode ? 'live' : 'background');

/* The columns: one per step, and a narrow one for the wait before any step
   that something outside has to start. */
function columnsFor(steps) {
  const cols = [];
  steps.forEach((step, i) => {
    if (i > 0 && (step.trigger || awaits(step))) cols.push({wait: true, before: i});
    cols.push({step, i});
  });
  return cols;
}

/* One field per run of the same state, including the waits inside the run. A
   step that names no state keeps the one before it. */
function stateRuns(cols) {
  const runs = [];
  let current = null;
  cols.forEach((c, ci) => {
    const s = c.wait ? current : c.step.state || current;
    current = s;
    const last = runs[runs.length - 1];
    if (last && last.state === s) last.to = ci;
    else runs.push({state: s, from: ci, to: ci});
  });
  return runs.filter((r) => r.state);
}

/* The arrival into the first step: the request a caller makes, or the start a
   system makes. */
function arrivalFor(step, i, kind) {
  const t = triggerOf(step);
  if (t) return {pink: true, word: t.word, title: `${t.word}: ${step.trigger.label}. ${t.note}.`};
  if (i === 0) {
    const word = step.arrives || (kind === 'system' ? 'start' : 'request');
    return {word, title: kind === 'system' ? 'Started by a system' : "The caller's request starts the workflow"};
  }
  return null;
}

function Calls({step}) {
  const systems = step.systems || [];
  const shown = systems.length > MAX_CALLS ? systems.slice(0, MAX_CALLS - 1) : systems;
  const rest = systems.slice(shown.length);
  return (
    <>
      {step.poll && (
        <span className={styles.poll} title={step.poll.note || step.poll.label}>
          <span className={styles.cadence} aria-hidden="true">
            {Array.from({length: 5}).map((_, k) => (
              <i key={k} />
            ))}
            <b />
          </span>
          <span className={styles.pollLabel}>{step.poll.label}</span>
        </span>
      )}
      {shown.map((s) => (
        <abbr key={s} className={styles.call} title={SYSTEMS[s] || s}>
          {SHORT[s] || s}
        </abbr>
      ))}
      {rest.length > 0 && (
        <abbr className={clsx(styles.call, styles.callMore)} title={rest.map((s) => SYSTEMS[s] || s).join('; ')}>
          +{rest.length} more
        </abbr>
      )}
      {step.table && (
        <span className={clsx(styles.call, styles.callTable)} title="A table this step works in">
          {step.table}
        </span>
      )}
    </>
  );
}

function End({exit}) {
  if (!exit) return null;
  return (
    <span className={clsx(styles.end, !exit.state && styles.endSoft)} title={exit.label || exit.state}>
      <i aria-hidden="true" />
      <span>
        {exit.state && <span className={styles.endState}>{exit.state}</span>}
        {exit.label && <small>{exit.label}</small>}
      </span>
    </span>
  );
}

function Route({origin, entry, core, workflows}) {
  const groups = [];
  if (origin && (origin.actor || (origin.channels || []).length)) {
    groups.push({
      label: 'From',
      items: [
        {
          text: [origin.actor, (origin.channels || []).map((c) => c.label).join(', ')].filter(Boolean).join(' · '),
          title: origin.note,
          tone: 'origin',
        },
      ],
    });
  }
  if (entry && entry.length) {
    groups.push({label: 'Through', items: entry.map((r) => ({text: r.label, note: r.note, title: ROUTE_KIND[r.kind], tone: r.kind}))});
  }
  if (core && core.length) {
    groups.push({label: 'Billpay', items: core.map((r) => ({text: r.label, note: r.note, title: ROUTE_KIND[r.kind], tone: r.kind}))});
  }
  if (workflows.length) {
    groups.push({
      label: 'Runs as',
      items: workflows.map((w) => ({
        text: w.label,
        note: w.note,
        title: w.child ? 'A child workflow the parent starts' : 'The Temporal workflow that runs this journey',
        tone: 'workflow',
      })),
    });
  }
  if (!groups.length) return null;
  return (
    <dl className={styles.route}>
      {groups.map((g) => (
        <div key={g.label} className={styles.routeRow}>
          <dt>{g.label}</dt>
          <dd>
            {g.items.map((it, k) => (
              <span key={k} className={styles.routeItem}>
                <span className={clsx(styles.hop, styles[`hop_${it.tone}`])} title={it.title}>
                  {it.text}
                </span>
                {it.note && <span className={styles.hopNote}>{it.note}</span>}
              </span>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Lanes({steps, kind}) {
  const cols = columnsFor(steps);
  const runs = stateRuns(cols);
  const template = ['var(--jm-label)', ...cols.map((c) => (c.wait ? 'var(--jm-wait)' : 'minmax(var(--jm-col), var(--jm-col-max))'))].join(' ');
  const at = (ci) => ci + 2; // grid column of a column index; the labels take the first
  const row = (key) => LANES.findIndex((l) => l.key === key) + 1;

  return (
    <div className={styles.lanes} style={{gridTemplateColumns: template}} aria-hidden="true">
      {LANES.map((l) => (
        <span key={l.key} className={styles.laneLabel} style={{gridRow: row(l.key)}}>
          {l.label}
        </span>
      ))}

      {cols.map((c, ci) =>
        c.wait ? (
          <span key={`w${ci}`} className={styles.wait} style={{gridRow: row('step'), gridColumn: at(ci)}}>
            <i />
            <i />
            <i />
          </span>
        ) : (
          <React.Fragment key={c.step.name}>
            {(() => {
              const a = arrivalFor(c.step, c.i, kind);
              return (
                <span className={styles.outside} style={{gridRow: row('outside'), gridColumn: at(ci)}}>
                  {a && (
                    <span className={clsx(styles.arrive, a.pink && styles.arrivePink)} title={a.title}>
                      <i />
                      {a.word}
                    </span>
                  )}
                  {c.step.reply && (
                    <span className={styles.reply} title={`Replies ${c.step.reply}`}>
                      <i />
                      reply
                    </span>
                  )}
                  {(a || c.step.reply) && <span className={clsx(styles.drop, a && a.pink && styles.dropPink)} />}
                </span>
              );
            })()}
            <span
              className={clsx(styles.step, styles[`pace_${paceOf(c.step)}`])}
              style={{gridRow: row('step'), gridColumn: at(ci)}}
              title={c.step.caption}>
              <b className={styles.square}>{c.i + 1}</b>
              <span className={styles.stepName}>{c.step.name}</span>
            </span>
            <span className={styles.calls} style={{gridRow: row('calls'), gridColumn: at(ci)}}>
              <Calls step={c.step} />
            </span>
            <span className={styles.ends} style={{gridRow: row('ends'), gridColumn: at(ci)}}>
              <End exit={c.step.exit} />
            </span>
          </React.Fragment>
        ),
      )}

      {runs.map((r) => (
        <span
          key={`${r.state}-${r.from}`}
          className={clsx(styles.stateField, styles[`tone_${toneFor(r.state)}`])}
          style={{gridRow: row('state'), gridColumn: `${at(r.from)} / ${at(r.to) + 1}`}}>
          <span className={styles.stateName}>{r.state}</span>
        </span>
      ))}
    </div>
  );
}

/* The same journey as a list, for a narrow column. */
function List({steps, kind}) {
  return (
    <ol className={styles.list} aria-hidden="true">
      {steps.map((step, i) => {
        const a = arrivalFor(step, i, kind);
        return (
          <li key={step.name} className={clsx(styles.item, styles[`pace_${paceOf(step)}`])}>
            {i > 0 && (step.trigger || awaits(step)) && (
              <span className={styles.itemWait}>
                <i />
                <i />
                <i />
              </span>
            )}
            <div className={styles.itemHead}>
              <b className={styles.square}>{i + 1}</b>
              <span className={styles.stepName}>{step.name}</span>
              {step.state && <span className={clsx(styles.itemState, styles[`tone_${toneFor(step.state)}`])}>{step.state}</span>}
            </div>
            <div className={styles.itemBody}>
              {a && a.pink && (
                <span className={clsx(styles.arrive, styles.arrivePink)}>
                  <i />
                  {a.word}
                </span>
              )}
              {step.reply && (
                <span className={styles.reply}>
                  <i />
                  reply
                </span>
              )}
              <Calls step={step} />
              <End exit={step.exit} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Legend({steps}) {
  const has = (f) => steps.some(f);
  const kinds = [...new Set(steps.filter((s) => s.trigger).map((s) => triggerOf(s).word))];
  const items = [];
  if (has((s) => paceOf(s) === 'live'))
    items.push({key: 'live', node: <b className={clsx(styles.square, styles.squareKey)} />, text: 'a caller waits'});
  if (has((s) => paceOf(s) === 'background'))
    items.push({key: 'bg', node: <b className={clsx(styles.square, styles.squareKey, styles.keyBackground)} />, text: 'nobody waits'});
  if (kinds.length)
    items.push({
      key: 'trig',
      node: <span className={clsx(styles.arrive, styles.arrivePink)}><i />{kinds.join(' · ')}</span>,
      text: 'arrives from outside and resumes the step',
    });
  if (has((s, i) => i > 0 && (s.trigger || awaits(s))))
    items.push({key: 'wait', node: <span className={styles.wait}><i /><i /><i /></span>, text: 'a wait'});
  if (has((s) => s.reply)) items.push({key: 'reply', node: <span className={styles.reply}><i />reply</span>, text: 'the answer to the caller'});
  if (has((s) => s.poll))
    items.push({
      key: 'poll',
      node: <span className={styles.cadence}><i /><i /><i /><b /></span>,
      text: 'the same call, repeated until it has an answer',
    });
  return (
    <ul className={styles.legend} aria-hidden="true">
      {items.map((it) => (
        <li key={it.key}>
          {it.node}
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

function describe(title, steps) {
  return `${title}: ${steps
    .map((s, i) => {
      const t = triggerOf(s);
      return [
        `step ${i + 1}, ${s.name}`,
        t && `started from outside by ${t.word.toLowerCase()}: ${s.trigger.label}`,
        s.state && `reaches ${s.state}`,
        s.reply && `replies ${s.reply}`,
        s.poll && `calls ${s.poll.label} again and again until it answers`,
        s.systems && s.systems.length && `calls ${s.systems.join(', ')}`,
        s.table && `works in the ${s.table}`,
        s.exit && `can end ${[s.exit.state, s.exit.label].filter(Boolean).join(', ')}`,
      ]
        .filter(Boolean)
        .join(', ');
    })
    .join('. ')}.`;
}

export default function JourneyMap({
  eyebrow,
  title,
  kind,
  origin,
  entry,
  core,
  workflow,
  steps,
  detail,
  detailLabel = 'How this works, step by step',
  detailOpen = false,
  reference,
  status,
}) {
  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const workflows = workflow ? (Array.isArray(workflow) ? workflow : [workflow]) : [];

  return (
    <figure className={styles.wrap}>
      <header className={styles.head}>
        <div>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h3 className={styles.title}>{title}</h3>
        </div>
        {JOURNEY_KIND[kind] && (
          <span className={styles.kind} data-kind={kind}>
            {JOURNEY_KIND[kind]}
          </span>
        )}
      </header>

      <Route origin={origin} entry={entry} core={core} workflows={workflows} />

      {!hasSteps && status && (
        <div className={clsx(styles.panel, status.kind === 'tbd' && styles.panelTbd)}>
          <p className={styles.panelLabel}>{STATUS_KIND[status.kind] || status.kind}</p>
          <p className={styles.panelNote}>{status.note}</p>
        </div>
      )}

      {hasSteps && (
        <div className={styles.canvas} role="img" aria-label={describe(title, steps)}>
          <Lanes steps={steps} kind={kind} />
          <List steps={steps} kind={kind} />
          <Legend steps={steps} />
        </div>
      )}

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
                    <span>{links(d.text)}</span>
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
