import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

/**
 * LegacyEstateMap — the payments estate as it actually runs, drawn from the two
 * source diagrams: the customer-journey traceability map (channels through
 * Arrangement Manager, GPP, FTN and the mainframe chain) and the Parsec
 * eligibility design (the facade, the caches and the standin path layered on
 * top of it).
 *
 * Everything is routed orthogonally. Connected boxes are put on shared
 * centrelines wherever possible, so the busiest edges (channels into the
 * integration hop, AM to GPP to FTN) are dead straight with no bends at all.
 * Where a bend is unavoidable the trunk is placed by hand into its own lane, so
 * parallel runs sit beside each other instead of on top of each other.
 *
 * Seventy-odd systems will not fit legibly on a page, and shrinking them until
 * they do loses the thing the map is for. So the canvas stays large and the
 * reader gets three ways in: spotlight one layer, zoom into a corner, or open
 * it full screen. Nothing is ever removed, only dimmed.
 *
 * All colour comes from the design tokens, so light and dark both render.
 */

const VB = {w: 2600, h: 1040};
const ZOOM_MIN = 1;
const ZOOM_MAX = 9;
const STUB = 14;
const CORNER = 9;

const LAYERS = [
  {id: 'channel', label: 'Channels'},
  {id: 'facade', label: 'Modernisation layer'},
  {id: 'am', label: 'AM core'},
  {id: 'processing', label: 'Processing & clearing'},
  {id: 'files', label: 'Files & third parties'},
  {id: 'mainframe', label: 'Mainframe & downstream'},
];

const PANELS = [
  {id: 'p_hop', l: 'channel', x: 240, y: 118, w: 160, h: 620, t: 'Integration hop', band: true},
  {
    id: 'p_facade',
    l: 'facade',
    x: 440,
    y: 100,
    w: 700,
    h: 600,
    t: 'Modernisation layer — added on top of AM',
    band: true,
    neu: true,
  },
  {id: 'sf', l: 'facade', x: 470, y: 210, w: 340, h: 140, t: 'Service Facade', key: true},
  {
    id: 'sorc',
    l: 'facade',
    x: 880,
    y: 130,
    w: 240,
    h: 130,
    t: 'SOR Cache',
    s: 'fallback when the primary path is down',
    key: true,
    dash: true,
  },
  {id: 'elig', l: 'facade', x: 880, y: 420, w: 240, h: 180, t: 'Eligibility', s: 'max of GAR and CAS', key: true},
];

const NODES = [
  /* ---- channels: one straight line each into the integration hop ---- */
  {id: 'voice', l: 'channel', k: 'fe', x: 20, y: 130, w: 170, h: 36, t: 'Voice Response'},
  {id: 'csp', l: 'channel', k: 'fe', x: 20, y: 176, w: 170, h: 36, t: 'CSP'},
  {id: 'wsp', l: 'channel', k: 'fe', x: 20, y: 222, w: 170, h: 36, t: 'WSP / GSP'},
  {id: 'myca', l: 'channel', k: 'fe', x: 20, y: 268, w: 170, h: 36, t: 'MYCA / Mobile'},
  {id: 'ace', l: 'channel', k: 'fe', x: 20, y: 314, w: 170, h: 36, t: 'ACE'},
  {id: 'payprof', l: 'channel', k: 'fe', x: 20, y: 360, w: 170, h: 36, t: 'Payment Profile'},
  {id: 'cop', l: 'channel', k: 'fe', x: 20, y: 406, w: 170, h: 36, t: 'COP'},
  {id: 'vpod', l: 'channel', k: 'fe', x: 20, y: 452, w: 170, h: 36, t: 'VPOD'},
  {id: 'cpm', l: 'channel', k: 'fe', x: 20, y: 498, w: 170, h: 36, t: 'CPM'},
  {id: 'gcap', l: 'channel', k: 'fe', x: 20, y: 544, w: 170, h: 36, t: 'GCAP'},
  {id: 'ormb', l: 'channel', k: 'fe', x: 20, y: 590, w: 170, h: 36, t: 'ORMB'},
  {id: 'cmfa', l: 'channel', k: 'fe', x: 20, y: 636, w: 170, h: 36, t: 'CMFA'},
  {id: 'gspref', l: 'channel', k: 'fe', x: 20, y: 682, w: 170, h: 36, t: 'GSP Refund'},

  {id: 'ngi', l: 'channel', k: 'fe', x: 252, y: 154, w: 136, h: 46, t: 'MYCA NGI', s: 'converged services'},
  {id: 'if_dp', l: 'channel', k: 'iface', x: 252, y: 244, w: 136, h: 46, t: 'DataPower'},
  {id: 'if_mq', l: 'channel', k: 'iface', x: 252, y: 330, w: 136, h: 46, t: 'MQ'},
  {id: 'if_mqr', l: 'channel', k: 'iface', x: 252, y: 416, w: 136, h: 46, t: 'MQ / REST'},
  {id: 'if_cd', l: 'channel', k: 'iface', x: 252, y: 502, w: 136, h: 46, t: 'C:D'},
  {id: 'if_ws', l: 'channel', k: 'iface', x: 252, y: 588, w: 136, h: 46, t: 'WS'},

  /* ---- modernisation layer (Parsec) ---- */
  {id: 'apigee', l: 'facade', k: 'key', x: 550, y: 130, w: 180, h: 50, t: 'APIGEE', s: 'authenticates, forwards'},
  {id: 'routing', l: 'facade', k: 'sub', neu: true, x: 486, y: 244, w: 308, h: 44, t: 'Routing', s: 'channel · market · program'},
  {id: 'cb', l: 'facade', k: 'sub', x: 486, y: 297, w: 150, h: 34, t: 'CircuitBreaker'},
  {id: 'sfpeh', l: 'facade', k: 'sub', neu: true, x: 644, y: 297, w: 150, h: 34, t: 'PreEligibilityHandler'},
  {id: 'sorgeo', l: 'facade', k: 'sub', x: 894, y: 176, w: 212, h: 34, t: 'geo account'},
  {id: 'sortri', l: 'facade', k: 'sub', x: 894, y: 214, w: 212, h: 34, t: 'triumph'},
  {
    id: 'pec',
    l: 'facade',
    k: 'key',
    neu: true,
    dash: true,
    x: 880,
    y: 300,
    w: 240,
    h: 62,
    t: 'Pre-Eligibility Cache',
    s: 'max amount + indicator · 5 min TTL',
  },
  {id: 'epeh', l: 'facade', k: 'sub', neu: true, x: 894, y: 472, w: 212, h: 34, t: 'PreEligibilityHandler'},
  {id: 'ecmi', l: 'facade', k: 'sub', x: 894, y: 510, w: 212, h: 34, t: 'CmInfoHandler'},
  {id: 'ebal', l: 'facade', k: 'sub', neu: true, x: 894, y: 548, w: 212, h: 34, t: 'BalancesHandler'},
  {id: 'altpay', l: 'facade', k: 'key', x: 456, y: 420, w: 210, h: 58, t: 'AlternatePayment', s: 'fallback for the payment journey'},
  {id: 'boom', l: 'facade', k: 'key', x: 456, y: 510, w: 210, h: 48, t: 'Boomerang'},
  {id: 'gar', l: 'facade', k: 'ext', x: 885, y: 740, w: 110, h: 52, t: 'GAR', s: 'balances'},
  {id: 'lbridge', l: 'facade', k: 'key', x: 1005, y: 640, w: 110, h: 52, t: 'Legacy Bridge'},
  {id: 'cas', l: 'facade', k: 'ext', x: 1005, y: 740, w: 110, h: 52, t: 'CAS', s: 'balances'},

  /* ---- AM core ---- */
  {id: 'wroc', l: 'am', k: 'db', x: 1185, y: 130, w: 130, h: 50, t: 'WROC DB2'},
  {id: 'sroc', l: 'am', k: 'db', x: 1335, y: 130, w: 130, h: 50, t: 'SROC DB2'},
  {id: 'ghdb', l: 'am', k: 'key', x: 1180, y: 220, w: 290, h: 62, t: 'GPHDB / GHDB', s: 'consolidated payment history'},
  {
    id: 'am',
    l: 'am',
    k: 'hero',
    x: 1180,
    y: 330,
    w: 290,
    h: 84,
    t: 'Arrangement Manager',
    s: 'AM Legacy · the legacy billpay app',
  },
  {id: 'db2', l: 'am', k: 'db', x: 1260, y: 460, w: 130, h: 50, t: 'DB2'},

  /* ---- processing & clearing ---- */
  {id: 'instream', l: 'processing', k: 'key', x: 1580, y: 130, w: 190, h: 48, t: 'Instream'},
  {id: 'firstdata', l: 'processing', k: 'tp', x: 1790, y: 130, w: 190, h: 48, t: 'First Data'},
  {id: 'il', l: 'processing', k: 'key', x: 1580, y: 200, w: 126, h: 48, t: 'IL'},
  {id: 'igor', l: 'processing', k: 'key', x: 1717, y: 200, w: 126, h: 48, t: 'IGOR'},
  {id: 'tl', l: 'processing', k: 'key', x: 1854, y: 200, w: 126, h: 48, t: 'TL'},
  {id: 'gpp', l: 'processing', k: 'hero', x: 1580, y: 330, w: 400, h: 84, t: 'GPP', s: 'global payment platform'},
  {id: 'gppdb1', l: 'processing', k: 'db', x: 1580, y: 450, w: 190, h: 52, t: 'GPP Primary DB'},
  {id: 'gppdb2', l: 'processing', k: 'db', x: 1790, y: 450, w: 190, h: 52, t: 'GPP Secondary DB'},
  {id: 'extract', l: 'processing', k: 'note', g: 'file', x: 1580, y: 526, w: 190, h: 38, t: 'Extract Files'},
  {id: 'balmsg', l: 'processing', k: 'note', g: 'msg', x: 1790, y: 526, w: 190, h: 38, t: 'Balancing Msg'},
  {id: 'bankach', l: 'processing', k: 'tp', x: 1580, y: 586, w: 190, h: 56, t: 'Bank', s: 'ACH, ACK and returns'},
  {id: 'globestar', l: 'processing', k: 'ext', x: 1790, y: 586, w: 190, h: 48, t: 'Globestar'},

  /* ---- files & third parties ---- */
  {id: 'gateway', l: 'files', k: 'key', x: 1180, y: 560, w: 190, h: 48, t: 'Gateway'},
  {id: 'firewall', l: 'files', k: 'iface', g: 'shield', x: 1180, y: 630, w: 190, h: 48, t: 'Amex Firewall'},
  {id: 'datacash', l: 'files', k: 'tp', x: 1180, y: 700, w: 190, h: 48, t: 'Datacash'},
  {id: 'bankcard', l: 'files', k: 'tp', x: 1180, y: 770, w: 190, h: 56, t: 'Bank', s: 'card rails'},
  {id: 'infoimage', l: 'files', k: 'tp', x: 1580, y: 690, w: 190, h: 56, t: 'Info Image', s: 'Datamark'},
  {id: 'payfiles', l: 'files', k: 'note', g: 'file', x: 1580, y: 766, w: 190, h: 38, t: 'Payment Files'},
  {id: 'imgfiles', l: 'files', k: 'note', g: 'file', x: 1580, y: 824, w: 190, h: 38, t: 'Payment and IMG files'},
  {id: 'transcentra', l: 'files', k: 'tp', x: 1790, y: 690, w: 190, h: 56, t: 'Transcentra'},
  {id: 'hba', l: 'files', k: 'tp', x: 1790, y: 766, w: 190, h: 56, t: 'Homebanking', s: 'Aggregator'},
  {id: 'banksft', l: 'files', k: 'tp', x: 1790, y: 842, w: 190, h: 56, t: 'Bank', s: '3rd-party SFT · ACH / ARC'},

  /* ---- mainframe & downstream ---- */
  {id: 'ftn', l: 'mainframe', k: 'hero', x: 2060, y: 330, w: 260, h: 84, t: 'FTN', s: 'file transmission network'},
  {id: 'webfocus', l: 'mainframe', k: 'ext', x: 2420, y: 130, w: 150, h: 46, t: 'WEBFOCUS'},
  {id: 'cornerstone', l: 'mainframe', k: 'ext', x: 2420, y: 186, w: 150, h: 46, t: 'Corner Stone'},
  {id: 'ablm', l: 'mainframe', k: 'ext', x: 2420, y: 242, w: 150, h: 46, t: 'ABLM'},
  {id: 'rcps', l: 'mainframe', k: 'ext', x: 2420, y: 298, w: 150, h: 46, t: 'RCPS'},
  {id: 'ccs', l: 'mainframe', k: 'ext', x: 2420, y: 410, w: 150, h: 46, t: 'Customer Comm.'},
  {id: 'payaware', l: 'mainframe', k: 'ext', x: 2420, y: 466, w: 150, h: 46, t: 'Payment Awareness'},
  {id: 'idn', l: 'mainframe', k: 'ext', x: 2420, y: 522, w: 150, h: 46, t: 'IDN / ENLIST'},
  {id: 'fincap', l: 'mainframe', k: 'ext', x: 2115, y: 660, w: 200, h: 52, t: 'FINCAP'},
  {id: 'cars', l: 'mainframe', k: 'ext', x: 2380, y: 660, w: 200, h: 52, t: 'CARS'},
  {id: 'triumph', l: 'mainframe', k: 'ext', x: 2115, y: 732, w: 200, h: 52, t: 'TRIUMPH'},
  {id: 'crs', l: 'mainframe', k: 'ext', x: 2115, y: 804, w: 200, h: 52, t: 'CRS'},
  {id: 'gbill', l: 'mainframe', k: 'ext', x: 2115, y: 876, w: 200, h: 52, t: 'Global Billing'},
  {id: 'dsto', l: 'mainframe', k: 'ext', x: 2380, y: 876, w: 200, h: 52, t: 'DSTO'},
];

const AT = {};
[...PANELS, ...NODES].forEach((n) => {
  AT[n.id] = n;
});

/* Stores have no box, so their anchors are pulled in to sit against the icon
   and the label rather than against an invisible rectangle. */
function pt(id, side) {
  const n = AT[id];
  const ix = n.k === 'db' ? 10 : 0;
  const iy = n.k === 'db' ? 7 : 0;
  const cx = n.x + n.w / 2;
  const cy = n.y + n.h / 2;
  switch (side) {
    case 'l': return [n.x + ix, cy];
    case 'lt': return [n.x + ix, n.y + n.h * 0.25];
    case 'lb': return [n.x + ix, n.y + n.h * 0.75];
    case 'r': return [n.x + n.w - ix, cy];
    case 'rt': return [n.x + n.w - ix, n.y + n.h * 0.25];
    case 'rb': return [n.x + n.w - ix, n.y + n.h * 0.75];
    case 't': return [cx, n.y + iy];
    case 'tl': return [n.x + n.w * 0.25, n.y + iy];
    case 'tr': return [n.x + n.w * 0.75, n.y + iy];
    case 'b': return [cx, n.y + n.h - iy];
    case 'bl': return [n.x + n.w * 0.25, n.y + n.h - iy];
    case 'br': return [n.x + n.w * 0.75, n.y + n.h - iy];
    default: return [cx, cy];
  }
}

const isH = (side) => side[0] === 'l' || side[0] === 'r';
function dirOf(side) {
  if (side[0] === 'l') return [-1, 0];
  if (side[0] === 'r') return [1, 0];
  if (side[0] === 't') return [0, -1];
  return [0, 1];
}

function dedupe(pts) {
  const out = [];
  pts.forEach((p) => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 0.4 || Math.abs(last[1] - p[1]) > 0.4) out.push(p);
  });
  /* drop points that sit mid-way along a straight run */
  const clean = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const a = clean[clean.length - 1];
    const b = out[i];
    const c = out[i + 1];
    const straight =
      (Math.abs(a[0] - b[0]) < 0.4 && Math.abs(b[0] - c[0]) < 0.4) ||
      (Math.abs(a[1] - b[1]) < 0.4 && Math.abs(b[1] - c[1]) < 0.4);
    if (!straight) clean.push(b);
  }
  if (out.length > 1) clean.push(out[out.length - 1]);
  return clean;
}

/* Axis-aligned waypoints, with a hand-placed trunk when the two sides face the
   same axis and a plain elbow when they do not. */
function waypoints(a, sa, b, sb, o) {
  const p1 = pt(a, sa);
  const p2 = pt(b, sb);
  if (o.ax !== undefined) p1[0] = o.ax;
  if (o.ay !== undefined) p1[1] = o.ay;
  if (o.bx !== undefined) p2[0] = o.bx;
  if (o.by !== undefined) p2[1] = o.by;

  const s = o.stub === undefined ? STUB : o.stub;
  const [dax, day] = dirOf(sa);
  const [dbx, dby] = dirOf(sb);
  const A = [p1[0] + dax * s, p1[1] + day * s];
  const B = [p2[0] + dbx * s, p2[1] + dby * s];

  if (o.via) return dedupe([p1, A, ...o.via, B, p2]);

  let mid = [];
  if (isH(sa) && isH(sb)) {
    if (Math.abs(A[1] - B[1]) > 0.4) {
      const tx = o.trunk !== undefined ? o.trunk : (A[0] + B[0]) / 2;
      mid = [[tx, A[1]], [tx, B[1]]];
    }
  } else if (!isH(sa) && !isH(sb)) {
    if (Math.abs(A[0] - B[0]) > 0.4) {
      const ty = o.trunk !== undefined ? o.trunk : (A[1] + B[1]) / 2;
      mid = [[A[0], ty], [B[0], ty]];
    }
  } else if (isH(sa)) {
    mid = [[B[0], A[1]]];
  } else {
    mid = [[A[0], B[1]]];
  }
  return dedupe([p1, A, ...mid, B, p2]);
}

function orthPath(pts, r = CORNER) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.abs(cx - px) + Math.abs(cy - py);
    const outLen = Math.abs(nx - cx) + Math.abs(ny - cy);
    const rr = Math.min(r, inLen / 2, outLen / 2);
    d += ` L${cx - Math.sign(cx - px) * rr},${cy - Math.sign(cy - py) * rr}`;
    d += ` Q${cx},${cy} ${cx + Math.sign(nx - cx) * rr},${cy + Math.sign(ny - cy) * rr}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

/* the label goes on the longest run, which is the trunk on a Z and the long
   leg on an L */
function longestMid(pts) {
  let best = -1;
  let bi = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]);
    if (len > best) {
      best = len;
      bi = i;
    }
  }
  return [(pts[bi][0] + pts[bi + 1][0]) / 2, (pts[bi][1] + pts[bi + 1][1]) / 2];
}

function link(a, sa, b, sb, o = {}) {
  const pts = waypoints(a, sa, b, sb, o);
  const [mx, my] = longestMid(pts);
  return {
    ...o,
    a,
    b,
    d: orthPath(pts),
    mx: o.lx !== undefined ? o.lx : mx + (o.dx || 0),
    my: o.ly !== undefined ? o.ly : my + (o.dy || 0),
  };
}

const CHANNEL_IDS = [
  'voice', 'csp', 'wsp', 'myca', 'ace', 'payprof', 'cop',
  'vpod', 'cpm', 'gcap', 'ormb', 'cmfa', 'gspref',
];

const EDGES = [
  /* each channel runs dead straight into the integration hop */
  ...CHANNEL_IDS.map((id) => {
    const n = AT[id];
    const y = n.y + n.h / 2;
    return {a: id, b: 'p_hop', s: 'svc', bare: true, d: `M${n.x + n.w},${y} L240,${y}`, mx: 0, my: 0};
  }),
  link('p_hop', 'r', 'apigee', 'l', {s: 'svc', bare: true, trunk: 420}),
  /* the original path: the interface thicket reaches AM directly, under the
     modernisation layer rather than through it */
  link('p_hop', 'r', 'am', 'lb', {s: 'svc', p: 'direct to AM', via: [[414, 715], [1166, 715]]}),

  /* ---- modernisation layer. Lanes 824 / 838 / 852 / 866 keep the four
     runs between the facade and the caches side by side. ---- */
  link('apigee', 'b', 'sf', 't', {s: 'svc', bare: true}),
  link('sf', 'rt', 'sorc', 'l', {s: 'svc', bare: true, stub: 8, trunk: 824}),
  link('sf', 'rb', 'pec', 'l', {s: 'svc', p: 'max_amount', stub: 8, trunk: 838, dy: -40}),
  link('pec', 'b', 'elig', 't', {s: 'svc', p: 'on cache miss'}),
  link('elig', 'lb', 'pec', 'lb', {s: 'svc', p: 'insert pre-eligibility data', stub: 8, trunk: 852, ly: 400}),
  link('sf', 'br', 'elig', 'lt', {s: 'svc', p: '/eligibilities', dy: -22}),
  link('cb', 'b', 'altpay', 't', {s: 'fb', p: '/standin'}),
  link('altpay', 'b', 'boom', 't', {s: 'sdk', p: 'SDK / JRE'}),
  link('altpay', 'r', 'elig', 'l', {s: 'svc', p: '/eligibilities', trunk: 773, lx: 773, ly: 480}),
  /* AlternatePayment reads the consolidated history: round the bottom of the
     facade, then up the lane between the facade and AM */
  link('altpay', 'l', 'ghdb', 'l', {s: 'svc', bare: true, via: [[442, 880], [1152, 880]]}),
  link('elig', 'bl', 'gar', 't', {s: 'svc', bare: true}),
  link('elig', 'br', 'lbridge', 't', {s: 'svc', bare: true}),
  link('lbridge', 'b', 'cas', 't', {s: 'svc', p: 'MQ'}),
  link('elig', 'r', 'sorc', 'r', {s: 'fb', p: 'fallback', trunk: 1134, dy: -80}),
  link('cas', 'b', 'sorc', 'b', {s: 'fb', bare: true, via: [[1060, 830], [866, 830], [866, 274]]}),

  /* ---- AM core ---- */
  link('am', 't', 'ghdb', 'b', {s: 'svc', p: 'WS'}),
  link('am', 'l', 'wroc', 'l', {s: 'data', p: 'JDBC', stub: 12, trunk: 1168, ly: 200}),
  link('am', 'b', 'db2', 't', {s: 'data', p: 'JDBC'}),
  link('wroc', 'r', 'sroc', 'l', {s: 'repl', p: 'QREP', dy: -40}),
  link('wroc', 'b', 'ghdb', 't', {s: 'data', p: 'JDBC', bx: 1250}),
  link('sroc', 'b', 'ghdb', 't', {s: 'data', p: 'JDBC', bx: 1400}),

  /* ---- AM out to the estate. Lanes 1484 / 1500 / 1516 / 1532 / 1548 / 1564
     fill the gap between AM and the processing column. ---- */
  link('am', 'r', 'il', 'l', {s: 'svc', p: 'WS', trunk: 1484}),
  link('am', 'rt', 'instream', 'l', {s: 'svc', p: 'MQ', trunk: 1500}),
  link('am', 'rt', 'firstdata', 't', {s: 'svc', p: 'WSM', via: [[1516, 351], [1516, 100], [1885, 100]]}),
  link('am', 'r', 'gpp', 'l', {s: 'svc', p: 'MQ'}),
  link('am', 'br', 'gateway', 't', {s: 'svc', p: 'WS', trunk: 535}),
  link('am', 'rb', 'globestar', 'b', {s: 'svc', p: 'DataPower', via: [[1548, 393], [1548, 648], [1885, 648]], dy: 14}),

  /* ---- processing & clearing ---- */
  link('il', 'r', 'igor', 'l', {s: 'svc', bare: true}),
  link('igor', 'r', 'tl', 'l', {s: 'svc', bare: true}),
  link('gpp', 'tl', 'il', 'b', {s: 'svc', p: 'ControlM', dx: -46}),
  link('tl', 'b', 'gpp', 'tr', {s: 'svc', p: 'ControlM', dx: 46}),
  link('gpp', 'bl', 'gppdb1', 't', {s: 'data', p: 'JDBC', ax: 1675}),
  link('gpp', 'br', 'gppdb2', 't', {s: 'data', p: 'JDBC', ax: 1885}),
  link('gppdb1', 'r', 'gppdb2', 'l', {s: 'repl', p: 'Golden Gate', dy: -46}),
  link('gppdb2', 'rt', 'webfocus', 'l', {s: 'data', p: 'JDBC', stub: 12, trunk: 1992}),
  link('gpp', 'l', 'bankach', 'l', {s: 'file', p: 'SFT', trunk: 1564, dx: -34}),

  /* ---- into and out of FTN. Lanes 1992 / 2006 / 2020 / 2034 / 2048 sit in
     the gap between the processing column and FTN. ---- */
  link('tl', 'r', 'ftn', 'lt', {s: 'file', p: 'SFT', trunk: 2006}),
  link('extract', 't', 'ftn', 'l', {s: 'file', p: 'SFT', via: [[1675, 512], [2020, 512], [2020, 372]]}),
  link('balmsg', 'r', 'ftn', 'br', {s: 'file', bare: true}),
  link('imgfiles', 'b', 'ftn', 'lb', {s: 'file', p: 'SFT', via: [[1675, 920], [2048, 920], [2048, 393]]}),
  link('ftn', 'bl', 'globestar', 'r', {s: 'file', p: 'Mainframe Batch', via: [[2125, 610]]}),
  link('ftn', 'b', 'transcentra', 't', {s: 'file', p: 'SFT', ax: 2160, via: [[2160, 650], [1885, 650]], dx: -80, dy: 8}),

  /* ---- files & third parties ---- */
  link('gateway', 'b', 'firewall', 't', {s: 'svc', bare: true}),
  link('firewall', 'b', 'datacash', 't', {s: 'svc', p: 'DataPower'}),
  link('datacash', 'b', 'bankcard', 't', {s: 'svc', bare: true}),
  link('il', 'l', 'infoimage', 't', {s: 'svc', p: 'WS', via: [[1532, 224], [1532, 672], [1675, 672]]}),
  link('igor', 'b', 'infoimage', 'tr', {s: 'svc', bare: true, via: [[2034, 262], [2034, 676]]}),
  link('infoimage', 'b', 'payfiles', 't', {s: 'file', p: 'SFT'}),
  link('payfiles', 'b', 'imgfiles', 't', {s: 'file', bare: true}),
  link('payfiles', 'r', 'hba', 'l', {s: 'file', bare: true, by: 785}),
  link('transcentra', 'b', 'hba', 't', {s: 'file', p: 'SFT'}),
  link('hba', 'b', 'banksft', 't', {s: 'file', p: 'SFT'}),

  /* ---- mainframe chain, one straight column under FTN ---- */
  link('ftn', 'b', 'fincap', 't', {s: 'file', p: 'Mainframe Batch', ax: 2215}),
  link('fincap', 'r', 'cars', 'l', {s: 'file', p: 'Mainframe Batch', dy: -40}),
  link('fincap', 'b', 'triumph', 't', {s: 'file', p: 'Mainframe Batch'}),
  link('triumph', 'b', 'crs', 't', {s: 'file', p: 'Mainframe Batch'}),
  link('crs', 'b', 'gbill', 't', {s: 'file', p: 'Mainframe Batch'}),
  link('gbill', 'r', 'dsto', 'l', {s: 'file', p: 'C:D', dy: -26}),

  /* ---- FTN back into the history, and out to the reporting estate ---- */
  link('ftn', 't', 'ghdb', 'r', {s: 'file', p: 'Mainframe Batch', via: [[2190, 300], [1564, 300], [1564, 251]], lx: 1900, ly: 300}),
  link('ftn', 'r', 'rcps', 'l', {s: 'file', bare: true, trunk: 2332}),
  link('ftn', 'r', 'ccs', 'l', {s: 'file', bare: true, trunk: 2340}),
  link('ftn', 'r', 'ablm', 'l', {s: 'file', bare: true, trunk: 2348}),
  link('ftn', 'r', 'payaware', 'l', {s: 'file', bare: true, trunk: 2356}),
  link('ftn', 'r', 'cornerstone', 'l', {s: 'file', bare: true, trunk: 2364}),
  link('ftn', 'r', 'idn', 'l', {s: 'file', p: 'Mainframe Batch', trunk: 2372, lx: 2372, ly: 596}),
];

const KIND_LABEL = [
  {k: 'fe', label: 'Channel / frontend system'},
  {k: 'iface', label: 'Interface'},
  {k: 'key', label: 'Payments domain system'},
  {k: 'ext', label: 'Outside the payments domain'},
  {k: 'tp', label: 'Third-party system'},
  {k: 'db', label: 'Database', g: 'db'},
];

const EDGE_LABEL = [
  {s: 'svc', label: 'Service call'},
  {s: 'data', label: 'Database access'},
  {s: 'file', label: 'File or batch transfer'},
  {s: 'repl', label: 'Replication'},
  {s: 'fb', label: 'Fallback / standin'},
  {s: 'sdk', label: 'SDK / JRE call'},
];

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/* Small line glyphs, drawn in a 14x16 box and scaled at the call site. They
   carry meaning the colour alone cannot: which boxes are stores, and which
   edges move files, batches or messages rather than making a call. */
const GLYPHS = {
  db: (
    <>
      <ellipse className={styles.solid} cx="7" cy="3.4" rx="5.8" ry="2.6" />
      <path d="M1.2,3.4 V12.6 a5.8,2.6 0 0 0 11.6,0 V3.4" />
      <path d="M1.2,8 a5.8,2.6 0 0 0 11.6,0" />
    </>
  ),
  file: (
    <>
      <path className={styles.solid} d="M2.4,1.6 h5.6 l3.6,3.6 v9.2 h-9.2 z" />
      <path d="M8,1.6 v3.6 h3.6" />
      <path d="M4.6,8.8 h4.6 M4.6,11.4 h4.6" />
    </>
  ),
  msg: (
    <>
      <rect className={styles.solid} x="1.4" y="3.2" width="11.2" height="8.6" rx="1.6" />
      <path d="M1.9,4.4 L7,8.4 L12.1,4.4" />
    </>
  ),
  batch: (
    <>
      <rect className={styles.solid} x="1.4" y="1.8" width="9.4" height="3.3" rx="1" />
      <rect className={styles.solid} x="2.8" y="6.2" width="9.4" height="3.3" rx="1" />
      <rect className={styles.solid} x="4.2" y="10.6" width="9.4" height="3.3" rx="1" />
    </>
  ),
  shield: (
    <>
      <path
        className={styles.solid}
        d="M7,1.3 L12.4,3.5 v4.7 c0,3.4 -2.4,5.4 -5.4,6.5 c-3,-1.1 -5.4,-3.1 -5.4,-6.5 V3.5 z"
      />
      <path d="M4.5,7.7 l1.9,1.9 l3.2,-3.5" />
    </>
  ),
  sft: (
    <>
      <path className={styles.solid} d="M1.4,1.6 h4.8 l2.4,2.4 v6.4 h-7.2 z" />
      <path d="M6.2,1.6 v2.4 h2.4" />
      <path d="M4.6,13.4 h7.8 M10.2,11.4 l2.2,2 l-2.2,2" />
    </>
  ),
};

function Glyph({name, x, y, size = 15}) {
  return (
    <g
      className={styles.glyph}
      transform={`translate(${x},${y}) scale(${size / 14})`}
      aria-hidden="true">
      {GLYPHS[name]}
    </g>
  );
}

/* rough advance width per character, by the type size each kind is set at */
const CHAR_W = {db: 7, note: 5.3, iface: 6.8, sub: 5.6};

function Shape({n, dimmed, showNew}) {
  const isNew = showNew && n.neu;
  const hasSub = Boolean(n.s);
  const isDb = n.k === 'db';
  const glyph = n.g || (isDb ? 'db' : null);
  /* An icon and its label are centred together, so a short name like DB2 sits
     as close to its icon as a long one does. */
  const gw = isDb ? 23 : 15;
  const gap = isDb ? 9 : 7;
  const runW = glyph ? gw + gap + n.t.length * (CHAR_W[n.k] || 7.2) : 0;
  const runX = n.x + (n.w - runW) / 2;
  const cx = glyph ? runX + gw + gap : n.x + n.w / 2;
  return (
    <g className={clsx(styles.node, styles[`k_${n.k}`], isNew && styles.isNew, dimmed && styles.dim)}>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={n.k === 'iface' ? n.h / 2 : 9}
        className={clsx(styles.box, n.dash && styles.dashed)}
      />
      {glyph && (
        <Glyph name={glyph} x={runX} y={n.y + n.h / 2 - gw / 2} size={gw} />
      )}
      <text
        x={cx}
        y={n.y + (hasSub ? n.h / 2 - 3 : n.h / 2 + 5)}
        style={glyph ? {textAnchor: 'start'} : undefined}
        className={styles.t}>
        {n.t}
      </text>
      {hasSub && (
        <text
          x={cx}
          y={n.y + n.h / 2 + 13}
          style={glyph ? {textAnchor: 'start'} : undefined}
          className={styles.s}>
          {n.s}
        </text>
      )}
      {isNew && (
        <rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={n.k === 'iface' ? n.h / 2 : 9}
          className={styles.newRing}
        />
      )}
    </g>
  );
}

function PanelShape({n, dimmed, showNew}) {
  const isNew = showNew && n.neu;
  return (
    <g
      className={clsx(
        styles.panel,
        n.band && styles.band,
        n.key && styles.panelKey,
        isNew && styles.panelNew,
        dimmed && styles.dim,
      )}>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={14}
        className={clsx(styles.panelBox, n.dash && styles.dashed)}
      />
      <text x={n.x + n.w / 2} y={n.y + 22} className={styles.panelT}>
        {n.t}
      </text>
      {n.s && (
        <text x={n.x + n.w / 2} y={n.y + 37} className={styles.panelS}>
          {n.s}
        </text>
      )}
    </g>
  );
}

const PILL_GLYPH = {
  'Mainframe Batch': 'batch',
  'C:D': 'sft',
  ControlM: 'batch',
};

/* Transports are set as plain text with a knockout halo. Only the labels that
   say something about the call itself keep a pill. */
const PLAIN = new Set(['JDBC', 'SDK / JRE', 'MQ', 'WS', 'SFT', 'QREP', 'WSM']);

function Pill({e, dimmed}) {
  if (PLAIN.has(e.p)) {
    return (
      <text
        x={e.mx}
        y={e.my + 3.6}
        className={clsx(styles.plain, styles[`e_${e.s}`], dimmed && styles.dim)}>
        {e.p}
      </text>
    );
  }
  const g = PILL_GLYPH[e.p];
  const w = e.p.length * 5.4 + 14 + (g ? 15 : 0);
  const left = e.mx - w / 2;
  return (
    <g className={clsx(styles.pill, styles[`e_${e.s}`], dimmed && styles.dim)}>
      <rect x={left} y={e.my - 9} width={w} height={18} rx={9} />
      {g && <Glyph name={g} x={left + 6} y={e.my - 6.5} size={13} />}
      <text x={e.mx + (g ? 7.5 : 0)} y={e.my + 3.8}>
        {e.p}
      </text>
    </g>
  );
}

export default function LegacyEstateMap({showIncremental = true}) {
  const [layer, setLayer] = useState(null);
  const [view, setView] = useState({k: 1, x: 0, y: 0});
  const [expanded, setExpanded] = useState(false);
  const svgRef = useRef(null);
  const drag = useRef(null);

  const zoomAt = useCallback((px, py, factor) => {
    setView((v) => {
      const k = clamp(v.k * factor, ZOOM_MIN, ZOOM_MAX);
      if (k === v.k) return v;
      const ux = (px - v.x) / v.k;
      const uy = (py - v.y) / v.k;
      return {k, x: px - ux * k, y: py - uy * k};
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const onWheel = (ev) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(
        ((ev.clientX - r.left) / r.width) * VB.w,
        ((ev.clientY - r.top) / r.height) * VB.h,
        ev.deltaY < 0 ? 1.15 : 1 / 1.15,
      );
    };
    el.addEventListener('wheel', onWheel, {passive: false});
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (ev) => {
      if (ev.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const onDown = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    drag.current = {
      sx: ev.clientX,
      sy: ev.clientY,
      ox: view.x,
      oy: view.y,
      fx: VB.w / r.width,
      fy: VB.h / r.height,
    };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const onMove = (ev) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({...v, x: d.ox + (ev.clientX - d.sx) * d.fx, y: d.oy + (ev.clientY - d.sy) * d.fy}));
  };
  const onUp = (ev) => {
    if (!drag.current) return;
    drag.current = null;
    ev.currentTarget.releasePointerCapture(ev.pointerId);
  };

  const nodeDim = (n) => Boolean(layer) && n.l !== layer;
  const edgeDim = (e) => Boolean(layer) && AT[e.a].l !== layer && AT[e.b].l !== layer;

  return (
    <div className={clsx(styles.wrap, expanded && styles.expanded)}>
      <div className={styles.bar}>
        <div className={styles.chips}>
          <button
            type="button"
            className={clsx(styles.chip, !layer && styles.chipOn)}
            onClick={() => setLayer(null)}>
            Show all
          </button>
          {LAYERS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={clsx(styles.chip, layer === l.id && styles.chipOn, styles[`c_${l.id}`])}
              onClick={() => setLayer(layer === l.id ? null : l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <div className={styles.tools}>
          <button type="button" className={styles.tool} onClick={() => zoomAt(VB.w / 2, VB.h / 2, 1.35)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className={styles.tool} onClick={() => zoomAt(VB.w / 2, VB.h / 2, 1 / 1.35)} aria-label="Zoom out">
            −
          </button>
          <button type="button" className={styles.tool} onClick={() => setView({k: 1, x: 0, y: 0})} aria-label="Reset zoom">
            Reset
          </button>
          <button type="button" className={styles.tool} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Close' : 'Expand'}
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        Drag to pan, scroll to zoom, or pick a layer to spotlight it. Expand for a full-screen read.
      </p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        className={styles.svg}
        role="img"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label="The legacy payments landscape. Thirteen frontend systems, among them Voice Response, CSP, WSP/GSP, MYCA and Mobile, ACE, Payment Profile, COP, VPOD, CPM, GCAP, ORMB, CMFA and GSP Refund, all reach Arrangement Manager through a thicket of interfaces: DataPower, MQ, MQ over REST, Connect Direct, web services and the MYCA NGI converged services. A modernisation layer was later added on top: APIGEE authenticates and forwards to a Service Facade holding Routing, a CircuitBreaker and a pre-eligibility handler, backed by an SOR cache of geo account and triumph data, a pre-eligibility cache holding the maximum amount and eligibility indicator for five minutes, and an Eligibility service that takes the greater of the GAR and CAS balances, reaching CAS through a Legacy Bridge over MQ. When the circuit breaker opens, the standin path runs AlternatePayment, which calls Boomerang and reads the consolidated history. At the centre sits Arrangement Manager, the legacy billpay application, over DB2, WROC DB2 and SROC DB2 replicated to each other by QREP, and GPHDB, the consolidated payment history. AM feeds Instream, First Data, IL, IGOR, TL and GPP, the global payment platform, whose primary and secondary databases replicate by Golden Gate and feed WEBFOCUS. GPP exchanges ACH files, acknowledgements and returns with the bank. Card rails run from AM through Gateway, the Amex firewall and Datacash. File paths run to Info Image and Datamark, Transcentra and the Homebanking Aggregator. FTN, the file transmission network, drives the mainframe batch chain of FINCAP, CARS, TRIUMPH, CRS, Global Billing, DSTO and the e-statement database, feeds Corner Stone, ABLM, RCPS, the customer communication system, Payment Awareness, Globestar and IDN ENLIST, and writes back into the consolidated payment history. Red markers show the systems where traceability breaks.">
        <defs>
          {EDGE_LABEL.map(({s}) => (
            <marker
              key={s}
              id={`lem-a-${s}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className={styles[`m_${s}`]} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {PANELS.map((p) => (
            <PanelShape key={p.id} n={p} dimmed={nodeDim(p)} showNew={showIncremental} />
          ))}

          <g className={styles.edges}>
            {EDGES.map((e, i) => (
              <path
                key={`${e.a}-${e.b}-${i}`}
                d={e.d}
                className={clsx(styles.edge, styles[`e_${e.s}`], edgeDim(e) && styles.dim)}
                markerEnd={`url(#lem-a-${e.s})`}
              />
            ))}
          </g>

          {NODES.map((n) => (
            <Shape key={n.id} n={n} dimmed={nodeDim(n)} showNew={showIncremental} />
          ))}

          <g>
            {EDGES.filter((e) => e.p).map((e, i) => (
              <Pill key={`${e.a}-${e.b}-p${i}`} e={e} dimmed={edgeDim(e)} />
            ))}
          </g>
        </g>
      </svg>

      <div className={styles.legend}>
        <div className={styles.lgroup}>
          <span className={styles.lhead}>What the boxes are</span>
          <div className={styles.lrow}>
            {KIND_LABEL.map((l) => (
              <span key={l.k} className={styles.li}>
                {l.g ? (
                  <svg viewBox="0 0 14 16" className={clsx(styles.swIcon, styles[`k_${l.k}`])} aria-hidden="true">
                    <g className={styles.glyph}>{GLYPHS[l.g]}</g>
                  </svg>
                ) : (
                  <i className={clsx(styles.sw, styles[`k_${l.k}`])} />
                )}
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.lgroup}>
          <span className={styles.lhead}>How they talk to each other</span>
          <div className={styles.lrow}>
            {EDGE_LABEL.map((l) => (
              <span key={l.s} className={styles.li}>
                <i className={clsx(styles.swLine, styles[`e_${l.s}`])} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.lgroup}>
          <span className={styles.lhead}>What to look out for</span>
          <div className={styles.lrow}>
            {showIncremental && (
              <span className={styles.li}>
                <i className={clsx(styles.sw, styles.swNew)} />
                Added on top of the legacy estate
              </span>
            )}
            <span className={styles.li}>
              <svg viewBox="0 0 14 16" className={clsx(styles.swIcon, styles.k_note)} aria-hidden="true">
                <g className={styles.glyph}>{GLYPHS.file}</g>
              </svg>
              File payload
            </span>
            <span className={styles.li}>
              <svg viewBox="0 0 14 16" className={clsx(styles.swIcon, styles.k_note)} aria-hidden="true">
                <g className={styles.glyph}>{GLYPHS.msg}</g>
              </svg>
              Message payload
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
