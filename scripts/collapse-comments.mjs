#!/usr/bin/env node
// Collapse comments longer than 2 lines across the codebase. Lexer-based, so strings, templates, regexes, and…
// JSX comments are never corrupted; pragmas and triple-slash directives are left untouched. Usage: [--dry].
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry');

const EXCLUDE_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.git', 'migrations']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.prisma']);

const PRAGMA_RE =
  /@ts-ignore|@ts-expect-error|@ts-nocheck|@ts-check|eslint-disable|eslint-enable|istanbul|prettier-ignore/;

// Triple-slash compiler directives (e.g. /// <reference types="next" />) are
// functional, not prose — they must stay on their own line, never merged.
const TRIPLE_DIRECTIVE_RE = /^\s*\/\/\/\s*</;

// Characters after which a `/` starts a regex literal (heuristic).
const REGEX_PREFIX = new Set([
  '(',
  '[',
  '{',
  ',',
  ';',
  ':',
  '=',
  '!',
  '&',
  '|',
  '?',
  '+',
  '-',
  '*',
  '%',
  '^',
  '~',
  '<',
  '>',
]);

const MAX_LINE = 110;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(extname(entry.name))) yield full;
  }
}

// ── lexer helpers ───────────────────────────────────────────────────────────

function skipString(code, i, quote) {
  let j = i + 1;
  while (j < code.length) {
    if (code[j] === '\\') {
      j += 2;
      continue;
    }
    if (code[j] === quote) return j + 1;
    j += 1;
  }
  return code.length;
}

function skipToLineEnd(code, i) {
  const nl = code.indexOf('\n', i);
  return nl === -1 ? code.length : nl + 1;
}

function skipBlock(code, i) {
  const end = code.indexOf('*/', i + 2);
  return end === -1 ? code.length : end + 2;
}

function skipRegex(code, i) {
  let j = i + 1;
  let inClass = false;
  while (j < code.length) {
    const c = code[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return j + 1;
    else if (c === '\n') return j;
    j += 1;
  }
  return code.length;
}

function skipTemplate(code, i) {
  let j = i + 1;
  while (j < code.length) {
    const c = code[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '`') return j + 1;
    if (c === '$' && code[j + 1] === '{') {
      j = skipTemplateExpr(code, j + 2);
      continue;
    }
    j += 1;
  }
  return code.length;
}

function skipTemplateExpr(code, i) {
  let depth = 1;
  let j = i;
  let prev = '';
  while (j < code.length) {
    const c = code[j];
    if (c === "'" || c === '"') {
      j = skipString(code, j, c);
      prev = c;
      continue;
    }
    if (c === '`') {
      j = skipTemplate(code, j);
      prev = c;
      continue;
    }
    if (c === '/' && code[j + 1] === '/') {
      j = skipToLineEnd(code, j);
      prev = '\n';
      continue;
    }
    if (c === '/' && code[j + 1] === '*') {
      j = skipBlock(code, j);
      prev = ' ';
      continue;
    }
    if (c === '/' && regexAllowed(prev)) {
      j = skipRegex(code, j);
      prev = '/';
      continue;
    }
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
    if (!/\s/.test(c)) prev = c;
    j += 1;
  }
  return code.length;
}

function regexAllowed(prev) {
  if (prev === '' || prev === '\n') return true;
  return REGEX_PREFIX.has(prev);
}

// ── comment text helpers ────────────────────────────────────────────────────

function truncate(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const end = lastSpace > max * 0.5 ? lastSpace : max;
  return cut.slice(0, end).trimEnd() + '…';
}

function condenseToLines(text, prefix) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return prefix;
  if (normalized.length <= MAX_LINE) return `${prefix} ${normalized}`;
  const line1 = truncate(normalized, MAX_LINE);
  const rest = normalized.slice(line1.length).trim();
  const line2 = rest.length > 0 ? truncate(rest, MAX_LINE) : '';
  return line2 ? `${prefix} ${line1}\n${prefix} ${line2}` : `${prefix} ${line1}`;
}

function extractBlockContent(lines) {
  const content = [];
  for (let k = 0; k < lines.length; k += 1) {
    let line = lines[k];
    if (k === 0) line = line.replace(/^\/\*\*?/, '');
    if (k === lines.length - 1) line = line.replace(/\*\/\s*$/, '');
    line = line.replace(/^\s*\* ?/, '').trim();
    if (line) content.push(line);
  }
  return content;
}

function linePrefixOf(line) {
  return /^\s*\/\/\//.test(line) ? '///' : '//';
}
// Reads a run of consecutive `//`-style comment lines starting at `start` (which points at the first `/`).…
// Returns { text, end } where `end` is the position right after the group (start of the next line) and `text`…
function readLineGroup(code, start, eol) {
  const n = code.length;
  let i = start;
  const lines = [];
  while (i < n) {
    let j = i;
    while (j < n && code[j] !== '\n' && code[j] !== '\r') j += 1;
    lines.push(code.slice(i, j));
    if (j >= n) {
      i = j;
      break;
    }
    i = j + (code[j] === '\r' ? 2 : 1);
    let k = i;
    while (k < n && (code[k] === ' ' || code[k] === '\t')) k += 1;
    if (code[k] === '/' && code[k + 1] === '/') {
      i = k;
      continue;
    }
    break;
  }
  const end = i;
  if (lines.length <= 2 || lines.some((l) => PRAGMA_RE.test(l) || TRIPLE_DIRECTIVE_RE.test(l))) {
    return { text: lines.join(eol) + eol, end };
  }
  const content = lines.map((l) => l.replace(/^\s*\/{2,3}/, '').trim()).filter(Boolean);
  const prefix = linePrefixOf(lines[0]);
  const condensed = condenseToLines(content.join(' '), prefix);
  return { text: condensed + eol, end };
}
// Reads a `/* ... */` block comment starting at `start`. Returns { text, end } where `end` points just past…
// the closing marker and `text` is the replacement (indentation excluded — handled by the caller).
function readBlock(code, start) {
  const n = code.length;
  const close = code.indexOf('*/', start + 2);
  const end = close === -1 ? n : close + 2;
  const raw = code.slice(start, end);
  const lines = raw.split(/\r?\n/);
  const hasPragma = PRAGMA_RE.test(raw);

  if (lines.length <= 2 || hasPragma) {
    return { text: raw, end };
  }

  const content = extractBlockContent(lines);
  const condensed = condenseToLines(content.join(' '), '//');
  return { text: condensed, end };
}

function transform(code) {
  const eol = code.includes('\r\n') ? '\r\n' : '\n';
  const out = [];
  let i = 0;
  const n = code.length;

  const lastNonWs = () => {
    for (let k = out.length - 1; k >= 0; k -= 1) {
      if (!/\s/.test(out[k])) return out[k];
    }
    return '';
  };
  const popTrailingWs = () => {
    // Only pop single-char whitespace elements: multi-char elements (string
    // literals pushed as one unit) must never be treated as whitespace.
    while (out.length > 0) {
      const last = out[out.length - 1];
      if (typeof last === 'string' && last.length === 1 && /\s/.test(last)) out.pop();
      else break;
    }
  };

  // Whitespace-only prefix of the current comment's line ('' when mid-line).
  const lineIndent = (start) => {
    let lineStart = start;
    while (lineStart > 0 && code[lineStart - 1] !== '\n' && code[lineStart - 1] !== '\r') {
      lineStart -= 1;
    }
    const between = code.slice(lineStart, start);
    return between.trim() === '' ? between : '';
  };

  const emitComment = (start, text, wasChanged) => {
    if (!wasChanged) {
      out.push(text);
      return;
    }
    const indent = lineIndent(start);
    popTrailingWs();
    // Always restore the line break: for own-line comments the newline was
    // popped above, for mid-line comments it moves the comment to its own line.
    if (out.length > 0) out.push(eol);
    // Indent every line of the replacement, not just the first. Normalize line endings first so this is idempotent…
    // when `text` already contains the eol sequence (e.g. CRLF from readLineGroup).
    const lines = text.replace(/\r\n/g, '\n').replace(/\n/g, eol).split(eol);
    const trailing = lines[lines.length - 1] === '' ? eol : '';
    const body = lines.filter((l) => l !== '');
    out.push(indent + body.join(eol + indent) + trailing);
  };

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === "'" || ch === '"') {
      out.push(code.slice(i, skipString(code, i, ch)));
      i = skipString(code, i, ch);
      continue;
    }
    if (ch === '`') {
      out.push(code.slice(i, skipTemplate(code, i)));
      i = skipTemplate(code, i);
      continue;
    }
    if (ch === '/' && next === '/') {
      const group = readLineGroup(code, i, eol);
      emitComment(i, group.text, group.text !== code.slice(i, group.end));
      i = group.end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const block = readBlock(code, i);
      const close = code.indexOf('*/', i + 2);
      const end = close === -1 ? n : close + 2;

      // JSX comment `{/* ... */}` — keep the wrapper, condense content only.
      const nextNonWs = (() => {
        let k = end;
        while (k < n && /\s/.test(code[k])) k += 1;
        return code[k];
      })();
      if (lastNonWs() === '{' && nextNonWs === '}') {
        const rawLines = code.slice(i, end).split(/\r?\n/);
        const content = extractBlockContent(rawLines).join(' ').replace(/\s+/g, ' ').trim();
        if (content.length <= MAX_LINE * 2) {
          out.push(`/* ${content} */`);
        } else {
          const line1 = truncate(content, MAX_LINE);
          const rest = content.slice(line1.length).trim();
          const line2 = truncate(rest, MAX_LINE);
          out.push(`/*\n * ${line1}\n * ${line2}\n */`);
        }
        i = end;
        continue;
      }

      const wasChanged = block.text !== code.slice(i, block.end);
      emitComment(i, block.text, wasChanged);
      i = block.end;
      continue;
    }
    if (ch === '/' && regexAllowed(lastNonWs())) {
      out.push(code.slice(i, skipRegex(code, i)));
      i = skipRegex(code, i);
      continue;
    }
    out.push(ch);
    i += 1;
  }

  return out.join('');
}

export { transform };

// ── main ────────────────────────────────────────────────────────────────────

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  let changed = 0;
  let removed = 0;

  for (const file of walk(ROOT)) {
    const original = readFileSync(file, 'utf8');
    const updated = transform(original);
    if (updated === original) continue;
    changed += 1;
    removed += Math.max(0, original.split(/\r?\n/).length - updated.split(/\r?\n/).length);
    if (DRY) {
      console.log(`[dry] ${file}`);
    } else {
      writeFileSync(file, updated);
    }
  }

  console.log(
    DRY
      ? `[dry-run] ${changed} files would change (~${removed} comment lines removed).`
      : `Done: collapsed comments in ${changed} files (~${removed} comment lines removed).`,
  );
}
