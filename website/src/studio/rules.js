/**
 * What the Studio checks, and the edits that touch more than one part of a
 * journey at once. Everything here works on the journey's plain data, the
 * same shape its YAML file has.
 */
import {awaits} from '../components/JourneyMap';

export const clone = (o) => JSON.parse(JSON.stringify(o));
export const endsOf = (s) => (s.exit ? [].concat(s.exit) : []);
export const linksOf = (s) => s.links || [];

export function setEnds(s, list) {
  if (!list.length) delete s.exit;
  else s.exit = list.length === 1 ? list[0] : list;
}

export const stepLabel = (J, i) => `Step ${i + 1} (${(J.steps[i] && J.steps[i].name) || 'no name'})`;

/* The same rules the check on a pull request applies, and a few it can't
   see because it never meets an empty field: each problem names the part of
   the diagram to open, so the Studio can mark it and take you there. */
export function validate(J) {
  const errs = [];
  const steps = J.steps || [];
  if (!J.title) errs.push({key: 'head', msg: 'The journey needs a name.'});
  if (J.steps && !steps.length) errs.push({key: 'gap:0', msg: 'A journey needs at least one step.'});
  const seen = {};
  steps.forEach((st, i) => {
    if (!st.name) errs.push({key: `step:${i}`, msg: `Step ${i + 1} needs a name.`});
    else if (seen[st.name] !== undefined) errs.push({key: `step:${i}`, msg: `Steps ${seen[st.name] + 1} and ${i + 1} are both called "${st.name}". Give each step its own name.`});
    else seen[st.name] = i;
    if (st.trigger && !st.trigger.name) errs.push({key: `outside:${i}`, msg: `The event that reaches step ${i + 1} needs a name.`});
    if (st.reply === '') errs.push({key: `outside:${i}`, msg: `Say who step ${i + 1} answers, and with what.`});
    if (st.poll && !st.poll.label) errs.push({key: `calls:${i}`, msg: `The repeated call at step ${i + 1} needs a name.`});
    if (endsOf(st).some((e) => !e.state && !e.label)) errs.push({key: `ends:${i}`, msg: `An end at step ${i + 1} needs a state or a reason.`});
    linksOf(st).forEach((l, k) => {
      const t = steps.findIndex((x) => x.name === l.to);
      if (t < 0) errs.push({key: `link:${i}:${k}`, msg: `A link from step ${i + 1} points to "${l.to}", which isn't a step.`});
      else if (t === i) errs.push({key: `link:${i}:${k}`, msg: `A link from step ${i + 1} points back to itself.`});
      if (!l.label) errs.push({key: `link:${i}:${k}`, msg: `The link from step ${i + 1} needs a few words saying why, such as retry.`});
    });
  });
  (J.detail || []).forEach((d, k) => {
    if (!d.text) errs.push({key: `note:${k}`, msg: `Note ${k + 1} is empty. Write it or delete it.`});
    if (d.step && d.step > steps.length) errs.push({key: `note:${k}`, msg: `Note ${k + 1} explains step ${d.step}, and there are only ${steps.length} steps.`});
  });
  ['entry', 'core', 'workflow'].forEach((g) =>
    (J[g] || []).forEach((r, k) => {
      if (!r.label) errs.push({key: `route:${g}:${k}`, msg: 'This item needs a name.'});
    }),
  );
  if (J.status && !J.status.note) errs.push({key: 'head', msg: 'Say why this journey has no steps to draw.'});
  return errs;
}

export function uniqueName(J, base) {
  const names = new Set(J.steps.map((s) => s.name));
  if (!names.has(base)) return base;
  let n = 2;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/* Numbered notes follow their steps when steps move or go. */
function renumberNotes(J, map, dropped, mode) {
  J.detail = (J.detail || []).filter((d) => {
    if (!d.step) return true;
    if (d.step - 1 === dropped) {
      if (mode === 'delete') return false;
      delete d.step;
      return true;
    }
    d.step = map(d.step - 1) + 1;
    return true;
  });
  if (!J.detail.length) delete J.detail;
}

/* The word for how a journey starts belongs to whichever step is first. */
function fixArrives(J) {
  const holder = J.steps.find((s) => s.arrives);
  if (!holder || holder === J.steps[0]) return;
  const word = holder.arrives;
  delete holder.arrives;
  if (J.steps[0] && !J.steps[0].trigger) J.steps[0].arrives = word;
}

/* After a move, numbered notes follow their steps; a note between steps
   stays after the note it followed. */
function sortNotes(J) {
  let key = 0;
  const keyed = (J.detail || []).map((d, idx) => {
    if (d.step) key = d.step;
    return {d, idx, k: d.step ? d.step : key + 0.5};
  });
  keyed.sort((a, b) => a.k - b.k || a.idx - b.idx);
  if (keyed.length) J.detail = keyed.map((x) => x.d);
}

export function addStep(J, b) {
  J.steps = J.steps || [];
  const prev = J.steps[b - 1];
  const step = {name: uniqueName(J, 'New step'), mode: prev ? (prev.mode === 'awaiting' ? 'background' : prev.mode || 'live') : 'live'};
  J.steps.splice(b, 0, step);
  renumberNotes(J, (i) => (i >= b ? i + 1 : i));
  fixArrives(J);
  return `New step added as step ${b + 1}`;
}

/* Deleting a step drops the links to it as well, and says how many. */
export function deleteStep(J, i, notes) {
  const label = stepLabel(J, i);
  const name = J.steps[i].name;
  let dropped = 0;
  J.steps.forEach((x) => {
    if (!x.links) return;
    const keep = x.links.filter((l) => l.to !== name);
    dropped += x.links.length - keep.length;
    if (keep.length) x.links = keep;
    else delete x.links;
  });
  dropped += linksOf(J.steps[i]).length;
  J.steps.splice(i, 1);
  renumberNotes(J, (k) => (k > i ? k - 1 : k), i, notes);
  fixArrives(J);
  const extra = dropped ? `, and ${dropped === 1 ? 'its link' : `its ${dropped} links`}` : '';
  return `${label} deleted${notes === 'delete' ? ', with its notes' : ''}${extra}`;
}

/* Move step `from` to the gap `b` (the gap before step b). Returns the new
   index, or null when the step would land where it is. */
export function moveStep(J, from, b) {
  if (b === from || b === from + 1) return null;
  const to = b > from ? b - 1 : b;
  const [st] = J.steps.splice(from, 1);
  J.steps.splice(to, 0, st);
  renumberNotes(J, (k) => {
    if (k === from) return to;
    if (from < to && k > from && k <= to) return k - 1;
    if (to < from && k >= to && k < from) return k + 1;
    return k;
  });
  sortNotes(J);
  fixArrives(J);
  return to;
}

/* What happens in the gap before a step: straight on, a wait, or an event. */
export function gapKind(step) {
  if (!step) return null;
  return step.trigger ? 'event' : awaits(step) ? 'wait' : 'straight';
}
