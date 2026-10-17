import React, {useCallback, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import useOverlay from '../../lib/useOverlay';
import styles from './styles.module.css';

/**
 * RouteLedger: every road through Billpay on one sheet, from the One-Data
 * function a sender calls to the activities the stages call on its behalf.
 *
 * Each row reads left to right across six stations: the One-Data function,
 * the billpay-core API or dispatcher it reaches, the Router, the workflow the
 * Router picks, the stages that workflow runs, and any stage only that
 * journey has. Bands group the rows by how the work arrives. One line goes
 * into the Router per request and one comes out per journey, so a request
 * with three possible workflows shows the Router's choice as a fan.
 *
 * The stage columns carry on below the bands into the activity rows, so a
 * reader can follow Execute straight down to clearing, AR and open-to-buy.
 * Picking a journey lights the calls it makes there.
 *
 * CSS grid rather than SVG, like LandscapeMap: the text stays text. Every
 * length is in em and the sheet's font size follows its container's width,
 * so the whole sheet scales as one piece until the type reaches its floor,
 * and scrolls sideways from there. Takes no props; the content is the arrays
 * below, from the spec's workflow, stage and activity tables.
 */

const STAGES = ['Capture', 'Verify', 'Reverify', 'Execute', 'Fulfil'];

/* how far the sheet spans, in em: the sum of the column widths in the CSS */
const SPAN_EM = 91.5;

/* Small monoline glyphs on a 24-unit grid, in the JourneyMap style, marking
   what kind of door a request comes through: a core API endpoint, a
   dispatcher the governor paces, or rows waiting in One-Data's inbox. */
const GLYPHS = {
  api: {
    label: 'billpay-core API endpoint',
    d: ['M9 3.8v3.8', 'M15 3.8v3.8', 'M6.6 7.6h10.8v3a5.4 5.4 0 0 1-10.8 0z', 'M12 16v4.2'],
  },
  dispatcher: {
    label: 'Dispatcher, paced by the governor',
    d: ['M3.6 6.6h8', 'M3.6 12h8', 'M3.6 17.4h8', 'M14.4 12h6', 'M17.8 9.4l2.6 2.6-2.6 2.6'],
  },
  inbox: {
    label: "Rows in One-Data's inbox",
    d: ['M3.6 13.2V6.4a2 2 0 0 1 2-2h12.8a2 2 0 0 1 2 2v6.8', 'M3.6 13.2h4.2l1.4 2.4h5.6l1.4-2.4h4.2v4.4a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z'],
  },
};

/* `|` marks where a long name may break onto a second line */
const BANDS = [
  {
    term: 'A caller waits',
    desc: 'Update-With-Start',
    cluster: 'Online',
    requests: [
      {
        fn: ['CreatePayment.v3'],
        api: ['POST', '/payments'],
        journeys: [
          {id: 'immediate', wf: 'CreateImmediatePayment', why: 'today, one instruction', stages: [0, 1, 3, 4]},
          {
            id: 'multiple',
            wf: 'CreatePaymentWith|MultipleInstructions',
            why: 'today, several instructions',
            stages: [0, 1, 3, 4],
            child: true,
            note: 'a child per instruction',
          },
          {id: 'scheduled', wf: 'CreateScheduledPayment', why: 'a future date', stages: [0, 1]},
        ],
      },
      {
        fn: ['UpdatePayment.v1'],
        api: ['PUT', '/payments/{payment-id}'],
        journeys: [
          {
            id: 'update',
            wf: 'UpdatePayment',
            why: 'SCHEDULED, inside the window',
            own: ['Cancel'],
            stages: [0, 1],
            child: true,
          },
        ],
      },
      {
        fn: ['DeletePayment.v1'],
        api: ['DELETE', '/payments/{payment-id}'],
        journeys: [{id: 'cancel', wf: 'CancelPayment', why: 'SCHEDULED, inside the window', own: ['Cancel']}],
      },
      {
        fn: ['CreatePaymentIntent.v1'],
        api: ['POST', '/payments/intent'],
        journeys: [
          {
            id: 'intent',
            wf: 'CreatePaymentIntent',
            why: 'once the bank confirms',
            note: 'steps still to be defined',
          },
        ],
      },
      {
        fn: ['CreatePaymentInstallment.v1'],
        api: ['POST', '/payment-installments'],
        journeys: [
          {
            id: 'payplan',
            wf: 'Pay & Plan',
            plain: true,
            full: 'Pay & Plan, a composite workflow',
            why: 'a payment and its installments',
            stages: [0, 1, 3, 4],
            child: true,
            note: 'then the Installments API',
          },
        ],
      },
      {
        fn: ['CreateCreditBalance|Refund.v1'],
        api: ['POST', '/refunds'],
        journeys: [{id: 'refund', wf: 'CreateBalanceRefund', why: 'a refund from a channel', stages: [0, 1, 3, 4]}],
      },
    ],
  },
  {
    term: 'Stored by One-Data, then pulled',
    desc: 'the inbox and a dispatcher',
    cluster: 'Offline',
    from: 'inbox',
    requests: [
      {
        fn: ['CreateBillpayTransaction|FromAccountsReceivable.v1'],
        by: 'AR intake dispatcher',
        journeys: [
          {id: 'arScheduled', wf: 'CreateScheduledPayment', why: 'a payment AR raises', stages: [0, 1]},
          {id: 'arRefund', wf: 'CreateBalanceRefund', why: 'a refund AR raises', stages: [0, 1, 3, 4]},
        ],
      },
      {
        fn: ['MoneyMovementEvent|Handler.v1'],
        by: 'returns dispatcher',
        journeys: [{id: 'returned', wf: 'ProcessReturnedPayment', why: 'a return', own: ['Return', 'QueueRepresentment']}],
      },
      {
        fn: ['CreateInboundPayment.v1'],
        by: 'inbound dispatcher',
        journeys: [{id: 'inbound', wf: 'ProcessInboundPayment', why: 'a third-party push', stages: [0, 1, 3, 4]}],
      },
    ],
  },
  {
    term: 'Calls back',
    desc: 'async start',
    cluster: 'Offline',
    requests: [
      {
        fn: ['CreatePaymentAllocations.v1'],
        api: ['POST', '/payments/{payment-id}/allocations'],
        journeys: [
          {
            id: 'receive',
            wf: 'ReceiveAllocations',
            why: 'a batch of allocations',
            own: ['ReceiveAllocations'],
            skip: ['LifecycleEventActivities'],
          },
        ],
      },
    ],
  },
  {
    term: 'Falls due',
    desc: 'a Work Tracker row and a dispatcher',
    cluster: 'Offline',
    from: 'tracker',
    requests: [
      {
        row: 'SCHED_EXEC',
        by: 'scheduled-payments dispatcher',
        journeys: [{id: 'execute', wf: 'ExecuteScheduledPayment', why: 'on the due date', stages: [2, 3, 4]}],
      },
      {
        row: 'ALLOC_REQUEST',
        by: 'allocation-request dispatcher',
        journeys: [
          {
            id: 'request',
            wf: 'RequestAllocations',
            why: 'at the fetch time',
            own: ['RequestAllocations'],
            skip: ['LifecycleEventActivities'],
          },
        ],
      },
      {
        row: 'ALLOC_LEG',
        by: 'leg dispatcher',
        journeys: [
          {id: 'leg', wf: 'ExecuteSplitPayment', why: 'a corporate leg', stages: [3, 4], skip: ['ClearingActivities']},
        ],
      },
      {
        row: 'REPRESENT',
        by: 'representment dispatcher',
        journeys: [{id: 'represent', wf: 'ProcessRepresentment', why: 'on the representment date', own: ['Represent']}],
      },
    ],
  },
];

/* the one road that skips the Router: a Schedule starts the PAID drain */
const DRAIN = {
  term: 'Not routed',
  desc: 'a Schedule, every 30 seconds',
  cluster: 'Offline',
  from: 'inbox',
  drain: true,
  requests: [
    {
      fn: ['MoneyMovementEvent|Handler.v1', 'AccountsReceivable|TransactionEventHandler.v1'],
      by: 'READY rows',
      journeys: [{id: 'paid', wf: 'ProcessPaidEvents', why: 'the PAID drain', own: ['Settle']}],
    },
  ],
};

/* who calls each system: stage columns, stages of their own, or a source.
   A journey's `skip` drops a call its stage would otherwise make: a corporate
   leg never clears, and the allocation stages change no payment state, so
   they send no lifecycle event. */
const ACTIVITIES = [
  {name: 'PaymentStore', system: 'Oracle', rail: true, note: 'every stage commits here'},
  {name: 'LifecycleEventActivities', system: 'RTF', rail: true, note: 'every state change'},
  {name: 'CommunicationActivities', system: 'Raven', stages: [1, 4], own: ['Cancel']},
  {name: 'InstrumentActivities', system: 'Payment Instruments', stages: [1, 2], own: ['Represent']},
  {name: 'OptionsActivities', system: 'Payment Options', stages: [1, 2], own: ['Represent']},
  {name: 'ClearingActivities', system: 'MR/M3', stages: [3], own: ['Represent']},
  {name: 'ReceivablesActivities', system: 'GAR', stages: [3]},
  {name: 'AuthorizationActivities', system: 'AMP', stages: [3]},
  {name: 'AccountingActivities', system: 'Accounting', stages: [4]},
  {name: 'BalanceControlActivities', system: 'eBNC', stages: [4]},
  {name: 'RiskActivities', system: 'Risk', stages: [4]},
  {name: 'AllocationActivities', system: 'Allocations manager', own: ['RequestAllocations']},
  {name: 'InboxActivities', system: 'One-Data', from: 'inbox', note: 'the PAID drain and the inbox dispatchers'},
];

/* ------------------------------------------------------------ the model -- */

const plain = (s) => s.replace(/\|/g, '');

/* every journey, with what it inherits from its band and its request */
const JOURNEYS = {};
[...BANDS, DRAIN].forEach((band) => {
  band.requests.forEach((q) => {
    q.journeys.forEach((j) => {
      JOURNEYS[j.id] = {
        ...j,
        name: plain(j.wf),
        full: j.full || `${plain(j.wf)}Workflow`,
        cluster: band.cluster,
        from: band.from,
        source: q.row ? `its ${q.row} Work Tracker row` : q.fn.map(plain).join(' or '),
        entry: band.drain
          ? "the READY rows in One-Data's inbox, started by a Schedule rather than the Router"
          : q.api
            ? `${q.api[0]} ${q.api[1]}`
            : `the ${q.by}`,
      };
    });
  });
});

function calls(act, j) {
  if ((j.skip || []).includes(act.name)) return false;
  const stages = j.stages || [];
  const own = j.own || [];
  if (act.rail) return stages.length + own.length > 0;
  if (act.from) return j.from === act.from;
  return (act.stages || []).some((s) => stages.includes(s)) || (act.own || []).some((o) => own.includes(o));
}

function list(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function runs(j) {
  const own = j.own || [];
  const steps = [...own, ...(j.stages || []).map((s) => STAGES[s])];
  if (!steps.length) return 'Its steps are still to be defined.';
  let how = '';
  if (j.child) how = own.length ? ', the last of them through a child workflow' : ' through a child workflow';
  const note = j.note ? ` (${j.note})` : '';
  return `It runs ${list(steps)}${how}${note}.`;
}

function summary(j) {
  const systems = ACTIVITIES.filter((a) => calls(a, j)).map((a) => a.system);
  const head = `${j.full} on the ${j.cluster} cluster (${j.why}). From ${j.source}, through ${j.entry}.`;
  const tail = systems.length ? ` It calls ${list(systems)}.` : '';
  return `${head} ${runs(j)}${tail}`;
}

const LABEL =
  'The complete picture. Every road through Billpay, one row per journey, read left to right: the One-Data function a sender calls, the billpay-core API or dispatcher it reaches, the Router, the workflow the Router picks on the Online or Offline cluster, and the stages that workflow runs. Rows are grouped by how work arrives: a caller waits, stored by One-Data then pulled, the allocations callback, work that falls due from a Work Tracker row, and the PAID drain, which a Schedule starts without the Router. Below, one row per activity interface shows which stages call which system. Pick a journey to light the calls it makes.';

/* ---------------------------------------------------------------- parts -- */

function Name({text}) {
  const parts = text.split('|');
  return parts.map((p, i) => (
    // eslint-disable-next-line react/no-array-index-key
    <React.Fragment key={i}>
      {i > 0 && <wbr />}
      {p}
    </React.Fragment>
  ));
}

function Badge({n}) {
  return (
    <b className={styles.badge} aria-hidden="true">
      {n}
    </b>
  );
}

/* the glyph sits in a small tinted square, the site's one shape */
function Glyph({kind, className}) {
  return (
    <span className={clsx(styles.glyphBox, className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" className={styles.glyph}>
        {GLYPHS[kind].d.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

function ToolIcon({name}) {
  return (
    <svg viewBox="0 0 16 16" className={styles.toolIcon} aria-hidden="true">
      {name === 'expand' ? (
        <path d="M2.5 6V2.5H6 M10 2.5h3.5V6 M13.5 10v3.5H10 M6 13.5H2.5V10" />
      ) : (
        <path d="M6 2.5V6H2.5 M13.5 6H10V2.5 M10 13.5V10h3.5 M2.5 10H6v3.5" />
      )}
    </svg>
  );
}

function Track({stages, child, row}) {
  if (!stages || !stages.length) return null;
  const a = stages[0];
  const b = stages[stages.length - 1];
  return (
    <div className={clsx(styles.track, child && styles.child)} style={{gridRow: row}} aria-hidden="true">
      {b > a && <i className={styles.trackLine} style={{'--a': a, '--b': b}} />}
      {stages.map((s) => (
        <i key={s} className={styles.sq} style={{'--i': s}} />
      ))}
    </div>
  );
}

function Band({band, pick, onPick}) {
  const cells = [];
  let row = 2;
  band.requests.forEach((q, qi) => {
    const k = q.journeys.length;
    const rows = `${row} / span ${k}`;
    const lit = q.journeys.some((j) => j.id === pick);
    cells.push(
      <div key={`fn${qi}`} className={clsx(styles.fn, q.row && styles.fnRow)} style={{gridRow: rows}}>
        {q.row
          ? q.row
          : q.fn.map((f) => (
              <span key={f} className={styles.fnName}>
                <Name text={f} />
              </span>
            ))}
      </div>,
    );
    cells.push(
      <div
        key={`in${qi}`}
        className={clsx(styles.entry, band.drain && styles.entryDrain, lit && styles.entryLit)}
        style={{gridRow: rows}}>
        {q.api ? (
          <>
            <Glyph kind="api" className={styles.glyphApi} />
            <span className={styles.method}>{q.api[0]}</span>
            <span className={styles.path}>{q.api[1]}</span>
          </>
        ) : (
          <>
            <Glyph kind={band.drain ? 'inbox' : 'dispatcher'} className={band.drain ? styles.glyphInbox : styles.glyphDispatch} />
            <span className={styles.by}>{q.by}</span>
          </>
        )}
        <i className={clsx(styles.wire, band.drain && styles.wireDrain)} aria-hidden="true">
          {band.drain && <span className={styles.wireLabel}>not routed</span>}
        </i>
      </div>,
    );
    q.journeys.forEach((j) => {
      const on = j.id === pick;
      cells.push(
        <button
          key={`pick-${j.id}`}
          type="button"
          className={clsx(styles.pick, on && styles.pickOn)}
          style={{gridRow: row}}
          aria-pressed={on}
          aria-label={summary(JOURNEYS[j.id])}
          title={JOURNEYS[j.id].full}
          onClick={() => onPick(j.id)}
        />,
        <div key={`wf-${j.id}`} className={clsx(styles.wf, on && styles.wfOn)} style={{gridRow: row}} aria-hidden="true">
          <i className={clsx(styles.out, band.drain && styles.outDrain)} />
          <i className={styles.wfSq} />
          <span className={styles.wfText}>
            <span className={clsx(styles.wfName, j.plain && styles.wfNamePlain)}>
              <Name text={j.wf} />
            </span>
            <span className={styles.wfWhy}>{j.why}</span>
          </span>
        </div>,
        <Track key={`st-${j.id}`} stages={j.stages} child={j.child} row={row} />,
        <div key={`own-${j.id}`} className={styles.own} style={{gridRow: row}} aria-hidden="true">
          {(j.own || []).map((o) => (
            <span key={o} className={styles.ownStage}>
              {o}
            </span>
          ))}
          {j.note && <span className={styles.ownNote}>{j.note}</span>}
        </div>,
      );
      row += 1;
    });
  });

  return (
    <section
      className={clsx(styles.band, band.cluster === 'Online' ? styles.online : styles.offline)}
      aria-label={`${band.term}, ${band.desc}, ${band.cluster} cluster`}>
      <div className={styles.bandHead}>
        <span className={styles.bandTerm}>{band.term}</span>
        <span className={styles.bandDesc}>{band.desc}</span>
      </div>
      <div className={styles.cluster} aria-hidden="true">
        <i className={styles.wfSq} />
        <span className={styles.clusterName}>{band.cluster} cluster</span>
      </div>
      {cells}
    </section>
  );
}

/* ------------------------------------------------------------ the sheet --- */

export default function RouteLedger() {
  const [pick, setPick] = useState('immediate');
  const [expanded, setExpanded] = useState(false);
  const closeRef = useRef(null);

  const collapse = useCallback(() => setExpanded(false), []);
  useOverlay({open: expanded, onClose: collapse, focusRef: closeRef});

  const onPick = useCallback((id) => setPick((cur) => (cur === id ? null : id)), []);

  const j = pick ? JOURNEYS[pick] : null;
  const lit = useMemo(() => (j ? ACTIVITIES.map((a) => calls(a, j)) : null), [j]);
  const tone = j && j.cluster === 'Online' ? styles.pickOnline : styles.pickOffline;

  return (
    <div
      className={clsx(styles.wrap, expanded && styles.expanded)}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'The complete picture, full screen' : undefined}>
      <div className={styles.bar}>
        <p className={styles.hint}>Click a journey to light the calls it makes. Click it again to clear.</p>
        <button
          ref={closeRef}
          type="button"
          className={styles.tool}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Leave full screen' : 'Full screen'}
          title={expanded ? 'Leave full screen (Esc)' : 'Full screen'}>
          <ToolIcon name={expanded ? 'collapse' : 'expand'} />
        </button>
      </div>

      <div className={styles.scroller}>
        <div className={styles.sheet} role="group" aria-label={LABEL} style={{'--rl-span': SPAN_EM}}>
          {/* ===================== the stations ===================== */}
          <div className={styles.heads}>
            <div className={styles.head} style={{gridColumn: 1}}>
              <Badge n={1} />
              <span>One-Data function</span>
            </div>
            <div className={clsx(styles.head, styles.headApi)} style={{gridColumn: 2}}>
              <Badge n={2} />
              <span>billpay-core API or dispatcher</span>
            </div>
            <div className={styles.headRouter}>
              <Badge n={3} />
              <span>Router</span>
            </div>
            <div className={clsx(styles.head, styles.headWf)}>
              <Badge n={4} />
              <span>Workflow</span>
            </div>
            <div className={clsx(styles.head, styles.headStages)}>
              <Badge n={5} />
              <span>Stages</span>
            </div>
            {STAGES.map((s, i) => (
              <span key={s} className={styles.stageName} style={{gridColumn: 5 + i}}>
                {s}
              </span>
            ))}
            <span className={styles.ownHead}>its own stage</span>
          </div>

          {/* ===================== the roads ======================== */}
          <div className={styles.routed}>
            <div className={styles.router} aria-hidden="true">
              <span className={styles.routerSteps}>
                Admit · pick the journey · resolve behaviors · pin the plan key · place · start
              </span>
            </div>
            <p className={styles.srOnly}>
              Every request in the next four groups passes the Router, which admits it, picks the journey, resolves
              the market's behaviors, pins the plan key, places the work on a cluster and starts the workflow.
            </p>
            {BANDS.map((band) => (
              <Band key={band.term} band={band} pick={pick} onPick={onPick} />
            ))}
          </div>
          <Band band={DRAIN} pick={pick} onPick={onPick} />

          {/* ===================== the calls ======================== */}
          <div className={clsx(styles.acts, j && styles.hasPick, tone)}>
            <div className={styles.actsIntro}>
              <div className={styles.head}>
                <Badge n={6} />
                <span>Activities</span>
              </div>
              <p className={styles.actsDesc}>
                One interface per system. Follow a stage&apos;s column down to see what it calls.
              </p>
              <p className={styles.actsDesc}>
                {j ? (
                  <>
                    Lit: the calls <code className={styles.actsPick}>{j.name}</code> makes.
                  </>
                ) : (
                  'Pick a journey above to light the calls it makes.'
                )}
              </p>
            </div>
            {STAGES.map((s, i) => (
              <span key={s} className={clsx(styles.stageName, styles.stageNameActs)} style={{gridColumn: 5 + i}}>
                {s}
              </span>
            ))}
            <span className={clsx(styles.ownHead, styles.ownHeadActs)}>its own stage</span>

            {ACTIVITIES.map((a, i) => {
              const row = i + 2;
              const on = lit ? lit[i] : true;
              const st = j ? j.stages || [] : [];
              const own = j ? j.own || [] : [];
              const by = a.rail
                ? a.note
                : `called by ${list([...(a.stages || []).map((s) => STAGES[s]), ...(a.own || []), ...(a.note ? [a.note] : [])])}`;
              return (
                <React.Fragment key={a.name}>
                  {i % 2 === 0 && <i className={styles.stripe} style={{gridRow: row}} aria-hidden="true" />}
                  <div className={clsx(styles.actLabel, on && styles.actOn)} style={{gridRow: row}}>
                    <span className={styles.actName}>{a.name}</span>
                    <span className={styles.actSystem}>{a.system}</span>
                    <span className={styles.srOnly}>, {by}</span>
                  </div>
                  <div className={styles.matrix} style={{gridRow: row}} aria-hidden="true">
                    {a.rail ? (
                      <i className={clsx(styles.rail, on && styles.mOn)} />
                    ) : (
                      (a.stages || []).map((s) => (
                        <i key={s} className={clsx(styles.mq, on && st.includes(s) && styles.mOn)} style={{'--i': s}} />
                      ))
                    )}
                  </div>
                  <div className={styles.actOwn} style={{gridRow: row}} aria-hidden="true">
                    {(a.own || []).map((o) => (
                      <span key={o} className={clsx(styles.actOwnStage, on && own.includes(o) && styles.mOn)}>
                        {o}
                      </span>
                    ))}
                    {a.note && <span className={styles.actNote}>{a.note}</span>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <p className={styles.srOnly} aria-live="polite">
        {j ? summary(j) : 'No journey picked.'}
      </p>

      <div className={styles.legend}>
        <span className={styles.li}>
          <Glyph kind="api" className={clsx(styles.swGlyph, styles.glyphApi)} />
          Core API endpoint
        </span>
        <span className={styles.li}>
          <Glyph kind="dispatcher" className={clsx(styles.swGlyph, styles.glyphDispatch)} />
          Dispatcher, paced by the governor
        </span>
        <span className={styles.li}>
          <Glyph kind="inbox" className={clsx(styles.swGlyph, styles.glyphInbox)} />
          Rows in One-Data&apos;s inbox
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.swSq, styles.swOnline)} />
          Online cluster
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.swSq, styles.swOffline)} />
          Offline cluster
        </span>
        <span className={styles.li}>
          <i className={styles.swWire} />
          One line in per request, one out per journey
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.swSq, styles.swOffline, styles.swPale)} />
          Runs in a child workflow
        </span>
        <span className={styles.li}>
          <i className={styles.swDash} />
          Not routed: a Schedule starts it
        </span>
        <span className={styles.li}>
          <i className={styles.swRail} />
          Called by every stage
        </span>
        <span className={styles.li}>
          <i className={styles.swPick} />
          The journey you picked
        </span>
      </div>
      <p className={styles.note}>
        The two reads, <code>GET /payments/account/{'{account-id}'}</code> and <code>GET /payments/{'{payment-id}'}</code>,
        go straight to Oracle and start no workflow.
      </p>
    </div>
  );
}
