# MMORPG Guideline (V1.10.0.04)

A seven-part development sequence for a JavaScript MMORPG, written by Gemini and reconciled here with this repository. **It is a guide, not the truth.** Read one section with `node tools/sec.mjs docs/MMORPG_GUIDELINE.md G<n>`; never read the whole file.

## G0. How to use this file

**When to open it:** the user does not know what to work on, or a task touches one of the topics in the index below. Open `ROADMAP.md` first (section "Choosing work"), pick the item, then read only the matching `G<n>` for ideas and risks.

**Authority order (higher wins, the guideline always loses):** `Claude.md` > `SERVER_PATH.md` decisions D1-D13 > `docs/proposals/ASSESSMENT.md` > this file. If the guideline contradicts a higher file, follow the higher file and say so in one line.

**Trust rule for the source evidence:** the original "Evidence Base" lines cite no studies or measurements. Each is tagged here: **common practice** (widely accepted engineering), **anecdotal** (plausible, unmeasured), **measured** (checked in this repo). Anything not **measured** must be verified in the code or by a test before it drives a decision.

**Section shape (grep-friendly):** every G section has the same fields in the same order: Source idea, Source evidence, Verdict, Do, Do not, Repo hooks, Gate. Verdict is ADOPT, ADAPT (idea kept, method changed) or REJECT-PART.

**Status at V1.16.0.01:** no server exists. S1a (safety net) shipped in V1.10.0.05, S1b (seeded RNG) in V1.11.2.01, S1c (sim clock) in V1.12.0.02 S1d (damage out of the view) in V1.12.0.03 and S1e (input commands) in V1.12.0.04; S1f (presentation out of the sim) is in progress: the projectile group shipped in V1.12.0.05 and the `Fireball` skill in V1.16.0.01, `FlameShieldEffect` is next. Nothing below is built by this file; it adds no code and no dependency.

| Id | Topic | Verdict | Where it lands |
| -- | ----- | ------- | -------------- |
| G1 | One source of data and math for client and server | ADAPT | S1h, S1k, `src/sim` |
| G2 | Fixed-step authoritative server loop | ADAPT | S1j, S3, D4 |
| G3 | Canvas rendering, interpolation, culling | ADAPT | S1j, S4, A1-A2, T1 |
| G4 | In-memory sessions plus transactional saves | ADAPT | S5, S8a |
| G5 | Composition-based entities and combat events | ADAPT | rules 1-4 in `Claude.md`, S1d, S1f |
| G6 | AI development rules (CLAUDE.md, linting) | ADOPT (exists) | `Claude.md` 5b, audit tool |
| G7 | Headless load tester and profiling | ADAPT | S6, W5 |
| G8 | Conflict table (guideline vs project) | reference | all |
| G9 | Suggested order from today | reference | `ROADMAP.md` |

## G1. One source of data and math for client and server

- **Source idea:** npm-workspaces monorepo with `/client`, `/server`, `/shared`; shared JSON/ES-module data for races, classes and items; shared pure math (`vector.js`, `stats.js`) used identically by both sides.
- **Source evidence:** keeping definitions in two places desynchronizes state (**common practice**).
- **Verdict:** ADAPT. The goal is right; workspaces and folder names are not needed.
- **Do:** keep definitions as data registered in `content/index.js` (rule 1). Move simulation, data and shared math under `src/sim/` (S1k); the browser imports them as ES modules and the Node server imports the same files. Put pure formulas (damage, stat growth, distance, line of sight) in one place; tests import them from Node.
- **Do not:** add npm workspaces, a bundler or a second copy of any formula (D10, R13). Do not let `core/math.js` keep `rand` in sim paths (audit: 1 `random` hit); gameplay dice go through `world.rng` (S1b, done in V1.11.2.01; the remaining `random` hits are visual and leave in S1f).
- **Repo hooks:** `content/index.js`, `core/math.js`, `src/sim/` (future), `tools/audit-server-ready.mjs`.
- **Gate:** `node tools/audit-server-ready.mjs` PASS; `tests/import-sim.mjs` (S1k) imports every sim file in Node with no `window` / `document`.

## G2. Fixed-step authoritative server loop

- **Source idea:** Node loop at 20 Hz (50 ms) with delta-time correction on a high-resolution clock; server-side collision of W/A/S/D input against a 2D tilemap; send only changed state (JSON or binary deltas).
- **Source evidence:** `setInterval` drifts when the event loop is blocked, so use `process.hrtime` / `performance.now` (**common practice**).
- **Verdict:** ADAPT. Principle kept; rate, transport and compression differ.
- **Do:** accumulate real time and step the sim at `SIM_DT = 1/30` (D4, S1j); the server host schedules each tick against a target time (drift-corrected `setTimeout` using `performance.now`) and runs catch-up steps with a cap. The clock lives in the host, never in sim code (R2). Clients send `InputCommand` only (S1e, S2). Tile collision is a sim grid built from the Tiled map (T2). Round positions to 0.1 and send JSON; add per-entity deltas with interest management (W2) only after measuring (D5).
- **Do not:** use 20 Hz (decision is 30), Socket.io (decision is `ws`, S3), a binary protocol before measurement, or any wall-clock call inside simulation files.
- **Repo hooks:** `core/Game._loop` (variable `dt` today, capped at 0.05), `SERVER_PATH.md` S1j, S2, S3, section 8.
- **Gate:** same seed plus same scripted inputs for 60 s of sim time gives the same state hash twice, at 60 Hz and at 144 Hz render rates (S1j).

## G3. Canvas rendering, interpolation, culling

- **Source idea:** HTML5 Canvas or WebGL through Phaser, PixiJS or the raw Canvas API; spritesheets plus Tiled maps; lerp between 20 Hz server updates at 60-140 Hz; draw only what is inside the camera.
- **Source evidence:** many DOM nodes cause reflow and leaks; hardware-accelerated canvas is needed (**common practice**). The repo already renders to one canvas (**measured**: HUD is DOM but sparse and updates only on change).
- **Verdict:** ADAPT. Raw Canvas 2D stays; framework rejected.
- **Do:** keep Canvas 2D (D10); lerp between the last two sim states (S1j, S4); keep off-screen culling and `scaled()` particle counts (`Claude.md` 6); load sprites through a manifest with the cylinder fallback (A1), integer `PIXEL_SCALE` (A2), Tiled JSON with a validator (T1).
- **Do not:** add Phaser, Pixi or any renderer dependency without a measured problem and a roadmap entry; do not draw from sim code (R5).
- **Repo hooks:** `render/`, `lobby/assets.js`, `docs/ART_AND_MAPS.md` sections 2-5, ROADMAP "Art and maps".
- **Gate:** 60 FPS with 3,000+ particles; first frame under 1 s; zero external requests (`Claude.md` 6).

## G4. In-memory sessions plus transactional saves

- **Source idea:** active characters in a Node `Map`; persist level-ups, trades and pickups asynchronously to SQLite or PostgreSQL via Knex or Prisma; batch-save every 5-10 minutes; flush on SIGINT.
- **Source evidence:** a database write per tick exhausts connections and stalls the loop (**common practice**).
- **Verdict:** ADAPT. Pattern kept; library and "asynchronous" detail differ.
- **Do:** keep live state in memory on the server host; write only meaningful events at once (level-up, trade, pickup, purchase) and everything else in periodic batches inside one transaction. Flush on SIGINT and SIGTERM and on a clean "server stopping" path. Use `better-sqlite3` (D6, S5). It is synchronous: keep each write small and batched so it does not stall a tick. Version every saved record (the roadmap L2/L4 already asks for a versioned save).
- **Do not:** add Prisma, Knex or PostgreSQL now; do not write position per tick; do not let sim code touch storage (S1g adapter only).
- **Repo hooks:** `progression/Progression.js` (storage adapter since V1.12.0.06, `sim/storage.js`, P7 done), `lobby/Wallet.js`, `SERVER_PATH.md` S5, S8a backups.
- **Gate:** kill the server mid-session; restart restores state to the last flush and loses no purchased item (S5 test).

## G5. Composition-based entities and combat events

- **Source idea:** one entity factory (`createEntity(id, race, class)`) with stats and a cooldown `Map`; server cooldown checks with `Date.now()`; combat through Node `EventEmitter` events; avoid deep inheritance because it confuses AI-assisted edits.
- **Source evidence:** deep class trees cause state bugs when AI edits them (**anecdotal**; the shallow-tree advice is **common practice**).
- **Verdict:** ADAPT. The snippet itself breaks three repo rules.
- **Do:** keep entities one level deep (`Entity` base, rule 4) and build behavior from data, mods and status components (`Mods`, `StatusSystem`, `ward`). Store cooldowns as a plain object `{ skillId: readyAtSimTime }` compared with `world.time` (S1c) or as a number decremented by `dt`. Keep combat on the existing `EventBus` (`hit cast explosion burn ward shield levelup kill stun`); add events instead of calling VFX or audio.
- **Do not:** use `Date.now()` (R2), a `Map` as sim state (R8, R9), Node `EventEmitter` in sim files (R12), or new inheritance layers. Races (the snippet's `raceData`) do not exist yet; add them as data only when a race is on the roadmap.
- **Repo hooks:** `entities/Entity.js`, `systems/SkillCaster.js`, `core/EventBus.js`, `types.js`, S1d, S1f, S1h.
- **Gate:** `node tests/graugr.test.mjs` plus a headless test with no `HitEffects` (S1d).

## G6. AI development rules (CLAUDE.md, linting)

- **Source idea:** a root CLAUDE.md that forbids Node built-ins in client code, DOM in server code, and non-standard features in shared code; ESLint and Prettier enforce imports.
- **Source evidence:** models confuse browser and Node globals when no boundary rule exists (**anecdotal**, but consistent with how R1 and R12 were written).
- **Verdict:** ADOPT. Already built, stricter than the source.
- **Do:** treat `Claude.md` 5b (R1-R13) as the boundary contract and `tools/audit-server-ready.mjs` as its linter (debt may never go up). Keep `Claude.md` short and the doc map current. Run `node --check` on every `src/**/*.js`. New files must have zero audit hits.
- **Do not:** add ESLint or Prettier without owner approval and a roadmap entry (R13); `.editorconfig` and the audit cover the need today. Do not duplicate rules into this file.
- **Repo hooks:** `Claude.md` 1b, 2, 5b; `.editorconfig`; `tools/`.
- **Gate:** audit prints PASS; `npm run docs` (section lint) passes.

## G7. Headless load tester and profiling

- **Source idea:** `tools/bot-runner.js` spawns 50+ headless WebSocket clients that move and press keys; monitor tick delay and `process.memoryUsage()`; remove short-lived allocations from the loop to avoid garbage-collection pauses; goal 100+ simultaneous players.
- **Source evidence:** manual testing misses closure leaks, unhandled rejections and listener leaks (**common practice**).
- **Verdict:** ADAPT. Tool kept; target lowered to the committed range.
- **Do:** build `tools/loadtest.mjs` in S6 with scripted bots that speak the S2 protocol; report tick duration (p50, p95, max), overshoot count, memory and listener count over time using `perf_hooks.monitorEventLoopDelay` and `process.memoryUsage()`. Keep hot paths allocation-free (`Claude.md` 6). Add a long soak (30+ minutes) before S9.
- **Do not:** claim 100+ players; the committed targets are 10-50 (S6 50-bot test, S9 50-player scale test); 100 players + 400 NPCs is a design ceiling only (W stages).
- **Repo hooks:** `SERVER_PATH.md` S6, S9, 4 (cost and capacity); ROADMAP W5.
- **Gate:** 50 bots for 30 minutes: p95 tick under half of `SIM_DT`, flat memory, no listener growth.

## G8. Conflict table (guideline vs project)

| Guideline says | Project rule | Resolution |
| -------------- | ------------ | ---------- |
| npm workspaces, ESLint, Prettier, Knex or Prisma, Socket.io, Phaser or Pixi | R13, D10, `SERVER_PATH.md` 7: only `ws` (S3) and `better-sqlite3` (S5) | Not added. Needs owner approval plus a roadmap entry |
| 20 Hz tick | D4: 30 Hz | 30 Hz |
| `Date.now()` for cooldowns | R2: no clock in sim | `world.time` or `dt` timers |
| `Map()` cooldowns and sessions in entity state | R8 plain data, R9 order independence | Plain objects and arrays; a server-host `Map` is fine if iteration order never affects results |
| Node `EventEmitter` | R12, existing `EventBus` | Keep `EventBus` |
| Binary or JSON deltas now | D5: JSON first, measure | Full snapshots first; deltas after W2 |
| 100+ simultaneous players | S6/S9 targets: 10-50 | 50 until measured |
| Separate `/client` `/server` `/shared` | S1k: `src/sim`, `src/view`, `src/net` | Follow S1k |

## G9. Suggested order from today

Dependency view of the seven parts (details and "done when" live in `SERVER_PATH.md`):

1. **Foundation (G1, G5, G6):** S1a tests, S1b seeded RNG, S1c sim clock, S1d damage out of the view, S1e input commands.
2. **Authority and loop (G2):** S1f-S1k, then S2 loopback, S3 real server.
3. **Feel and render (G3):** S1j interpolation, S4 prediction; art and map stages A1-A2, T1-T2 can run alongside S1 (views, plus the T2 sim grid after S1h).
4. **Persistence (G4):** S5 accounts and SQLite, after S3.
5. **Scale proof (G7):** S6 rooms and 50-bot test, S7 hardening, S8 hosting, S9 alpha.

Items with no server dependency that may run in between: L2 item model, M1 pure bag primitive (new files, not wired in). One step per version; owner approves proposal stages.
