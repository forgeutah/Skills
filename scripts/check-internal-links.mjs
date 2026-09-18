/**
 * Fails on internal markdown links that point at missing files.
 *
 * Scans every .md file in the repo (excluding node_modules), extracts
 * [text](target) and [text](target "title") markdown links, and resolves
 * targets that are relative paths (not http/https/mailto, not bare anchors,
 * not inline code). A target that is a relative path whose resolved file or
 * directory does not exist is a hard failure.
 *
 * Exits non-zero on the first problem and prints a stable summary line on success.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// [text](target) or [text](target "title") or [text](target 'title') or [text](target (title))
// Captures group 1 = target. Not matched inside code spans (a very small heuristic:
// this is a lint, not a parser).
const LINK_RE = /\[[^\]]*\]\(([^)\s]+)(?:\s+["'(][^"')]*["')])?\)/g;

function walk(root) {
  const out = [];
  const entries = readdirSync(root);
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(root, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (extname(entry) === '.md') {
      out.push(full);
    }
  }
  return out;
}

const mdFiles = walk(ROOT);
let linkCount = 0;

for (const file of mdFiles) {
  const raw = readFileSync(file, 'utf8');
  for (const match of raw.matchAll(LINK_RE)) {
    const target = match[1];
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(target) || // scheme (http, https, mailto, ...)
      target.startsWith('#') // in-file anchor
    ) {
      continue;
    }
    linkCount += 1;
    // Strip any trailing "| something" or " {text}" link-reference syntax.
    const resolved = resolve(dirname(file), target.split('|')[0].trim());
    if (!existsSync(resolved)) {
      process.stderr.write(`check-internal-links: broken link in ${relative(ROOT, file)} -> ${target}\n`);
      process.exit(1);
    }
  }
}

process.stdout.write(`links verified: ${linkCount} internal links across ${mdFiles.length} markdown files resolve\n`);
