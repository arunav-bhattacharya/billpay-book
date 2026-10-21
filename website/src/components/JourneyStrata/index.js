import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import RouteLedger from '../RouteLedger';
import {IFACES, ROAD, calls, plain, seq} from '../RouteLedger/model';
import useOverlay from '../../lib/useOverlay';
import {GROUPS, JOURNEY} from './journeys';
import styles from './styles.module.css';

/**
 * JourneyStrata: The Complete Picture, one journey at a time.
 *
 * The journey is drawn as a cross-section. Left to right is time, cut into
 * segments: one per workflow run, and one per wait between runs. Top to
 * bottom is distance from the customer: what they do and see, One-Data at
 * the edge, the core API and the Router, the workflows in Temporal, the
 * systems each stage calls, and Oracle at the bottom, where every stage
 * commits. Inside a run segment every stratum shares the same columns, one
 * per stage, so whatever happens at a stage lines up under it from the
 * customer down to the row it writes.
 *
 * The workflow, its stages, the states they commit, how the Router starts it
 * and the systems each stage calls come from RouteLedger's model, so the two
 * views can't disagree. The "By workflow" side of the switch is RouteLedger
 * itself. A time ruler in days appears only on a journey that waits for a
 * date: everything else happens in seconds and minutes.
 *
 * Every length is in em, and the board's font size follows its width, so
 * the whole cross-section scales as one piece. Below a readable size it
 * stops shrinking and scrolls sideways instead.
 */

const MAIN = {
  Capture: ['PENDING'],
  Verify: ['ACCEPTED', 'DECLINED'],
  Reverify: ['ACCEPTED', 'DECLINED'],
  Execute: ['PROCESSING'],
  Fulfil: ['PROCESSED'],
  Cancel: ['CANCELLED'],
  RequestConfirmation: ['PENDING', 'DECLINED'],
  RequestAllocations: ['ALLOCATING'],
  ReceiveAllocations: ['ALLOCATED'],
  Return: ['RETURNED'],
  QueueRepresentment: ['REPRESENTING'],
  Represent: ['REPRESENTED', 'DECLINED'],
  Settle: ['PAID'],
};
const SCHEDULES = new Set(['scheduled', 'arScheduled', 'update']);

/* the state a stage commits on this road, then the states it can exit to */
function states(j, s) {
  if (s === 'Verify' && SCHEDULES.has(j.id)) return ['SCHEDULED', 'DECLINED'];
  if (s === 'Verify' && j.id === 'inbound') return ['ACCEPTED', 'DISALLOWED'];
  return MAIN[s] || [];
}

/* the systems a stage calls on this road, Raven last, rails left out */
const CALL_ORDER = [
  ...IFACES.filter((f) => !f.rail && f.name !== 'CommunicationActivities'),
  ...IFACES.filter((f) => f.name === 'CommunicationActivities'),
];
function systemsAt(j, s) {
  const out = j.band.drain && s === 'Settle' ? [{name: 'One-Data inbox', kind: 'call'}] : [];
  CALL_ORDER.forEach((f) => {
    const c = calls(j, f)[s];
    if (!c || c.kind === 'skip') return;
    f.system.split(', ').forEach((name) => out.push({name, kind: c.kind}));
  });
  return out;
}

const STARTS = {
  pulled: (j) => ({c: j.req.inbox, s: "Offline · the Router, at the governor's pace"}),
  due: (j) => ({c: j.req.by, s: "Offline · the Router again, with the day's config"}),
  drain: () => ({c: 'a Schedule', s: 'no Router: a run every 30 seconds'}),
};
function entryOf(j) {
  if (STARTS[j.band.key]) return STARTS[j.band.key](j);
  const api = `${j.req.api[0]} ${j.req.api[1]}`;
  if (j.band.key === 'callback') return {c: api, s: 'Offline · async start, 202'};
  if (j.update) return {c: api, s: 'an update to the running workflow'};
  return {c: api, s: `${j.cluster} · Update-With-Start`};
}

/* a segment, with its road resolved and its columns counted */
function resolve(seg) {
  if (!seg.road) {
    const kind = seg.wait ? 'wait' : seg.read ? 'read' : 'card';
    return {...seg, kind, cols: kind === 'wait' ? 1 : 2, weight: kind === 'wait' ? 0.85 : 2, stages: []};
  }
  const base = ROAD[seg.road];
  let j = seg.stages
    ? {...base, stages: seg.stages, child: base.child.filter((s) => seg.stages.includes(s))}
    : base;
  if (seg.cond) j = {...j, cond: seg.cond};
  if (seg.exc) j = {...j, exc: {...j.exc, ...seg.exc}};
  const stages = seq(j);
  return {...seg, kind: 'run', j, stages, cols: Math.max(stages.length, 1), weight: Math.max(stages.length, 1.6)};
}

function colOf(seg, at) {
  if (!seg.stages.length || at === undefined) return 1;
  if (at === 'last') return seg.stages.length;
  const i = seg.stages.indexOf(at);
  return i < 0 ? 1 : i + 1;
}

/* the board's width in em, so its font size can follow its container */
function designWidth(segs) {
  return segs.reduce((w, s) => w + (s.kind === 'wait' ? 7 : s.weight * 9) + 1, 10);
}

function Square({kind}) {
  return <span className={clsx(styles.sq, styles[`sq_${kind}`])} aria-hidden="true" />;
}

function State({st, exit, child}) {
  return <span className={clsx(styles.state, exit && styles.stateExit, child && styles.stateChild)}>{st}</span>;
}

function Label({term, desc}) {
  return (
    <div className={styles.label}>
      <span className={styles.labelTerm}>{term}</span>
      {desc && <span className={styles.labelDesc}>{desc}</span>}
    </div>
  );
}

function Cell({seg, className, children}) {
  return (
    <div className={clsx(styles.cell, styles[`cell_${seg.kind}`], className)} style={{'--cols': seg.cols}}>
      {children}
    </div>
  );
}

function At({seg, at, span, children, className}) {
  const col = colOf(seg, at);
  return (
    <div className={clsx(styles.at, className)} style={{gridColumn: span ? '1 / -1' : `${col} / span 1`}}>
      {children}
    </div>
  );
}

/* how far along the segment the customer is still waiting: up to the stage
   that answers them, then nobody waits */
function waitEnd(seg) {
  if (!seg.waiting) return '0%';
  if (seg.kind !== 'run') return '100%';
  const answers = ['Verify', 'RequestConfirmation'].map((s) => seg.stages.indexOf(s)).find((i) => i >= 0);
  const i = answers === undefined ? seg.stages.length - 1 : answers;
  return `calc(${i} / ${seg.cols} * 100% + 0.75em)`;
}

function CustomerCell({seg}) {
  return (
    <div
      className={clsx(styles.cell, styles[`cell_${seg.kind}`], styles.track)}
      style={{'--cols': seg.cols, '--wait-end': waitEnd(seg)}}>
      {(seg.customer || []).map((m) => (
        <At seg={seg} at={m.at} key={m.t}>
          <span className={styles.momentHead}>
            <span className={styles.momentTerm}>{m.t}</span>
          </span>
          <span className={styles.momentNode}>
            <Square kind={m.m === 'choice' ? 'choice' : m.m === 'quiet' ? 'quiet' : 'on'} />
          </span>
          {m.s && <span className={styles.momentSub}>{m.s}</span>}
          {m.st && <State st={m.st} />}
        </At>
      ))}
    </div>
  );
}

function Box({c, s}) {
  return (
    <>
      <span className={styles.box}>{c}</span>
      {s && <span className={styles.boxSub}>{s}</span>}
    </>
  );
}

function OneDataCell({seg}) {
  return (
    <Cell seg={seg}>
      {(seg.oneData || []).map((o) => (
        <At seg={seg} at={o.at} key={o.c + o.s}>
          <Box c={o.c} s={o.s} />
        </At>
      ))}
    </Cell>
  );
}

function EntryCell({seg}) {
  const e = seg.entry || (seg.kind === 'run' ? entryOf(seg.j) : null);
  return (
    <Cell seg={seg}>
      {e && (
        <At seg={seg} at={seg.stages[0]}>
          <Box c={e.c} s={e.s} />
        </At>
      )}
    </Cell>
  );
}

function ClusterTag({cluster}) {
  return <span className={clsx(styles.cluster, styles[`cluster_${cluster}`])}>{cluster}</span>;
}

function WorkflowCell({seg}) {
  if (seg.kind === 'wait') {
    return (
      <Cell seg={seg}>
        <p className={styles.waitText}>{seg.wait}</p>
      </Cell>
    );
  }
  if (seg.kind === 'read') {
    return (
      <Cell seg={seg}>
        <p className={styles.waitText}>{seg.read}</p>
      </Cell>
    );
  }
  if (seg.kind === 'card') {
    const c = seg.card;
    return (
      <Cell seg={seg}>
        <div className={clsx(styles.card, styles.cardSpan)}>
          <div className={styles.cardHead}>
            <span className={styles.cardName}>{c.composite ? `${c.name} composite` : c.name}</span>
            <ClusterTag cluster={c.cluster} />
          </div>
          <span className={styles.cardId}>{c.id}</span>
          <p className={styles.cardNote}>{c.tbd}</p>
        </div>
      </Cell>
    );
  }
  const {j} = seg;
  const name = j.plain ? j.wf : plain(j.wf);
  return (
    <Cell seg={seg}>
      <div className={clsx(styles.card, styles.cardSpan)}>
        <div className={styles.cardHead}>
          <span className={styles.cardName}>{name}</span>
          <ClusterTag cluster={j.cluster} />
        </div>
        <span className={styles.cardId}>
          {j.wfId}
          {j.update && ` · update ${j.update}`}
        </span>
        <div className={styles.stages}>
          {seg.stages.map((s, i) => {
            const [main, ...exits] = states(j, s);
            const child = j.child.includes(s);
            const sometimes = Boolean(j.cond[s]);
            return (
              <div className={styles.stage} key={s}>
                <span className={styles.exits}>
                  {exits.map((x) => (
                    <State st={x} exit key={x} />
                  ))}
                </span>
                <span className={styles.stageRow}>
                  <span
                    className={clsx(styles.stageSq, child && styles.stageChild, sometimes && styles.stageCond)}
                    aria-hidden="true"
                  />
                  <span className={styles.stageText}>
                    <span className={styles.stageName}>{s}</span>
                    <span className={styles.stageState}>{main}</span>
                  </span>
                  {i < seg.stages.length - 1 && <span className={styles.stageArrow} aria-hidden="true" />}
                </span>
              </div>
            );
          })}
        </div>
        {j.child.length > 0 && (
          <p className={styles.cardNote}>
            <span className={clsx(styles.stageSq, styles.stageChild, styles.inlineSq)} aria-hidden="true" />
            {j.id === 'multiple'
              ? `${j.childWf} runs these, one child per instruction`
              : j.id === 'update'
                ? `${j.childWf} runs these, as a child, for the new payment`
                : `${j.childWf} runs these, as a child`}
          </p>
        )}
        {j.stop && <p className={styles.cardNote}>{j.stop.title}</p>}
        {j.tbd && <p className={styles.cardNote}>{j.tbd}</p>}
        {seg.after && <p className={styles.cardNote}>{seg.after}</p>}
      </div>
    </Cell>
  );
}

function RulerCell({seg}) {
  return (
    <Cell seg={seg} className={clsx(styles.ruler, seg.kind === 'wait' && styles.rulerGap)}>
      {(seg.ruler || []).map((r) => (
        <At seg={seg} at={r.at} key={r.t}>
          <span className={styles.tick} aria-hidden="true" />
          <span className={styles.tickText}>{r.t}</span>
        </At>
      ))}
    </Cell>
  );
}

function SystemsCell({seg}) {
  if (seg.kind !== 'run') {
    return (
      <Cell seg={seg}>
        {seg.kind === 'read' && <p className={styles.waitText}>No other system. The read goes to Oracle.</p>}
      </Cell>
    );
  }
  return (
    <Cell seg={seg}>
      {seg.stages.map((s) => {
        const list = systemsAt(seg.j, s);
        return (
          <At seg={seg} at={s} key={s}>
            {list.length === 0 ? (
              <span className={styles.none}>only Oracle and RTF</span>
            ) : (
              <ul className={styles.systems}>
                {list.map((x) => (
                  <li key={x.name}>
                    <Square kind={x.kind === 'cond' ? 'choice' : x.kind === 'child' ? 'child' : 'on'} />
                    {x.name}
                  </li>
                ))}
              </ul>
            )}
          </At>
        );
      })}
    </Cell>
  );
}

function OracleCell({seg}) {
  const rows = [];
  if (seg.kind === 'run') {
    seg.stages.forEach((s) => {
      const [main] = states(seg.j, s);
      const label = seg.payment?.[s] || (s === 'RequestConfirmation' ? 'link stored' : null);
      rows.push(
        <At seg={seg} at={s} key={`p-${s}`} className={styles.paymentRow}>
          <span className={styles.oracleNode} aria-hidden="true" />
          <span className={clsx(styles.oState, seg.j.child.includes(s) && styles.oStateChild)}>
            {s === 'RequestConfirmation' ? label : main}
          </span>
          {label && s !== 'RequestConfirmation' && <span className={styles.oSub}>{label}</span>}
        </At>,
      );
    });
  }
  return (
    <Cell seg={seg} className={styles.oracleCell}>
      {rows}
      {(seg.oracle || []).map((o) => (
        <At seg={seg} at={o.at} key={o.row + (o.st || '') + o.s} className={styles.oracleRow}>
          <span className={styles.oRow}>{o.row}</span>
          {o.st && <span className={styles.oChip}>{o.st}</span>}
          {o.s && <span className={styles.oSub}>{o.s}</span>}
        </At>
      ))}
    </Cell>
  );
}

function Board({journey}) {
  const segs = journey.segments.map(resolve);
  const runs = segs.map((s, i) => (s.kind === 'run' ? i : -1)).filter((i) => i >= 0);
  const columns = ['var(--js-label)', ...segs.map((s) => `minmax(0, ${s.weight}fr)`)].join(' ');
  const width = designWidth(segs);
  const system = journey.kind === 'system';
  const strata = [
    {key: 'customer', term: 'Customer', desc: system ? 'nobody waits' : 'what they do and see', Comp: CustomerCell},
    {key: 'onedata', term: 'One-Data', desc: 'the edge', Comp: OneDataCell},
    {key: 'entry', term: 'API and Router', desc: 'admit, pick, pin, place', Comp: EntryCell},
    {key: 'workflows', term: 'Workflows', desc: 'Temporal', Comp: WorkflowCell},
    ...(journey.days ? [{key: 'time', term: 'Time', desc: 'in days', Comp: RulerCell}] : []),
    {key: 'systems', term: 'Systems', desc: 'what each stage calls', Comp: SystemsCell, rails: runs.length > 0},
    {key: 'oracle', term: 'Oracle', desc: 'the source of truth', Comp: OracleCell},
  ];
  return (
    <div className={styles.scroller}>
      <div
        className={styles.board}
        style={{gridTemplateColumns: columns, '--js-design': width, minWidth: `calc(${width} * 10px)`}}>
        <div className={styles.phases}>
          <span />
          {segs.map((s, i) => (
            <div className={clsx(styles.phase, s.kind === 'wait' && styles.phaseWait)} key={i}>
              <span className={styles.phaseTerm}>{s.phase[0]}</span>
              <span className={styles.phaseNote}>{s.phase[1]}</span>
            </div>
          ))}
        </div>
        {strata.map(({key, term, desc, Comp, rails}) => (
          <div className={clsx(styles.stratum, styles[`stratum_${key}`], rails && styles.hasRails)} key={key}>
            <Label term={term} desc={desc} />
            {rails && (
              <div className={styles.rails} style={{gridColumn: `${runs[0] + 2} / ${runs[runs.length - 1] + 3}`}}>
                <span className={styles.rail}>PaymentStore → Oracle · every stage commits once</span>
                <span className={clsx(styles.rail, styles.railSoft)}>LifecycleEventActivities → RTF · every state change</span>
              </div>
            )}
            {segs.map((s, i) => (
              <Comp seg={s} key={i} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({days}) {
  return (
    <div className={styles.legend}>
      <span className={styles.legendItem}>
        <Square kind="on" />
        happens on this journey
      </span>
      <span className={styles.legendItem}>
        <Square kind="choice" />
        can happen, not always
      </span>
      <span className={styles.legendItem}>
        <Square kind="child" />
        run by a child workflow
      </span>
      <span className={styles.legendItem}>
        <span className={clsx(styles.legendLine, styles.trackOn)} aria-hidden="true" />
        the customer is waiting
      </span>
      <span className={styles.legendItem}>
        <span className={clsx(styles.legendLine, styles.trackOff)} aria-hidden="true" />
        nobody is waiting
      </span>
      <span className={styles.legendNote}>
        {days ? 'not to scale' : 'not to scale · days only on journeys that wait for a date'}
      </span>
    </div>
  );
}

function Index({pick, onPick, open}) {
  return (
    <nav className={clsx(styles.index, open && styles.indexOpen)} aria-label="Journeys" id="journey-strata-index">
      {GROUPS.map((g) => (
        <div className={styles.group} key={g.label}>
          <p className={styles.groupTerm}>{g.label}</p>
          <ul className={styles.groupList}>
            {g.journeys.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  className={styles.pick}
                  aria-pressed={pick === j.id}
                  onClick={() => onPick(j.id)}>
                  <Square kind={j.kind === 'system' ? 'choice' : 'on'} />
                  {j.term}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className={styles.indexKey}>
        <span>
          <Square kind="on" /> a customer starts it
        </span>
        <span>
          <Square kind="choice" /> a system does
        </span>
      </p>
    </nav>
  );
}

const VIEWS = [
  {id: 'journey', label: 'By journey'},
  {id: 'workflow', label: 'By workflow'},
];

export default function JourneyStrata() {
  const [view, setView] = useState('journey');
  const [pick, setPick] = useState('later');
  const [expanded, setExpanded] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const toolRef = useRef(null);
  const collapse = useCallback(() => setExpanded(false), []);
  useOverlay({open: expanded, onClose: collapse, focusRef: toolRef});

  // A link can open a journey or the workflow view: ?journey=bank, ?view=workflow.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (JOURNEY[q.get('journey')]) setPick(q.get('journey'));
    if (q.get('view') === 'workflow') setView('workflow');
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('journey', pick);
    if (view === 'workflow') url.searchParams.set('view', 'workflow');
    else url.searchParams.delete('view');
    window.history.replaceState(window.history.state, '', url);
  }, [pick, view]);

  const journey = JOURNEY[pick];
  return (
    <div className={styles.root}>
      <div className={styles.switchBar}>
        <div className={styles.switch} role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.switchBtn}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {view === 'workflow' ? (
        <RouteLedger />
      ) : (
        <div
          className={clsx(styles.wrap, expanded && styles.expanded)}
          role={expanded ? 'dialog' : undefined}
          aria-modal={expanded ? true : undefined}
          aria-label={expanded ? 'The complete picture, full screen' : undefined}>
          <div className={styles.layout}>
            <button
              type="button"
              className={styles.picker}
              aria-expanded={indexOpen}
              aria-controls="journey-strata-index"
              onClick={() => setIndexOpen((v) => !v)}>
              <span className={styles.pickerLabel}>Journey</span>
              <span className={styles.pickerValue}>{journey.term}</span>
              <span className={styles.pickerHint}>{indexOpen ? 'Close the list' : 'Choose another'}</span>
            </button>
            <Index
              pick={pick}
              open={indexOpen}
              onPick={(id) => {
                setPick(id);
                setIndexOpen(false);
              }}
            />
            <section className={styles.main} aria-label={`${journey.term}, through every layer`}>
              <div className={styles.head}>
                <div>
                  <p className={styles.kicker}>{journey.group}</p>
                  <p className={styles.title} role="heading" aria-level={2}>
                    {journey.term}
                  </p>
                  <p className={styles.meta}>{journey.meta.join(' · ')}</p>
                </div>
                <button
                  ref={toolRef}
                  type="button"
                  className={styles.expand}
                  aria-pressed={expanded}
                  onClick={() => setExpanded((v) => !v)}>
                  {expanded ? 'Close full screen' : 'Full screen'}
                </button>
              </div>
              <Board journey={journey} />
              <p className={clsx(styles.scrollHint, journey.segments.length > 5 && styles.scrollHintWide)}>
                Scroll sideways to follow the journey, or open it full screen.
              </p>
              <Legend days={journey.days} />
              {journey.next && (
                <p className={styles.next}>
                  {journey.next.text}{' '}
                  <button type="button" className={styles.nextLink} onClick={() => setPick(journey.next.to)}>
                    Open {JOURNEY[journey.next.to].term}
                  </button>
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
