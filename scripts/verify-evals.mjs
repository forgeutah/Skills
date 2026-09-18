import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_ROOT = join(ROOT, 'skills');

function fail(message) {
  process.stderr.write(`verify-evals: ${message}\n`);
  process.exit(1);
}

function listSkillDirs(root) {
  const out = [];
  let topEntries;
  try {
    topEntries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of topEntries.sort()) {
    if (entry.startsWith('.')) continue;
    const full = join(root, entry);
    if (!statSync(full).isDirectory()) continue;
    const subEntries = readdirSync(full);
    for (const sub of subEntries.sort()) {
      if (sub.startsWith('.')) continue;
      const subFull = join(full, sub);
      if (statSync(subFull).isDirectory()) {
        out.push({ category: entry, name: sub, path: subFull });
      }
    }
  }
  return out;
}

const skills = listSkillDirs(SKILL_ROOT);
if (skills.length === 0) {
  process.stdout.write('verify-evals: no skills yet — add evals/evals.json with each new skill\n');
  process.exit(0);
}

for (const { category, name, path } of skills) {
  const evalsPath = join(path, 'evals', 'evals.json');
  if (!existsSync(evalsPath)) fail(`${category}/${name}: missing evals/evals.json`);

  let document;
  try {
    document = JSON.parse(readFileSync(evalsPath, 'utf8'));
  } catch (error) {
    fail(`${category}/${name}: invalid JSON (${error.message})`);
  }

  if (document.skill_name !== name) {
    fail(`${category}/${name}: skill_name must match the folder name`);
  }
  if (!Array.isArray(document.evals) || document.evals.length < 2) {
    fail(`${category}/${name}: evals must contain at least two cases`);
  }

  const ids = new Set();
  for (const test of document.evals) {
    if (!Number.isInteger(test.id) || ids.has(test.id)) {
      fail(`${category}/${name}: eval ids must be unique integers`);
    }
    ids.add(test.id);
    if (typeof test.prompt !== 'string' || test.prompt.trim() === '') {
      fail(`${category}/${name}: every eval needs a prompt`);
    }
    if (typeof test.expected_output !== 'string' || test.expected_output.trim() === '') {
      fail(`${category}/${name}: every eval needs expected_output`);
    }
    if (!Array.isArray(test.expectations) || test.expectations.length === 0) {
      fail(`${category}/${name}: every eval needs one or more expectations`);
    }
  }
}

process.stdout.write(`eval fixtures verified: ${skills.length} skills\n`);
