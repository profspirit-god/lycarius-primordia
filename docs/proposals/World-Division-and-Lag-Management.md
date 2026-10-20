# World Division & Lag Management

**Proposal for Lycarius Primordia / browser-based MMORPG**\
**Status: PROPOSAL ONLY --- NOT IMPLEMENTED OR INTEGRATED**

> **Instruction to Claude:** This is a design proposal, not evidence of
> existing code. Inspect the repository before recommending changes. Do
> not assume these systems exist, do not edit files during the initial
> inspection, and do not claim implementation without verified code and
> tests. Present an integration plan and wait for approval.

## 1. Objective

Design a scalable world simulation that supports multiple maps,
real-time movement/combat, monsters, player groups, instanced content,
and populated-feeling regions without simulating every entity at full
detail at all times.

**Core principle:** separate world organization, simulation frequency,
network replication, and client rendering. An entity being off-screen
must not automatically mean its server-side world stops existing.

Initial planning target: **100 human players, 200 roaming NPC
adventurers, and 200 static NPCs**. This is a design target, not a
capacity guarantee. Actual capacity depends on hardware, code, AI
complexity, network traffic, and load testing.

## 2. World hierarchy

Use a logical hierarchy such as:

**World → Region → Zone → Instance → Spatial Cell**

-   **World:** persistent game universe and global state.
-   **Region:** broad geographic/cultural area; owns regional events,
    factions, and discovery progress.
-   **Zone:** playable map with its own terrain, entity population,
    rules, and player capacity policy.
-   **Instance:** separate runtime copy of a zone or dungeon for a solo
    player, party, or guild.
-   **Spatial cell/chunk:** small area used for nearby-entity queries,
    movement updates, and network interest management.

These are logical concepts. Reuse existing map structures if they
already provide equivalent behavior.

### Public zones and copies

A public zone may have multiple **channels/copies** when population or
server load requires it. Each copy has separate live entities but shares
only explicitly defined persistent state. Define whether players can
switch copies, how parties stay together, and how trades, bosses, and
regional events synchronize.

### Private instances

Support access-controlled instances for:

-   Solo content.
-   Party dungeons.
-   Guild dungeons.
-   Temporary event scenarios.

Each instance needs an owner/access policy, lifecycle, capacity,
save/reset rules, and cleanup policy. Decide whether the instance
persists after its last player leaves. Never accidentally duplicate
unique loot or global state when copying a zone.

## 3. Separate four systems

### A. World organization

Determines which region, zone, copy, instance, and cell contain an
entity.

### B. Simulation

Runs authoritative rules: movement, combat, AI, status effects, timers,
and world events.

### C. Interest management

Determines which entities and state changes each player needs to
receive.

### D. Rendering

Determines what the browser draws. The client may stop rendering distant
entities, but it does not control authoritative simulation.

**Important:** reducing rendering alone does not reduce server CPU much.
Interest management reduces unnecessary network traffic; adaptive
simulation reduces server work.

## 4. Spatial cells and visibility

Divide each zone into spatial cells/chunks. Use them to query nearby
entities instead of checking every entity against every player on every
update.

For each player, maintain a **relevance set** based on distance and
gameplay rules. Send updates for relevant entities only, plus exceptions
such as party members, targets, combat participants, or scripted events.

Use separate thresholds for entering and leaving relevance to prevent
rapid add/remove flicker near a boundary. When an entity enters
relevance, send a snapshot; afterward, send incremental updates. When it
leaves, stop routine replication and remove or mark it dormant on the
client.

Cell size and update rates must be measured and tuned against movement
speed, combat range, entity density, and map geometry. Avoid assuming
one universal cell size fits every map.

## 5. Adaptive simulation tiers

Entities and cells can use tiers according to player proximity and
gameplay importance.

  -----------------------------------------------------------------------
  Tier                    Typical condition       Server behavior
  ----------------------- ----------------------- -----------------------
  **Active**              Players nearby or       Full movement, combat,
                          entity in consequential AI, and timely
                          combat                  replication

  **Reduced**             No nearby players;      Lower-frequency AI and
                          low-risk background     movement; aggregate
                          activity                routine needs

  **Dormant**             No players and no event Pause eligible updates;
                          requiring live          save state and
                          processing              timestamps

  **Critical exception**  Entity affects combat,  Keep required rules
                          an event, economy, or   active regardless of
                          player safety           visibility
  -----------------------------------------------------------------------

Tier changes must not create exploitable time skips, teleporting,
duplicate rewards, or inconsistent timers. Use elapsed-time calculations
for eligible background systems rather than replaying every missed tick.

### What may be reduced or paused?

Potentially reduce or pause: - Distant ambient NPC idle decisions. -
Nonessential wandering and cosmetic behavior. - Low-priority
environmental effects. - Routine background decisions whose result can
be calculated later.

Do **not** pause blindly: - Combat or projectiles that can affect a
player. - Aggro, pursuit, or abilities within relevant gameplay range. -
Auction/trade/economy transactions or global cooldowns that require
consistency. - Timed quests/events with player-visible consequences. -
Persistent hazards or offline-player rules whose design requires
continued simulation. - Any action that can duplicate loot, skip a cost,
or change a competitive outcome.

For dormant entities, save a compact state and last-update timestamp. On
reactivation, apply only the allowed elapsed-time consequences. Do not
simulate thousands of stale AI ticks unless a mechanic requires it.

## 6. NPC population strategy

Planning population: **200 roaming NPC adventurers (RNPCs) + 200 static
NPCs**.

### Roaming NPC adventurers

RNPCs may trade, travel, form groups, explore, develop stories, change
affiliations, and potentially engage in player-killing if that is part
of their design. Full simulation for all 200 at all times may be
expensive.

Use tiered fidelity: - **Active:** detailed movement, combat, decisions,
and interaction near players. - **Reduced:** periodic goals and coarse
travel between destinations. - **Dormant:** store goal,
route/destination, inventory summary, relationships, and relevant
history; advance only permitted background state on a schedule or when
reactivated.

Use a **goal/state model** (e.g. travelling, trading, resting, fighting,
regrouping) rather than constantly running expensive decision-making.
Schedule AI work across ticks so every NPC does not pathfind
simultaneously. Cache routes where appropriate and use bounded
pathfinding.

NPC stories should be state-driven and event-based. Record consequential
events; do not require every off-screen conversation or movement step to
be simulated.

### Static NPCs

Static vendors, quest givers, guards, and ambient characters should use
lightweight idle behavior. Run dialogue, shop logic, quest checks, and
combat only when triggered or relevant. Keep essential vendor/quest
state authoritative and persistent.

## 7. Real-time server loop

Use a bounded server simulation loop with clear work budgets.

-   Process validated player inputs.
-   Update relevant movement and collision.
-   Resolve combat and status effects authoritatively.
-   Process nearby active AI.
-   Process scheduled reduced-tier AI within a budget.
-   Apply queued state changes and persistence.
-   Publish state deltas to relevant clients.
-   Measure tick duration, backlog, and dropped/deferred work.

Avoid unbounded work inside one tick. Spread noncritical AI,
pathfinding, persistence, and maintenance over time. Do not silently
defer combat-critical work when overloaded; define an overload policy
and monitor it.

The required tick rate must be chosen based on combat feel and measured
performance, not assumed. Use authoritative timestamps/sequences and
interpolation on clients where suitable. Client prediction may improve
responsiveness but must not decide outcomes.

## 8. Networking and state updates

-   Send snapshots on entry or resynchronization; use deltas for routine
    updates.
-   Replicate only state relevant to each client.
-   Batch small updates where latency permits.
-   Avoid sending unchanged state every tick.
-   Rate-limit and validate client input.
-   Keep combat, inventory, loot, trades, and secret state
    server-authoritative.
-   Handle disconnect/reconnect without duplicating actions.
-   Define maximum entity/update budgets per client and zone.

Do not rely on client render distance as a security boundary. Clients
may request only allowed information; the server must enforce access and
relevance.

## 9. Zone capacity and migration

Each zone/copy should have a configurable soft capacity and a hard
safety limit. When a public zone approaches its tested limit, the system
may route new arrivals to another copy, while keeping parties together.
Do not split a party silently.

Moving between zones/instances must be transactional enough to prevent
duplicate entities, inventory, or rewards: 1. Validate destination and
access. 2. Reserve destination capacity. 3. Save/transfer required
character state. 4. Remove the source presence. 5. Confirm destination
presence. 6. Recover safely if transfer fails.

Do not promise seamless migration or multi-server scaling until the
existing architecture supports it. A single-process implementation may
use these abstractions without immediately deploying multiple machines.

## 10. Persistence and lifecycle

Persist data according to its importance:

-   Character, inventory, currency, quests, and unique item state:
    durable and consistent.
-   Instance progress: according to declared instance rules.
-   NPC story/provenance: save consequential state.
-   Ambient position and nonessential idle details: may be reconstructed
    or saved less often.
-   Global/regional events: persistent when players can observe their
    effects.

Define cleanup for empty instances and expired temporary entities.
Cleanup must not erase rewards, secrets, or progress that should
survive. Use stable entity IDs where state must persist across zone
transitions or server restarts.

## 11. Metrics and overload behavior

Measure at minimum: - Server tick duration and tick overruns. - CPU and
memory usage. - Active players/entities per zone and cell. - AI
decisions and pathfinding jobs per second. - Network bytes/messages per
client and zone. - Persistence latency and queue depth. -
Input-to-result latency, disconnects, and error rates. -
Dormant-to-active transition cost.

When overloaded, reduce low-priority AI frequency, defer noncritical
work, and throttle cosmetic updates before compromising combat or
inventory integrity. Expose warnings in logs/metrics; never hide
overload by silently dropping authoritative actions.

## 12. Testing and capacity validation

Test progressively with synthetic clients and controlled NPC
populations:

1.  1--5 players, basic movement.
2.  10 players with movement and combat.
3.  20--25 players across multiple cells/zones.
4.  50 players with combat, active monsters, and RNPCs.
5.  75--100 players only after earlier tests are stable.
6.  Increase RNPCs and static NPCs independently to find their costs.
7.  Test dense crowds, zone transfers, instance creation/cleanup,
    reconnects, and server restart.
8.  Test worst-case combat and many simultaneous AI/pathfinding events.

Record CPU, RAM, tick overruns, latency, network traffic, and state
consistency. Aim to retain headroom rather than running continuously at
maximum capacity. A target population is not confirmed until repeatable
load tests pass on the intended hardware and network.

## 13. Implementation roadmap for Claude

### Phase 0 --- Repository inspection only

1.  Identify current game architecture, server runtime, networking
    layer, map/entity model, combat loop, AI, persistence, and test
    setup.
2.  Locate existing visibility/range logic, if any.
3.  Report which proposal concepts already exist, are partial, or are
    missing.
4.  Make no changes.

### Phase 1 --- Design for this codebase

Propose the smallest compatible architecture for zones, spatial cells,
relevance sets, and simulation tiers. Identify affected files, migration
risks, and required tests. Do not implement until approved.

### Phase 2 --- Local simulation prototype

Implement spatial queries and interest management for one test zone.
Verify that players receive relevant entities and no longer receive
routine updates for irrelevant entities. Do not yet add distributed
servers.

### Phase 3 --- Adaptive NPC simulation

Add active/reduced/dormant tiers for a small NPC set. Test reactivation,
elapsed-time rules, combat safety, and persistence.

### Phase 4 --- Instances and population controls

Add zone copies, private instances, lifecycle rules, and capacity
policies only after the single-zone behavior is stable.

### Phase 5 --- Load testing and tuning

Automate load tests, gather metrics, tune cell size/update rates/AI
budgets, and document measured limits.

### Mandatory instructions

-   Treat this file as a proposal, not current implementation.
-   Inspect before coding; report findings first.
-   Do not refactor unrelated systems or add dependencies without
    justification.
-   Preserve existing gameplay behavior unless changes are approved.
-   Do not claim capacity or completion without test evidence.
-   If the repository architecture conflicts with this proposal, explain
    the conflict and offer the smallest viable alternative.

## 14. Design rules

1.  World hierarchy, simulation, networking, and rendering are separate
    concerns.
2.  Off-screen does not mean nonexistent; dormant does not mean
    state-free.
3.  Reduce background fidelity before reducing authoritative
    correctness.
4.  Use spatial indexing; avoid all-entities-versus-all-players loops.
5.  Keep combat, inventory, economy, and unique state
    server-authoritative.
6.  Use explicit lifecycle, persistence, and transfer rules.
7.  Measure before promising player capacity.
8.  Start with one zone and one NPC tiering prototype; scale only after
    tests.

## Summary

This proposal defines a world hierarchy, public zone copies, private
instances, spatial cells, interest management, adaptive simulation
tiers, and tiered NPC AI to reduce unnecessary server work while
preserving authoritative gameplay.

**Current status: concept only. Repository inspection and explicit
approval are required before integration.**
