import React, {useCallback, useMemo, useRef, useState} from 'react';
import clsx from 'clsx';
import useOverlay from '../../lib/useOverlay';
import styles from './styles.module.css';

/**
 * DomainModelMap: the payment domain model, as agreed on 2026-10-17.
 *
 * A payment's class is its state, so the map is a grid: one row per state,
 * read top to bottom in lifecycle order, and one column per shape, a full
 * payment in the middle and a split leg on the right. Where a full payment
 * stops (disallowed, cancelled, declined) sits in its own column at the far
 * left, still under the FullPayment header because both are full payments.
 * A leg stops in one way only, a representment that fails its recheck, so its
 * DECLINED class sits under its own column. Every arrow is one of the 36
 * transition functions; the blue ones make a leg. The two traits are tinted
 * bands behind the rows they cover, so "verified" reads as a region of the
 * lifecycle rather than a label on twenty-two boxes.
 *
 * What the supplied code does not have yet is dashed: the two corporate
 * classes and their six moves, PENDING to CANCELLED, PROCESSING to RETURNED,
 * the disallowed class, and the representment that fails its recheck, for a
 * payment and a leg. A move that stays but changes (a second return takes its
 * own returnedInfo, a representment builds the next presentment) keeps a
 * solid line and says so in its note. The supplied code's moves from
 * REPRESENTING back to RETURNED are gone from the model, so they aren't drawn.
 *
 * Coordinates are hand-placed on a 1056 x 952 canvas. Lines run in lanes
 * beside the boxes, so no two cross. PENDING and SCHEDULED both reach
 * CANCELLED and DECLINED, which no two lanes can do without crossing, so
 * PENDING to DECLINED leaves by the top and runs down the left margin.
 * ACCEPTED to PROCESSING runs down the right, because the corporate states
 * sit between them, and ALLOCATED's Reverify climbs back to ACCEPTED on the
 * right for the same reason.
 *
 * Takes no props; the content is the arrays below. Colours are tokens. The two
 * root types are the deepest fills, Payment in Deep Blue and Refund in a deep
 * Bright Blue, and the shapes under Payment take a pale tint of its colour.
 * The state tones are the lifecycle tokens the Mermaid state diagrams use, so
 * a PAID box here matches PAID on the Payment State Model page.
 */

const W = 1056;
const H = 952;

/* ------------------------------------------------------------ geometry -- */

const ROW0 = 220;
const PITCH = 62;
const BH = 44;
const r = (i) => ROW0 + i * PITCH;

const COL = {
  stop: {x: 32, w: 180},
  full: {x: 284, w: 224},
  split: {x: 628, w: 224},
};

/* tone: mid (in flight), ok (paid, returned, represented), stop (ends here).
   corp: only a corporate payment is ever in this state. todo: the supplied
   code does not have this class yet. */
const BOXES = [
  {id: 'disallowed', col: 'stop', row: 0, state: 'DISALLOWED', cls: 'DisallowedFullPayment', tone: 'stop', todo: true,
    extra: 'Only a push payment ends here.'},
  {id: 'canF', col: 'stop', row: 1, state: 'CANCELLED', cls: 'CancelledFullPayment', tone: 'stop',
    extra: 'It may have no amount and only a plain Timeline, because a payment cancelled while PENDING was never verified.'},
  {id: 'decF', col: 'stop', row: 4, state: 'DECLINED', cls: 'DeclinedFullPayment', tone: 'stop',
    extra: 'It carries a declineCode and no confirmation code.'},

  {id: 'pendF', col: 'full', row: 0, state: 'PENDING', cls: 'PendingFullPayment', tone: 'mid',
    extra: "While it waits for the customer's bank it holds bankConfirmation: the provider's reference and the redirect link (not in the code yet)."},
  {id: 'schF', col: 'full', row: 1, state: 'SCHEDULED', cls: 'ScheduledFullPayment', tone: 'mid'},
  {id: 'accF', col: 'full', row: 2, state: 'ACCEPTED', cls: 'AcceptedFullPayment', tone: 'mid'},
  {id: 'allocF', col: 'full', row: 3, state: 'ALLOCATING', cls: 'AllocatingFullPayment', tone: 'mid', corp: true, todo: true},
  {id: 'allocdF', col: 'full', row: 4, state: 'ALLOCATED', cls: 'AllocatedFullPayment', tone: 'mid', corp: true, todo: true},
  {id: 'procF', col: 'full', row: 5, state: 'PROCESSING', cls: 'ProcessingFullPayment', tone: 'mid'},
  {id: 'prodF', col: 'full', row: 6, state: 'PROCESSED', cls: 'ProcessedFullPayment', tone: 'mid'},
  {id: 'paidF', col: 'full', row: 7, state: 'PAID', cls: 'PaidFullPayment', tone: 'ok'},
  {id: 'retF', col: 'full', row: 8, state: 'RETURNED', cls: 'ReturnedFullPayment', tone: 'ok'},
  {id: 'repingF', col: 'full', row: 9, state: 'REPRESENTING', cls: 'RepresentingFullPayment', tone: 'mid'},
  {id: 'repedF', col: 'full', row: 10, state: 'REPRESENTED', cls: 'RepresentedFullPayment', tone: 'ok'},

  {id: 'accS', col: 'split', row: 2, state: 'ACCEPTED', cls: 'AcceptedSplitPayment', tone: 'mid'},
  {id: 'procS', col: 'split', row: 5, state: 'PROCESSING', cls: 'ProcessingSplitPayment', tone: 'mid'},
  {id: 'prodS', col: 'split', row: 6, state: 'PROCESSED', cls: 'ProcessedSplitPayment', tone: 'mid'},
  {id: 'paidS', col: 'split', row: 7, state: 'PAID', cls: 'PaidSplitPayment', tone: 'ok'},
  {id: 'retS', col: 'split', row: 8, state: 'RETURNED', cls: 'ReturnedSplitPayment', tone: 'ok'},
  {id: 'repingS', col: 'split', row: 9, state: 'REPRESENTING', cls: 'RepresentingSplitPayment', tone: 'mid'},
  {id: 'repedS', col: 'split', row: 10, state: 'REPRESENTED', cls: 'RepresentedSplitPayment', tone: 'ok'},
  {id: 'decS', col: 'split', row: 11, state: 'DECLINED', cls: 'DeclinedSplitPayment', tone: 'stop', todo: true,
    extra: 'A leg ends here only when its representment fails the recheck. It carries a declineCode and no confirmation code.'},
];

const AT = {};
BOXES.forEach((b) => {
  const c = COL[b.col];
  AT[b.id] = {...b, x: c.x, w: c.w, y: r(b.row) - BH / 2, cx: c.x + c.w / 2, cy: r(b.row)};
});

/* the traits each class carries, worked out from where it sits; a class
   where a payment stops carries neither */
const isVerified = (b) => b.tone !== 'stop' && b.row >= 1;
const isRepresent = (b) => b.tone !== 'stop' && b.row >= 8;

/* ---------------------------------------------------------------- paths -- */

const L = (id) => AT[id].x;
const R = (id) => AT[id].x + AT[id].w;
const top = (id) => AT[id].y;
const bot = (id) => AT[id].y + BH;

/* straight down (or up) between two boxes in the same column, at x */
const vert = (a, b, x) => (AT[b].row > AT[a].row ? `M${x},${bot(a)} V${top(b)}` : `M${x},${top(a)} V${bot(b)}`);

const FX = AT.pendF.cx; /* 396 */
const SX = AT.accS.cx; /* 740 */

const NEXT = 'builds the next presentment, numbered one higher and clearing on the representment date; the code copies the number and timeline today';
const SECOND = 'the code takes no returnedInfo here yet';

const EDGES = [
  /* PENDING */
  {a: 'pendF', b: 'schF', fn: 'toScheduledFullPayment(account, amount, timeline, option, instrument)', d: vert('pendF', 'schF', FX)},
  {a: 'pendF', b: 'accF', fn: 'toAcceptedFullPayment(account, amount, timeline, option, instrument)',
    d: `M${R('pendF')},${r(0)} H520 V${r(2) - 14} H${R('accF')}`},
  {a: 'pendF', b: 'disallowed', fn: 'toDisallowedFullPayment(...)', note: 'a push payment only', todo: true,
    d: `M${L('pendF')},${r(0) - 8} H${R('disallowed')}`},
  {a: 'pendF', b: 'canF', fn: 'toCancelledFullPayment()', note: 'the confirmation window closed', todo: true,
    d: `M${L('pendF')},${r(0) + 8} H250 V${r(1) - 14} H${R('canF')}`},
  {a: 'pendF', b: 'decF', fn: 'toDeclinedFullPayment(option, instrument, declineCode)',
    d: `M300,${top('pendF')} V189 H10 V${r(4)} H${L('decF')}`},

  /* SCHEDULED */
  {a: 'schF', b: 'accF', fn: 'toAcceptedFullPayment()', d: vert('schF', 'accF', FX)},
  {a: 'schF', b: 'canF', fn: 'toCancelledFullPayment()', d: `M${L('schF')},${r(1) - 4} H${R('canF')}`},
  {a: 'schF', b: 'decF', fn: 'toDeclinedFullPayment(declineCode)',
    d: `M${L('schF')},${r(1) + 7} H238 V${r(4) - 12} H${R('decF')}`},
  {a: 'schF', b: 'allocF', fn: 'toAllocatingFullPayment()', note: 'corporate, at the fetch time', todo: true,
    d: `M${L('schF')},${r(1) + 17} H264 V${r(3)} H${L('allocF')}`},

  /* ACCEPTED */
  {a: 'accF', b: 'allocF', fn: 'toAllocatingFullPayment()', note: 'corporate, paid today', todo: true, d: vert('accF', 'allocF', FX)},
  {a: 'accF', b: 'procF', fn: 'toProcessingFullPayment()',
    d: `M${R('accF')},${r(2) + 8} H548 V${r(5) - 12} H${R('procF')}`},
  {a: 'accF', b: 'accS', fn: 'toAcceptedSplitPayment(splitSlice)', kind: 'split', d: `M${R('accF')},${r(2) - 3} H${L('accS')}`},

  /* the corporate states */
  {a: 'allocF', b: 'allocdF', fn: 'toAllocatedFullPayment()', note: 'the batches add up', todo: true, d: vert('allocF', 'allocdF', FX)},
  {a: 'allocdF', b: 'procF', fn: 'toProcessingFullPayment()', note: 'paid today', todo: true, d: vert('allocdF', 'procF', FX)},
  {a: 'allocdF', b: 'accF', fn: 'toAcceptedFullPayment()', note: 'scheduled, at Reverify', todo: true,
    d: `M${R('allocdF')},${r(4)} H530 V${r(2) + 18} H${R('accF')}`},
  {a: 'allocdF', b: 'decF', fn: 'toDeclinedFullPayment(declineCode)', note: 'Reverify fails', todo: true,
    d: `M${L('allocdF')},${r(4)} H${R('decF')}`},

  /* PROCESSING on */
  {a: 'procF', b: 'prodF', fn: 'toProcessedFullPayment()', d: vert('procF', 'prodF', FX)},
  {a: 'procF', b: 'accS', fn: 'toAcceptedSplitPayment(splitSlice)', kind: 'split',
    d: `M${R('procF')},${r(5)} H572 V${r(2) + 14} H${L('accS')}`},
  {a: 'procF', b: 'retF', fn: 'toReturnedFullPayment(returnedInfo)', todo: true,
    d: `M${L('procF')},${r(5) + 10} H256 V${r(8) + 8} H${L('retF')}`},
  {a: 'prodF', b: 'paidF', fn: 'toPaidFullPayment()', d: vert('prodF', 'paidF', FX)},
  {a: 'prodF', b: 'retF', fn: 'toReturnedFullPayment(returnedInfo)',
    d: `M${L('prodF')},${r(6)} H270 V${r(8) - 8} H${L('retF')}`},
  {a: 'paidF', b: 'retF', fn: 'toReturnedFullPayment(returnedInfo)', d: vert('paidF', 'retF', FX)},
  {a: 'retF', b: 'repingF', fn: 'toRepresentingFullPayment(representmentDate)', note: NEXT, d: vert('retF', 'repingF', FX - 40)},
  {a: 'repingF', b: 'repedF', fn: 'toRepresentedFullPayment()', d: vert('repingF', 'repedF', FX)},
  {a: 'repingF', b: 'decF', fn: 'toDeclinedFullPayment(declineCode)', note: 'the recheck fails', todo: true,
    d: `M${L('repingF')},${r(9)} H226 V${r(4) + 12} H${R('decF')}`},
  {a: 'repedF', b: 'retF', fn: 'toReturnedFullPayment(returnedInfo)', note: SECOND,
    d: `M${R('repedF')},${r(10)} H${R('repedF') + 20} V${r(8) + 8} H${R('retF')}`},

  /* split leg */
  {a: 'accS', b: 'procS', fn: 'toProcessingSplitPayment()', d: vert('accS', 'procS', SX)},
  {a: 'procS', b: 'prodS', fn: 'toProcessedSplitPayment()', d: vert('procS', 'prodS', SX)},
  {a: 'procS', b: 'retS', fn: 'toReturnedSplitPayment(returnedInfo)', todo: true,
    d: `M${L('procS')},${r(5) + 10} H${L('procS') - 28} V${r(8) + 8} H${L('retS')}`},
  {a: 'prodS', b: 'paidS', fn: 'toPaidSplitPayment()', d: vert('prodS', 'paidS', SX)},
  {a: 'prodS', b: 'retS', fn: 'toReturnedSplitPayment(returnedInfo)',
    d: `M${L('prodS')},${r(6)} H${L('prodS') - 16} V${r(8) - 8} H${L('retS')}`},
  {a: 'paidS', b: 'retS', fn: 'toReturnedSplitPayment(returnedInfo)', d: vert('paidS', 'retS', SX)},
  {a: 'retS', b: 'repingS', fn: 'toRepresentingSplitPayment(representmentDate)', note: NEXT, d: vert('retS', 'repingS', SX - 40)},
  {a: 'repingS', b: 'repedS', fn: 'toRepresentedSplitPayment()', d: vert('repingS', 'repedS', SX)},
  {a: 'repingS', b: 'decS', fn: 'toDeclinedSplitPayment(declineCode)', note: 'the recheck fails', todo: true,
    d: `M${L('repingS')},${r(9)} H606 V${r(11)} H${L('decS')}`},
  {a: 'repedS', b: 'retS', fn: 'toReturnedSplitPayment(returnedInfo)', note: SECOND,
    d: `M${R('repedS')},${r(10)} H${R('repedS') + 16} V${r(8) + 8} H${R('retS')}`},
];

/* the transition functions, by source class, for the reader line */
const MOVES = {};
EDGES.forEach((e) => {
  (MOVES[e.a] = MOVES[e.a] || []).push(e);
});

/* one move in words, with its note and whether the code has it yet */
const tagsOf = (e) => [e.note, e.todo && 'not in the code yet'].filter(Boolean);
const titleOf = (e) => (tagsOf(e).length ? `${e.fn} (${tagsOf(e).join('; ')})` : e.fn);
const describe = (e) => {
  const tags = tagsOf(e);
  return `${e.fn} to ${AT[e.b].cls}${tags.length ? ` (${tags.join('; ')})` : ''}`;
};

/* the classes at either end of the moves a light picks out */
const endsOf = (pick) => new Set(EDGES.filter(pick).flatMap((e) => [e.a, e.b]));
const TODO_ENDS = endsOf((e) => e.todo);
const CORP_ENDS = endsOf((e) => AT[e.a].corp || AT[e.b].corp);

/* ------------------------------------------------------------- spotlight -- */

const LIGHTS = [
  {id: 'full', label: 'Full payments'},
  {id: 'split', label: 'Split legs'},
  {id: 'corporate', label: 'Corporate'},
  {id: 'verified', label: 'Verified'},
  {id: 'represent', label: 'Representment'},
  {id: 'todo', label: 'Not in the code yet'},
];

function litBox(b, light) {
  switch (light) {
    case 'full':
      return b.col === 'full' || b.col === 'stop';
    case 'split':
      return b.col === 'split';
    case 'corporate':
      return CORP_ENDS.has(b.id);
    case 'verified':
      return isVerified(b);
    case 'represent':
      return isRepresent(b);
    case 'todo':
      return Boolean(b.todo) || TODO_ENDS.has(b.id);
    default:
      return true;
  }
}

function litEdge(e, light) {
  const a = AT[e.a];
  const b = AT[e.b];
  switch (light) {
    case 'full':
      return a.col !== 'split';
    case 'split':
      return b.col === 'split';
    case 'corporate':
      return Boolean(a.corp || b.corp);
    case 'verified':
      return isVerified(a) && isVerified(b);
    case 'represent':
      return isRepresent(b);
    case 'todo':
      return Boolean(e.todo);
    default:
      return true;
  }
}

/* ----------------------------------------------------------- value types -- */

const VALUES = [
  {
    term: 'Timelines',
    desc: 'When things happen, as its own small hierarchy.',
    lines: [
      ['Timeline', 'captureTimestamp, transactionDate, transactionTimestamp'],
      ['InitialTimeline', 'the plain one, set at capture'],
      ['ExecutableTimeline', 'adds clearingDate, executionTimestamp, cancelCutoffTimestamp and frequency (ONCE or RECURRING)'],
      ['ImmediateTimeline', 'executable, frequency ONCE'],
      ['ScheduledTimeline', 'executable, adds scheduleDate'],
    ],
  },
  {
    term: 'ReturnedInfo',
    desc: 'What a return brings with it, carried from RETURNED on. A second return brings its own, on its own presentment. Which fields are required is still to be confirmed.',
    lines: [
      ['effectiveDate', ''],
      ['returnReason', ''],
      ['returnSource', ''],
      ['originalPaymentId', ''],
      ['originalPresentmentSequence', ''],
      ['originalPaymentDate', ''],
    ],
  },
  {
    term: 'SplitSlice',
    desc: 'What it takes to make a leg from an ACCEPTED or PROCESSING full payment. splitPaymentId and account are not in the code yet.',
    lines: [
      ['sequenceNumber', 'becomes the _seq of the leg ID'],
      ['splitAmount', "the leg's amount"],
      ['splitPaymentId', "the leg's ID, {paymentId}_{seq}"],
      ['account', 'the card account the leg pays'],
    ],
  },
  {
    term: 'BankConfirmation',
    desc: "On a PendingFullPayment as bankConfirmation, null unless the payment waits for the customer's bank. Not in the code yet.",
    lines: [
      ['providerReference', "the bank-confirmation provider's reference"],
      ['redirectLink', 'the link the customer follows; a Proposed name'],
    ],
  },
];

/* ---------------------------------------------------------------- parts -- */

function Marker({id, cls}) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8.6"
      refY="5"
      markerWidth="6.4"
      markerHeight="6.4"
      orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" className={cls} />
    </marker>
  );
}

const RB = 8;
function ClassBox({b, dim, on, onEnter, onLeave, onPick}) {
  const block = `M${b.x + RB},${b.y} A${RB},${RB} 0 0 0 ${b.x},${b.y + RB} V${b.y + BH - RB} A${RB},${RB} 0 0 0 ${b.x + RB},${b.y + BH} Z`;
  return (
    <g
      className={clsx(styles.box, styles[`t_${b.tone}`], b.todo && styles.todo, dim && styles.dim, on && styles.on)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onPick}>
      <rect x={b.x} y={b.y} width={b.w} height={BH} rx={RB} className={styles.boxBody} />
      <path d={block} className={styles.boxBlock} />
      <text x={b.x + 18} y={b.cy - 5} className={styles.boxState}>
        {b.state}
      </text>
      <text x={b.x + 18} y={b.cy + 13} className={styles.boxTitle}>
        {b.cls}
      </text>
    </g>
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

const LABEL =
  "The payment domain model as agreed on 2026-10-17. At the top, a Transaction is either a Payment or a Refund, the two root types, drawn as the deepest boxes; Refund has no concrete types yet. Payments come in two shapes, a FullPayment and a SplitPayment, a leg whose ID is its parent's plus a sequence number. Each lifecycle state has a class for each shape that can be in it, drawn as a grid with one row per state from PENDING down to REPRESENTED. Full payments have all eleven states on the path, from PendingFullPayment through AllocatingFullPayment and AllocatedFullPayment, which only a corporate payment reaches, to RepresentedFullPayment, plus DisallowedFullPayment, CancelledFullPayment and DeclinedFullPayment in a column on the left where a payment stops. Legs start at ACCEPTED and have seven states on the path, plus DeclinedSplitPayment under their column for a representment that fails its recheck; a leg is never pending, scheduled, allocating, allocated or cancelled. The transition functions join them: a pending payment is accepted, scheduled or declined, cancelled when its confirmation window closes, or, for a push payment, disallowed; a scheduled one is accepted, declined or cancelled, or for a corporate payment moves to allocating at the fetch time; an accepted one moves to processing, or for a corporate payment paid today to allocating; allocating moves to allocated, which moves to processing when it was paid today, or back to accepted or on to declined at Reverify when it was scheduled; a processing, processed or paid payment can be returned; a returned one builds its next presentment, numbered one higher, which is representing; a representing one is represented, or declined when its recheck fails, for a payment and a leg alike; and a represented one can be returned again, with that return's own details. An accepted or processing full payment makes accepted legs from a split slice, drawn in blue. Every class from SCHEDULED to REPRESENTED is a VerifiedPayment, which guarantees a tokenized account, an amount, a verified option and instrument, and an executable timeline; RETURNED, REPRESENTING and REPRESENTED also carry ReturnedInfo. Dashed lines and outlines mark what the supplied code does not have yet: the two corporate classes and their moves, PENDING to CANCELLED, PROCESSING to RETURNED for a payment and a leg, DisallowedFullPayment, DeclinedSplitPayment, and REPRESENTING to DECLINED for a payment and a leg.";

/* ------------------------------------------------------------- the map --- */

export default function DomainModelMap() {
  const [light, setLight] = useState(null);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const closeRef = useRef(null);

  const collapse = useCallback(() => setExpanded(false), []);
  useOverlay({open: expanded, onClose: collapse, focusRef: closeRef});

  const focus = hover || pinned;

  /* a focused class lights its moves in and out, and the classes at their ends */
  const near = useMemo(() => {
    if (!focus) return null;
    const ids = new Set([focus]);
    EDGES.forEach((e) => {
      if (e.a === focus) ids.add(e.b);
      if (e.b === focus) ids.add(e.a);
    });
    return ids;
  }, [focus]);

  const boxDim = (b) => (near ? !near.has(b.id) : Boolean(light) && !litBox(b, light));
  const edgeDim = (e) => (near ? e.a !== focus && e.b !== focus : Boolean(light) && !litEdge(e, light));

  const f = focus ? AT[focus] : null;
  let reading = 'Point at a class to see the functions that move it on. Click to keep it lit.';
  if (f) {
    const traits = [f.col === 'split' ? 'a split leg' : 'a full payment'];
    traits.push(isVerified(f) ? 'verified' : 'not verified');
    if (isRepresent(f)) traits.push('carries returnedInfo');
    if (f.corp) traits.push('corporate only');
    if (f.todo) traits.push('not in the code yet');
    const out = MOVES[f.id] || [];
    const moves = out.length ? `Moves on with ${out.map(describe).join('; ')}.` : 'No move out: it ends here.';
    reading = `${f.cls}: ${f.state}, ${traits.join(', ')}. ${f.extra ? `${f.extra} ` : ''}${moves}`;
  }

  const bandTop = r(1) - 31;
  const bandBottom = r(10) + 31;
  const repTop = r(8) - 28;
  const repBottom = r(10) + 27;
  const bandX0 = 244;
  const bandX1 = 880;

  return (
    <div
      className={clsx(styles.wrap, expanded && styles.expanded)}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'Payment domain model, full screen' : undefined}>
      <div className={styles.bar}>
        <div className={styles.chips}>
          <button
            type="button"
            className={clsx(styles.chip, !light && styles.chipOn)}
            aria-pressed={!light}
            onClick={() => setLight(null)}>
            Everything
          </button>
          {LIGHTS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={clsx(styles.chip, light === l.id && styles.chipOn, l.id === 'todo' && styles.chipTodo)}
              aria-pressed={light === l.id}
              onClick={() => {
                setPinned(null);
                setLight(light === l.id ? null : l.id);
              }}>
              {l.label}
            </button>
          ))}
        </div>
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

      <div className={styles.frame}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={LABEL}>
          <defs>
            <Marker id="dmm-move" cls={styles.headMove} />
            <Marker id="dmm-split" cls={styles.headSplit} />
            <marker
              id="dmm-isa"
              viewBox="0 0 12 12"
              refX="10.5"
              refY="6"
              markerWidth="9"
              markerHeight="9"
              orient="auto-start-reverse">
              <path d="M1,1 L11,6 L1,11 z" className={styles.headIsa} />
            </marker>
          </defs>

          {/* ======================= the root types ======================= */}
          <rect x={12} y={12} width={W - 24} height={110} rx={14} className={styles.frameTx} />
          <text x={28} y={34} className={styles.groupLabel}>
            TRANSACTION
          </text>
          <text x={150} y={34} className={styles.groupNote}>
            id (a TransactionId) · account · amount
          </text>
          <g className={clsx(styles.root, styles.rootPay, light === 'todo' && styles.dim)}>
            <rect x={24} y={44} width={820} height={66} rx={9} className={styles.rootBody} />
            <text x={44} y={66} className={styles.rootTitle}>
              Payment
            </text>
            <text x={44} y={86} className={styles.rootFields}>
              paymentId · confirmationCode · status · source · timeline · option · instrument
            </text>
            <text x={44} y={101} className={styles.rootFields}>
              presentmentSequence · hasMoneyMovement · planDetailData
            </text>
          </g>
          <g className={clsx(styles.root, styles.rootRef, light && styles.dim)}>
            <rect x={860} y={44} width={184} height={66} rx={9} className={styles.rootBody} />
            <text x={880} y={66} className={styles.rootTitle}>
              Refund
            </text>
            <text x={880} y={86} className={styles.rootFields}>
              refundId
            </text>
            <text x={880} y={101} className={styles.rootFields}>
              no classes yet
            </text>
          </g>

          {/* ======================= the two shapes ======================= */}
          <path d={`M266,136 V110`} className={styles.isa} markerEnd="url(#dmm-isa)" />
          <path d={`M${SX},136 V110`} className={styles.isa} markerEnd="url(#dmm-isa)" />
          <g className={clsx(styles.shape, light === 'split' && styles.dim)}>
            <rect x={24} y={136} width={484} height={44} rx={9} className={styles.shapeBody} />
            <text x={42} y={156} className={styles.shapeTitle}>
              FullPayment
            </text>
            <text x={42} y={172} className={styles.shapeNote}>
              settles as one amount
            </text>
          </g>
          <g className={clsx(styles.shape, (light === 'full' || light === 'corporate') && styles.dim)}>
            <rect x={628} y={136} width={224} height={44} rx={9} className={styles.shapeBody} />
            <text x={646} y={156} className={styles.shapeTitle}>
              SplitPayment
            </text>
            <text x={646} y={172} className={styles.shapeNote}>
              a leg: {'{paymentId}_{seq}'}
            </text>
          </g>
          <text x={SX} y={r(0) + 4} textAnchor="middle" className={styles.laneNote}>
            Legs start at ACCEPTED
          </text>

          {/* ======================= the two traits ======================= */}
          <g className={clsx(light && light !== 'verified' && styles.dimBand)}>
            <rect x={bandX0} y={bandTop} width={bandX1 - bandX0} height={bandBottom - bandTop} rx={14} className={styles.bandVerified} />
            <text x={896} y={r(1) - 8} className={styles.bandTitle}>
              VerifiedPayment
            </text>
            {['TokenizedAccount', 'non-null amount', 'VerifiedPaymentOption', 'VerifiedInstrument', 'ExecutableTimeline'].map((t, i) => (
              <text key={t} x={896} y={r(1) + 10 + i * 16} className={styles.bandLine}>
                {t}
              </text>
            ))}
          </g>
          <g className={clsx(light && light !== 'represent' && light !== 'verified' && styles.dimBand)}>
            <rect x={bandX0 + 8} y={repTop} width={bandX1 - bandX0 - 16} height={repBottom - repTop} rx={11} className={styles.bandRepresent} />
            <text x={896} y={r(8) - 8} className={styles.bandTitle}>
              Representment
            </text>
            <text x={896} y={r(8) + 8} className={styles.bandTitle}>
              Payment
            </text>
            <text x={896} y={r(8) + 26} className={styles.bandLine}>
              returnedInfo
            </text>
          </g>

          {/* ======================= the moves ============================ */}
          <g>
            {EDGES.map((e) => (
              <path
                key={`${e.a}-${e.b}`}
                d={e.d}
                className={clsx(styles.edge, e.kind === 'split' && styles.edgeSplit, e.todo && styles.edgeTodo, edgeDim(e) && styles.dim)}
                markerEnd={`url(#dmm-${e.kind === 'split' ? 'split' : 'move'})`}>
                <title>{titleOf(e)}</title>
              </path>
            ))}
          </g>

          {/* ======================= the classes ========================== */}
          {BOXES.map((b) => {
            const at = AT[b.id];
            return (
              <ClassBox
                key={b.id}
                b={at}
                dim={boxDim(at)}
                on={focus === b.id}
                onEnter={() => setHover(b.id)}
                onLeave={() => setHover(null)}
                onPick={() => {
                  setLight(null);
                  setPinned(pinned === b.id ? null : b.id);
                }}
              />
            );
          })}
        </svg>
      </div>

      <p className={styles.reading} aria-live="polite">
        {reading}
      </p>

      <div className={styles.legend}>
        <span className={styles.li}>
          <i className={clsx(styles.sw, styles.t_mid)} />
          In flight
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.sw, styles.t_ok)} />
          Paid, returned or represented
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.sw, styles.t_stop)} />
          Stops here
        </span>
        <span className={styles.li}>
          <i className={styles.swLine} />
          A transition function
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.swLine, styles.swSplit)} />
          Makes a leg
        </span>
        <span className={styles.li}>
          <i className={clsx(styles.swLine, styles.swTodo)} />
          Agreed, not in the code yet
        </span>
      </div>

      <div className={styles.values}>
        {VALUES.map((v) => (
          <section key={v.term} className={styles.value}>
            <h4 className={styles.valueTerm}>{v.term}</h4>
            <p className={styles.valueDesc}>{v.desc}</p>
            <ul className={styles.valueList}>
              {v.lines.map(([name, what]) => (
                <li key={name}>
                  <code>{name}</code>
                  {what && <span className={styles.valueWhat}> {what}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
