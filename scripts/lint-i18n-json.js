/**
 * lint-i18n-json.js — pre-flight checker for locale / i18n JSON files.
 *
 * A single invalid JSON file under apps/admin/src or apps/web/src makes vite
 * crash on the FIRST browser request with a cryptic "Failed to parse JSON file"
 * error, and the launcher's failure tail then shows a stale/confusing log.
 * This script validates every .json up front and reports the exact file + node's
 * parse error so the failure is precise and actionable.
 *
 * Exit codes:
 *   0 = all JSON valid
 *   1 = one or more JSON files failed to parse
 *   2 = bad invocation (no dirs given)
 *
 * Usage: node lint-i18n-json.js <dir1> [dir2] ...
 */
'use strict';

const fs = require('fs');
const path = require('path');

const roots = process.argv.slice(2);
if (roots.length === 0) {
  process.stderr.write('usage: node lint-i18n-json.js <dir1> [dir2] ...\n');
  process.exit(2);
}

let bad = 0;

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p);
    } else if (e.name.endsWith('.json')) {
      const s = fs.readFileSync(p, 'utf8');
      try {
        JSON.parse(s);
      } catch (err) {
        bad++;
        process.stderr.write(`INVALID JSON: ${p}\n`);
        process.stderr.write(`  ${err.message}\n`);
      }
    }
  }
}

for (const r of roots) walk(r);

if (bad > 0) {
  process.stderr.write(`\n${bad} JSON file(s) failed to parse. Fix the reported file(s) before starting the dev servers.\n`);
  process.exit(1);
}
process.stdout.write('all locale JSON files valid\n');
