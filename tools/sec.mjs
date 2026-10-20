// Print one section of a markdown doc, so a session need not read the whole file.
// Usage: node tools/sec.mjs <file>            list headings (line, size, title)
//        node tools/sec.mjs <file> <id|text>  print the matching section
// <id> matches a heading that starts with it ("5b", "S1", "M2", "V1.9.0.00"), else a heading
// containing the text, else a bullet starting "- **<id>." (e.g. S1f). Add more words to narrow.
import { readFileSync } from "node:fs";

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error("usage: node tools/sec.mjs <file> [id|text]");
  process.exit(2);
}
const q = rest.join(" ").trim().toLowerCase();
const lines = readFileSync(file, "utf8").replace(/\r/g, "").split("\n");

let fence = false;
const heads = [];
lines.forEach((l, i) => {
  if (/^```/.test(l)) fence = !fence;
  const m = !fence && /^(#{1,6})\s+(.*)$/.exec(l);
  if (m) heads.push({ i, level: m[1].length, title: m[2] });
});

const end = (h) => {
  const next = heads.find((x) => x.i > h.i && x.level <= h.level);
  return next ? next.i : lines.length;
};

if (!q) {
  heads.forEach((h) =>
    console.log(`${String(h.i + 1).padStart(5)} ${String(end(h) - h.i).padStart(4)}L ${"  ".repeat(h.level - 1)}${h.title}`),
  );
  process.exit(0);
}

const norm = (t) => t.toLowerCase().replace(/[*`]/g, "");
const startsWith = (t) => {
  const s = norm(t);
  return s.startsWith(q) && !/[a-z0-9]/.test(s[q.length] ?? " ");
};
let hit = heads.find((h) => startsWith(h.title)) ?? heads.find((h) => norm(h.title).includes(q));
let from, to;
if (hit) {
  from = hit.i;
  to = end(hit);
} else {
  const re = new RegExp(`^\\s*[-*]\\s+\\*\\*${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[.\\s:*]`, "i");
  from = lines.findIndex((l) => re.test(l));
  if (from < 0) {
    console.error(`no section "${q}" in ${file}. Headings:`);
    heads.forEach((h) => console.error(`  ${h.title}`));
    process.exit(1);
  }
  to = from + 1;
  while (to < lines.length && !/^\s*[-*]\s+\*\*/.test(lines[to]) && !/^#{1,6}\s/.test(lines[to])) to++;
}
console.log(lines.slice(from, to).join("\n").replace(/\n+$/, ""));
