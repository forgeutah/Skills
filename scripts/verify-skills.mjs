import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_ROOT = join(ROOT, 'skills');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const PLACEHOLDERS = /\b(TODO|FIXME|XXX|PLACEHOLDER|REPLACE_ME)\b|lorem\s+ipsum/i;

function parseFrontmatter(raw) {
  const match = FRONTMATTER.exec(raw);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fields;
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
  process.stdout.write(`verify-skills: no skills yet — add one under skills/<category>/<name>/\n`);
  process.exit(0);
}

for (const { category, name, path } of skills) {
  const skillFile = join(path, 'SKILL.md');
  const raw = readFileSync(skillFile, 'utf8');

  const fields = parseFrontmatter(raw);
  if (fields === null) {
    throw new Error(`${category}/${name}/SKILL.md: missing frontmatter (needs a --- name/description block)`);
  }
  if (typeof fields.name !== 'string' || fields.name === '') {
    throw new Error(`${category}/${name}/SKILL.md: frontmatter 'name' is required`);
  }
  if (typeof fields.description !== 'string' || fields.description === '') {
    throw new Error(`${category}/${name}/SKILL.md: frontmatter 'description' is required`);
  }
  if (!NAME_PATTERN.test(fields.name)) {
    throw new Error(`${category}/${name}/SKILL.md: name '${fields.name}' must be lowercase-hyphenated (a-z0-9-)`);
  }
  if (fields.name !== name) {
    throw new Error(`${category}/${name}/SKILL.md: frontmatter name '${fields.name}' must match the folder name`);
  }

  const body = raw.replace(FRONTMATTER, '').trim();
  if (body.length < 200) {
    throw new Error(`${category}/${name}/SKILL.md: body is too short to be useful (${body.length} chars)`);
  }
  if (PLACEHOLDERS.test(body)) {
    throw new Error(`${category}/${name}/SKILL.md: placeholder tokens (TODO/FIXME/lorem/placeholder) are not allowed`);
  }
}

process.stdout.write(`skills verified: ${skills.length} skills across ${new Set(skills.map(s => s.category)).size} categories\n`);
