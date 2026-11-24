/**
 * Writes the Studio's edits back out as the files in the repository, in the
 * same layout, so an edit changes only the lines it should and a file with
 * no edits comes out exactly as it went in.
 */
import {dump} from 'js-yaml';
import {KINDS} from '../lib/journeyTheme';

function pick(o, keys) {
  const r = {};
  keys.forEach((k) => {
    if (o[k] !== undefined && o[k] !== '' && !(Array.isArray(o[k]) && !o[k].length)) r[k] = o[k];
  });
  return r;
}

/* The fields in the order the files keep them. */
function normalize(p) {
  const d = pick(p, ['title', 'eyebrow', 'kind']);
  if (p.origin) {
    const o = pick(p.origin, ['actor', 'channels', 'note']);
    if (Object.keys(o).length) d.origin = o;
  }
  if (p.entry && p.entry.length) d.entry = p.entry.map((r) => pick(r, ['kind', 'label', 'note']));
  if (p.core && p.core.length) d.core = p.core.map((r) => pick(r, ['kind', 'label', 'note']));
  if (p.workflow && p.workflow.length) d.workflow = [].concat(p.workflow).map((w) => pick(w, ['label', 'note', 'child']));
  if (p.steps) {
    d.steps = p.steps.map((s) => {
      const o = pick(s, ['name', 'state', 'mode', 'caption', 'arrives', 'trigger', 'reply', 'systems', 'poll', 'table', 'waiting', 'exit', 'links']);
      if (o.links) o.links = o.links.map((l) => pick(l, ['to', 'label']));
      if (o.trigger) o.trigger = pick(o.trigger, ['kind', 'name', 'label']);
      if (o.poll) o.poll = pick(o.poll, ['label', 'note']);
      if (o.exit) {
        const ends = [].concat(o.exit).map((e) => pick(e, ['state', 'label'])).filter((e) => Object.keys(e).length);
        if (!ends.length) delete o.exit;
        else o.exit = ends.length === 1 ? ends[0] : ends;
      }
      return o;
    });
  }
  if (p.status) d.status = pick(p.status, ['kind', 'note']);
  if (p.detailLabel) d.detailLabel = p.detailLabel;
  if (p.detailOpen) d.detailOpen = p.detailOpen;
  if (p.detail && p.detail.length) d.detail = p.detail.map((x) => pick(x, ['step', 'text']));
  if (p.reference) d.reference = pick(p.reference, ['to', 'label']);
  return d;
}

export function emitJourney(p) {
  const head = [
    '# yaml-language-server: $schema=../schemas/journey.schema.json',
    '# $schema: ../schemas/journey.schema.json',
    '#',
    `# ${p.title}: one journey on Design > Journeys > All Journeys.`,
    '# Change the words after the colons. Keep the indenting as it is.',
    '# How to edit, and what each field means: website/diagrams/README.md',
    '',
    '',
  ].join('\n');
  let body = dump(normalize(p), {lineWidth: 100, noRefs: true, quotingType: '"', flowLevel: -1});
  body = body
    .replace(/\n(origin|entry|core|workflow|steps|status|detail|reference):/g, '\n\n$1:')
    .replace(/\n {2}- name:/g, '\n\n  - name:')
    .replace(/(steps:\n)\n/, '$1');
  return head + body;
}

/* A plain value stays plain; anything YAML would read as something else, or
   that starts with a mark YAML reserves, is quoted. */
const q = (s) => (/^[\s`*[\]{}&!%@#|>'",?:-]|: | #|\s$/.test(s) || /^(true|false|null|yes|no|on|off|~|[-+.\d][\d.e+-]*)$/i.test(s) ? JSON.stringify(s) : s);

export function emitSystems(list) {
  return [
    '# yaml-language-server: $schema=schemas/systems.schema.json',
    '# $schema: schemas/systems.schema.json',
    '#',
    '# The systems a journey step can call. A journey names a system by its',
    '# name; the lane shows the short name if there is one, and the full name',
    '# shows on hover. Add a new system at the end, with the same indenting.',
    '# How to edit: website/diagrams/README.md',
    '',
    ...list.flatMap((s) => [`- name: ${q(s.name)}`, ...(s.short ? [`  short: ${q(s.short)}`] : []), `  full: ${q(s.full)}`]),
    '',
  ].join('\n');
}

export function emitTheme(theme) {
  return [
    '# yaml-language-server: $schema=schemas/theme.schema.json',
    '# $schema: schemas/theme.schema.json',
    '#',
    '# The colours of every journey diagram, one per kind of part. Each value',
    '# is a colour name from the Amex palette, and the site draws it in both',
    '# light and dark. Which names each part can take, and what each means:',
    '# website/diagrams/README.md',
    '',
    'journeys:',
    ...Object.keys(KINDS).map((k) => `  ${k}: ${theme[k]}`),
    '',
  ].join('\n');
}

/* A line diff, trimmed to the changed lines and two either side. Each row is
   [mark, text]: '+' added, '-' removed, ' ' unchanged, '~' lines skipped. */
export function diffLines(a, b) {
  const A = a.split('\n');
  const B = b.split('\n');
  const n = A.length;
  const m = B.length;
  const L = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      out.push([' ', A[i]]);
      i++;
      j++;
    } else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) {
      out.push(['+', B[j]]);
      j++;
    } else {
      out.push(['-', A[i]]);
      i++;
    }
  }
  const changed = out.map((x) => x[0] !== ' ');
  const rows = [];
  let skipped = false;
  out.forEach((row, k) => {
    if (!changed.slice(Math.max(0, k - 2), k + 3).some(Boolean)) {
      if (!skipped) rows.push(['~', '']);
      skipped = true;
      return;
    }
    skipped = false;
    rows.push(row);
  });
  return rows;
}
