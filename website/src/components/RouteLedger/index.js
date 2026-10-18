import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import useOverlay from '../../lib/useOverlay';
import styles from './styles.module.css';
import {
  ALL,
  BANDS,
  CORP,
  IFACE,
  IFACES,
  MOVE,
  ROAD,
  ROADS,
  STAGES,
  callDetail,
  calls,
  inboxUse,
  otherRoads,
  moveOf,
  router,
  routerLine,
  seq,
  uses,
} from './model';

/**
 * RouteLedger, the lens: every road through Billpay in one index, with one
 * road's card open beside it.
 *
 * The index lists every road, grouped by how work arrives. Each row shows
 * the trigger, where it lands, the Router's choice and the stages the road
 * runs, as a strip of squares. With nothing picked, every road shows the
 * same way. Pick a road and the rest grey out while its card follows it from
 * the trigger, through the Router's six steps, to every activity its stages
 * call. Pick an activity under the index and the roads that call it stay
 * lit instead.
 *
 * The board scales as one piece: every length is in em, and the font size
 * follows the container's width. The card opens level with the road it
 * belongs to, so the picked row runs straight into it. Below 860px of
 * container the card opens inline under its road instead, and the
 * activities fold into a list. The content is model.js, from the spec's
 * tables.
 */

const WIDE_AT = 860;

/* how far above its road's row a card starts, in em: enough for the curved
   join above the row to meet the card */
const CARD_LIFT = 1.4;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* the best kind of call each interface gets at each stage, across every
   road: what the activities map shows when nothing is picked */
const RANK = {call: 2, cond: 1};
const STATIC = Object.fromEntries(
  IFACES.map((f) => {
    const m = {};
    ROADS.forEach((j) => {
      Object.entries(calls(j, f)).forEach(([s, c]) => {
        if (c.kind === 'skip') return;
        const k = c.kind === 'cond' ? 'cond' : 'call';
        if (!m[s] || RANK[k] > RANK[m[s]]) m[s] = k;
      });
    });
    return [f.name, m];
  }),
);

/* a corporate payment's first workflow runs only these, then stops */
const CORP_STAGES = ['Capture', 'Verify'];

/* road j's calls to f, at only the given stages when a card shows part of it */
function callsAt(j, f, only) {
  const cl = calls(j, f);
  if (!only) return cl;
  return Object.fromEntries(Object.entries(cl).filter(([s]) => only.includes(s)));
}

/* Communication goes last in a stage's list: in Fulfil it is the last call */
const CALL_ORDER = [...IFACES.filter((f) => !f.rail && f.name !== 'CommunicationActivities'), IFACE.CommunicationActivities];

const LABEL =
  "The complete picture: every road through Billpay. An index lists each road, grouped by how work arrives: a caller waits, stored by One-Data then pulled, the allocations callback, work that falls due from a Work Tracker row, and the PAID drain, which a Schedule starts without the Router. Each road shows its trigger, where it lands, the Router's choice of cluster and start, and the stages it runs. Pick a road and its card opens, following it from the trigger through the Router's six steps to every activity its stages call, while the other roads grey out. Below the index, every activity interface with its system, its task queue and the stages that call it.";

/* Small monoline glyphs on a 24-unit grid, in the JourneyMap style, marking
   the door a request comes through: a core API endpoint, a dispatcher the
   governor paces, or rows waiting in One-Data's inbox. */
const GLYPHS = {
  api: ['M9 3.8v3.8', 'M15 3.8v3.8', 'M6.6 7.6h10.8v3a5.4 5.4 0 0 1-10.8 0z', 'M12 16v4.2'],
  dispatcher: ['M3.6 6.6h8', 'M3.6 12h8', 'M3.6 17.4h8', 'M14.4 12h6', 'M17.8 9.4l2.6 2.6-2.6 2.6'],
  inbox: [
    'M3.6 13.2V6.4a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v6.8',
    'M3.6 13.2h4.2l1.4 2.4h5.6l1.4-2.4h4.2v4.4a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z',
  ],
};

/* ---------------------------------------------------------------- hooks -- */

/* The width the lens gets, which decides wide or narrow, and a count that
   moves whenever the index changes size, so a card can line up with its
   road again after the type reflows. */
function useLayout(scrollerRef, indexRef) {
  const [layout, setLayout] = useState({width: WIDE_AT, tick: 0});
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      /* a width of 0 means the page is not laid out just now (a hidden tab,
         a print or capture pass): keep the last real layout */
      const width = scroller.getBoundingClientRect().width;
      if (width > 0) setLayout((l) => ({width, tick: l.tick + 1}));
    });
    ro.observe(scroller);
    if (indexRef.current) ro.observe(indexRef.current);
    return () => ro.disconnect();
  }, [scrollerRef, indexRef]);
  return layout;
}

function scrollTo(el, block) {
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({block, behavior: reduce ? 'auto' : 'smooth'});
}

/* after React has moved the card, bring a target into view */
function reveal(target, block) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollTo(target(), block)));
}

/* ---------------------------------------------------------------- parts -- */

function Name({text}) {
  return text.split('|').map((p, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <React.Fragment key={i}>
      {i > 0 && <wbr />}
      {p}
    </React.Fragment>
  ));
}

/* a path that breaks before a segment, and never inside {payment-id} */
function Path({text}) {
  return text
    .split('/')
    .filter(Boolean)
    .map((p, i) => (
      // eslint-disable-next-line react/no-array-index-key
      <React.Fragment key={i}>
        {i > 0 && <wbr />}
        <span className={p.startsWith('{') ? styles.seg : undefined}>/{p}</span>
      </React.Fragment>
    ));
}

function Glyph({kind}) {
  return (
    <span className={clsx(styles.glyphBox, styles[`glyph_${kind}`])} aria-hidden="true">
      <svg viewBox="0 0 24 24" className={styles.glyph}>
        {GLYPHS[kind].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

function Api({method, path, big}) {
  return (
    <span className={clsx(styles.api, big && styles.apiBig)}>
      <Glyph kind="api" />
      <span className={styles.method}>{method}</span>
      <span className={styles.path}>
        <Path text={path} />
      </span>
    </span>
  );
}

function Icon({name}) {
  const d = {
    expand: 'M2.5 6V2.5H6 M10 2.5h3.5V6 M13.5 10v3.5H10 M6 13.5H2.5V10',
    collapse: 'M6 2.5V6H2.5 M13.5 6H10V2.5 M10 13.5V10h3.5 M2.5 10H6v3.5',
    close: 'M4 4l8 8 M12 4l-8 8',
    arrow: 'M3 8h9.5 M9 4.5L12.5 8 9 11.5',
    chevron: 'M4 6.5l4 4 4-4',
  }[name];
  return (
    <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* a stage name with the state it moves the payment to */
function Moves({to}) {
  return (
    <span className={styles.move}>
      <span aria-hidden="true">→ </span>
      <span className={styles.srOnly}>moves the payment to </span>
      {to}
    </span>
  );
}

/* ------------------------------------------------------------ the index -- */

/* only: the stages to show, when a card shows part of the road */
function Strip({j, act, only}) {
  const at = act ? new Set(Object.keys(calls(j, act)).filter((s) => calls(j, act)[s].kind !== 'skip')) : null;
  const ownOn = j.own.length > 0 && !only && (!at || j.own.some((s) => at.has(s)));
  return (
    <span className={styles.strip} aria-hidden="true">
      {STAGES.map((s) => {
        const on = j.stages.includes(s) && (!at || at.has(s)) && (!only || only.includes(s));
        let kind = 'empty';
        if (on) kind = j.cond[s] ? 'cond' : j.child.includes(s) ? 'child' : 'call';
        return <i key={s} className={clsx(styles.sq, styles[kind])} />;
      })}
      <i className={clsx(styles.sq, styles.ownSq, ownOn ? styles.call : styles.empty)} />
    </span>
  );
}

function roadLabel(j) {
  const head = `${j.name}${j.tag ? `, ${j.tag}` : ''}. ${j.lead}`;
  const how = j.band.drain ? 'Not routed: a Schedule starts it' : `${j.cluster} cluster, ${j.band.start}`;
  return `${head} ${how}. Stages: ${seq(j).join(', ')}.`;
}

function RoadRow({j, on, dim, act, only, onRoad, rowRef}) {
  return (
    <button
      ref={rowRef}
      type="button"
      className={clsx(styles.road, styles[j.cluster], on && styles.roadOn, dim && styles.dim)}
      aria-pressed={on}
      aria-label={roadLabel(j)}
      onClick={() => onRoad(j.id)}>
      <span className={styles.roadName}>
        <i className={styles.tone} />
        <span className={styles.wf}>
          <Name text={j.wf} />
          {j.tag && <span className={styles.tag}>{j.tag}</span>}
        </span>
      </span>
      <span className={styles.choice}>
        {j.band.drain ? (
          'no Router, a Schedule'
        ) : (
          <>
            <b>{j.cluster}</b>, {j.band.start}
          </>
        )}
      </span>
      <Strip j={j} act={act} only={only} />
    </button>
  );
}

function writers(req) {
  return req.wrote ? [...new Set(req.wrote.map((id) => ROAD[id].name))] : null;
}

function RequestHead({req, band, dim}) {
  const names = writers(req);
  return (
    <div className={clsx(styles.reqHead, dim && styles.dim)}>
      <div className={styles.trig}>
        {req.row ? (
          <span className={styles.rowName}>
            <span className={styles.mono}>{req.row}</span> <span className={styles.from}>row</span>
          </span>
        ) : (
          req.fn.map((f) => (
            <span key={f} className={styles.fnName}>
              <Name text={f} />
            </span>
          ))
        )}
        {!req.row && <span className={styles.from}>{req.ready ? req.from : `from ${req.from}`}</span>}
        {req.aside && <span className={styles.from}>{req.aside}</span>}
      </div>
      <div className={styles.where}>
        {req.api && <Api method={req.api[0]} path={req.api[1]} />}
        {req.ready && (
          <span className={styles.door}>
            <Glyph kind="inbox" />
            READY rows in One-Data&apos;s inbox
          </span>
        )}
        {req.inbox && (
          <>
            <span className={styles.door}>
              <Glyph kind="inbox" />
              One-Data&apos;s inbox
            </span>
            <span className={styles.from}>pulled by the {req.inbox}</span>
          </>
        )}
        {req.row && (
          <span className={styles.door}>
            <Glyph kind="dispatcher" />
            {req.by}
          </span>
        )}
      </div>
      {req.row && (
        <div className={styles.rowMeta}>
          <span>
            written by{' '}
            {names ? (
              names.map((n, i) => (
                <React.Fragment key={n}>
                  {i > 0 && ' or '}
                  <span className={styles.mono}>{n}</span>
                </React.Fragment>
              ))
            ) : (
              <>{req.writer}</>
            )}
          </span>
          <span>
            began at{' '}
            {req.origin.map((o, i) => (
              <React.Fragment key={o}>
                {i > 0 && ' or '}
                <span className={styles.mono}>
                  <Name text={o} />
                </span>
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
      {band.drain && <span className={styles.srOnly}>Not routed.</span>}
    </div>
  );
}

/* ------------------------------------------------------------- the card -- */

function CardTop({term, desc, tag, toneClass, onClear}) {
  return (
    <div className={styles.cardTop}>
      <span className={styles.cardBand}>
        <b>{term}</b> {desc}
      </span>
      {tag && <span className={clsx(styles.clusterTag, toneClass)}>{tag}</span>}
      {onClear && (
        <button type="button" className={styles.close} onClick={onClear} aria-label="Show all roads" title="Show all (Esc)">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

function Badge({n, kind}) {
  return (
    <span className={clsx(styles.badge, kind && styles[`badge_${kind}`])} aria-hidden="true">
      {kind === 'then' ? <Icon name="arrow" /> : <span className={styles.badgeNum}>{n}</span>}
    </span>
  );
}

function AccountSwitch({corp, setCorp}) {
  return (
    <span className={styles.switch} role="group" aria-label="Account type">
      <span className={styles.switchLabel} aria-hidden="true">
        Account type
      </span>
      <span className={styles.switchTrack}>
        {['CONSUMER', 'CORPORATE'].map((v) => {
          const on = (v === 'CORPORATE') === corp;
          return (
            <button
              key={v}
              type="button"
              className={clsx(styles.switchBtn, on && styles.switchOn)}
              aria-pressed={on}
              onClick={() => setCorp(v === 'CORPORATE')}>
              {v}
            </button>
          );
        })}
      </span>
    </span>
  );
}

function RoadLink({id, children, go}) {
  return (
    <button type="button" className={styles.inlineLink} onClick={() => go(id)}>
      {children}
    </button>
  );
}

/* 1: what starts the road */
function Trigger({j, n, brief, go}) {
  const {req} = j;
  if (req.ready) {
    return (
      <li className={styles.step}>
        <Badge n={n} />
        <p className={styles.stepHead}>
          <Glyph kind="inbox" />
          <b>READY rows in One-Data&apos;s inbox</b>
        </p>
        <p className={styles.stepNote}>
          <span className={styles.mono}>CreateMoneyMovementEventHandler.v1</span> records settlements from MR/M3, and{' '}
          <span className={styles.mono}>CreateAccountsReceivableTransactionEventHandler.v1</span> records AR postings from
          GAR. A row is READY once it has both.
        </p>
      </li>
    );
  }
  if (req.row) {
    const names = writers(req);
    return (
      <li className={styles.step}>
        <Badge n={n} />
        <p className={styles.stepHead}>
          <span className={styles.rowChip}>{req.row}</span>
          <span>a Work Tracker row in Oracle, now due</span>
        </p>
        <p className={styles.stepNote}>
          written by{' '}
          {names ? (
            names.map((name, i) => (
              <React.Fragment key={name}>
                {i > 0 && ' or '}
                <RoadLink id={req.wrote.find((id) => ROAD[id].name === name)} go={go}>
                  {name}
                </RoadLink>
              </React.Fragment>
            ))
          ) : (
            <>{req.writer}</>
          )}
          , {req.written}
        </p>
        <p className={styles.stepNote}>
          a road that began at{' '}
          {req.origin.map((o, i) => (
            <React.Fragment key={o}>
              {i > 0 && ' or '}
              <span className={styles.mono}>
                  <Name text={o} />
                </span>
            </React.Fragment>
          ))}
        </p>
        <p className={styles.stepNote}>due {req.due}</p>
      </li>
    );
  }
  return (
    <li className={styles.step}>
      <Badge n={n} />
      <p className={styles.stepHead}>
        <span>{req.calls}</span>
        <b>
          <Name text={req.fn[0]} />
        </b>
      </p>
      {!brief && (
        <p className={styles.stepNote}>
          One-Data {req.handler ? 'event handler' : 'function'}
          {req.aside ? `, ${req.aside}` : ''}: {req.does}.
        </p>
      )}
    </li>
  );
}

/* 2: where it lands */
function Lands({j, n, brief}) {
  const {req, band} = j;
  let head;
  let note;
  if (band.drain) {
    head = (
      <>
        <Glyph kind="dispatcher" />
        <b>A Schedule, every 30 seconds</b>
      </>
    );
    note = 'Overlap policy SKIP, so only one run is ever active. It starts ProcessPaidEvents itself: the PAID drain never goes through the Router.';
  } else if (req.api) {
    head = <Api method={req.api[0]} path={req.api[1]} big />;
    note = req.stores
      ? 'billpay-core endpoint: it stores the batch in allocation_batch, then hands the request to the Router.'
      : 'billpay-core endpoint: it hands the request to the Router.';
  } else if (req.inbox) {
    head = (
      <>
        <Glyph kind="inbox" />
        <b>One-Data&apos;s inbox</b>
      </>
    );
    note = `The ${req.inbox} pulls it every minute, at the governor's pace, on control queue ${req.ctl}, and calls the Router.`;
  } else {
    head = (
      <>
        <Glyph kind="dispatcher" />
        <b>{req.by}</b>
      </>
    );
    note = `${req.runs}, on control queue ${req.ctl}, at the governor's pace. It claims the row and calls the Router.`;
  }
  return (
    <li className={clsx(styles.step, band.drain && styles.segTone)}>
      <Badge n={n} />
      <p className={styles.stepHead}>{head}</p>
      {!brief && <p className={styles.stepNote}>{note}</p>}
    </li>
  );
}

/* 3: the Router, its six steps or one line */
function RouterStep({j, n, corp, folded, onToggle}) {
  if (corp) {
    return (
      <li className={clsx(styles.step, styles.segTone)}>
        <Badge n={n} kind="router" />
        <p className={styles.stepHead}>
          <b>Router</b>
          <span className={styles.quiet}>{routerLine(j)}</span>
        </p>
        <p className={styles.stepNote}>
          Resolves the account type to <span className={styles.chip}>CORPORATE</span> (an example).
        </p>
      </li>
    );
  }
  if (folded !== null && folded) {
    return (
      <li className={clsx(styles.step, styles.segTone)}>
        <Badge n={n} kind="router" />
        <p className={styles.stepHead}>
          <b>Router</b>
          <span className={styles.quiet}>{routerLine(j)}</span>
        </p>
        <button type="button" className={styles.more} aria-expanded="false" onClick={onToggle}>
          Show its six steps <Icon name="chevron" />
        </button>
      </li>
    );
  }
  return (
    <li className={clsx(styles.step, styles.segTone, styles.stepRouter)}>
      <Badge n={n} kind="router" />
      <div className={styles.routerPanel}>
        <i className={styles.routerBar} aria-hidden="true" />
        <p className={styles.stepHead}>
          <b>Router</b>
          <span className={styles.quiet}>six steps, with this road&apos;s outcome</span>
          {folded === false && (
            <button type="button" className={styles.more} aria-expanded="true" onClick={onToggle}>
              Hide them <Icon name="chevron" />
            </button>
          )}
        </p>
        <dl className={styles.rSteps}>
          {router(j).map((st) => (
            <React.Fragment key={st.name}>
              <dt className={styles.rName}>{st.name}</dt>
              <dd className={styles.rBody}>
                {st.chips ? (
                  st.chips.length > 0 && (
                    <span className={styles.chips}>
                      {st.chips.map((c) => (
                        <span key={c} className={styles.chip}>
                          {c}
                        </span>
                      ))}
                    </span>
                  )
                ) : (
                  <span className={styles.rMain}>{st.main}</span>
                )}
                {st.note && <span className={styles.rNote}>{st.note}</span>}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </li>
  );
}

/* the key an open activity is kept under: its stage, or "rail" for the
   calls every stage makes */
const callKey = (s, f) => `${s || 'rail'}|${f.name}`;

/* An activity opened in place: where it runs, what this call does here,
   and the way out to every road that calls it. */
function CallDetail({id, open, j, f, s, c, pickAct}) {
  const n = otherRoads(j, f);
  return (
    <div id={id} className={styles.detail} hidden={!open}>
      {callDetail(j, f, s, c).map((t) => (
        <p key={t} className={styles.detailLine}>
          {t}
        </p>
      ))}
      <p className={styles.detailLine}>
        {n ? `${n} other ${n === 1 ? 'road calls' : 'roads call'} it. ` : 'No other road calls it. '}
        <button type="button" className={styles.textLink} onClick={() => pickAct(f.name)}>
          See every road that calls it
        </button>
      </p>
    </div>
  );
}

function CallLine({j, f, s, c, open, onToggle, pickAct}) {
  const showQueue = j.cluster === 'Offline' && f.queue.startsWith('ds-');
  const id = `rl-${j.id}-${s}-${f.name}`;
  return (
    <li>
      <button
        type="button"
        className={clsx(styles.callBtn, styles[c.kind], open && styles.callOpen)}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onToggle(callKey(s, f))}>
        <i className={styles.callSq} aria-hidden="true" />
        <span className={styles.callName}>{f.name}</span>
        <span className={styles.sys}>{f.system}</span>
        {showQueue && <span className={styles.queue}>{f.queue}</span>}
        {c.kind === 'skip' && <span className={styles.srOnly}>, never called here:</span>}
        {c.kind === 'child' && <span className={styles.srOnly}>, in a child workflow</span>}
        {c.note && <span className={styles.callNote}>{c.note}</span>}
        <span className={styles.chev}>
          <Icon name="chevron" />
        </span>
      </button>
      <CallDetail id={id} open={open} j={j} f={f} s={s} c={c} pickAct={pickAct} />
    </li>
  );
}

/* one of the calls every stage makes */
function RailLine({j, f, note, open, onToggle, pickAct}) {
  const id = `rl-${j.id}-rail-${f.name}`;
  return (
    <li>
      <button
        type="button"
        className={clsx(styles.railLine, open && styles.callOpen)}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onToggle(callKey(null, f))}>
        <i className={styles.railSq} aria-hidden="true" />
        <span className={styles.callName}>{f.name}</span>
        <b className={styles.railSys}>{f.system}</b>
        <span className={styles.sys}>{note}</span>
        <span className={styles.chev}>
          <Icon name="chevron" />
        </span>
      </button>
      <CallDetail id={id} open={open} j={j} f={f} s={null} c={null} pickAct={pickAct} />
    </li>
  );
}

/* the calls every stage of road j makes: PaymentStore and RTF, and One-Data's
   inbox where the road reads it */
function railsOf(j) {
  return [IFACE.PaymentStore, IFACE.LifecycleEventActivities, ...(inboxUse(j) ? [IFACE.InboxActivities] : [])];
}

/* every activity a card can open, as keys */
function cardKeys(j, stages, corp) {
  const keys = [];
  stages.forEach((s) =>
    CALL_ORDER.forEach((f) => {
      if (calls(j, f)[s]) keys.push(callKey(s, f));
    }),
  );
  if (!corp) railsOf(j).forEach((f) => keys.push(callKey(null, f)));
  return keys;
}

/* 4: the workflow, its stages, and every call they make */
function StagesStep({j, n, stages, corp, corpRow, open, onToggle, pickAct}) {
  const offline = j.cluster === 'Offline';
  return (
    <li className={clsx(styles.step, styles.segTone)}>
      <Badge n={n} />
      <p className={styles.stepHead}>
        <span className={clsx(styles.mono, styles.strong)}>{j.band.drain ? j.name : <Name text={j.wf} />}</span>
        <span className={styles.quiet}>runs {stages.length === 1 ? 'this stage' : 'these stages'}</span>
      </p>
      <p className={styles.stepNote}>
        {offline
          ? "Each call runs on its system's task queue, shown beside it."
          : "Every call runs on online-wf, the Online cluster's main task queue, unless a SEPA run has capped its downstream."}
      </p>
      {!corp && j.first && <p className={styles.stepText}>{j.first}</p>}
      {!corp && j.tbd && <p className={styles.stepText}>{j.tbd}</p>}
      <ol className={styles.stageList}>
        {stages.map((s) => {
          const child = j.child.includes(s);
          const cond = Boolean(j.cond[s]);
          const list = CALL_ORDER.map((f) => [f, calls(j, f)[s]]).filter(([, c]) => c);
          return (
            <li key={s} className={styles.stage}>
              <i className={clsx(styles.stageMark, child && styles.child, cond && styles.cond)} aria-hidden="true" />
              <p className={styles.stageHead}>
                <b className={styles.stageName}>{s}</b>
                <Moves to={moveOf(j, s)} />
              </p>
              {child && <p className={styles.srOnly}>A child workflow runs this stage.</p>}
              {cond && <p className={styles.condNote}>{j.cond[s]}</p>}
              {!corp && j.notes[s] && <p className={styles.stageNote}>{j.notes[s]}</p>}
              {list.length ? (
                <ul className={styles.calls}>
                  {list.map(([f, c]) => (
                    <CallLine
                      key={f.name}
                      j={j}
                      f={f}
                      s={s}
                      c={c}
                      open={open.has(callKey(s, f))}
                      onToggle={onToggle}
                      pickAct={pickAct}
                    />
                  ))}
                </ul>
              ) : (
                <p className={styles.quietLine}>no call beyond Oracle and RTF</p>
              )}
            </li>
          );
        })}
      </ol>
      {corp && (
        <p className={clsx(styles.stepHead, styles.gapTop)}>
          <span className={styles.rowChip}>ALLOC_REQUEST</span>
          <span>{corpRow}</span>
        </p>
      )}
      {!corp && j.after && <p className={styles.stepText}>{j.after}</p>}
      {!corp && j.stop && (
        <div className={styles.stop}>
          <i className={styles.stopMark} aria-hidden="true" />
          <p className={styles.stopTitle}>{j.stop.title}</p>
          <p className={styles.stepNote}>{j.stop.text}</p>
        </div>
      )}
      {!corp && (
        <ul className={styles.rails}>
          {railsOf(j).map((f) => (
            <RailLine
              key={f.name}
              j={j}
              f={f}
              note={f.name === 'InboxActivities' ? inboxUse(j) : f.note}
              open={open.has(callKey(null, f))}
              onToggle={onToggle}
              pickAct={pickAct}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* the last step: the road that follows, or where the story stops */
function Tail({j, go}) {
  if (j.then.length) {
    return (
      <li className={clsx(styles.step, styles.stepThen)}>
        <Badge kind="then" />
        {j.then.map((t) => (
          <div key={t.to} className={styles.thenRow}>
            <p className={styles.stepHead}>
              <b>Then</b>
              <span className={styles.quiet}>{t.text}</span>
            </p>
            <button type="button" className={styles.go} onClick={() => go(t.to)}>
              <span>{ROAD[t.to].name}</span>
              {ROAD[t.to].tag && <span className={styles.goTag}>{ROAD[t.to].tag}</span>}
              <Icon name="arrow" />
            </button>
          </div>
        ))}
      </li>
    );
  }
  return (
    <li className={clsx(styles.step, styles.stepEnd)}>
      <i className={styles.endMark} aria-hidden="true" />
      <p className={styles.stopTitle}>{j.end || 'Its later steps are still to be defined.'}</p>
    </li>
  );
}

/* where a corporate payment's first workflow stops */
function CorpStop() {
  return (
    <li className={clsx(styles.step, styles.stepEnd)}>
      <i className={styles.endMark} aria-hidden="true" />
      <p className={styles.stopTitle}>The workflow ends here.</p>
      <p className={styles.stepNote}>No Execute and no Fulfil. Dispatchers start every later step.</p>
    </li>
  );
}

function CorpNext({j, mode, go}) {
  return (
    <div className={styles.next}>
      <p className={styles.nextHead}>What happens next</p>
      <p className={styles.stepNote}>Each later step starts from a Work Tracker row or a call. No workflow waits for the next.</p>
      <ol className={styles.timeline}>
        {mode.path.map((p) => {
          const r = ROAD[p.to];
          return (
            <li key={p.state} className={clsx(styles.tStop, styles[r.cluster])}>
              <span className={styles.tState}>{p.state}</span>
              <i className={styles.tMark} aria-hidden="true" />
              <div className={styles.tBody}>
                <p className={styles.tHead}>
                  {p.to === j.id ? (
                    <span className={clsx(styles.mono, styles.strong)}>{r.name}</span>
                  ) : (
                    <button type="button" className={styles.inlineLink} onClick={() => go(p.to)}>
                      {r.name}
                    </button>
                  )}
                  <span className={styles.quiet}>{p.how}</span>
                </p>
                <p className={styles.tDid}>{p.did}</p>
                {p.quiet && <p className={styles.quietLine}>{p.quiet}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* open: the activities opened in this card. The lens keeps it, so the card
   can move between the side and the row without closing them. */
function RoadCard({j, corp, setCorp, open, setOpen, go, pickAct, onClear, wide}) {
  const [routerOpen, setRouterOpen] = useState(false);
  useEffect(() => setRouterOpen(false), [j.id]);
  const mode = corp && j.corp ? CORP[j.corp] : null;
  const stages = mode ? CORP_STAGES : seq(j);
  const keys = cardKeys(j, stages, Boolean(mode));
  const allOpen = keys.length > 0 && keys.every((k) => open.has(k));
  const toggle = useCallback(
    (key) =>
      setOpen((prev) => {
        const nextOpen = new Set(prev);
        if (nextOpen.has(key)) nextOpen.delete(key);
        else nextOpen.add(key);
        return nextOpen;
      }),
    [setOpen],
  );
  let n = 0;
  const next = () => {
    n += 1;
    return n;
  };
  const folded = wide ? null : !routerOpen;
  return (
    <article className={clsx(styles.card, styles[j.cluster])} aria-label={`Card for ${j.name}${j.tag ? `, ${j.tag}` : ''}`}>
      <CardTop
        term={j.band.term}
        desc={j.band.desc}
        tag={`${j.cluster} cluster`}
        toneClass={styles[j.cluster]}
        onClear={onClear}
      />
      <p className={styles.cardTitle}>
        <span>
          <Name text={j.wf} />
        </span>
        {j.tag && <span className={styles.titleTag}>{j.tag}</span>}
      </p>
      <div className={styles.leadRow}>
        <p className={styles.cardLead}>{mode ? mode.lead : j.lead}</p>
        <span className={styles.cardTools}>
          {j.corp && <AccountSwitch corp={corp} setCorp={setCorp} />}
          <button
            type="button"
            className={clsx(styles.expandAll, allOpen && styles.expandAllOn)}
            aria-label={allOpen ? 'Collapse all activities' : 'Expand all activities'}
            onClick={() => setOpen(allOpen ? new Set() : new Set(keys))}>
            <Icon name="chevron" />
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </span>
      </div>
      <ol className={styles.steps}>
        <Trigger j={j} n={next()} brief={Boolean(mode)} go={go} />
        <Lands j={j} n={next()} brief={Boolean(mode)} />
        {!j.band.drain && (
          <RouterStep
            j={j}
            n={next()}
            corp={Boolean(mode)}
            folded={folded}
            onToggle={() => setRouterOpen((v) => !v)}
          />
        )}
        <StagesStep
          j={j}
          n={next()}
          stages={stages}
          corp={Boolean(mode)}
          corpRow={mode && mode.row}
          open={open}
          onToggle={toggle}
          pickAct={pickAct}
        />
        {mode ? <CorpStop /> : <Tail j={j} go={go} />}
      </ol>
      {mode && <CorpNext j={j} mode={mode} go={go} />}
    </article>
  );
}

/* --------------------------------------------------- the activity card -- */

const RTF_EXCEPTIONS = [
  'RequestConfirmation changes no state when it gets the link, so it sends none; with no link it sends DECLINED.',
  'ReceiveAllocations sends one only for the batch that completes the amount.',
  'Fulfil sends its event before its commit, because PROCESSED means it has gone out.',
  'Settle sends the PAID events after the batch commits.',
];

function ActCard({f, go, onClear}) {
  const byStage = {};
  const skips = [];
  ROADS.forEach((j) => {
    Object.entries(calls(j, f)).forEach(([s, c]) => {
      if (c.kind === 'skip') skips.push({j, s, note: c.note});
      else (byStage[s] = byStage[s] || []).push({j, c});
    });
  });
  const roads = ROADS.filter((j) => uses(j, f));
  const inbox = f.name === 'InboxActivities';
  return (
    <article className={styles.card} aria-label={`Card for ${f.name}`}>
      <CardTop term="Activity" desc="picked in the activities" tag={f.queue} toneClass={styles.Offline} onClear={onClear} />
      <p className={styles.cardTitle}>{f.name}</p>
      <p className={styles.cardLead}>
        {f.system}.{' '}
        {f.rail
          ? `Every road calls it, at every stage.`
          : `${roads.length} ${roads.length === 1 ? 'road calls' : 'roads call'} it${inbox ? ', outside any stage' : ''}.`}
      </p>
      {f.note && !f.rail && !skips.length && (
        <p className={clsx(styles.stepNote, styles.gapTop)}>Note: {f.note}.</p>
      )}

      {f.rail && f.name === 'PaymentStore' && (
        <p className={clsx(styles.stepText, styles.gapTop)}>
          It is the only code that reaches Oracle, and it runs as a local activity. Each stage commits its new state,
          a timeline entry and its Work Tracker rows in one guarded transaction.
        </p>
      )}
      {f.rail && f.name === 'LifecycleEventActivities' && (
        <>
          <p className={clsx(styles.stepText, styles.gapTop)}>
            After each commit the workflow sends the stage&apos;s lifecycle event to RTF, and waits for it, so each
            payment&apos;s events arrive in order. Four stages differ:
          </p>
          <ul className={styles.plainList}>
            {RTF_EXCEPTIONS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}

      {inbox && (
        <ul className={clsx(styles.roadChips, styles.gapTop)}>
          {roads.map((j) => (
            <li key={j.id}>
              <button type="button" className={clsx(styles.roadChip, styles[j.cluster])} onClick={() => go(j.id)}>
                <i className={clsx(styles.chipSq, styles.call)} aria-hidden="true" />
                <span className={styles.chipName}>{j.name}</span>
                {j.tag && <span className={styles.chipNote}>{j.tag}</span>}
                <span className={styles.chipNote}>{inboxUse(j)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!f.rail && !inbox && (
        <ol className={styles.actStages}>
          {ALL.filter((s) => byStage[s]).map((s) => (
            <li key={s}>
              <p className={styles.stageHead}>
                <i className={styles.actMark} aria-hidden="true" />
                <b className={styles.stageName}>{s}</b>
                <Moves to={MOVE[s]} />
              </p>
              <ul className={styles.roadChips}>
                {byStage[s].map(({j, c}) => (
                  <li key={j.id}>
                    <button type="button" className={clsx(styles.roadChip, styles[j.cluster])} onClick={() => go(j.id)}>
                      <i className={clsx(styles.chipSq, styles[c.kind])} aria-hidden="true" />
                      <span className={styles.chipName}>{j.name}</span>
                      {j.tag && <span className={styles.chipNote}>{j.tag}</span>}
                      {c.note && <span className={styles.chipNote}>{c.note}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {skips.length > 0 && (
        <ul className={styles.skips}>
          {skips.map(({j, s, note}) => (
            <li key={`${j.id}-${s}`}>
              <i className={styles.skipMark} aria-hidden="true" />
              <button type="button" className={styles.inlineLink} onClick={() => go(j.id)}>
                {j.name}
              </button>
              {j.tag && <span className={styles.quiet}>{j.tag}</span>}
              <span className={styles.quiet}>
                never at {s}: {note}
              </span>
            </li>
          ))}
        </ul>
      )}

      {f.queue.startsWith('ds-') && (
        <p className={clsx(styles.quietLine, styles.gapTop)}>On the Online cluster these calls run on online-wf, its main task queue, unless a SEPA run has capped this downstream.</p>
      )}
      {f.name === 'InboxActivities' && (
        <p className={clsx(styles.quietLine, styles.gapTop)}>
          ProcessMissingPaidEvents calls it too, to hand an event it finds to its One-Data handler.
        </p>
      )}
    </article>
  );
}

/* --------------------------------------------- with nothing picked yet -- */

const ROUTER_STEPS = ['Admit', 'Pick the journey', 'Resolve behaviors', 'Pin the plan key', 'Place', 'Start'];

function Overview() {
  return (
    <article className={styles.card} aria-label="How a card reads">
      <CardTop term="Every road" desc={`${ROADS.length} roads, ${IFACES.length} activity interfaces`} />
      <p className={clsx(styles.cardTitle, styles.titleSans)}>Pick a road to follow it</p>
      <p className={styles.cardLead}>
        Its card opens here and the other roads grey out. Every card reads the same way, top to bottom.
      </p>
      <ol className={clsx(styles.steps, styles.Online)}>
        <li className={styles.step}>
          <Badge n={1} />
          <p className={styles.stepHead}>
            <b>What starts it</b>
          </p>
          <p className={styles.stepNote}>
            A One-Data function a sender calls, an event One-Data stores, or a Work Tracker row that falls due.
          </p>
        </li>
        <li className={styles.step}>
          <Badge n={2} />
          <p className={styles.stepHead}>
            <b>Where it lands</b>
          </p>
          <p className={styles.stepNote}>A billpay-core endpoint, One-Data&apos;s inbox, or a dispatcher the governor paces.</p>
        </li>
        <li className={clsx(styles.step, styles.segTone)}>
          <Badge n={3} kind="router" />
          <p className={styles.stepHead}>
            <b>The Router</b>
          </p>
          <p className={styles.stepNote}>
            It picks the workflow, the cluster and how the workflow starts, in six steps. The PAID drain is the one
            road it never sees.
          </p>
          <span className={clsx(styles.chips, styles.chipsPill, styles.gapTop)}>
            {ROUTER_STEPS.map((s) => (
              <span key={s} className={styles.chip}>
                {s}
              </span>
            ))}
          </span>
        </li>
        <li className={clsx(styles.step, styles.segTone)}>
          <Badge n={4} />
          <p className={styles.stepHead}>
            <b>The stages</b>
          </p>
          <p className={styles.stepNote}>
            Each stage moves the payment to its next state. The card names every activity it calls and the system
            behind it.
          </p>
        </li>
        <li className={clsx(styles.step, styles.stepThen)}>
          <Badge kind="then" />
          <p className={styles.stepHead}>
            <b>Then</b>
          </p>
          <p className={styles.stepNote}>The road that comes next, one click away.</p>
        </li>
      </ol>
      <p className={clsx(styles.quietLine, styles.gapTop)}>
        Or pick an activity under the index to see every road that calls it.
      </p>
    </article>
  );
}

/* ------------------------------------------------------ the activities -- */

function Cell({kind, small}) {
  if (!kind) return <span className={styles.mxCell} />;
  return (
    <span className={styles.mxCell}>
      <i className={clsx(styles.mq, styles[kind], small && styles.small)} />
    </span>
  );
}

function Matrix({j, only, actName, onAct}) {
  const lanes = j ? new Set(seq(j).filter((s) => !only || only.includes(s))) : null;
  const col = (s) => {
    const i = ALL.indexOf(s);
    return i < STAGES.length ? 3 + i : 4 + i;
  };
  return (
    <div className={styles.mxWrap}>
      <div className={clsx(styles.mx, j && styles[j.cluster])}>
        <div className={styles.mxHead} aria-hidden="true">
          <span className={styles.mxHLabel} style={{gridColumn: 1}}>
            Interface
          </span>
          <span className={styles.mxHLabel} style={{gridColumn: 2}}>
            System
          </span>
          {ALL.map((s) => (
            <span
              key={s}
              className={clsx(styles.slant, STAGES.includes(s) ? styles.slantCore : styles.slantOwn, lanes && lanes.has(s) && styles.slantLit)}
              style={{gridColumn: col(s)}}>
              <span>{s}</span>
            </span>
          ))}
          <span className={styles.mxHLabel} style={{gridColumn: 17}}>
            Task queue
          </span>
          <span className={styles.mxHLabel} style={{gridColumn: 18}}>
            Notes
          </span>
        </div>
        <div className={styles.mxBody}>
          {lanes && (
            <div className={styles.mxLanes} aria-hidden="true">
              {[...lanes].map((s) => (
                <i key={s} className={styles.mxLane} style={{gridColumn: col(s)}} />
              ))}
            </div>
          )}
          {IFACES.map((f, i) => {
            const cl = j ? callsAt(j, f, only) : null;
            const lit = j ? (f.name === 'InboxActivities' ? uses(j, f) : Object.values(cl).some((c) => c.kind !== 'skip')) : actName === f.name;
            const picked = actName === f.name;
            const exc = j ? Object.entries(j.exc).find(([k]) => k.endsWith(`|${f.name}`)) : null;
            const inbox = f.name === 'InboxActivities' && j ? inboxUse(j) : null;
            const note = exc ? exc[1].note : inbox || f.note;
            return (
              <button
                key={f.name}
                type="button"
                className={clsx(
                  styles.mxRow,
                  i % 2 === 0 && styles.mxStripe,
                  lit && styles.mxLit,
                  picked && styles.mxPicked,
                )}
                aria-pressed={picked}
                aria-label={`${f.name}, ${f.system}, ${f.queue}. ${
                  f.rail
                    ? 'Called by every stage.'
                    : f.at.length
                      ? `Called at ${ALL.filter((s) => STATIC[f.name][s]).join(', ')}.`
                      : 'Called outside the stages.'
                }${j ? (lit ? ` ${j.name} calls it.` : ` ${j.name} does not call it.`) : ''}`}
                onClick={() => onAct(f.name)}>
                <span className={styles.mxIf}>
                  <i className={styles.mxBar} />
                  {f.name}
                </span>
                <span className={styles.mxSys}>{f.system}</span>
                {f.rail && (
                  <>
                    <i className={styles.mxRail} style={{gridColumn: '3 / 8'}} />
                    <i className={clsx(styles.mxRail, styles.mxRailOwn)} style={{gridColumn: '9 / 17'}} />
                  </>
                )}
                {ALL.map((s) => {
                  const st = STATIC[f.name][s];
                  let kind = null;
                  let small = false;
                  if (cl) {
                    const c = cl[s];
                    if (c) {
                      kind = c.kind;
                      small = c.kind === 'cond';
                    } else if (st) {
                      kind = 'empty';
                      small = st === 'cond';
                    }
                  } else if (st) {
                    kind = picked ? 'pickedRest' : 'rest';
                    small = st === 'cond';
                  }
                  return (
                    <span key={s} style={{gridColumn: col(s)}} className={styles.mxCellWrap}>
                      <Cell kind={kind} small={small} />
                    </span>
                  );
                })}
                <span className={clsx(styles.mxQ, (f.queue.startsWith('ds-') || f.queue.startsWith('online')) && styles.mono)}>
                  {f.queue}
                </span>
                <span className={clsx(styles.mxNote, (exc || inbox) && styles.mxNoteHit)}>{note}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActList({j, only, actName, onAct, renderCard}) {
  return (
    <ul className={clsx(styles.actList, j && styles[j.cluster])}>
      {IFACES.map((f) => {
        const cl = j ? callsAt(j, f, only) : {};
        const at = Object.keys(cl).filter((s) => cl[s].kind !== 'skip');
        const lit = j ? (f.name === 'InboxActivities' ? uses(j, f) : at.length > 0) : false;
        const picked = actName === f.name;
        return (
          <li key={f.name} data-act={f.name}>
            <button
              type="button"
              className={clsx(styles.actItem, lit && styles.actLit, picked && styles.actPicked)}
              aria-pressed={picked}
              onClick={() => onAct(f.name)}>
              <span className={styles.actTop}>
                <span className={styles.mono}>{f.name}</span>
                <span className={styles.sys}>{f.system}</span>
              </span>
              {f.rail || !f.at.length ? (
                <span className={styles.quietLine}>{f.note}</span>
              ) : (
                <span className={styles.sChips}>
                  {ALL.filter((s) => STATIC[f.name][s]).map((s) => (
                    <span key={s} className={clsx(styles.sChip, at.includes(s) && styles.sChipOn)}>
                      {s}
                    </span>
                  ))}
                </span>
              )}
            </button>
            {picked && renderCard(f)}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------- the lens -- */

export default function RouteLedger() {
  const [pick, setPick] = useState(null);
  const [corp, setCorp] = useState(false);
  const [said, setSaid] = useState('');
  const [expanded, setExpanded] = useState(false);
  /* the road whose row the card lines up with; null puts it at the top */
  const [anchor, setAnchor] = useState(null);
  const [cardTop, setCardTop] = useState(0);
  /* the activities opened in the picked road's card */
  const [openCalls, setOpenCalls] = useState(() => new Set());
  const scrollerRef = useRef(null);
  const lensRef = useRef(null);
  const boardRef = useRef(null);
  const indexRef = useRef(null);
  const cardRef = useRef(null);
  const rowRefs = useRef({});
  const toolRef = useRef(null);
  const layout = useLayout(scrollerRef, indexRef);
  const wide = layout.width >= WIDE_AT;

  const collapse = useCallback(() => setExpanded(false), []);
  useOverlay({open: expanded, onClose: collapse, focusRef: toolRef});

  const j = pick && pick.type === 'road' ? ROAD[pick.id] : null;
  const act = pick && pick.type === 'act' ? IFACE[pick.name] : null;
  const mode = j && corp && j.corp ? CORP[j.corp] : null;

  /* the roads that stay lit; null when nothing is picked */
  const lit = useMemo(() => {
    if (j) return new Set([j.id, ...(mode ? mode.path.map((p) => p.to) : [])]);
    if (act) return new Set(ROADS.filter((r) => uses(r, act)).map((r) => r.id));
    return null;
  }, [j, act, mode]);

  /* line the card up with its road's row, a little above it */
  useIsoLayoutEffect(() => {
    const row = anchor && rowRefs.current[anchor];
    if (!wide || !row || !lensRef.current) {
      setCardTop(0);
      return;
    }
    const em = parseFloat(window.getComputedStyle(lensRef.current).fontSize) || 14;
    setCardTop(Math.max(0, Math.round(row.offsetTop - CARD_LIFT * em)));
  }, [anchor, wide, layout]);

  /* the current pick, for handlers that decide from it */
  const pickRef = useRef(null);
  pickRef.current = pick;

  const clear = useCallback(() => {
    setPick(null);
    setCorp(false);
    setOpenCalls(new Set());
    setAnchor(null);
    setSaid('Showing every road.');
  }, []);

  const pickRoad = useCallback(
    (id, from) => {
      const cur = pickRef.current;
      if (from !== 'link' && cur && cur.type === 'road' && cur.id === id) {
        clear();
        return;
      }
      const r = ROAD[id];
      setCorp(false);
      setOpenCalls(new Set());
      setPick({type: 'road', id});
      setAnchor(id);
      setSaid(`${r.name}${r.tag ? `, ${r.tag},` : ''} picked. Its card is open, and the other roads are greyed out.`);
    },
    [clear],
  );

  const pickAct = useCallback(
    (name, from) => {
      const cur = pickRef.current;
      if (from === 'matrix' && cur && cur.type === 'act' && cur.name === name) {
        clear();
        return;
      }
      const n = ROADS.filter((r) => uses(r, IFACE[name])).length;
      setCorp(false);
      setPick({type: 'act', name});
      if (from === 'matrix') setAnchor(null);
      setSaid(`${name} picked. ${n} roads call it, and the others are greyed out.`);
    },
    [clear],
  );

  /* a link inside a card: pick that road, and its row and card come into view */
  const go = useCallback(
    (id) => {
      pickRoad(id, 'link');
      reveal(() => rowRefs.current[id], 'start');
    },
    [pickRoad],
  );

  /* an activity picked inside a card opens in the same place; one picked in
     the activities opens at the top of the board */
  const actFromCard = useCallback(
    (name) => {
      pickAct(name, 'card');
      reveal(() => (wide ? cardRef.current : lensRef.current.querySelector(`[data-act="${name}"]`)), 'start');
    },
    [pickAct, wide],
  );
  const actFromMatrix = useCallback(
    (name) => {
      pickAct(name, 'matrix');
      if (wide) reveal(() => boardRef.current, 'start');
    },
    [pickAct, wide],
  );

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && pick) {
      e.stopPropagation();
      clear();
    }
  };

  const roadCard = j && (
    <RoadCard
      j={j}
      corp={corp}
      setCorp={setCorp}
      open={openCalls}
      setOpen={setOpenCalls}
      go={go}
      pickAct={actFromCard}
      onClear={clear}
      wide={wide}
    />
  );
  const actCard = (f) => <ActCard f={f} go={go} onClear={clear} />;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={clsx(styles.wrap, expanded && styles.expanded)}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'The complete picture, full screen' : undefined}
      onKeyDown={onKeyDown}>
      <div className={styles.bar}>
        <p className={styles.hint}>
          Pick a road to open its card. Pick an activity to see every road that calls it.
        </p>
        <span className={styles.tools}>
          {pick && (
            <button type="button" className={styles.showAll} onClick={clear}>
              Show all
            </button>
          )}
          <button
            ref={toolRef}
            type="button"
            className={styles.tool}
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Leave full screen' : 'Full screen'}
            title={expanded ? 'Leave full screen (Esc)' : 'Full screen'}>
            <Icon name={expanded ? 'collapse' : 'expand'} />
          </button>
        </span>
      </div>

      <div className={styles.scroller} ref={scrollerRef}>
        <div
          ref={lensRef}
          className={clsx(styles.lens, wide ? styles.wide : styles.narrow)}
          role="group"
          aria-label={LABEL}>
          <div className={styles.board} ref={boardRef}>
            <div className={styles.index} ref={indexRef}>
              {wide && (
                <>
                  <div className={styles.lanes} aria-hidden="true">
                    {STAGES.map((s) => (
                      <i key={s} />
                    ))}
                  </div>
                  <div className={styles.ixHead} aria-hidden="true">
                    <span className={styles.ixLabel}>Trigger</span>
                    <span className={styles.ixLabel}>
                      Endpoint, or where it waits
                      <span className={styles.ixSub}>then the Router&apos;s choice</span>
                    </span>
                    <span className={styles.ixStrip}>
                      {STAGES.map((s) => (
                        <span key={s} className={clsx(styles.slant, styles.slantCore)}>
                          <span>{s}</span>
                        </span>
                      ))}
                      <span className={clsx(styles.slant, styles.slantOwn, styles.ownSlot)}>
                        <span>its own stage</span>
                      </span>
                    </span>
                  </div>
                </>
              )}
              {!wide && (
                <p className={styles.key}>
                  Each road&apos;s squares are its stages: Capture, Verify, Reverify, Execute, Fulfil, then a stage of
                  its own.
                </p>
              )}

              {BANDS.map((band) => {
                const bandLit = !lit || band.requests.some((q) => q.roads.some((r) => lit.has(r.id)));
                return (
                  <section key={band.key} className={styles.band} aria-label={`${band.term}, ${band.desc}`}>
                    <p className={clsx(styles.bandHead, !bandLit && styles.dim)}>
                      <span className={styles.bandTerm}>{band.term}</span>
                      <span className={styles.bandDesc}>{band.desc}</span>
                    </p>
                    {band.requests.map((req) => {
                      const reqLit = !lit || req.roads.some((r) => lit.has(r.id));
                      return (
                        <div key={req.row || req.fn.join()} className={styles.req}>
                          <RequestHead req={req} band={band} dim={!reqLit} />
                          {req.roads.map((r) => {
                            const road = ROAD[r.id];
                            const on = Boolean(j && j.id === r.id);
                            return (
                              <React.Fragment key={r.id}>
                                <RoadRow
                                  j={road}
                                  on={on}
                                  dim={Boolean(lit && !lit.has(r.id))}
                                  act={act}
                                  only={on && mode ? CORP_STAGES : null}
                                  onRoad={pickRoad}
                                  rowRef={(el) => {
                                    rowRefs.current[r.id] = el;
                                  }}
                                />
                                {!wide && on && <div className={styles.inlineCard}>{roadCard}</div>}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })}
                  </section>
                );
              })}
            </div>

            {wide && (
              <div className={styles.pane}>
                <div className={styles.cardBox} ref={cardRef} style={{marginTop: cardTop}}>
                  {j && roadCard}
                  {act && actCard(act)}
                  {!pick && <Overview />}
                </div>
              </div>
            )}
          </div>

          <div className={styles.acts}>
            <p className={styles.actsHead}>
              <i className={styles.actsBox} aria-hidden="true" />
              <span className={styles.actsTitle}>Activities</span>
              <span className={styles.actsDesc}>every interface, its system and task queue, and the stages that call it</span>
            </p>
            <p className={styles.actsHint}>
              {j ? (
                <>
                  Lit: the calls <span className={clsx(styles.mono, styles.strong)}>{j.name}</span> makes.
                </>
              ) : act ? (
                <>
                  Picked: <span className={clsx(styles.mono, styles.strong)}>{act.name}</span>. The card
                  {wide ? ' above' : ' below it'} lists every road that calls it.
                </>
              ) : (
                <>Every call any road makes. Pick a road to light its own, or pick an activity.</>
              )}
            </p>
            {wide ? (
              <Matrix j={j} only={mode ? CORP_STAGES : null} actName={act ? act.name : null} onAct={actFromMatrix} />
            ) : (
              <ActList
                j={j}
                only={mode ? CORP_STAGES : null}
                actName={act ? act.name : null}
                onAct={actFromMatrix}
                renderCard={(f) => <div className={styles.inlineCard}>{actCard(f)}</div>}
              />
            )}
          </div>

          <div className={styles.legend}>
            <span className={styles.li}>
              <i className={clsx(styles.lgSq, styles.Online)} />
              Online cluster
            </span>
            <span className={styles.li}>
              <i className={clsx(styles.lgSq, styles.Offline)} />
              Offline cluster
            </span>
            <span className={styles.li}>
              <i className={clsx(styles.lgSq, styles.lgPale)} />
              pale: a child workflow runs it
            </span>
            <span className={styles.li}>
              <i className={clsx(styles.lgSq, styles.lgSmall)} />
              small: only in some cases
            </span>
            <span className={styles.li}>
              <i className={styles.lgStrike} />
              struck: this road never does
            </span>
            <span className={styles.li}>
              <i className={clsx(styles.lgSq, styles.lgEmpty)} />
              grey: not on this road
            </span>
          </div>
          <p className={styles.note}>
            Task queues are the Offline cluster&apos;s. On the Online cluster every regular activity runs on online-wf,
            its main task queue, except calls to a downstream a SEPA run has capped. Raven calls follow the default Raven
            setting, which a market or an account type can change. Outside the roads, the leg dispatcher&apos;s completion check calls RTF and Raven before
            it moves a corporate parent to PROCESSED, and ProcessMissingPaidEvents asks MR/M3 and GAR for a
            payment&apos;s state. The two reads, <span className={styles.mono}>GET /payments/account/{'{account-id}'}</span>{' '}
            and <span className={styles.mono}>GET /payments/{'{payment-id}'}</span>, go straight to Oracle and start no
            workflow.
          </p>
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {said}
      </p>
    </div>
  );
}
