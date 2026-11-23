#!/usr/bin/env node
/**
 * Checks every diagram file under website/diagrams against its schema, and
 * lists what to fix in plain words. Runs in a second, without a full build:
 *
 *   npm run check:diagrams
 */
const fs = require('fs');
const path = require('path');
const {check, ROOT} = require('../plugins/diagram-data/validate');

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'schemas' ? [] : walk(p);
    return /\.ya?ml$/.test(d.name) ? [p] : [];
  });
}

const files = walk(ROOT);
let bad = 0;
for (const file of files) {
  const {errors} = check(file, fs.readFileSync(file, 'utf8'));
  if (errors.length) {
    bad++;
    console.log(errors.map((e) => `  - ${e}`).join('\n'));
  }
}
if (bad) {
  console.log(`\n${bad} of ${files.length} diagram files need fixing.`);
  process.exit(1);
}
console.log(`All ${files.length} diagram files are fine.`);
