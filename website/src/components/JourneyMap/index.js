import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import systemsFile from '@site/diagrams/systems.yaml';
import themeFile from '@site/diagrams/theme.yaml';
import {links as markup} from '../../lib/inlineMarkup';
import {themeStyle} from '../../lib/journeyTheme';
import styles from './styles.module.css';
import {TRIGGER_KIND as TRIGGERS} from '../../lib/triggers';

/**
 * JourneyMap: one payment journey, drawn as lanes.
 *
 * Every journey reads left to right in the same five lanes, and a column holds
 * one step from top to bottom:
 *
 *   Outside   what reaches the workflow from outside (pink, named as the
 *             event it is), the request that starts it, and the reply that
 *             goes back to the caller
 *   Step      the numbered step. Bright Blue while a caller waits, Deep Blue
 *             once nobody does, pale while it waits for something outside
 *   State     the payment's lifecycle state, as one continuous field per state
 *   Calls     the systems the step calls; a repeated call is a row of small
 *             squares that ends in a solid one
 *   Ends      where the payment can leave the journey at that step
 *
 * A sixth lane, Links, appears when a step links to another: a retry back to
 * an earlier step, say. Each link runs on its own level, shortest on top, from
 * a small square under the step it leaves to an arrow under the step it
 * reaches. It is all grid cells, so it needs no measuring and draws the same
 * on the server.
 *
 * A run of steps a caller waits on, from its request to its reply, sits in
 * one tinted box marked Sync, so the sync part of a journey reads apart from
 * the part that runs with nobody waiting.
 *
 * Alignment does the work connectors used to do: a mark belongs to the step
 * above or below it. A wait between steps is a run of dots. The words live in
 * the numbered notes below the diagram, keyed to the same step numbers.
 *
 * Under 540px of its own width the lanes fold into a list, one step per row.
 *
 * Passing no `steps` renders the compact form: the route only, with a panel
 * saying why there is no journey to draw.
 *
 * A journey's content lives in its own YAML file under website/diagrams/
 * journeys, checked against diagrams/schemas/journey.schema.json, and a page
 * names it: <JourneyMap journey="pay-by-bank-today" />. The colours come from
 * diagrams/theme.yaml and the systems' names from diagrams/systems.yaml. The
 * figure's "Edit this diagram" opens the Diagram Studio on it.
 *
 * The Studio draws with this same component, passing `edit`: every part then
 * carries a data-key the Studio listens for, empty lanes show what can be
 * added, and the gaps between steps take a new step or a dragged one.
 */

/* Every journey file, bundled at build time. Each was checked on the way in
   by plugins/diagram-data, so a mistake stops the build with a plain message. */
const JOURNEYS = require.context('@site/diagrams/journeys', false, /\.ya?ml$/);

export function loadJourney(name) {
  const key = JOURNEYS.keys().find((k) => k === `./${name}.yaml` || k === `./${name}.yml`);
  if (!key) {
    throw new Error(`JourneyMap: there is no file diagrams/journeys/${name}.yaml. Check the name in the page.`);
  }
  const mod = JOURNEYS(key);
  return {name, data: mod.default || mod, file: `website/diagrams/journeys/${key.slice(2)}`};
}

/* Every journey, by title, for the Studio's picker. */
export function listJourneys() {
  return JOURNEYS.keys()
    .map((k) => loadJourney(k.slice(2).replace(/\.ya?ml$/, '')))
    .sort((a, b) => a.data.title.localeCompare(b.data.title));
}

/* The systems a step can call, and the colours, as their files have them. */
export const SYSTEM_LIST = systemsFile;
export const THEME = themeFile.journeys;
export const SYSTEMS_PATH = 'website/diagrams/systems.yaml';
export const THEME_PATH = 'website/diagrams/theme.yaml';
const systemMap = (list) => Object.fromEntries(list.map((s) => [s.name, s]));
const SYSTEMS = systemMap(SYSTEM_LIST);

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

/* A lane cell holds three calls at most; the rest fold into a count. */
const MAX_CALLS = 3;

export const ROUTE_KIND = {
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
  {key: 'sync', label: ''},
  {key: 'outside', label: 'Outside'},
  {key: 'step', label: 'Step'},
  {key: 'state', label: 'State'},
  {key: 'calls', label: 'Calls'},
  {key: 'ends', label: 'Ends'},
  {key: 'links', label: 'Links'},
];

const triggerOf = (step) => (step.trigger ? TRIGGERS[step.trigger.kind] || TRIGGERS.events : null);
export const awaits = (step) => step.waiting ?? step.mode === 'awaiting';
/* Bright Blue while a caller waits, Deep Blue once nobody does, pale while the
   step waits on something from outside. */
export const paceOf = (step) => (awaits(step) ? 'await' : step.mode === 'live' || !step.mode ? 'live' : 'background');

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
    if (last && last.state === s) {
      last.to = ci;
      if (!c.wait) last.steps.push(c.i);
    } else {
      runs.push({state: s, from: ci, to: ci, steps: c.wait ? [] : [c.i]});
    }
  });
  return runs.filter((r) => r.state && r.steps.length);
}

/* The runs of steps a caller waits on: consecutive live columns, broken by a
   wait or by a step nobody waits on. */
function syncRuns(cols) {
  const runs = [];
  let open = null;
  cols.forEach((c, ci) => {
    if (!c.wait && paceOf(c.step) === 'live') {
      if (open) open.to = ci;
      else runs.push((open = {from: ci, to: ci}));
    } else {
      open = null;
    }
  });
  return runs;
}

/* Every link in the journey, each on its own level: the shortest on top, so
   a long one runs under the short ones and never crosses their labels. A
   link to a step that isn't there is kept only while editing, so the Studio
   can show it to be fixed. */
function linkLevels(steps, cols, editing) {
  const colOf = new Map();
  cols.forEach((c, ci) => !c.wait && colOf.set(c.i, ci));
  const all = [];
  steps.forEach((s, i) =>
    (s.links || []).forEach((l, k) => {
      const t = steps.findIndex((x) => x.name === l.to);
      const ok = t >= 0 && t !== i;
      if (ok || editing) all.push({i, k, t: ok ? t : -1, label: l.label, cs: colOf.get(i), ct: ok ? colOf.get(t) : null});
    }),
  );
  all
    .map((l, n) => ({n, span: l.t < 0 ? 0 : Math.abs(l.t - l.i)}))
    .sort((a, b) => a.span - b.span || a.n - b.n)
    .forEach((o, lv) => {
      all[o.n].lv = lv;
    });
  return all;
}

/* The arrival into the first step: the request a caller makes, or the start a
   system makes. Something from outside shows as the event it is, by name;
   the mechanism (an update, a signal) is on hover. */
function arrivalFor(step, i, kind) {
  const t = triggerOf(step);
  if (t) {
    const word = step.trigger.name || t.word;
    return {pink: true, word, title: `${word}: ${step.trigger.label || ''}. ${t.word}: ${t.note}.`};
  }
  if (i === 0) {
    const word = step.arrives || (kind === 'system' ? 'start' : 'request');
    return {word, title: kind === 'system' ? 'Started by a system' : "The caller's request starts the workflow"};
  }
  return null;
}

/* While editing, an empty name shows as a pale word saying what goes there. */
const Ph = ({children}) => <span className={styles.ph}>{children}</span>;

function Calls({step, systems, edit}) {
  const list = step.systems || [];
  const shown = list.length > MAX_CALLS ? list.slice(0, MAX_CALLS - 1) : list;
  const rest = list.slice(shown.length);
  const full = (s) => (systems[s] && systems[s].full) || s;
  if (edit && !list.length && !step.poll && !step.table) return <span className={styles.ghost}>+ calls</span>;
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
          <span className={styles.pollLabel}>{step.poll.label || (edit && <Ph>call</Ph>)}</span>
        </span>
      )}
      {shown.map((s) => (
        <abbr key={s} className={styles.call} title={full(s)}>
          {(systems[s] && systems[s].short) || s}
        </abbr>
      ))}
      {rest.length > 0 && (
        <abbr className={clsx(styles.call, styles.callMore)} title={rest.map(full).join('; ')}>
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

function End({exit, edit}) {
  if (!exit) return edit ? <span className={styles.ghost}>+ end</span> : null;
  if (Array.isArray(exit)) return exit.map((e, k) => <End key={k} exit={e} />);
  return (
    <span className={clsx(styles.end, !exit.state && styles.endSoft)} title={exit.label || exit.state}>
      <i aria-hidden="true" />
      <span>
        {exit.state && <span className={styles.endState}>{exit.state}</span>}
        {exit.label && <small>{exit.label}</small>}
        {!exit.state && !exit.label && <small className={styles.ph}>empty</small>}
      </span>
    </span>
  );
}

/* Props that make a part of the figure editable: a key the Studio reads, the
   keyboard reach of a button, and the marks for the part that's open or
   needs fixing. Nothing at all outside the Studio. */
function editable(edit, key, label, extra) {
  if (!edit) return {className: extra};
  return {
    'data-key': key,
    tabIndex: 0,
    role: 'button',
    'aria-label': label,
    className: clsx(extra, styles.hit, edit.sel === key && styles.sel, edit.bad && edit.bad.has(key) && styles.bad),
  };
}

function Route({origin, entry, core, workflows, edit}) {
  const groups = [];
  if (edit || (origin && (origin.actor || (origin.channels || []).length))) {
    const o = origin || {};
    groups.push({
      group: 'origin',
      label: 'From',
      items: [
        {
          text: [o.actor, (o.channels || []).map((c) => (typeof c === 'string' ? c : c.label)).join(', ')].filter(Boolean).join(' · '),
          title: o.note,
          tone: 'origin',
        },
      ],
    });
  }
  if (edit || (entry && entry.length)) {
    groups.push({group: 'entry', add: 'an entry point', label: 'Through', items: (entry || []).map((r) => ({text: r.label, note: r.note, title: ROUTE_KIND[r.kind], tone: r.kind}))});
  }
  if (edit || (core && core.length)) {
    groups.push({group: 'core', add: 'a Billpay API', label: 'Billpay', items: (core || []).map((r) => ({text: r.label, note: r.note, title: ROUTE_KIND[r.kind], tone: r.kind}))});
  }
  if (edit || workflows.length) {
    groups.push({
      group: 'workflow',
      add: 'a workflow',
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
              <span key={k} {...editable(edit, `route:${g.group}:${k}`, `${g.label}: ${it.text || 'empty'}. Click to change`, styles.routeItem)}>
                <span className={clsx(styles.hop, styles[`hop_${it.tone}`])} title={it.title}>
                  {it.text || (edit && <Ph>{g.group === 'origin' ? 'who' : 'name'}</Ph>)}
                </span>
                {it.note && <span className={styles.hopNote}>{it.note}</span>}
              </span>
            ))}
            {edit && g.add && (
              <button className={styles.addMini} type="button" data-key={`route-add:${g.group}`} aria-label={`Add ${g.add}`} title={`Add ${g.add}`}>
                +
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Lanes({steps, kind, systems, edit}) {
  const cols = columnsFor(steps);
  const runs = stateRuns(cols);
  const syncs = syncRuns(cols);
  const links = linkLevels(steps, cols, !!edit);
  const template = ['var(--jm-label)', ...cols.map((c) => (c.wait ? 'var(--jm-wait)' : 'minmax(var(--jm-col), var(--jm-col-max))'))].join(' ');
  const at = (ci) => ci + 2; // grid column of a column index; the labels take the first
  const lanes = LANES.filter((l) => (l.key !== 'sync' || syncs.length) && (l.key !== 'links' || links.length));
  const row = (key) => lanes.findIndex((l) => l.key === key) + 1;
  const colOfStep = (i) => cols.findIndex((c) => !c.wait && c.i === i);

  return (
    <div
      className={clsx(styles.lanes, edit && edit.linkFrom != null && styles.linking, edit && edit.dragging && styles.dragging)}
      style={{gridTemplateColumns: template}}
      aria-hidden={edit ? undefined : 'true'}>
      {syncs.map((r) => (
        <span
          key={`sync${r.from}`}
          className={styles.syncBox}
          style={{gridRow: `${row('sync')} / ${row('ends') + 1}`, gridColumn: `${at(r.from)} / ${at(r.to) + 1}`}}>
          <span className={styles.syncTag}>Sync</span>
        </span>
      ))}
      {syncs.length > 0 && <span className={styles.syncRow} style={{gridRow: row('sync')}} />}
      {lanes.filter((l) => l.label).map((l) => (
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
          <React.Fragment key={edit ? `s${c.i}` : c.step.name}>
            {(() => {
              const a = arrivalFor(c.step, c.i, kind);
              const e = editable(edit, `outside:${c.i}`, `What reaches step ${c.i + 1} from outside. Click to change`, styles.outside);
              return (
                <span {...e} style={{gridRow: row('outside'), gridColumn: at(ci)}}>
                  {a && (
                    <span className={clsx(styles.arrive, a.pink && styles.arrivePink)} title={a.title}>
                      <i />
                      {a.word}
                    </span>
                  )}
                  {c.step.reply != null && (
                    <span className={styles.reply} title={`Replies ${c.step.reply}`}>
                      <i />
                      reply
                    </span>
                  )}
                  {(a || c.step.reply != null) && <span className={clsx(styles.drop, a && a.pink && styles.dropPink)} />}
                  {edit && !a && c.step.reply == null && <span className={styles.ghost}>+ event</span>}
                </span>
              );
            })()}
            <span
              {...editable(
                edit,
                `step:${c.i}`,
                `Step ${c.i + 1}, ${c.step.name || 'no name'}. Click to change, or drag to move`,
                clsx(styles.step, styles[`pace_${paceOf(c.step)}`], edit && edit.linkFrom === c.i && styles.linkSource),
              )}
              draggable={edit ? true : undefined}
              style={{gridRow: row('step'), gridColumn: at(ci)}}
              title={c.step.caption}>
              <b className={styles.square}>{c.i + 1}</b>
              <span className={styles.stepName}>{c.step.name || (edit && <Ph>name</Ph>)}</span>
              {edit && (
                <button className={styles.linkHandle} type="button" data-key={`link-start:${c.i}`} aria-label={`Link step ${c.i + 1} to another step`} title="Link to another step">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 12V7a3 3 0 0 1 3-3h7" />
                    <path d="m10 1 3 3-3 3" />
                  </svg>
                </button>
              )}
            </span>
            <span {...editable(edit, `calls:${c.i}`, `Calls step ${c.i + 1} makes. Click to change`, styles.calls)} style={{gridRow: row('calls'), gridColumn: at(ci)}}>
              <Calls step={c.step} systems={systems} edit={edit} />
            </span>
            <span {...editable(edit, `ends:${c.i}`, `Where the payment can end at step ${c.i + 1}. Click to change`, styles.ends)} style={{gridRow: row('ends'), gridColumn: at(ci)}}>
              <End exit={c.step.exit} edit={edit} />
            </span>
          </React.Fragment>
        ),
      )}

      {runs.map((r) => {
        const e = editable(edit, `state:${r.steps[0]}`, `State ${r.state}. Click to change`, clsx(styles.stateField, styles[`tone_${toneFor(r.state)}`]));
        return (
          <span key={`${r.state}-${r.from}`} {...e} data-steps={edit ? r.steps.join(' ') : undefined} style={{gridRow: row('state'), gridColumn: `${at(r.from)} / ${at(r.to) + 1}`}}>
            <span className={styles.stateName}>{r.state}</span>
          </span>
        );
      })}

      {links.map((l) => {
        const r = row('links') + l.lv;
        const key = `link:${l.i}:${l.k}`;
        const label = editable(edit, key, `Link from step ${l.i + 1}: ${l.label || 'no words yet'}. Click to change`, clsx(styles.linkLabel, l.t < 0 && styles.linkLost));
        if (l.t < 0) {
          return (
            <span key={key} {...label} style={{gridRow: r, gridColumn: at(l.cs)}}>
              {l.label || <Ph>link</Ph>} ?
            </span>
          );
        }
        const lo = Math.min(l.cs, l.ct);
        const hi = Math.max(l.cs, l.ct);
        const right = l.ct > l.cs;
        const cells = [];
        for (let c = lo; c <= hi; c++) {
          /* Where the line starts and stops inside this column: from the
             source's square, just left of centre, to the arrow, just right. */
          let from = '0px';
          let to = '0px';
          if (c === l.cs) [from, to] = right ? ['calc(50% - 6px)', '0px'] : ['0px', 'calc(50% + 6px)'];
          if (c === l.ct) [from, to] = right ? ['0px', 'calc(50% - 6px)'] : ['calc(50% + 6px)', '0px'];
          cells.push(
            <span
              key={`${key}:${c}`}
              className={styles.linkRun}
              data-key={edit ? key : undefined}
              style={{gridRow: r, gridColumn: at(c), '--run-from': from, '--run-to': to}}
            />,
          );
        }
        const rise = {gridRow: `${row('links')} / ${r + 1}`};
        return (
          <React.Fragment key={key}>
            <span className={clsx(styles.linkRise, styles.linkFrom)} style={{...rise, gridColumn: at(l.cs)}} />
            <span className={clsx(styles.linkRise, styles.linkTo)} style={{...rise, gridColumn: at(l.ct)}} />
            {cells}
            <span {...label} style={{gridRow: r, gridColumn: `${at(lo)} / ${at(hi) + 1}`}}>
              {l.label || (edit && <Ph>why</Ph>)}
            </span>
          </React.Fragment>
        );
      })}

      {edit &&
        Array.from({length: steps.length + 1}, (_, b) => {
          /* The gap before step b: on the wait column if there is one, else
             straddling the edge between two steps. */
          const n = steps.length;
          const where = b === 0 ? 'Before step 1' : b === n ? `After step ${b}` : `Between step ${b} and step ${b + 1}`;
          let col;
          let side;
          if (!n) {
            col = 2;
            side = 'start';
          } else if (b === n) {
            col = at(colOfStep(n - 1));
            side = 'end';
          } else if (b > 0 && cols[colOfStep(b) - 1] && cols[colOfStep(b) - 1].wait) {
            col = at(colOfStep(b) - 1);
            side = 'centre';
          } else {
            col = at(colOfStep(b));
            side = 'start';
          }
          const key = `gap:${b}`;
          return (
            <span
              key={key}
              data-key={key}
              className={clsx(styles.gap, styles[`gap_${side}`], edit.sel === key && styles.gapSel, edit.dropAt === b && styles.gapOver)}
              style={{gridRow: n ? `${row('outside')} / ${row('ends') + 1}` : `${row('outside')} / span 1`, gridColumn: col}}>
              <button type="button" className={styles.plus} data-key={key} aria-label={`${where}: add a step, or change what happens here`}>
                +
              </button>
            </span>
          );
        })}
    </div>
  );
}

/* The same journey as a list, for a narrow column. */
function List({steps, kind, systems}) {
  /* The same Sync runs as the lanes: live steps, broken by a wait. */
  const live = (i) => i >= 0 && i < steps.length && paceOf(steps[i]) === 'live';
  const waitBefore = (i) => i > 0 && i < steps.length && (steps[i].trigger || awaits(steps[i]));
  return (
    <ol className={styles.list} aria-hidden="true">
      {steps.map((step, i) => {
        const a = arrivalFor(step, i, kind);
        const sync = live(i);
        const first = sync && (!live(i - 1) || waitBefore(i));
        const last = sync && (!live(i + 1) || waitBefore(i + 1));
        return (
          <li
            key={step.name}
            className={clsx(
              styles.item,
              styles[`pace_${paceOf(step)}`],
              sync && styles.itemSync,
              first && styles.itemSyncFirst,
              last && styles.itemSyncLast,
            )}>
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
              {paceOf(step) === 'live' && <span className={styles.syncTag}>Sync</span>}
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
              <Calls step={step} systems={systems} />
              <End exit={step.exit} />
              {(step.links || []).map((l) => {
                const t = steps.findIndex((x) => x.name === l.to);
                return t >= 0 && t !== i ? (
                  <span key={l.to} className={styles.linkItem}>
                    <i />
                    {l.label}, to step {t + 1}
                  </span>
                ) : null;
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Legend({steps, edit}) {
  const has = (f) => steps.some(f);
  const items = [];
  if (has((s) => paceOf(s) === 'live'))
    items.push({
      key: 'live',
      kind: 'live-step',
      node: (
        <span className={styles.syncKey}>
          <b className={clsx(styles.square, styles.squareKey)} />
          Sync
        </span>
      ),
      text: 'a caller waits for the reply',
    });
  if (has((s) => paceOf(s) === 'background'))
    items.push({key: 'bg', kind: 'background-step', node: <b className={clsx(styles.square, styles.squareKey, styles.keyBackground)} />, text: 'nobody waits'});
  if (has((s) => s.trigger))
    items.push({
      key: 'trig',
      kind: 'trigger',
      node: <span className={clsx(styles.arrive, styles.arrivePink)}><i />Event</span>,
      text: 'arrives from outside and resumes the payment',
    });
  if (has((s, i) => i > 0 && (s.trigger || awaits(s))))
    items.push({key: 'wait', node: <span className={styles.wait}><i /><i /><i /></span>, text: 'a wait'});
  if (has((s) => s.reply)) items.push({key: 'reply', node: <span className={styles.reply}><i />reply</span>, text: 'the answer to the caller'});
  if (has((s) => (s.links || []).length))
    items.push({key: 'link', kind: 'link', node: <span className={styles.linkKey}><b /><i /></span>, text: 'a link from one step to another'});
  if (has((s) => s.poll))
    items.push({
      key: 'poll',
      node: <span className={styles.cadence}><i /><i /><i /><b /></span>,
      text: 'the same call, repeated until it has an answer',
    });
  const keyed = edit && items.some((it) => it.kind);
  return (
    <ul className={styles.legend} aria-hidden={edit ? undefined : 'true'}>
      {items.map((it) => {
        const e = edit && it.kind ? editable(edit, `legend:${it.kind}`, `Colour of ${it.text}. Click to change`) : {};
        return (
          <li key={it.key} {...e} title={e.role ? 'Change this colour' : undefined}>
            {it.node}
            <span>{it.text}</span>
          </li>
        );
      })}
      {keyed && <li className={styles.legendHint}>Click a key to change its colour</li>}
    </ul>
  );
}

function describe(title, steps) {
  return `${title}: ${steps
    .map((s, i) => {
      const t = triggerOf(s);
      return [
        `step ${i + 1}, ${s.name}`,
        paceOf(s) === 'live' && 'sync, a caller waits',
        t && `started from outside by the ${s.trigger.name || t.word.toLowerCase()}: ${s.trigger.label}`,
        s.state && `reaches ${s.state}`,
        s.reply && `replies ${s.reply}`,
        s.poll && `calls ${s.poll.label} again and again until it answers`,
        s.systems && s.systems.length && `calls ${s.systems.join(', ')}`,
        s.table && `works in the ${s.table}`,
        s.exit && `can end ${[].concat(s.exit).map((e) => [e.state, e.label].filter(Boolean).join(', ')).join(', or ')}`,
        s.links && s.links.length && s.links.map((l) => `links to ${l.to}: ${l.label}`).join(', '),
      ]
        .filter(Boolean)
        .join(', ');
    })
    .join('. ')}.`;
}

export function Journey({
  journeyName,
  edit,
  theme = THEME,
  systems = SYSTEMS,
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
  const hasSteps = Array.isArray(steps) && (steps.length > 0 || !!edit);
  const workflows = workflow ? (Array.isArray(workflow) ? workflow : [workflow]) : [];
  const notes = detail || [];

  return (
    <figure className={clsx(styles.wrap, edit && styles.editing)} style={themeStyle(theme)}>
      <header {...editable(edit, 'head', 'Journey name and kind. Click to change', styles.head)}>
        <div>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h3 className={styles.title}>{title || (edit && <Ph>name</Ph>)}</h3>
        </div>
        {(JOURNEY_KIND[kind] || (journeyName && !edit)) && (
          <div className={styles.headSide}>
            {JOURNEY_KIND[kind] && (
              <span className={styles.kind} data-kind={kind}>
                {JOURNEY_KIND[kind]}
              </span>
            )}
            {journeyName && !edit && (
              <Link className={styles.edit} to={`/studio?journey=${journeyName}`}>
                Edit this diagram
              </Link>
            )}
          </div>
        )}
      </header>

      <Route origin={origin} entry={entry} core={core} workflows={workflows} edit={edit} />

      {!hasSteps && status && (
        <div className={clsx(styles.panel, status.kind === 'tbd' && styles.panelTbd)}>
          <p className={styles.panelLabel}>{STATUS_KIND[status.kind] || status.kind}</p>
          <p className={styles.panelNote}>{status.note}</p>
        </div>
      )}

      {hasSteps && (
        <div className={styles.canvas} role={edit ? undefined : 'img'} aria-label={edit ? undefined : describe(title, steps)}>
          <Lanes steps={steps} kind={kind} systems={systems} edit={edit} />
          {!edit && <List steps={steps} kind={kind} systems={systems} />}
          <Legend steps={steps} edit={edit} />
        </div>
      )}

      {edit ? (
        <figcaption className={styles.foot}>
          <div className={styles.detail}>
            <p className={styles.detailHead}>{detailLabel}</p>
            <ul>
              {notes.map((d, k) => (
                <li key={k} {...editable(edit, `note:${k}`, `Note ${k + 1}. Click to change`)}>
                  {d.step ? <span className={styles.detailNum}>{d.step}</span> : <span className={clsx(styles.detailNum, styles.detailDot)} aria-hidden="true" />}
                  <span>{d.text ? markup(d.text) : <Ph>empty note</Ph>}</span>
                </li>
              ))}
            </ul>
            <button className={styles.addNote} type="button" data-key="note-add">
              + Add a note
            </button>
          </div>
          {reference && <span className={styles.reference}>{reference.label || 'Sequence diagram'}</span>}
        </figcaption>
      ) : (
        (notes.length > 0 || reference) && (
          <figcaption className={styles.foot}>
            {notes.length > 0 && (
              <details className={styles.detail} open={detailOpen}>
                <summary>{detailLabel}</summary>
                <ul>
                  {notes.map((d, i) => (
                    <li key={i}>
                      {d.step ? (
                        <span className={styles.detailNum}>{d.step}</span>
                      ) : (
                        <span className={clsx(styles.detailNum, styles.detailDot)} aria-hidden="true" />
                      )}
                      <span>{markup(d.text)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {reference && (
              <Link className={styles.reference} to={reference.to}>
                {reference.label || 'Sequence diagram'}
              </Link>
            )}
          </figcaption>
        )
      )}
    </figure>
  );
}

export default function JourneyMap({journey, ...props}) {
  if (!journey) {
    return <Journey {...props} />;
  }
  const {data} = loadJourney(journey);
  return <Journey {...data} {...props} journeyName={journey} />;
}
