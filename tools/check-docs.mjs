// Doc structure check: every markdown doc must be readable by section (see tools/sec.mjs).
// Usage: node tools/check-docs.mjs [--strict]
// FAIL: no title (#), no sections (##), mixed line endings, or a file named in the Claude.md doc map is missing.
// WARN: a leaf section (no sub-headings) longer than LEAF_MAX lines, or a long file with too few headings.
// Exit 0 when there is no FAIL (and no WARN with --strict).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const LEAF_MAX = 60; // lines; split a leaf section above this
const LINES_PER_HEADING = 60; // a long file should have at least one heading per this many lines
const LONG_FILE = 120;
const ROOT_DOCS = ["Claude.md", "ROADMAP.md", "README.md", "CHANGELOG.md", "SERVER_PATH.md"];
const strict = process.argv.includes("--strict");

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
  });
const files = [...ROOT_DOCS.filter(existsSync), ...(existsSync("docs") ? walk("docs") : [])];

const fails = [];
const warns = [];

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const crlf = (raw.match(/\r\n/g) ?? []).length;
  const lf = (raw.match(/\n/g) ?? []).length - crlf;
  if (crlf && lf) fails.push(`${file}: mixed line endings (${crlf} CRLF, ${lf} LF)`);

  const lines = raw.replace(/\r/g, "").split("\n");
  let fence = false;
  const heads = [];
  lines.forEach((l, i) => {
    if (/^```/.test(l)) fence = !fence;
    const m = !fence && /^(#{1,6})\s+(.*)$/.exec(l);
    if (m) heads.push({ i, level: m[1].length, title: m[2] });
  });

  if (!heads.some((h) => h.level === 1)) fails.push(`${file}: no title (# heading)`);
  if (!heads.some((h) => h.level === 2)) fails.push(`${file}: no sections (## headings)`);
  if (lines.length > LONG_FILE && lines.length / Math.max(1, heads.length) > LINES_PER_HEADING) {
    warns.push(`${file}: ${lines.length} lines but only ${heads.length} headings`);
  }
  heads.forEach((h, k) => {
    const next = heads.slice(k + 1).find((x) => x.level <= h.level);
    const end = next ? next.i : lines.length;
    const hasChild = heads.some((x) => x.i > h.i && x.i < end);
    if (!hasChild && end - h.i > LEAF_MAX) warns.push(`${file}:${h.i + 1}: section "${h.title}" is ${end - h.i} lines (max ${LEAF_MAX})`);
  });
}

// Every file in the Claude.md doc map (section 1b) must exist.
if (existsSync("Claude.md")) {
  const text = readFileSync("Claude.md", "utf8").replace(/\r/g, "");
  const start = text.indexOf("## 1b.");
  const end = text.indexOf("\n## ", start + 1);
  for (const m of text.slice(start, end).matchAll(/^\| `([^`]+)` \|/gm)) {
    if (!existsSync(m[1])) fails.push(`Claude.md doc map: "${m[1]}" does not exist`);
  }
}

warns.forEach((w) => console.log(`WARN ${w}`));
fails.forEach((f) => console.log(`FAIL ${f}`));
const bad = fails.length > 0 || (strict && warns.length > 0);
console.log(`${bad ? "FAIL" : "PASS"}: ${files.length} docs, ${fails.length} fail, ${warns.length} warn`);
process.exit(bad ? 1 : 0);
