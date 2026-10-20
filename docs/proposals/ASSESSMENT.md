# Proposal assessment (V1.10.0.02)

Verdicts for `Marble-bag-engine.md` (MBE) and `World-Division-and-Lag-Management.md` (WDL). Read one section: `node tools/sec.mjs docs/proposals/ASSESSMENT.md <id>`. Status of both: **proposal only, nothing implemented.** Phase 0 (inspection) is done here; no code was changed.

## 1. Verdicts

| Proposal | Verdict | Condition |
| -------- | ------- | --------- |
| MBE | **Feasible**, staged | Core primitive now; everything else waits on S1b/S1d/S1h/S1i, L2 and S5 |
| WDL | **Feasible, reduced scope**; 100 players / 400 NPCs is **not** a Primordia target | Rooms + interest management ride on S6; tiers need NPCs; capacity only from S6 load tests |

Both fit D1 (server-authoritative), D2 (same sim files in Node) and `Claude.md` 5b. Neither needs a new dependency.

## 2. Phase 0 findings (verified in V1.10.0.01 code)

| Needed by | Exists? | Evidence |
| --------- | ------- | -------- |
| MBE: RNG source | Partial | `Math.random` only; `world.rng` is S1b. Crit = one site: `FireballProjectile.roll`, 12% flat, x1.75, damage jitter `rand(0.9,1.1)` |
| MBE: token consumption point | Partial | Hits are `hit` events; damage still applied in `HitEffects` (P3, S1d). Consumption must live in the sim, after S1d |
| MBE: instance IDs | No | Entities have no `id` (S1h). Skills have a definition `id` only |
| MBE: items / instance state | No | `ItemRegistry` is L2, not built |
| MBE: persistence | No | `Progression` uses `localStorage` (P7, S1g); server saves are S5 |
| MBE: hidden state vs client | No | No snapshots yet (S1h `snapshot()`, S2) |
| MBE: test RNG | Partial | Headless test pattern exists (`tests/graugr.test.mjs`); no seeded RNG |
| WDL: zones/maps | No | One infinite placeholder ground; tilemap + 2 zones are "Then: world" |
| WDL: spatial index | No | Entities are one flat array; every system loops all of them |
| WDL: rooms | Planned | D8 / S6 (one `Simulation` per room) |
| WDL: interest management | Planned | S6 item 2, radius only |
| WDL: NPC population | No | Only Graugr and the training dummy; NPCs/quests are "Later" |
| WDL: tick loop + metrics | Planned | S1j fixed 30 Hz (D4); loadtest in S6 |
| WDL: single-process, no sharding | Matches | `SERVER_PATH.md` section 7 forbids sharding before 100 measured players |

## 3. MBE: conflicts and decisions

1. **Balance change.** A 4-normal/2-crit bag makes crit 33%, not 12%. To keep 12% use a 22/3 style pool (about 12%) or accept a new rate. Needs owner approval ("preserve behaviour unless approved"). Default: keep 12% via a pool of 22 NORMAL + 3 CRIT (rate 12%, short clusters possible).
2. **Bag scope for combat.** Per attacker (character/entity id) is the default; per skill is an option. Decide before M2.
3. **Consumption rule (MBE section 4).** Default: one token per landed Fireball hit that rolls damage (`FireballProjectile.roll`); misses and deflects consume nothing; explosion/AoE and burn ticks consume nothing. Today only Fireball crits, so one code path.
4. **RNG.** The bag takes an injected RNG with `next()`. It must not call `Math.random`. Use `world.rng` once S1b exists; before that tests inject a stub.
5. **Hidden state.** Bag order and gates stay out of `snapshot()` (replicated list excludes them). Dev inspector only behind a Settings developer flag, stripped from server builds.
6. **Concurrency.** Single-threaded Node per room makes draws atomic inside one tick; DB-level idempotency matters only for item-instance writes (S5, one transaction per save).
7. **Persistence of a unique secret** needs item instance IDs (L2) and the server DB (S5). Do not build the masterwork bow before both.
8. **Gates/sequences** read the event log; bound window (default 16 events), depth (default 3) and history (default 64 outcomes per bag). Load-time validator rejects cycles and unknown refs.
9. **Discovery archive** (MBE section 9) is out of scope until accounts exist (S5) and at least one gated secret ships.

## 4. MBE: staged plan

| Stage | Work | Needs | Done when |
| ----- | ---- | ----- | --------- |
| M0 | Phase 0 inspection | none | **Done in this document** |
| M1 | `src/sim/bag/` pure primitive: `Bag` (tokens, Fisher-Yates via injected rng, draw, refill/no_refill, `serialize/restore`), validator, unit tests with a seeded test RNG. Not wired to the game | none (new files, zero audit hits) | Counts exact per cycle; 6-token cycle test; refill/empty tests; serialize round-trip; Node import with no globals |
| M2 | Fireball crit uses one per-caster combat bag; rate per decision 3.1 | S1b, S1d | Same-seed damage lists identical; crit totals per cycle exact; audit debt not up |
| M3 | Gates: `ALL/ANY/NOT`, counts, bounded sequences; event-fed | M1, S1h | Tests for window/reset/interrupt; cycles fail at load |
| M4 | Item-instance state + one-time secret + first data-driven item (masterwork bow) | L2, S1h, S5 | Survives restart/trade; cannot fire twice; client payload has no hidden fields |
| M5 | Crafting gates, NPC memory, world mysteries, discovery archive | M4, NPCs, accounts | One scope per version, owner approval each |

M1 can ship any time as a cleanup-level or minor version (new files only) and does not block S1.

## 5. WDL: conflicts and decisions

1. **Scale.** WDL plans 100 players + 200 RNPC + 200 static NPCs. Roadmap targets 10 to 50 players (S6 load test; S9 50-player scale test) on the owner's PC (D9). Keep 100/400 as a **design ceiling only**; no capacity claim until S6/S9 numbers exist.
2. **Hierarchy.** World > Region > Zone > Instance > Cell maps to: world = server process, region = metadata, zone = map, instance = room (D8), cell = new. Build only zone + room + cell for now; region/world state comes with the first persistent shared event.
3. **Public zone copies/channels** and open-world persistence conflict with D8's "no shared open world until rooms work". Postpone to W4, after S6.
4. **Interest management.** S6 item 2 is radius-based; W2 upgrades it to a spatial hash. Entities need ids (S1h) first.
5. **Hit-stop (D11)** is already view-only after S1j; tiers never slow sim time.
6. **Tiers** (active/reduced/dormant/critical) need real NPCs with goals. Prerequisite: an NPC/RNPC type on `SkillCaster` plus a goal state machine. Nothing to tier today except Graugr and raid spawns.
7. **Elapsed-time rule** for dormant entities: requires `world.time` (S1c) and plain-data state (S1h).
8. **Transfer protocol** (WDL section 9) belongs after S5 (character saves) and is moot for single-process rooms until zones exist.
9. **Overload policy**: log and shed cosmetic/ambient work first; never drop input or combat. Metrics come from `tools/loadtest.mjs` (S6).

## 6. WDL: staged plan

| Stage | Work | Needs | Done when |
| ----- | ---- | ----- | --------- |
| W0 | Phase 0 inspection | none | **Done in this document** |
| W1 | Design note for this codebase: zone/room/cell data shapes, sim-tick budget, overload policy | S1k | Written into `SERVER_PATH.md`; owner approves |
| W2 | `src/sim/spatial/` uniform grid (insert/move/query radius), unit tests; then S6 interest management uses it (enter/leave thresholds with hysteresis, snapshot on enter, deltas after) | S1h, S2 (snapshots) | Irrelevant entities receive no routine updates; tests with 3 players over 2 distant clusters; enter/leave flicker test |
| W3 | Active/reduced/dormant tiers for a small NPC set with elapsed-time catch-up | NPC type, S1c, S5 | No time-skip exploits; reactivation test; combat entities never reduced |
| W4 | Zone copies, private instances, capacity (soft/hard), lifecycle and cleanup | S6, zones exist | Party never split silently; unique state not duplicated; cleanup keeps rewards |
| W5 | Automated load tests and tuning of cell size/rates/AI budget | S6 `loadtest.mjs` | Measured limits recorded in CHANGELOG |

W2 is folded into S6 (not a separate version) when S6 starts; W3/W4 wait for the "world" and "NPCs" roadmap blocks.

## 7. Risks

- Scope creep: two large proposals on a solo project. Mitigation: M1 only before S1 closes; everything else after V1.11.0.00.
- Rewrite risk: building bags or grids before S1h ids forces rework. Mitigation: gates above.
- Balance drift (crit rate, tick feel at 30 Hz): retest after M2 and S1j.
- Capacity claims: forbidden without S6/S9 data.

## 8. Rules for sessions using these files

1. Open the proposal **section** you need, not the whole file: `node tools/sec.mjs docs/proposals/<file> <n>`. Read sections 1 to 2 of the proposal plus this assessment's section for the stage you build.
2. Never claim implementation without code and tests. Follow the stage tables above; one stage per version; owner approves each stage.
3. Proposal wording that conflicts with `Claude.md`, `SERVER_PATH.md` or a decision here loses; flag it.
