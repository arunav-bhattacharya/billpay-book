import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import useOverlay from '../../lib/useOverlay';
import styles from './styles.module.css';

/**
 * LegacyEstateMap: the payments estate as it actually runs, drawn from the two
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

const VB = {w: 2600, h: 1300};
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
  {id: 'p_hop', l: 'channel', x: 240, y: 130, w: 160, h: 640, t: 'Integration hop', band: true},
  {
    id: 'p_facade',
    l: 'facade',
    x: 440,
    y: 130,
    w: 700,
    h: 780,
    t: 'Modernisation layer, added on top of AM',
    band: true,
    neu: true,
  },
  {id: 'sf', l: 'facade', x: 456, y: 270, w: 340, h: 168, t: 'Service Facade', key: true, strong: true},
  {
    id: 'sorc',
    l: 'facade',
    x: 880,
    y: 168,
    w: 240,
    h: 152,
    t: 'SOR Cache',
    s: 'fallback when the primary path is down',
    key: true,
    dash: true,
  },
  {id: 'elig', l: 'facade', x: 880, y: 512, w: 240, h: 212, t: 'Eligibility', s: 'max of GAR and CAS', key: true, strong: true},
  {id: 'p_corp', l: 'am', x: 1180, y: 1040, w: 330, h: 172, t: 'Corporate Allocations', band: true},
];

const NODES = [
  /* ---- channels: one straight line each into the integration hop ---- */
  {id: 'voice', l: 'channel', k: 'fe', x: 20, y: 150, w: 170, h: 42, t: 'Voice Response'},
  {id: 'csp', l: 'channel', k: 'fe', x: 20, y: 204, w: 170, h: 42, t: 'CSP'},
  {id: 'wsp', l: 'channel', k: 'fe', x: 20, y: 258, w: 170, h: 42, t: 'WSP / GSP'},
  {id: 'myca', l: 'channel', k: 'fe', x: 20, y: 312, w: 170, h: 42, t: 'MYCA / Mobile'},
  {id: 'ace', l: 'channel', k: 'fe', x: 20, y: 366, w: 170, h: 42, t: 'ACE'},
  {id: 'payprof', l: 'channel', k: 'fe', x: 20, y: 420, w: 170, h: 42, t: 'Payment Profile'},
  {id: 'vpod', l: 'channel', k: 'fe', x: 20, y: 474, w: 170, h: 42, t: 'VPOD'},
  {id: 'gcap', l: 'channel', k: 'fe', x: 20, y: 528, w: 170, h: 42, t: 'GCAP'},
  {id: 'ormb', l: 'channel', k: 'fe', x: 20, y: 582, w: 170, h: 42, t: 'ORMB'},
  {id: 'cmfa', l: 'channel', k: 'fe', x: 20, y: 636, w: 170, h: 42, t: 'CMFA'},
  {id: 'gspref', l: 'channel', k: 'fe', x: 20, y: 690, w: 170, h: 42, t: 'GSP Refund'},

  {id: 'apigee', l: 'channel', k: 'iface', x: 252, y: 168, w: 136, h: 54, t: 'APIGEE', s: 'authenticates, forwards'},
  {id: 'if_dp', l: 'channel', k: 'iface', x: 252, y: 266, w: 136, h: 54, t: 'DataPower'},
  {id: 'if_mq', l: 'channel', k: 'iface', x: 252, y: 364, w: 136, h: 54, t: 'MQ'},
  {id: 'if_mqr', l: 'channel', k: 'iface', x: 252, y: 462, w: 136, h: 54, t: 'MQ / REST'},
  {id: 'if_cd', l: 'channel', k: 'iface', x: 252, y: 560, w: 136, h: 54, t: 'C:D'},
  {id: 'if_ws', l: 'channel', k: 'iface', x: 252, y: 658, w: 136, h: 54, t: 'WS'},

  /* ---- modernisation layer (Parsec) ---- */
  {id: 'routing', l: 'facade', k: 'sub', neu: true, x: 472, y: 312, w: 308, h: 50, t: 'Routing', s: 'channel \u00b7 market \u00b7 program'},
  {id: 'cb', l: 'facade', k: 'sub', x: 472, y: 372, w: 150, h: 42, t: 'CircuitBreaker'},
  {id: 'sfpeh', l: 'facade', k: 'sub', neu: true, x: 630, y: 372, w: 150, h: 42, t: 'PreEligibilityHandler'},
  {id: 'sorgeo', l: 'facade', k: 'sub', x: 894, y: 222, w: 212, h: 42, t: 'geo account'},
  {id: 'sortri', l: 'facade', k: 'sub', x: 894, y: 268, w: 212, h: 42, t: 'triumph'},
  {
    id: 'pec',
    l: 'facade',
    k: 'key',
    neu: true,
    dash: true,
    x: 880,
    y: 361,
    w: 240,
    h: 70,
    t: 'Pre-Eligibility Cache',
    s: 'max amount + indicator \u00b7 5 min TTL',
  },
  {id: 'epeh', l: 'facade', k: 'sub', neu: true, x: 894, y: 574, w: 212, h: 42, t: 'PreEligibilityHandler'},
  {id: 'ecmi', l: 'facade', k: 'sub', x: 894, y: 620, w: 212, h: 42, t: 'CmInfoHandler'},
  {id: 'ebal', l: 'facade', k: 'sub', neu: true, x: 894, y: 666, w: 212, h: 42, t: 'BalancesHandler'},
  {id: 'altpay', l: 'facade', k: 'key', x: 456, y: 512, w: 340, h: 66, t: 'AlternatePayment', s: 'fallback for the payment journey'},
  {id: 'boom', l: 'facade', k: 'key', x: 456, y: 616, w: 340, h: 56, t: 'Boomerang'},
  {id: 'lbridge', l: 'facade', k: 'key', x: 1004, y: 780, w: 116, h: 60, t: 'Legacy Bridge'},
  {id: 'gar', l: 'facade', k: 'ext', x: 880, y: 960, w: 116, h: 60, t: 'GAR', s: 'balances'},
  {id: 'cas', l: 'facade', k: 'ext', x: 1004, y: 960, w: 116, h: 60, t: 'CAS', s: 'balances'},

  /* ---- AM core ---- */
  {id: 'ghdb_e', l: 'am', k: 'db', x: 1200, y: 168, w: 130, h: 50, t: 'US-East DB2', s: 'GPHDB'},
  {id: 'ghdb_w', l: 'am', k: 'db', x: 1360, y: 168, w: 130, h: 50, t: 'US-West DB2', s: 'GPHDB'},
  {id: 'ghdb', l: 'am', k: 'hero', x: 1200, y: 280, w: 290, h: 74, t: 'GPHDB', s: 'consolidated payment history'},
  {id: 'amdb_e', l: 'am', k: 'db', x: 1200, y: 560, w: 120, h: 50, t: 'US-East DB2', s: 'AM'},
  {id: 'amdb_w', l: 'am', k: 'db', x: 1370, y: 560, w: 120, h: 50, t: 'US-West DB2', s: 'AM'},
  {
    id: 'am',
    l: 'am',
    k: 'hero',
    x: 1200,
    y: 420,
    w: 290,
    h: 96,
    t: 'Arrangement Manager',
    s: 'AM Legacy \u00b7 the legacy billpay app',
  },

  /* ---- processing & clearing ---- */
  {id: 'instream', l: 'processing', k: 'ext', x: 1580, y: 168, w: 190, h: 56, t: 'Instream'},
  {id: 'firstdata', l: 'processing', k: 'tp', x: 1790, y: 168, w: 190, h: 56, t: 'First Data'},
  {id: 'il', l: 'processing', k: 'key', x: 1580, y: 260, w: 126, h: 56, t: 'IL'},
  {id: 'igor', l: 'processing', k: 'ext', x: 1717, y: 260, w: 126, h: 56, t: 'IGOR'},
  {id: 'tl', l: 'processing', k: 'key', x: 1854, y: 260, w: 126, h: 56, t: 'TL'},
  {id: 'gpp', l: 'processing', k: 'hero', x: 1580, y: 420, w: 400, h: 96, t: 'GPP', s: 'global payment platform'},
  {id: 'gppdb1', l: 'processing', k: 'db', x: 1580, y: 570, w: 190, h: 58, t: 'GPP Primary DB'},
  {id: 'gppdb2', l: 'processing', k: 'db', x: 1790, y: 570, w: 190, h: 58, t: 'GPP Secondary DB'},
  {id: 'extract', l: 'processing', k: 'note', g: 'file', x: 1580, y: 660, w: 190, h: 46, t: 'Extract Files'},
  {id: 'balmsg', l: 'processing', k: 'note', g: 'msg', x: 1790, y: 660, w: 190, h: 46, t: 'Balancing Msg'},
  {id: 'globestar', l: 'processing', k: 'ext', x: 1790, y: 740, w: 190, h: 56, t: 'Globestar'},

  /* ---- card rails, files and the one bank ---- */
  {id: 'gateway', l: 'files', k: 'key', x: 1250, y: 660, w: 190, h: 56, t: 'Gateway'},
  {id: 'firewall', l: 'files', k: 'iface', g: 'shield', x: 1250, y: 740, w: 190, h: 56, t: 'Amex Firewall'},
  {id: 'datacash', l: 'files', k: 'tp', x: 1250, y: 820, w: 190, h: 56, t: 'Datacash'},
  {id: 'bank', l: 'files', k: 'bank', g: 'bank', icon: 54, x: 1250, y: 906, w: 190, h: 92, t: 'Bank'},
  {id: 'infoimage', l: 'files', k: 'tp', x: 1580, y: 840, w: 190, h: 66, t: 'Info Image', s: 'Datamark'},
  {id: 'payfiles', l: 'files', k: 'note', g: 'file', x: 1580, y: 930, w: 190, h: 46, t: 'Payment Files'},
  {id: 'imgfiles', l: 'files', k: 'note', g: 'file', x: 1580, y: 1000, w: 190, h: 46, t: 'Payment and IMG files'},
  {id: 'hba', l: 'files', k: 'tp', x: 1580, y: 1090, w: 190, h: 66, t: 'Homebanking', s: 'Aggregator'},
  {id: 'wcr', l: 'files', k: 'hero', x: 1820, y: 1075, w: 230, h: 96, t: 'WCR'},
  {id: 'wcrdb_e', l: 'files', k: 'db', x: 1820, y: 1195, w: 120, h: 50, t: 'US-East DB2', s: 'WCR'},
  {id: 'wcrdb_w', l: 'files', k: 'db', x: 1950, y: 1195, w: 120, h: 50, t: 'US-West DB2', s: 'WCR'},

  /* ---- mainframe & downstream ---- */
  {id: 'ftn', l: 'mainframe', k: 'hero', x: 2060, y: 420, w: 260, h: 96, t: 'FTN', s: 'file transmission network'},
  {id: 'webfocus', l: 'mainframe', k: 'ext', x: 2420, y: 168, w: 150, h: 56, t: 'WEBFOCUS'},
  {id: 'cornerstone', l: 'mainframe', k: 'ext', x: 2420, y: 238, w: 150, h: 56, t: 'Corner Stone'},
  {id: 'ablm', l: 'mainframe', k: 'key', x: 2420, y: 308, w: 150, h: 56, t: 'ABLM'},
  {id: 'rcps', l: 'mainframe', k: 'key', x: 2420, y: 378, w: 150, h: 56, t: 'RCPS'},
  {id: 'ccs', l: 'mainframe', k: 'ext', x: 2420, y: 448, w: 150, h: 56, t: 'Customer Comm.'},
  {id: 'payaware', l: 'mainframe', k: 'ext', x: 2420, y: 518, w: 150, h: 56, t: 'Payment Awareness'},
  {id: 'idn', l: 'mainframe', k: 'ext', x: 2420, y: 588, w: 150, h: 56, t: 'IDN / ENLIST'},
  {id: 'fincap', l: 'mainframe', k: 'ext', x: 2115, y: 800, w: 200, h: 60, t: 'FINCAP'},
  {id: 'cop', l: 'am', k: 'ext', x: 1200, y: 1090, w: 140, h: 54, t: 'COP'},
  {id: 'cpm', l: 'am', k: 'ext', x: 1350, y: 1090, w: 140, h: 54, t: 'CPM'},
  {id: 'cars', l: 'am', k: 'ext', x: 1275, y: 1152, w: 140, h: 54, t: 'CARS'},
  {id: 'triumph', l: 'mainframe', k: 'ext', x: 2115, y: 890, w: 200, h: 60, t: 'TRIUMPH'},
  {id: 'crs', l: 'mainframe', k: 'ext', x: 2115, y: 980, w: 200, h: 60, t: 'CRS'},
  {id: 'gbill', l: 'mainframe', k: 'ext', x: 2115, y: 1070, w: 200, h: 60, t: 'Global Billing'},
  {id: 'dsto', l: 'mainframe', k: 'ext', x: 2380, y: 1070, w: 200, h: 60, t: 'DSTO'},
];

const AT = {};
[...PANELS, ...NODES].forEach((n) => {
  AT[n.id] = n;
});

/* Stores and the bank have no box, so their anchors are pulled in to sit
   against the icon and the label rather than an invisible rectangle. */
function pt(id, side) {
  const n = AT[id];
  const ix = n.k === 'db' ? 10 : n.k === 'bank' ? 60 : 0;
  const iy = n.k === 'db' ? 7 : n.k === 'bank' ? 10 : 0;
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
  'voice', 'csp', 'wsp', 'myca', 'ace', 'payprof',
  'vpod', 'gcap', 'ormb', 'cmfa', 'gspref',
];

const EDGES = [
  /* each channel runs dead straight into the integration hop */
  ...CHANNEL_IDS.map((id) => {
    const n = AT[id];
    const y = n.y + n.h / 2;
    return {a: id, b: 'p_hop', s: 'svc', d: `M${n.x + n.w},${y} L240,${y}`, mx: 0, my: 0};
  }),
  /* the original path: the interface thicket reaches AM directly, under the
     modernisation layer rather than through it */
  link('p_hop', 'r', 'am', 'l', {s: 'svc', p: 'direct to AM', via: [[414, 880], [1186, 880]]}),

  /* ---- modernisation layer. Lanes 824 / 838 / 852 / 866 keep the runs
     between the facade and the caches side by side. ---- */
  link('apigee', 'r', 'sf', 't', {s: 'svc'}),
  link('sf', 'rt', 'sorc', 'l', {s: 'svc', stub: 8, trunk: 824}),
  link('sf', 'rb', 'pec', 'l', {s: 'svc', p: 'max_amount', dy: -44}),
  link('pec', 'b', 'elig', 't', {s: 'svc', p: 'on cache miss', ly: 490}),
  link('elig', 'lb', 'pec', 'lb', {s: 'svc', p: 'insert pre-eligibility data', stub: 8, trunk: 852, ly: 478}),
  link('sf', 'r', 'elig', 'l', {s: 'svc', p: '/eligibilities', trunk: 838, lx: 830, ly: 500}),
  /* the facade still hands the request on to AM: it took the routing decision
     off the channels, it did not replace the app underneath */
  link('sf', 'r', 'am', 'l', {s: 'svc', p: '/inquiry · /payment', ay: 424, by: 452, trunk: 810, lx: 1000, ly: 452}),
  link('cb', 'b', 'altpay', 't', {s: 'fb', p: '/standin', bx: 547}),
  link('altpay', 'b', 'boom', 't', {s: 'svc'}),
  /* dead straight into Eligibility: AlternatePayment sits at the same height.
     The gap is only 84px, so the call keeps its label on the facade edge above
     rather than burying the arrow under a second identical pill. */
  link('altpay', 'r', 'elig', 'l', {s: 'svc', by: 545}),
  link('altpay', 'l', 'ghdb', 'l', {s: 'svc', via: [[442, 1060], [1150, 1060], [1150, 317]]}),
  link('elig', 'bl', 'gar', 't', {s: 'svc', ax: 938}),
  link('elig', 'br', 'lbridge', 't', {s: 'svc', ax: 1062}),
  link('lbridge', 'b', 'cas', 't', {s: 'svc', p: 'MQ'}),
  link('elig', 'r', 'sorc', 'r', {s: 'fb', p: 'fallback', trunk: 1134, dy: -110}),
  link('cas', 'b', 'sorc', 'b', {s: 'fb', via: [[1062, 1100], [866, 1100], [866, 334]]}),

  /* ---- AM core ---- */
  link('am', 't', 'ghdb', 'b', {s: 'svc', p: 'WS'}),
  link('ghdb', 't', 'ghdb_e', 'b', {s: 'data', ax: 1265}),
  link('ghdb', 't', 'ghdb_w', 'b', {s: 'data', ax: 1425}),
  link('ghdb_e', 'r', 'ghdb_w', 'l', {s: 'repl', p: 'QREP', dy: -40}),
  link('am', 'b', 'amdb_e', 't', {s: 'data', ax: 1260}),
  link('am', 'b', 'amdb_w', 't', {s: 'data', ax: 1430}),
  link('amdb_e', 'r', 'amdb_w', 'l', {s: 'repl', p: 'QREP', dy: -40}),
  link('wcr', 'b', 'wcrdb_e', 't', {s: 'data', ax: 1880}),
  link('wcr', 'b', 'wcrdb_w', 't', {s: 'data', ax: 2010}),
  link('wcrdb_e', 'r', 'wcrdb_w', 'l', {s: 'repl', p: 'QREP', dy: -40}),
  /* WCR keeps its DB2 in the same two centres, reached over the top */
  /* corporate allocations feed the arrangement they belong to */
  link('p_corp', 'l', 'am', 'lb', {s: 'svc', p: 'allocations', stub: 16, via: [[1164, 1126], [1164, 492]], lx: 1155, ly: 898}),

  /* ---- AM out to the estate. Lanes 1503 / 1516 / 1529 / 1542 / 1555 / 1568
     fill the gap between AM and the processing column. ---- */
  link('am', 'r', 'il', 'l', {s: 'svc', p: 'WS', trunk: 1503}),
  link('am', 'rt', 'instream', 'l', {s: 'svc', p: 'MQ', trunk: 1516}),
  link('am', 'rt', 'firstdata', 't', {s: 'svc', p: 'WSM', via: [[1529, 444], [1529, 145], [1885, 145]]}),
  link('am', 'r', 'gpp', 'l', {s: 'svc', p: 'MQ'}),
  link('am', 'b', 'gateway', 't', {s: 'svc', p: 'WS', ax: 1345, dy: -45}),
  link('am', 'rb', 'globestar', 'b', {s: 'svc', p: 'DataPower', via: [[1555, 492], [1555, 812], [1885, 812]]}),

  /* ---- processing & clearing ---- */
  link('il', 'r', 'igor', 'l', {s: 'svc'}),
  link('igor', 'r', 'tl', 'l', {s: 'svc'}),
  link('gpp', 'tl', 'il', 'b', {s: 'svc', p: 'ControlM', ax: 1643}),
  link('tl', 'b', 'gpp', 'tr', {s: 'svc', p: 'ControlM', bx: 1917}),
  link('gpp', 'bl', 'gppdb1', 't', {s: 'data', ax: 1675}),
  link('gpp', 'br', 'gppdb2', 't', {s: 'data', ax: 1885}),
  link('gppdb1', 'r', 'gppdb2', 'l', {s: 'repl', p: 'Golden Gate', dy: -48}),
  link('gppdb2', 'rt', 'webfocus', 'l', {s: 'data', stub: 12, trunk: 1992}),
  link('gpp', 'l', 'bank', 'r', {s: 'file', p: 'SFT', trunk: 1568}),

  /* ---- into and out of FTN ---- */
  link('tl', 'r', 'ftn', 'lt', {s: 'file', p: 'SFT', trunk: 2006}),
  link('extract', 't', 'ftn', 'l', {s: 'file', p: 'SFT', via: [[1675, 640], [2020, 640], [2020, 468]]}),
  link('balmsg', 'r', 'ftn', 'br', {s: 'file'}),
  link('imgfiles', 'r', 'ftn', 'lb', {s: 'file', p: 'SFT', via: [[2046, 1023], [2046, 492]]}),
  link('ftn', 'bl', 'globestar', 'r', {s: 'file', p: 'Mainframe Batch', via: [[2125, 768]]}),

  /* ---- card rails, and the inbound chain: bank to homebanking to WCR to FTN ---- */
  link('gateway', 'b', 'firewall', 't', {s: 'svc'}),
  link('firewall', 'b', 'datacash', 't', {s: 'svc', p: 'DataPower'}),
  link('datacash', 'b', 'bank', 't', {s: 'svc'}),
  link('bank', 'rb', 'hba', 'l', {s: 'file', p: 'SFT', trunk: 1516, dy: -40}),
  link('hba', 'r', 'wcr', 'l', {s: 'file', p: 'SFT'}),
  link('wcr', 'r', 'ftn', 'b', {s: 'file', p: 'SFT', bx: 2085, via: [[2085, 1123]]}),

  /* ---- image and payment files ---- */
  link('il', 'l', 'infoimage', 't', {s: 'svc', p: 'WS', via: [[1542, 288], [1542, 790], [1675, 790]]}),
  link('igor', 'b', 'infoimage', 'tr', {s: 'svc', via: [[2034, 330], [2034, 826]]}),
  link('infoimage', 'b', 'payfiles', 't', {s: 'file', p: 'SFT'}),
  link('payfiles', 'b', 'imgfiles', 't', {s: 'file'}),

  /* ---- mainframe chain, one straight column under FTN ---- */
  link('ftn', 'b', 'fincap', 't', {s: 'file', p: 'Mainframe Batch', ax: 2215, dy: 80}),
  link('fincap', 'b', 'triumph', 't', {s: 'file', p: 'Mainframe Batch'}),
  link('triumph', 'b', 'crs', 't', {s: 'file', p: 'Mainframe Batch'}),
  link('crs', 'b', 'gbill', 't', {s: 'file', p: 'Mainframe Batch'}),
  link('gbill', 'r', 'dsto', 'l', {s: 'file', p: 'C:D', dy: -44}),
  link('fincap', 'l', 'cars', 'r', {s: 'file', p: 'Mainframe Batch', via: [[1536, 830], [1536, 1179]], ly: 900}),

  /* ---- FTN back into the history, and out to the reporting estate ---- */
  link('ftn', 't', 'ghdb', 'r', {s: 'file', p: 'Mainframe Batch', via: [[2190, 380], [1555, 380], [1555, 317]], lx: 2160, ly: 380}),
  /* one bus rather than six lanes: every feed leaves FTN on the same stub at
     y=441, runs to a shared spine, and combs off into its own system. The
     transport is labelled once, above the top of the spine. */
  link('ftn', 'r', 'cornerstone', 'l', {s: 'file', p: 'Mainframe Batch', ay: 441, trunk: 2370, lx: 2358, ly: 244}),
  link('ftn', 'r', 'ablm', 'l', {s: 'file', ay: 441, trunk: 2370}),
  link('ftn', 'r', 'rcps', 'l', {s: 'file', ay: 441, trunk: 2370}),
  link('ftn', 'r', 'ccs', 'l', {s: 'file', ay: 441, trunk: 2370}),
  link('ftn', 'r', 'payaware', 'l', {s: 'file', ay: 441, trunk: 2370}),
  link('ftn', 'r', 'idn', 'l', {s: 'file', ay: 441, trunk: 2370}),
];

const KIND_LABEL = [
  {k: 'fe', label: 'Channel / frontend system'},
  {k: 'iface', label: 'Interface'},
  {k: 'key', label: 'Payments domain system'},
  {k: 'ext', label: 'Outside the payments domain'},
  {k: 'tp', label: 'Third-party system'},
];

const EDGE_LABEL = [
  {s: 'svc', label: 'Service call'},
  {s: 'data', label: 'Database access'},
  {s: 'file', label: 'File or batch transfer'},
  {s: 'repl', label: 'Replication'},
  {s: 'fb', label: 'Fallback / standin'},
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
  bank: (
    <>
      <path d="M1,5.6 L7,1.9 L13,5.6" />
      <rect className={styles.solid} x="0.8" y="5.6" width="12.4" height="1.8" rx="0.6" />
      <path d="M3.2,7.8 V12.2 M7,7.8 V12.2 M10.8,7.8 V12.2" />
      <rect className={styles.solid} x="0.8" y="12.4" width="12.4" height="1.9" rx="0.6" />
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

function Shape({n, dimmed}) {
  const isNew = n.neu;
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
        <Glyph
          name={glyph}
          x={n.icon ? n.x + n.w / 2 - n.icon / 2 : runX}
          y={n.icon ? n.y + 12 : n.y + n.h / 2 - gw / 2}
          size={n.icon || gw}
        />
      )}
      {n.icon ? (
        <text x={n.x + n.w / 2} y={n.y + n.h - 10} className={styles.t}>
          {n.t}
        </text>
      ) : (
        <>
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
        </>
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

function PanelShape({n, dimmed}) {
  const isNew = n.neu;
  return (
    <g
      className={clsx(
        styles.panel,
        n.band && styles.band,
        n.key && styles.panelKey,
        n.strong && styles.panelStrong,
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
      <text x={n.x + n.w / 2} y={n.y + (n.strong ? 30 : 22)} className={styles.panelT}>
        {n.t}
      </text>
      {n.s && (
        <text x={n.x + n.w / 2} y={n.y + (n.strong ? 48 : 37)} className={styles.panelS}>
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
const PLAIN = new Set(['MQ', 'WS', 'SFT', 'QREP', 'WSM']);

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

/* Toolbar glyphs. Drawn rather than typed so they sit on the same optical
   weight as the + and − buttons beside them. */
const TOOL_ICONS = {
  reset: (
    <>
      <path d="M3.2 8a4.8 4.8 0 1 1 1.5 3.5" />
      <path d="M3 4.4V8h3.6" />
    </>
  ),
  expand: (
    <>
      <path d="M6.2 2.3H2.3v3.9" />
      <path d="M9.8 2.3h3.9v3.9" />
      <path d="M13.7 9.8v3.9H9.8" />
      <path d="M2.3 9.8v3.9h3.9" />
    </>
  ),
  collapse: (
    <>
      <path d="M2.3 6.2h3.9V2.3" />
      <path d="M13.7 6.2H9.8V2.3" />
      <path d="M9.8 13.7V9.8h3.9" />
      <path d="M6.2 13.7V9.8H2.3" />
    </>
  ),
};

function ToolIcon({name}) {
  return (
    <svg viewBox="0 0 16 16" className={styles.toolIcon} aria-hidden="true">
      {TOOL_ICONS[name]}
    </svg>
  );
}

export default function LegacyEstateMap() {
  const [layer, setLayer] = useState(null);
  const [view, setView] = useState({k: 1, x: 0, y: 0});
  const [expanded, setExpanded] = useState(false);
  const svgRef = useRef(null);
  const closeRef = useRef(null);
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

  const collapse = useCallback(() => setExpanded(false), []);
  useOverlay({open: expanded, onClose: collapse, focusRef: closeRef});

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
    <div
      className={clsx(styles.wrap, expanded && styles.expanded)}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      aria-label={expanded ? 'Payments estate, full screen' : undefined}>
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
          <button
            type="button"
            className={styles.tool}
            onClick={() => setView({k: 1, x: 0, y: 0})}
            aria-label="Reset zoom"
            title="Reset zoom">
            <ToolIcon name="reset" />
          </button>
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
        aria-label="The legacy payments landscape. Eleven frontend systems, among them Voice Response, CSP, WSP/GSP, MYCA and Mobile, ACE, Payment Profile, VPOD, GCAP, ORMB, CMFA and GSP Refund, reach Arrangement Manager through an integration hop of APIGEE, DataPower, MQ, MQ over REST, Connect Direct and web services. A modernisation layer was later added on top: a Service Facade holding Routing, a CircuitBreaker and a pre-eligibility handler, backed by an SOR cache of geo account and triumph data, a pre-eligibility cache holding the maximum amount and eligibility indicator for five minutes, and an Eligibility service that takes the greater of the GAR and CAS balances, reaching CAS through a Legacy Bridge over MQ. The facade forwards the inquiry and payment calls on to Arrangement Manager rather than replacing it. When the circuit breaker opens, the standin path runs AlternatePayment, which calls Boomerang and reads the consolidated history. At the centre sits Arrangement Manager, the legacy billpay application, and GPHDB, the consolidated payment history. AM, GPHDB and WCR each keep their own DB2 in US-East and US-West, replicated to each other by QREP. AM feeds Instream, First Data, IL, IGOR, TL and GPP, the global payment platform, whose primary and secondary databases replicate by Golden Gate and feed WEBFOCUS. Corporate allocations reach AM from COP, CPM and CARS. Card rails run from AM through Gateway, the Amex firewall and Datacash to the bank. Inbound files run from the bank through the Homebanking Aggregator and WCR into FTN, the file transmission network, which also takes extract files, balancing messages and payment and image files. FTN drives the mainframe batch chain of FINCAP, CARS, TRIUMPH, CRS, Global Billing and DSTO, feeds Corner Stone, ABLM, RCPS, the customer communication system, Payment Awareness, Globestar and IDN ENLIST, and writes back into the consolidated payment history.">
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
            <PanelShape key={p.id} n={p} dimmed={nodeDim(p)} />
          ))}

          <g>
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
            <Shape key={n.id} n={n} dimmed={nodeDim(n)} />
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
          <span className={styles.lhead}>Systems</span>
          <div className={styles.lrow}>
            {KIND_LABEL.map((l) => (
              <span key={l.k} className={styles.li}>
                <i className={clsx(styles.sw, styles[`k_${l.k}`])} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.lgroup}>
          <span className={styles.lhead}>Connectivity</span>
          <div className={styles.lrow}>
            {EDGE_LABEL.map((l) => (
              <span key={l.s} className={styles.li}>
                <i className={clsx(styles.swLine, styles[`e_${l.s}`])} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
