import React, {useId} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * ClassMap: a UML class diagram drawn in the house style.
 *
 * Classes are filled cards, never outlined. An interface sits on the deepest
 * fill with a small INTERFACE kicker; a class is a pale tint with a block of
 * Bright Blue down its left edge; plain data is a neutral card with no block.
 * A class that belongs to one market carries that market's code in a small
 * blue square, the only mark of ownership on the drawing.
 *
 * Lines run only across and down, turning on one small radius, and their ends
 * keep the UML meanings: a hollow triangle names a kind (solid when one
 * interface extends another, dashed when a class implements one), a hollow
 * diamond sits at the end that holds, a small solid head marks a call, and a
 * dashed line with a solid head marks something made. Lines into one parent
 * gather into a single trunk, drawn as branches with `head: false` plus one
 * link that carries the head. A link can carry a numbered square, `step`,
 * where the order of events matters.
 *
 * Coordinates are hand-placed on a `width` x `height` canvas, drawn to be
 * read in a 700-unit column. The drawing shows at no more than 91% of its
 * canvas, so the cards and their text stay compact in a wide column. Card heights follow from their content,
 * so a link's points are written against them:
 *
 *   interface, or a class with a note   52 + members
 *   any other card                      36 + members
 *   members                             14 + 16 each
 *
 * Props:
 *   classes  [{id, kind: 'interface' | 'class' | 'data', name, x, y, w,
 *              note?, members?: [string], market?}]
 *   links    [{type: 'extends' | 'implements' | 'holds' | 'uses' | 'makes',
 *              points: [[x, y], ...], head?, label?, at?: [x, y],
 *              align?: 'start' | 'middle' | 'end', step?}]
 *   texts?   [{x, y, text, align?}] for a short aside on the canvas
 *   width, height, label (the picture in prose, for screen readers),
 *   caption?, legend? (relation types to explain; default: the ones drawn)
 */

const RADIUS = 6; // every corner a line turns
const INSET = 18; // where a card's words start
const TALL = 52; // the head of an interface, or of a class with a note
const SHORT = 36; // the head of any other card
const PITCH = 16; // one member line

const KIND_LABEL = {
  extends: 'is a kind of',
  implements: 'implements',
  holds: 'holds',
  uses: 'uses',
  makes: 'makes',
};

/* An orthogonal polyline with every corner rounded by the same radius. */
function path(points) {
  const [first, ...rest] = points;
  let d = `M${first[0]},${first[1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const d1 = Math.hypot(x - px, y - py);
    const d2 = Math.hypot(nx - x, ny - y);
    const r = Math.min(RADIUS, d1 / 2, d2 / 2);
    const ax = x + ((px - x) / d1) * r;
    const ay = y + ((py - y) / d1) * r;
    const bx = x + ((nx - x) / d2) * r;
    const by = y + ((ny - y) / d2) * r;
    d += ` L${ax},${ay} Q${x},${y} ${bx},${by}`;
  }
  const last = rest[rest.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

function headHeight(c) {
  return c.kind === 'interface' || c.note ? TALL : SHORT;
}

export function cardHeight(c) {
  const n = c.members?.length || 0;
  return headHeight(c) + (n ? 14 + n * PITCH : 0);
}

function Card({c}) {
  const h = cardHeight(c);
  const head = headHeight(c);
  const iface = c.kind === 'interface';
  const hasMembers = c.members?.length > 0;
  // the members sit on a second fill, rounded at the bottom only
  const band = `M${c.x},${c.y + head} H${c.x + c.w} V${c.y + h - 8} A8,8 0 0 1 ${c.x + c.w - 8},${c.y + h} H${c.x + 8} A8,8 0 0 1 ${c.x},${c.y + h - 8} Z`;
  return (
    <g className={clsx(styles.card, styles[`k_${c.kind}`])}>
      <rect x={c.x} y={c.y} width={c.w} height={h} rx={8} className={styles.body} />
      {hasMembers && <path d={band} className={styles.band} />}
      {c.kind === 'class' && (
        <path
          d={`M${c.x + 8},${c.y} A8,8 0 0 0 ${c.x},${c.y + 8} V${c.y + h - 8} A8,8 0 0 0 ${c.x + 8},${c.y + h} Z`}
          className={styles.block}
        />
      )}
      {iface && (
        <text x={c.x + INSET} y={c.y + 19} className={styles.kicker}>
          INTERFACE
        </text>
      )}
      <text x={c.x + INSET} y={c.y + (iface ? 38 : 23)} className={styles.name}>
        {c.name}
      </text>
      {c.note && !iface && (
        <text x={c.x + INSET} y={c.y + 40} className={styles.note}>
          {c.note}
        </text>
      )}
      {c.market && (
        <g>
          <rect x={c.x + c.w - 36} y={c.y + 10} width={24} height={17} rx={4} className={styles.market} />
          <text x={c.x + c.w - 24} y={c.y + 22.5} textAnchor="middle" className={styles.marketText}>
            {c.market}
          </text>
        </g>
      )}
      {hasMembers &&
        c.members.map((m, i) => (
          <text key={m} x={c.x + INSET} y={c.y + head + 19 + i * PITCH} className={styles.member}>
            {m}
          </text>
        ))}
    </g>
  );
}

function Link({l, id}) {
  const dashed = l.type === 'implements' || l.type === 'makes';
  const head = l.head === false ? undefined : l.type;
  const markerEnd = head && head !== 'holds' ? `url(#${id}-${head})` : undefined;
  const markerStart = head === 'holds' ? `url(#${id}-holds)` : undefined;
  return (
    <path
      d={path(l.points)}
      className={clsx(styles.line, dashed && styles.dashed)}
      markerEnd={markerEnd}
      markerStart={markerStart}
    />
  );
}

/* A link's words. With a step, the numbered square comes first and the words
   follow it, so `at` is where the square starts. */
function Label({l}) {
  if (!l.label && !l.step) return null;
  const [x, y] = l.at;
  if (!l.step) {
    return (
      <text x={x} y={y} textAnchor={l.align || 'middle'} className={styles.label}>
        {l.label}
      </text>
    );
  }
  return (
    <g>
      <rect x={x} y={y - 12.2} width={16} height={16} rx={3.5} className={styles.stepBox} />
      <text x={x + 8} y={y - 0.4} textAnchor="middle" className={styles.stepText}>
        {l.step}
      </text>
      {l.label && (
        <text x={x + 22} y={y} className={styles.label}>
          {l.label}
        </text>
      )}
    </g>
  );
}

function Swatch({type, id}) {
  const dashed = type === 'implements' || type === 'makes';
  return (
    <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true" className={styles.swatch}>
      <path
        d={type === 'holds' ? 'M8,6 H32' : 'M2,6 H26'}
        className={clsx(styles.line, dashed && styles.dashed)}
        markerEnd={type === 'holds' ? undefined : `url(#${id}-${type})`}
        markerStart={type === 'holds' ? `url(#${id}-holds)` : undefined}
      />
    </svg>
  );
}

export default function ClassMap({classes, links, texts = [], width, height, label, caption, legend}) {
  const id = `cm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const used = legend || [...new Set(links.filter((l) => l.head !== false).map((l) => l.type))];
  const markets = [...new Set(classes.filter((c) => c.market).map((c) => c.market))];
  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} style={{maxWidth: width * 0.91}} role="img" aria-label={label}>
          <defs>
            <marker id={`${id}-extends`} viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M1,1 L11,6 L1,11 z" className={styles.hollow} />
            </marker>
            <marker id={`${id}-implements`} viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
              <path d="M1,1 L11,6 L1,11 z" className={styles.hollow} />
            </marker>
            <marker id={`${id}-holds`} viewBox="0 0 16 10" refX="1" refY="5" markerWidth="13" markerHeight="8.2" orient="auto">
              <path d="M1,5 L8,1 L15,5 L8,9 z" className={styles.hollow} />
            </marker>
            <marker id={`${id}-uses`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.solid} />
            </marker>
            <marker id={`${id}-makes`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">
              <path d="M0,0.5 L10,5 L0,9.5 z" className={styles.solid} />
            </marker>
          </defs>
          {links.map((l, i) => (
            <Link key={i} l={l} id={id} />
          ))}
          {classes.map((c) => (
            <Card key={c.id} c={c} />
          ))}
          {links.map((l, i) => (
            <Label key={i} l={l} />
          ))}
          {texts.map((t) => (
            <text key={t.text} x={t.x} y={t.y} textAnchor={t.align || 'start'} className={styles.aside}>
              {t.text}
            </text>
          ))}
        </svg>
      </div>
      <div className={styles.legend}>
        {used.map((t) => (
          <span key={t} className={styles.li}>
            <Swatch type={t} id={id} />
            {KIND_LABEL[t]}
          </span>
        ))}
        {markets.map((m) => (
          <span key={m} className={styles.li}>
            <span className={styles.marketSw}>{m}</span>
            only in {m}
          </span>
        ))}
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
