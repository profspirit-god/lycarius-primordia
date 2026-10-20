# SERVER_PATH.md: the road to online

Detailed plan for turning Primordia from a single-browser game into an online game. `ROADMAP.md` summarizes it in one table; this file is the contract. Written at **V1.9.0.01** and rebased onto the V1.10.0.00 code in **V1.10.0.01**: every version number below is one minor higher than in the first draft, because V1.10.0.00 shipped the HUD and loading release; the audit was re-run and its counts are unchanged. Claude sessions read **only the section of the phase they are working on**, plus section 1 (decisions) and the rules in `Claude.md` section 5b.

**Plain-English glossary** (for the owner):

- **Simulation (sim):** the code that decides what happens: damage, cooldowns, enemy AI, movement. It has no screen.
- **View:** the code that shows it: drawing, particles, sounds, menus.
- **Server:** one always-running Node.js program that runs the simulation for everybody. It is the only one allowed to decide outcomes (called **authoritative**).
- **Client:** the browser. It sends the player's inputs and draws what the server says.
- **Tick:** one step of the simulation. **Snapshot:** the server's report of the world after a tick.
- **Prediction:** the client moves your own character immediately without waiting, then corrects itself when the server answers. **Interpolation:** other players are drawn slightly in the past so their motion looks smooth.
- **Latency (ping):** the delay between you and the server.

---

## 0. Gates (every phase, every session)

A phase is **not done** until all of these hold. No exceptions, no "almost".

1. `node tests/graugr.test.mjs` passes (and every test added by later phases).
2. `node tools/audit-server-ready.mjs` prints `PASS` (no count above `tools/server-ready-baseline.json`). From phase S1k on: `--strict` passes.
3. `node --check` passes on every `.js` file; the game plays in the browser exactly as before (the phase's manual checklist).
4. CHANGELOG, README, ROADMAP, `Claude.md` and this file updated; `VERSION` bumped; debt log (section 6) edited.
5. When debt goes down: `node tools/audit-server-ready.mjs --write-baseline`, committed in the same branch. Debt may **never** go up.

Every phase = one branch from `dev`, one or more commits, one PR, one tag. Versions below are guides.

---

## 1. Target architecture (decisions)

| #   | Decision | Why | Reversible? |
| --- | -------- | --- | ----------- |
| D1  | **Server-authoritative.** Clients send inputs only, never results (no damage, no positions as truth). | The only design that stops cheating. | No (it is the foundation) |
| D2  | **Node.js server running the same simulation files as the browser** (`src/sim`, `src/entities`, `src/skills`, ...). | One language, one set of rules, no rewrite. | Yes, but costly |
| D3  | **WebSocket** transport (`ws` library, approved for S3 only). | Built into every browser, simple, enough for this game. | Yes |
| D4  | **Fixed simulation rate `SIM_HZ = 30`** (`SIM_DT = 1/30`), identical in single-player and on the server. Rendering stays at the display rate with interpolation. | Same results everywhere, cheap for the server. Fireball tunnelling is already prevented by the sub-stepping in `FireballProjectile`. | Yes (a constant), but gameplay feel must be retested |
| D5  | **JSON messages first**, positions rounded to 0.1. Binary only if measurements show a need. | Easy to debug. Premature optimization is the classic trap. | Yes |
| D6  | **SQLite** (`better-sqlite3`, approved for S5 only) in one file on the server. | No database server to run or pay for. Plenty for hundreds of players. | Yes (move to PostgreSQL later) |
| D7  | **Accounts: username + password only** (no email at first). Passwords hashed with Node's built-in `crypto.scrypt`, random salt, constant-time compare. | Less personal data to protect. | Yes |
| D8  | **Rooms:** one `Simulation` instance per room (training ground, raid party). No shared persistent open world until the rooms work. | Small, testable, cheap. | Yes |
| D9  | **Hosting: the owner's own PC first** (owner decision, V1.10.0.01), reached through an outbound-only tunnel that provides `wss://` without opening router ports; **a small VPS later** (a Singapore region is closest for the Philippines, Caddy for automatic HTTPS) when a trigger in S8 fires. The server is one Node process, so the same files run on both. | A closed alpha of 10 to 50 players does not need rented hardware. The code is the limit, not the PC (S8a has the numbers). | Yes: only the address and the tunnel change |
| D10 | **No engine switch, no framework, no bundler** unless a measured problem demands it. | Rewrites kill solo projects. | n/a |
| D11 | **Hit-stop and camera shake become view-only.** The server never slows time. | A server cannot freeze for one player. The feel changes slightly; this is a known, accepted cost. | Yes |
| D12 | **Art style: semi-pixelated** (owner, V1.10.0.03). Sprites and tiles are pixel art at 1 world unit = 1 art pixel; effects stay smooth. Art and map plan: `docs/ART_AND_MAPS.md`. Only the collision grid (T2) is sim code; sprites and tiles are views, so no phase is blocked. | Owner decision. | Costly once art exists (tile and frame sizes) |
| D13 | **The exe is a wrapper, not a fork.** A desktop build (S10) is a thin shell in its own `desktop/` folder with its own `package.json` that loads the same game files. The repository root stays free of dependencies. Needs owner approval before any dependency is added. | One code base and one set of tests; the browser version can never break because of the exe. | Yes |

---

## 2. Audit of the current code (V1.10.0.01)

Measured by `tools/audit-server-ready.mjs` on 28 simulation files, plus a manual read. Counts will fall as phases land; the live numbers are in `tools/server-ready-baseline.json`. Re-run at V1.10.0.01: V1.10.0.00 (DOM HUD, character panel, loading tasks, stamina, icons) added only client-side code and no simulation debt, so the counts equal those first measured at V1.9.0.01 (3 browser, 6 clock, 160 random, 4 settings, 227 presentation, 6 input, 6 single-player).

| #  | Problem | Where | Fixed in |
| -- | ------- | ----- | -------- |
| P1 | Gameplay dice use `Math.random` / `rand()`: crit and damage jitter, ignition chance, explosion jitter, Graugr AI, raid spawn, dummy AI. A server needs one controlled source (and tests need a fixed seed). 160 hits, but many are visual-only particles. | `FireballProjectile.roll`, `ExplosionSystem`, `StatusSystem.onHit`, `Graugr`, `RaidSystem`, `TrainingDummy` | S1b |
| P2 | Real-time clock inside sim code (`performance.now` in the dummy's DPS log). | `TrainingDummy` | S1c |
| P3 | **Damage is applied inside a presentation system.** `HitEffects.onHit` calls `target.onHit(e)`. A server has no `HitEffects`, so nothing would take damage. The "create X after HitEffects" ordering rule exists because of this. | `HitEffects`, `WorldScene.enter` | S1d |
| P4 | `onHit` mixes gameplay (health, stagger/`freeze` that cancels enemy casts) with cosmetics (`flash`, `glow`, knock spring). | `Player`, `TrainingDummy`, `Graugr` | S1d |
| P5 | Player reads the keyboard, the mouse and the camera directly. | `Player.update`, `Player.wantsCast/wantsToggle` | S1e |
| P6 | Drawing and particles live inside skills and entities (`draw()`, `world.particles`, `world.lights`, `ctx`). 227 hits. | all entities; `Fireball`, `FlameShieldEffect`, `BurnWardEffect`, `BurnResistance`, `FireballProjectile`, `Graugr.tryDeflect` | S1f |
| P7 | Progress is saved with `localStorage` inside the logic class. | `Progression` | S1g |
| P8 | Entities reference each other by object (`owner`, `target`, `killer`, WeakSets). Snapshots need ids and plain data. | `FireballProjectile`, `Graugr`, effects | S1h |
| P9 | The game assumes exactly one player (`world.player`). | `Graugr`, `RaidSystem`, `XpSystem`, `TrainingDummy`, `AudioSystem`, `WorldScene` | S1i |
| P10 | Variable frame time. Hit-stop slows entity time to 8%. Movement smoothing is frame-rate dependent in feel. | `Game._loop`, `WorldScene.update` | S1j |
| P11 | `WorldScene` is both the screen and the simulation container (`world`). | `WorldScene` | S1d to S1k |
| P12 | Presentation sits in the same folders as simulation (`entities/`, `skills/`). | folders | S1k |
| P13 | **New in V1.10.0.00:** the DOM HUD and character panel read live sim objects (`world.player`, `world.raid`); the loading screen's world dry run builds a real `Progression` and `Player`, so it reads the real save. Client-only code, so the audit does not count it. | `ui/PlayerHud.js`, `ui/ProfilePanel.js`, `lobby/loadTasks.js` | S1g (dry run gets an in-memory storage), S2 (HUD reads snapshots) |

---

## 3. Phases

Effort is counted in **sessions** (one focused chat that ends with a delivered zip). They are rough and are re-estimated at the start of each phase. Nothing here promises a date.

### S1: Separate the simulation from the view (the big one)

Goal: the simulation runs in Node with no browser, deterministically. **Behaviour must not change** for the player. Order matters: tests first, risky things last. Each step is its own branch `cleanup/sim-<step>` and a cleanup-digit version (`V1.10.0.05`, `.06`, ...; `V1.10.0.02` to `.04` were docs releases). The closing release is **V1.11.0.00**. About 14 to 20 sessions.

- **S1a. Safety net.** Extend `tests/` with characterization tests that pin today's behaviour: Fireball damage by charge, cooldowns and mana cost, burn ticks, Flame Shield absorb, explosion falloff, clash outcomes, XP and level math. Done when the tests are green on the unmodified code. Every later step must keep them green.
- **S1b. Seeded RNG.** Add `src/sim/rng.js` (mulberry32: `next()`, `range(a,b)`, `chance(p)`), create it in `WorldScene.enter` as `world.rng` with a seed. Classify every `rand(` / `Math.random` in a sim file as **G** (gameplay-affecting) or **V** (visual only). Replace every **G** with `world.rng`. **V** stays and moves out in S1f. Done when a test running the same seed twice gives identical Fireball damage lists, and different seeds differ.
- **S1c. Sim clock.** `world.time` (seconds, advanced by the sim step). Replace `performance.now` in sim code (the dummy DPS log). Done when the audit `clock` count is 0 outside draw code.
- **S1d. Damage out of the view.** Create `systems/DamageSystem.js` (sim): on `hit`, calls `target.onHit`. `HitEffects` keeps only VFX and no longer calls `onHit`. Split every `onHit` into `onHit` (health, stagger timer `staggerT`, knock velocity) and view-side reactions (flash, glow) that the view derives from events. Stagger must stay a sim value because it cancels enemy casts. Systems are created in an explicit ordered list in one place, and the ordering gotcha in `Claude.md` is rewritten. Done when the tests pass with a world that has **no** `HitEffects`.
- **S1e. Input command layer.** Define `InputCommand = { seq, mx, my, aim, btn }` (`mx`, `my` in -1..1, `aim` in radians, `btn` a bitmask). A client-only `PlayerController` turns keyboard and mouse (and the camera) into a command each tick; `Player` reads only `this.cmd`. Done when `Player.js` has zero `input` and `camera` hits and a test can drive a player with scripted commands.
- **S1f. Presentation out of the sim.** One sub-step per group, in this order: projectiles (`FireballProjectile`), `Fireball`, `FlameShieldEffect`, `BurnWardEffect` and `BurnResistance`, `Graugr` (including `tryDeflect`), `TrainingDummy`, `Player`. For each: the sim part emits events with plain data (`projectile:spawn`, `shield:hit`, `deflect`, ...); a view in `src/view/` listens and spawns particles, lights, damage numbers and sounds; `draw` moves out of the entity into a view registered by the entity's `kind` string. Done when the audit `present` count is 0 for that group and the effect looks identical.
- **S1g. Storage adapter.** `Progression` receives a `storage` object (`load()`, `save(data)`). The client passes a `localStorage` adapter; tests pass an in-memory one. Done when `Progression.js` has zero `dom` hits.
- **S1h. Ids and plain data.** The simulation assigns each entity an integer `id`. Cross-entity references inside sim state become ids (a lookup by id, not a stored object). Each entity class gets a header comment and a `replicated` list naming the fields clients need (`x y z aim hp stamina mana mode act.type act.phase tier stunT ...`) and a `snapshot()` returning only plain numbers and strings. Done when `JSON.stringify(entity.snapshot())` works for every entity kind and a test round-trips it.
- **S1i. Many players.** `world.players` (Map by id); `world.player` stays only as a client-side alias for "my player". `Graugr` targets the nearest living player; `XpSystem` pays the right player; `RaidSystem` and kill counters belong to a room. Done when a test with 3 players and 2 Graugr behaves sensibly and the audit `singlePlayer` count is 0.
- **S1j. Fixed timestep.** `Game` accumulates real time and steps the simulation at `SIM_DT`; rendering interpolates between the last two states. Hit-stop and shake move to the view (D11). Done when the game plays at 60 and at 144 Hz with the same simulation results, and a determinism test (same seed + same scripted inputs for 60 s of sim time) gives the same state hash twice.
- **S1k. Move and lock.** Move simulation files under `src/sim/` (keep imports working), keep views under `src/view/`. Add `tests/import-sim.mjs`: imports every file in `src/sim` in Node **with no stubs for `window` or `document`**. Done when `--strict` passes and `import-sim` passes. Release **V1.11.0.00**.

Difficulties (so nobody is surprised): the diff is large; `FlameShieldEffect` (385 lines) and `BurnWardEffect` (279 lines) mix logic and drawing heavily; the feel of fights will shift slightly because of D4 and D11. Workaround: tiny steps, tests first, one visual comparison per step.

### S2: Loopback "network" inside one browser (V1.12.0.00, 3 to 5 sessions)

Goal: prove the client/server split **before** any real server exists.

1. `src/net/protocol.js`: `PROTOCOL_VERSION = 1` and the messages below, with a validator for every message a client can send.
   - client to server: `hello {v, name}`, `input {seq, mx, my, aim, btn}` (30 per second), `ping {c}`
   - server to client: `welcome {v, id, tickRate}`, `snap {tick, ack, ents[]}`, `ev {tick, list[]}`, `pong {c}`, `bye {reason}`
   - limits: inbound message at most 1 KB; `mx`, `my` in [-1, 1]; `aim` in [-PI, PI]; `btn` an integer in [0, 255]; `name` 1 to 16 characters from a safe set. Anything else is dropped.
2. `src/net/Transport.js` (interface) and `LoopbackTransport` with developer settings for **fake latency (0 to 400 ms), jitter, and packet loss (0 to 20%)**.
3. `ClientWorld`: the view reads **only** snapshots and events; the sim runs on the "server" side of the loopback.

Done when: the whole game is playable through the loopback with 150 ms fake latency, and the client never reads or writes sim objects directly (a test asserts the view modules do not import `sim` internals).

### S3: Real Node server, two players (V1.13.0.00, 3 to 5 sessions)

1. `server/index.js` (WebSocket listener), `server/Room.js` (owns a `Simulation`, ticks at `SIM_HZ`), `server/Connection.js` (parse, validate, rate limit). `npm install ws` is approved here and nowhere else.
2. One room, guest names, no accounts. Start: `node server/index.js`; the client picks the server with a `?server=ws://localhost:8080` URL parameter **and a Settings text field that remembers the last address** (the desktop build, S10, has no URL bar). Public servers use `wss://` only. Provide full step-by-step run instructions in the README.
3. The server logs tick time (average and max) and entity count every 10 s.
4. A garbage-input test: random bytes, invalid JSON, oversized messages, wrong types, 1000 messages per second. The server must survive all of it and drop the offender.

Done when: two browser tabs on one machine see each other; fireballs from one hurt the other; closing a tab removes its player within 2 s; killing the server shows a "connection lost" screen instead of a frozen game; the garbage test passes; one tick with 2 players and 10 Graugr costs under 5 ms (measured and recorded in the CHANGELOG).

### S4: Prediction and smoothing (V1.14.0.00, 3 to 5 sessions)

1. Own movement is predicted with the unacknowledged input list (`seq`) and reconciled against `ack` in each snapshot.
2. Remote entities are interpolated about 100 ms in the past (two snapshots at 30 Hz).
3. Own casts show a cosmetic fireball at once; the server's projectile (matched by cast `seq`) replaces it. Damage and hits are only ever shown from server events.

Done when, with the loopback set to 150 ms and 5% loss: own movement responds in the same frame; corrections never snap more than 8 px and are blended; other players move smoothly; no hit is ever shown that the server did not report.

### S5: Accounts and saving (V1.15.0.00, 3 to 5 sessions)

1. `better-sqlite3` approved here. One file `data/primordia.db` (never committed; add to `.gitignore`).
2. Tables: `accounts(id, username UNIQUE NOCASE, pass_hash, salt, created_at)`, `characters(id, account_id, class_id, progression_json, wallet_json, updated_at)`, `sessions(token_hash, account_id, expires_at)`. Schema version in `PRAGMA user_version`, migrations as numbered functions.
3. Register and login screens (client) and endpoints (server). scrypt with a random 16-byte salt, 64-byte key, `timingSafeEqual`. Session token random 32 bytes, stored **hashed**. Login rate limit per IP and per username.
4. Progression is saved on level-up, every 60 s, and on disconnect. The server loads it on join; the client no longer owns it.

Done when: restart the server and a character keeps level, picks and wallet; wrong passwords are rejected and rate limited; the database file contains no plain-text password or token (checked by reading it).

### S6: Rooms and co-op raid (V1.16.0.00, 3 to 5 sessions)

1. A room manager creates, fills and deletes rooms. Raid rooms are joined by a 6-character invite code. Maximum players per room is a constant (start with 8).
2. Interest management: a client receives only entities within a radius of its player.
3. Idle rooms are destroyed after 60 s empty; idle connections are dropped after 30 s without input.
4. `tools/loadtest.mjs`: N headless bot clients (Node, using the already approved `ws`) that send scripted inputs and casts at 30 Hz. It prints, per minute: server tick average and max, bytes sent per player, total upload in Mbps, and the server's memory. This is how the 10 to 50 player capacity of the chosen host is **measured instead of guessed** (S8a).

Done when: 4 players in one raid room play 10 raids; two rooms run side by side without affecting each other; server CPU per tick is measured with 8 players + 30 Graugr and recorded; the load test runs 10, 25 and 50 bots (about 7 rooms at 50) for 10 minutes each on the machine that will host, and the tick average / max, upload in Mbps and memory at start and end are recorded in the CHANGELOG (memory growth over 10% is a bug).

### S7: Security hardening (V1.17.0.00, 2 to 3 sessions)

Checklist (each item gets a test or a written verification):

- Every client field validated by the S2 validators; unknown message types dropped; no `eval`, no dynamic `require` from input.
- Per-connection rate limits (messages per second, bytes per second) and a connection cap per IP.
- Server checks cooldown, stamina and mana itself (the sim already does); the client UI is never trusted.
- Inputs that imply impossible speed are clamped by the sim, not rejected by the client.
- `npm audit` clean (or each finding explained). Dependencies pinned in `package-lock.json`.
- Logs never contain passwords or tokens. A manual ban list file.
- Chat is **not** added until moderation (filter, mute, report) is designed.

### S8: Deployment (V1.18.0.00, 2 to 4 sessions)

The full command-by-command guide is written **at the start of this phase** with then-current versions (commands, prices and provider rules change; a guess now would be a source of error). The decision, the feasibility numbers and the checklists below are the contract. The host is the owner's own PC first (S8a). A VPS (S8b) runs the same server files and is added only when a trigger fires.

#### S8a: Host on the owner's own PC (default; owner decision at V1.10.0.01)

**Verdict: feasible for 10 to 50 players, with conditions.** If a condition fails, fix it or use S8b. Every figure here is an estimate from the planned design (30 Hz simulation, JSON messages, 8 players per room, about 7 rooms at 50 players). S3 and S6 replace the estimates with measurements, and the CHANGELOG records the real numbers.

| Resource | Estimate for 50 players | Verdict |
| -------- | ----------------------- | ------- |
| CPU | The budget per tick at 30 Hz is 33 ms. If one room tick costs 2 to 4 ms, 7 rooms cost 14 to 28 ms, and Node runs the simulation on one core. | **The real limit.** Measure it in S6. If the 50-player tick average passes 15 ms, run groups of rooms in `worker_threads` (built into Node, no dependency). |
| Upload bandwidth | A snapshot is about 1 to 2 KB; at 20 to 30 per second that is 20 to 60 KB/s per player, so about 1 to 3 MB/s (8 to 24 Mbps) for 50 players. Inbound is tiny: about 2 KB/s per player. | Fine on a symmetric fiber plan, **not** on a slow upload line. Reduce first with a 20 Hz snapshot rate, interest management (S6) and deltas, in that order. |
| Memory | Node plus 7 rooms: well under 1 GB. | Not a limit. |
| Disk | A SQLite file of a few MB plus logs. | Not a limit. |
| Latency | A host in the Philippines is close to Philippine players. Wi-Fi at the host adds jitter. | Use **wired Ethernet** at the host. |

Requirements (all true before testers are invited):

1. **Reachability without opening the router.** Many home internet plans sit behind carrier-grade NAT (CGNAT), where port forwarding cannot work at all; compare the router's WAN address with the address a "what is my IP" site shows. The default is an **outbound-only tunnel** (for example Cloudflare Tunnel, which carries WebSockets and provides HTTPS / `wss://`; alternatives are a game-oriented tunnel service, or Tailscale for a private tester group). A tunnel hides the home IP address and needs no open port. A stable public address needs a domain (about 10 to 15 USD per year). **Verify each provider's current terms and free-plan limits at the start of S8**; do not rely on this paragraph.
2. **Never** forward ports blindly, use the router's DMZ, or run the server as administrator. The server runs under its own limited Windows user, reads only its own folder, listens on `127.0.0.1`, and only the tunnel talks to it.
3. **Up when needed.** Turn off sleep and hibernation, set Windows active hours so updates do not restart the PC mid-session, and use a UPS if possible. Start the server with Windows Task Scheduler ("at startup", restart on failure): no extra software. Run on a **schedule** (playtest windows announced to testers) until S9, not 24/7.
4. **Backups and restore.** A nightly copy of `data/primordia.db` to a different drive and to a cloud folder, one **tested restore**, and BitLocker (or equivalent) on the drive that holds accounts.
5. **Isolation from daily use.** A server and the owner's gaming or browsing on one PC compete for CPU, memory and upload. A spare laptop or mini PC is better: it idles at roughly 10 to 20 W, and a laptop battery acts as a small UPS (at the price of battery wear).
6. **Your internet plan's terms.** Some residential plans forbid public servers. Read yours; a tunnel does not change what you are running.
7. **Update and rollback** exactly as in S8b, using git tags.

Cost reality (section 4): home hosting saves money only if the PC is on anyway or is a low-power machine. A desktop drawing 100 W for 24 hours a day uses 72 kWh a month; at an assumed 11 PHP per kWh that is about 790 PHP, **about the price of a small VPS**. Check your own electricity price.

Move to S8b when **any** trigger fires: more than 50 concurrent players are expected; the 50-bot load test (S6) on the host shows a tick average above 15 ms or a tick max above 33 ms; uptime must be higher than a home line and home power can give; the PC is needed for other work; the internet provider objects.

Static client hosting for S8a: GitHub Pages (free) serves the game files and only the WebSocket goes to the home PC. The desktop build (S10) needs no web hosting at all.

#### S8b: Host on a small VPS (when a trigger fires)

1. Choose provider and region (a Singapore region), smallest plan that passes the S6 measurements with 2x headroom.
2. Server OS (an Ubuntu LTS release), non-root user, SSH key login only, firewall allowing only SSH, 80, 443.
3. Node.js install, app checkout, `npm ci`, a `systemd` service that restarts on failure.
4. Domain DNS, Caddy reverse proxy with automatic HTTPS so the client uses `wss://`.
5. Static client hosting (GitHub Pages or the same Caddy). Pages are HTTPS, so the socket must be `wss://`.
6. Nightly backup of the SQLite file to a different machine, and one **tested restore**.
7. Update procedure and **rollback procedure** (previous tag, restore backup).
8. Uptime check and a log review routine.

Done when (S8a): a person on mobile data in another city can register, play a raid with you, close the app, return, and find the character saved; the restore test has been performed once; the server came back by itself after a Windows restart; and the host's CPU, upload and tick numbers during a 10-player session are written in the CHANGELOG. Done when (S8b): the same, on the VPS.

### S9: Closed alpha (V1.19.0.00, then **V2.0.0.00**)

5 to 10 invited testers for 2 weeks (the home host's playtest windows are announced to them). Record: crashes, disconnects, average and worst ping, server tick max, bug list, and "was it fun" notes. **V2.0.0.00 criteria:** 10 players for 30 minutes without a server crash; no save lost across 3 restarts; no known exploit that grants damage, health or items; owner approval. **Scale test before V2.0.0.00:** 50 players (bots from `tools/loadtest.mjs` plus as many real people as are available) for 30 minutes on the chosen host, with tick average / max, upload in Mbps and CPU recorded; if the host cannot carry 50, the supported player cap is written down instead (a lower cap is a valid result).


### S10: Desktop build, an exe (optional; next free minor version, 2 to 3 sessions)

Goal: a Windows installer or portable `.exe` that opens the game in its own window, with no browser and no web hosting, and gives the real "Exit Game". It can start any time after S3 (single-player works offline from the first build). It changes **no game code** except what the steps below name.

Options (verify current versions and sizes at the start of the phase):

| Option | What it is | Output size | Needs | Verdict |
| ------ | ---------- | ----------- | ----- | ------- |
| Electron | Chromium and Node bundled; a small `main.js` opens a window | roughly 80 to 200 MB installed | `electron` and `electron-builder` as dev dependencies inside `desktop/` | **Recommended.** The same engine as Chrome, so the game behaves as in the browser; mature packaging to an installer and a portable exe |
| Tauri | Uses the operating system's web view (WebView2 on Windows) | a few MB | A Rust toolchain; web-view differences between Windows versions | Smaller, but a second toolchain for a solo project. Revisit if download size matters |
| NW.js | Like Electron | like Electron | similar | No advantage over Electron |
| Installed web app (PWA) | The browser's "Install app" gives the game its own window and icon | tiny | `manifest.json` and a service worker, HTTPS hosting; **no dependency** | Not an `.exe`, but zero-dependency. A good stopgap |
| Server as an exe (Node single executable) | Packs the server | n/a | n/a | **Not needed.** The server runs with `node server/index.js` on the host |

Decision default: Electron, in `desktop/` with its own `package.json` (D13). The repository root stays dependency-free.

Steps:

1. `desktop/main.js` opens one window (minimum size, no menu bar, F11 for fullscreen) and loads the game through a **custom protocol or a tiny localhost server, not `file://`**, because ES modules and video need an http-like origin (verify what works in the Electron version used). Block navigation away from the game and new windows; `contextIsolation` on and `nodeIntegration` off.
2. "Exit Game" calls `window.desktop?.quit()`, exposed by a small preload script and feature-detected; the browser keeps today's message.
3. Server address: the same Settings field as S3, with a default list in `desktop/servers.json`. The exe may use `wss://` to the tunnel address or `ws://` to a LAN or Tailscale address.
4. Build with `electron-builder`: an NSIS installer and a portable exe, output in `dist/` (already in `.gitignore`), an icon, the version read from `src/config.js`.
5. Unsigned apps trigger a Windows SmartScreen warning ("More info", then "Run anyway"); a paid code-signing certificate removes it later (section 5).
6. Updates: testers download a new installer at first. Auto-update comes only after signing, as its own step.

Gotchas:

- **Saves do not move.** Until S5, progress lives in the browser's `localStorage`; the exe has its own storage, so a character made on the website is not in the exe. After S5 the server owns saves and the problem disappears.
- An exe does **not** stop cheating: anyone can edit client files. This is why the server stays authoritative (D1).
- Every release now means one more build to publish and to test on a clean Windows PC.
- The game files are about 1.7 MB today, so the installer size is almost all runtime.

Done when: the installer works on a clean Windows PC with no Node or browser setup; single-player plays offline; Exit Game closes the app; with S3 present, the exe joins a server by address; `npm test` and the audit still pass at the repository root; the root `package.json` gained no dependency.

---

## 4. Cost and capacity (approximate: verify current prices when you reach S8)

| Item | Roughly |
| ---- | ------- |
| Home PC as host (S8a): electricity | A 100 W desktop on 24/7: 72 kWh a month, about 790 PHP at an assumed 11 PHP per kWh. A 15 W mini PC or laptop: about 11 kWh, about 120 PHP. Scheduled hours cost proportionally less. Check your bill for the real price per kWh |
| Small VPS (S8b), 1 to 2 vCPU, 1 to 2 GB RAM | about 5 to 12 USD per month |
| Domain name (needed for a stable tunnel address) | about 10 to 15 USD per year |
| Tunnel (Cloudflare Tunnel or similar) | free tier at the time of writing; verify |
| HTTPS (the tunnel, or Caddy with Let's Encrypt) | free |
| SQLite, Node.js, `ws`, GitHub Pages | free |
| Off-site backup (cloud folder or a second small storage) | 0 to 3 USD per month |
| Electron and `electron-builder` for the exe (S10) | free, open-source tools |
| Code-signing certificate for the exe (optional, later) | paid per year; verify |

Capacity is **not** promised. It is measured in S3 and S6 and written into the CHANGELOG. Do not buy a bigger server on a guess.

---

## 5. Flags for the owner (not legal advice)

- Once you store usernames and passwords, you handle personal data. The Philippines has a Data Privacy Act. Before collecting emails, running public sign-up, or accepting money, ask a lawyer or the National Privacy Commission's guidance. Keep data minimal (D7).
- Many players are minors. Keep chat off, keep sign-up simple, and do not collect birth dates.
- Selling anything (cosmetics, passes) adds tax, payment-provider and consumer-protection rules. Not in scope until V2 is stable.
- Credentials (server SSH keys, tunnel tokens, `.env`) never go in the repository or in a chat.
- **Home hosting (S8a):** the account database sits on your own computer, so you are responsible for it (encryption, backups, malware). Do not reuse the server PC for risky browsing or downloads. Your internet plan's terms may forbid public servers: read them. A tunnel hides your home address; a forwarded port does not.
- **The exe (S10):** an unsigned program triggers a Windows SmartScreen warning and sometimes antivirus false positives. Publish builds only from your own release page and say so to testers; a paid code-signing certificate removes the warning later. An exe does not make cheating harder (D1 does).

---

## 6. Debt log

The audit tool counts the mechanical debt. This list holds debt a script cannot see. Add a line when you knowingly leave a shortcut; delete it when fixed. Format: `file: what, fix phase`.

- `systems/HitEffects.js`: applies damage via `target.onHit` (P3), S1d
- `entities/Graugr.js`: `tryDeflect` spawns particles and damage numbers; uses `world.player`; AI uses `rand`; `draw()` in the entity (added in V1.9.0.00), S1b/S1f/S1i
- `entities/Player.js`, `TrainingDummy.js`: read input / mix `onHit` effects (P4, P5), S1d/S1e
- `scenes/WorldScene.js`: is both view and sim container (P11), S1d to S1k
- `skills/FlameShieldEffect.js`, `BurnWardEffect.js`: heavy drawing inside the effect classes (P6), S1f
- `progression/Progression.js`: `localStorage` (P7), S1g
- `lobby/loadTasks.js`: the world dry run creates a real `Progression`, so loading reads the real save (P13), S1g
- `ui/PlayerHud.js`, `ui/ProfilePanel.js`: read `world.player` and `world.raid` directly (P13, added in V1.10.0.00), S2
- `core/Game.js`: variable timestep and hit-stop time scaling (P10), S1j

---

## 7. What NOT to do

- No Kubernetes, microservices, sharding, message queues or load balancers. One process, one room manager, until you have 100 concurrent players **and** a measured need.
- No custom binary protocol before JSON is measured to be a problem.
- No client-side authority "just for now". It never gets removed.
- No new dependency not named in this file (`ws`, `better-sqlite3`, and, only inside `desktop/` after owner approval, Electron and its packager).
- No port forwarding, router DMZ or administrator account for the home host (S8a). Outbound tunnel, limited user.
- No Electron (or any other) dependency in the repository root `package.json`. The exe lives in `desktop/` (D13).
- No game feature that reads `world.input`, the DOM, `localStorage`, the clock or `Math.random` inside simulation code (`Claude.md` 5b).
- Do not skip a gate to save a session. A skipped gate costs several sessions later.

---

## 8. Proposal hooks (added V1.10.0.02)

Small obligations so the two proposals in `docs/proposals/` stay buildable. They add no steps and change no "done when". Plan and prerequisites: `ROADMAP.md` "Proposals"; analysis: `docs/proposals/ASSESSMENT.md`.

| Step | Obligation | For |
| ---- | ---------- | --- |
| S1b | `world.rng` is passed into sim objects as a parameter (never an imported global) and exposes `next()` in [0,1) | M1 to M3 bags |
| S1c | `world.time` is the only time source for gate windows and dormant catch-up | M3, W3 |
| S1d | `DamageSystem` is the single place where hit-driven random draws and token consumption happen | M2 |
| S1h | Integer entity `id`; `snapshot()` omits fields marked hidden (bag order, gates, secrets) | M3, M4, W2 |
| S1k | New sim folders: `src/sim/bag/`, `src/sim/spatial/` (both covered by the audit list and `import-sim`) | M1, W2 |
| S2 | `snap` and `ev` payloads carry no hidden state; a test asserts it | M4 |
| S5 | Item-instance state gets its own table only when M4 starts; do not add it earlier | M4 |
| S6 | Interest management uses the W2 grid; room soft/hard capacity are constants; `loadtest.mjs` also logs entities per room | W2, W5 |
