// Server-readiness audit (see SERVER_PATH.md). Run from the repo root:
//   node tools/audit-server-ready.mjs               gate: exit 1 if any count is ABOVE tools/server-ready-baseline.json
//   node tools/audit-server-ready.mjs --verbose     also print file:line for every hit
//   node tools/audit-server-ready.mjs --strict      ignore the baseline: any hit fails (the goal state after phase S1)
//   node tools/audit-server-ready.mjs --write-baseline   store the current counts (only when debt went DOWN, or at a planned phase change)
// It scans SIMULATION files for code that cannot run on a headless server. Comments are ignored.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "tools", "server-ready-baseline.json");

// Simulation code = must run in Node with no browser. Everything else (scenes, ui, lobby, audio, render, presentation systems) is client-only.
const SIM_DIRS = ["sim", "entities", "skills", "classes", "progression", "content"];
const SIM_FILES = [
  "systems/Vitals.js", "systems/SkillCaster.js", "systems/StatusSystem.js", "systems/ExplosionSystem.js",
  "systems/XpSystem.js", "systems/RaidSystem.js", "core/EventBus.js", "core/Registry.js", "core/math.js", "types.js",
];

const RULES = {
  dom: /\b(?:document|window|navigator)\.|\blocalStorage\b|\bsessionStorage\b|\bAudioContext\b|\bnew Audio\b/g,
  clock: /\bperformance\.now\b|\bDate\.now\b|\bsetTimeout\b|\bsetInterval\b|\brequestAnimationFrame\b/g,
  random: /\bMath\.random\b|\brand\(/g,
  settings: /\bSettings\./g,
  present: /\b(?:particles|lights|damageNumbers|toasts)\.|\baddTrauma\b|\bhitstop\b|\.audio\b|\bctx\b|\bcamera\b/g,
  input: /\.input\b|\bscreenToWorld\b|\bworld\.game\b|\bgame\.(?:width|height)\b/g,
  singlePlayer: /\bworld\.player\b/g,
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}
const rel = (p) => relative(SRC, p).split("\\").join("/");
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/\/\/[^\n]*/g, "");

const files = new Set();
for (const d of SIM_DIRS) for (const f of walk(join(SRC, d))) files.add(rel(f));
for (const f of SIM_FILES) if (existsSync(join(SRC, f))) files.add(f);

const args = process.argv.slice(2), verbose = args.includes("--verbose"), strict = args.includes("--strict");
const counts = {}, hits = [];
for (const f of [...files].sort()) {
  const lines = strip(readFileSync(join(SRC, f), "utf8")).split(/\r?\n/);
  const c = {};
  lines.forEach((ln, i) => {
    for (const [rule, re] of Object.entries(RULES)) {
      const m = ln.match(re);
      if (m) { c[rule] = (c[rule] || 0) + m.length; hits.push(`${f}:${i + 1}  [${rule}]  ${ln.trim().slice(0, 90)}`); }
    }
  });
  if (Object.keys(c).length) counts[f] = c;
}

if (args.includes("--write-baseline")) {
  writeFileSync(BASELINE, JSON.stringify(counts, null, 2) + "\n");
  console.log(`Baseline written: ${Object.keys(counts).length} files with debt.`);
  process.exit(0);
}

const base = strict || !existsSync(BASELINE) ? {} : JSON.parse(readFileSync(BASELINE, "utf8"));
const totals = {}, regress = [], improved = [];
for (const [f, c] of Object.entries(counts)) for (const [r, n] of Object.entries(c)) {
  totals[r] = (totals[r] || 0) + n;
  const b = base[f]?.[r] ?? 0;
  if (n > b) regress.push(`${f} [${r}] ${b} -> ${n}`);
}
for (const [f, c] of Object.entries(base)) for (const [r, b] of Object.entries(c)) {
  const n = counts[f]?.[r] ?? 0;
  if (n < b) improved.push(`${f} [${r}] ${b} -> ${n}`);
}

console.log(`Server-ready audit: ${files.size} simulation files scanned${strict ? " (strict)" : ""}`);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("file", 34) + Object.keys(RULES).map((r) => pad(r, 13)).join(""));
for (const [f, c] of Object.entries(counts).sort((a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)))
  console.log(pad(f, 34) + Object.keys(RULES).map((r) => pad(c[r] || ".", 13)).join(""));
console.log(pad("TOTAL", 34) + Object.keys(RULES).map((r) => pad(totals[r] || 0, 13)).join(""));
if (verbose) console.log("\n" + hits.join("\n"));
if (improved.length) console.log(`\nImproved (run --write-baseline to lock it in):\n  ${improved.join("\n  ")}`);
if (regress.length) { console.log(`\nFAIL: new server-readiness debt:\n  ${regress.join("\n  ")}`); process.exit(1); }
console.log(strict && Object.keys(counts).length ? "\nFAIL (strict): debt remains" : "\nPASS");
if (strict && Object.keys(counts).length) process.exit(1);
