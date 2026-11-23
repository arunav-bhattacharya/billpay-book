/**
 * Reads a diagram's YAML file and checks it against its schema.
 *
 * Every folder under website/diagrams holds one kind of diagram, and the
 * schema for that kind is diagrams/schemas/<kind>.schema.json, where <kind>
 * is the folder's name without its plural "s" (journeys -> journey). The
 * build, the dev server and `npm run check:diagrams` all call this, so a
 * mistake reads the same wherever it is caught: the file, the place in it
 * in words ("step 4, Customer back"), and what to write instead.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

const ROOT = path.join(__dirname, '..', '..', 'diagrams');
const ajv = new Ajv({allErrors: true, strict: false});
const compiled = new Map();

function schemaFor(file) {
  const folder = path.basename(path.dirname(file));
  const kind = folder.replace(/s$/, '');
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
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const next = parts[i + 1];
    const isIndex = next !== undefined && /^\d+$/.test(next);
    if (isIndex) {
      const item = node && node[key] && node[key][Number(next)];
      const n = Number(next) + 1;
      const named = item && (item.name || item.label || item.state);
      const noun = {steps: 'step', detail: 'note', entry: 'the "Through" item', core: 'the "Billpay" item', workflow: 'workflow', systems: 'call', exit: 'end', channels: 'channel'}[key] || key;
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
  if (validate(data)) {
    return {data, errors: []};
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
  return {data, errors};
}

module.exports = {check, ROOT};
