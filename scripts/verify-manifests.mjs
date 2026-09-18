/**
 * Validates every plugin manifest in the repo: parses as JSON and carries the
 * required shape for its declared schema.
 *
 * Manifests checked:
 *   - plugin.json                     (agent-plugins.org schema 1.0.0)
 *   - .claude-plugin/plugin.json      + marketplace.json
 *   - .codex-plugin/plugin.json
 *   - .cursor-plugin/plugin.json      + marketplace.json
 *   - .agents/plugins/marketplace.json
 *
 * Exits non-zero on the first problem and prints a stable summary line on success.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Each manifest: relative path -> predicate on the parsed object.
// Predicates mirror the shape each schema expects. Keep them strict but
// additive: this is a shape lint, not a full schema validator.
const MANIFESTS = [
  {
    path: 'plugin.json',
    check: (o) =>
      typeof o['$schema'] === 'string' &&
      o['$schema'].startsWith('https://agent-plugins.org/schemas/') &&
      typeof o.name === 'string' &&
      o.name !== '' &&
      typeof o.version === 'string' &&
      typeof o.description === 'string' &&
      typeof o.license === 'string' &&
      Array.isArray(o.keywords),
  },
  {
    path: '.claude-plugin/plugin.json',
    check: (o) =>
      typeof o.name === 'string' && o.name !== '' &&
      typeof o.version === 'string' &&
      typeof o.description === 'string' &&
      typeof o.author?.name === 'string',
  },
  {
    path: '.claude-plugin/marketplace.json',
    check: (o) =>
      typeof o['$schema'] === 'string' &&
      typeof o.name === 'string' &&
      typeof o.owner?.name === 'string' &&
      Array.isArray(o.plugins) &&
      o.plugins.every((p) => typeof p.name === 'string' && typeof p.source === 'string'),
  },
  {
    path: '.codex-plugin/plugin.json',
    check: (o) =>
      typeof o.name === 'string' && o.name !== '' &&
      typeof o.version === 'string' &&
      typeof o.description === 'string' &&
      typeof o.skills === 'string',
  },
  {
    path: '.cursor-plugin/plugin.json',
    check: (o) =>
      typeof o.name === 'string' && o.name !== '' &&
      typeof o.version === 'string' &&
      typeof o.description === 'string' &&
      typeof o.author?.name === 'string' &&
      typeof o.skills === 'string',
  },
  {
    path: '.cursor-plugin/marketplace.json',
    check: (o) =>
      typeof o.name === 'string' &&
      typeof o.owner?.name === 'string' &&
      Array.isArray(o.plugins) &&
      o.plugins.every((p) => typeof p.name === 'string' && typeof p.source === 'string'),
  },
  {
    path: '.agents/plugins/marketplace.json',
    check: (o) =>
      typeof o.name === 'string' &&
      typeof o.interface?.displayName === 'string' &&
      Array.isArray(o.plugins) &&
      o.plugins.every((p) => typeof p.name === 'string' && typeof p.source?.source === 'string'),
  },
];

let checked = 0;
for (const { path, check } of MANIFESTS) {
  const full = join(ROOT, path);
  if (!existsSync(full)) {
    process.stderr.write(`verify-manifests: missing manifest ${path}\n`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(full, 'utf8'));
  } catch (err) {
    process.stderr.write(`verify-manifests: ${path} is not valid JSON: ${err.message}\n`);
    process.exit(1);
  }
  if (!check(parsed)) {
    process.stderr.write(`verify-manifests: ${path} does not match its declared schema shape\n`);
    process.exit(1);
  }
  checked += 1;
}

process.stdout.write(`manifests verified: ${checked} manifests match their declared schema shape\n`);
