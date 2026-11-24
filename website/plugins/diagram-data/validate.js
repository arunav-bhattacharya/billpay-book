/**
 * Reads a diagram's YAML file and checks it against its schema.
 *
 * Every folder under website/diagrams holds one kind of diagram, and the
 * schema for that kind is diagrams/schemas/<kind>.schema.json, where <kind>
 * is the folder's name without its plural "s" (journeys -> journey). A file
 * at the top of the folder, such as systems.yaml or theme.yaml, has a schema
 * of its own name. The build, the dev server and `npm run check:diagrams`
 * all call this, so a mistake reads the same wherever it is caught: the
 * file, the place in it in words ("step 4, Customer back"), and what to
 * write instead.
 *
 * A schema can't see across files, so a journey gets a few checks of its
 * own after it passes: every system it calls is in systems.yaml, no two
 * steps share a name, and every link points to another step of the journey.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..', '..', 'diagrams');
const SYSTEMS_FILE = path.join(ROOT, 'systems.yaml');
const ajv = new Ajv({allErrors: true, strict: false});
const compiled = new Map();

function schemaFor(file) {
  const kind =
    path.resolve(path.dirname(file)) === path.resolve(ROOT)
      ? path.basename(file).replace(/\.ya?ml$/, '')
      : path.basename(path.dirname(file)).replace(/s$/, '');
  const schemaPath = path.join(ROOT, 'schemas', `${kind}.schema.json`);
  if (!compiled.has(schemaPath)) {
    if (!fs.existsSync(schemaPath)) {
      return {schemaPath, validate: null};
    }
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    compiled.set(schemaPath, {schema, validate: ajv.compile(schema)});
  }
  return {schemaPath, ...compiled.get(schemaPath)};
}

/* "/steps/3/trigger/kind" -> "step 4 (Customer back), its trigger, kind" */
function where(data, pointer) {
  const parts = pointer.split('/').slice(1);
  const words = [];
  let node = data;
  // systems.yaml is a list at its top, so its pointers start with a number.
  if (Array.isArray(data) && /^\d+$/.test(parts[0] || '')) {
    const item = data[Number(parts[0])];
    words.push(`system ${Number(parts[0]) + 1}${item && typeof item.name === 'string' ? ` (${item.name})` : ''}`);
    node = item;
    parts.shift();
  }
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const next = parts[i + 1];
    const isIndex = next !== undefined && /^\d+$/.test(next);
    if (isIndex) {
      const item = node && node[key] && node[key][Number(next)];
      const n = Number(next) + 1;
      const named = item && (item.name || item.label || item.state);
      const noun = {steps: 'step', detail: 'note', entry: 'the "Through" item', core: 'the "Billpay" item', workflow: 'workflow', systems: 'call', exit: 'end', channels: 'channel', links: 'link'}[key] || key;
      words.push(`${noun} ${n}${named && typeof named === 'string' ? ` (${named})` : ''}`);
      node = item;
      i++;
      continue;
    }
    words.push(key);
    node = node && node[key];
  }
  return words.join(', ') || 'the top of the file';
}

function explain(data, err, schema) {
  const at = where(data, err.instancePath);
  const p = err.params || {};
  switch (err.keyword) {
    case 'enum': {
      const value = err.instancePath.split('/').reduce((n, k) => (k && n ? n[k] : n), data);
      return `${at}: "${value}" is not allowed. Use one of: ${p.allowedValues.join(', ')}.`;
    }
    case 'required':
      return `${at}: "${p.missingProperty}" is missing, and it is needed.`;
    case 'additionalProperties': {
      return `${at}: "${p.additionalProperty}" is not a field it can have. Check the spelling.`;
    }
    case 'type':
      return `${at}: should be ${{string: 'text', array: 'a list', object: 'a group of fields', boolean: 'true or false', integer: 'a whole number'}[p.type] || p.type}.`;
    case 'minimum':
      return `${at}: should be ${p.limit} or more.`;
    case 'anyOf':
      return null;
    default:
      return `${at}: ${err.message}.`;
  }
}

/* The names in systems.yaml, or null when that file can't be read; its own
   check then says why. */
function systemNames() {
  try {
    const list = yaml.load(fs.readFileSync(SYSTEMS_FILE, 'utf8'));
    return Array.isArray(list) ? new Set(list.map((s) => s && s.name)) : null;
  } catch (e) {
    return null;
  }
}

/* What a schema can't check: names that must match across a file, or
   across files. */
function crossCheck(kind, data) {
  const errors = [];
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  if (kind === 'systems' && Array.isArray(data)) {
    const seen = new Set();
    data.filter(isObj).forEach((s, i) => {
      if (s.name && seen.has(s.name)) errors.push(`system ${i + 1} (${s.name}): another system already has this name. Keep one of them.`);
      seen.add(s.name);
    });
  }
  if (kind === 'journey' && isObj(data) && Array.isArray(data.steps)) {
    const known = systemNames();
    const steps = data.steps.map((s) => (isObj(s) ? s : {}));
    const names = steps.map((s) => s.name);
    steps.forEach((s, i) => {
      const at = `step ${i + 1} (${s.name})`;
      if (s.name && names.indexOf(s.name) !== i) {
        errors.push(`${at}: step ${names.indexOf(s.name) + 1} has the same name. Give each step its own name, so a link can tell them apart.`);
      }
      [].concat(s.systems || []).forEach((name, k) => {
        if (known && typeof name === 'string' && !known.has(name)) {
          errors.push(`${at}, call ${k + 1}: "${name}" is not on the list of systems. Check the spelling against diagrams/systems.yaml, or add the system there.`);
        }
      });
      [].concat(s.links || []).filter((l) => isObj(l) && typeof l.to === 'string').forEach((l, k) => {
        const t = names.indexOf(l.to);
        if (t < 0) errors.push(`${at}, link ${k + 1}: there is no step called "${l.to}". Write the name exactly as the step has it.`);
        else if (t === i) errors.push(`${at}, link ${k + 1}: it points back to its own step. Point it to another step.`);
      });
    });
  }
  return errors;
}

function check(file, text) {
  const name = path.relative(path.join(ROOT, '..'), file);
  let data;
  try {
    data = yaml.load(text, {filename: name});
  } catch (e) {
    const line = e.mark ? ` at line ${e.mark.line + 1}` : '';
    return {data: null, errors: [`${name}${line}: the file can't be read as YAML. ${e.reason || e.message}. Check the indenting and that every "key: value" has a space after the colon.`]};
  }
  const {validate, schemaPath, schema} = schemaFor(file);
  if (!validate) {
    return {data, errors: [`${name}: there is no schema at ${path.relative(path.join(ROOT, '..'), schemaPath)} for this folder.`]};
  }
  const kind = path.basename(schemaPath).replace('.schema.json', '');
  const cross = crossCheck(kind, data).map((e) => `${name}, ${e}`);
  if (validate(data)) {
    return {data, errors: cross};
  }
  // An "exit" that is neither one end nor a list reports both failures; keep
  // the useful half.
  const seen = new Set();
  const errors = [];
  for (const err of validate.errors) {
    const msg = explain(data, err, schema);
    if (msg && !seen.has(msg)) {
      seen.add(msg);
      errors.push(`${name}, ${msg}`);
    }
  }
  return {data, errors: [...errors, ...cross]};
}

module.exports = {check, ROOT, SYSTEMS_FILE};
