# Marble Bag Engine

**Integration concept for Lycarius Primordia / browser-based MMORPG**\
**Status: PROPOSAL; stage M1 (the pure bag primitive, `src/sim/bag/`) is built in V1.16.0.00 but not integrated; everything else is NOT IMPLEMENTED**

> **Instruction to Claude:** This document describes a proposed system.
> The Marble Bag Engine does not currently exist in the game unless
> confirmed by inspecting the repository. Do not claim it is
> implemented, do not assume files/classes/APIs exist, and do not
> replace existing systems blindly. First inspect the codebase, report
> relevant architecture, then propose a staged integration plan. Wait
> for approval before making code changes.

## 1. Goal

Design a reusable, server-authoritative engine for controlled
randomness, nested outcomes, persistent hidden conditions, unique item
secrets, crafting mysteries, NPC behavior, and world discoveries.

The goal is to define content through configuration rather than custom
code for every secret. Start with a small combat prototype; expand only
after the existing architecture is understood.

**Core rule:** random outcomes are explicit; conditions are
deterministic given their inputs; hidden state remains server-side and
persists according to declared rules.

## 2. Core vocabulary

-   **Bag:** A collection of outcome tokens with explicit draw/refill
    behavior.
-   **Token / marble:** One outcome, e.g. `NORMAL`, `CRIT`, `BLEED`,
    `MASTERWORK_STRIKE`.
-   **Draw:** Resolves an outcome and may consume a token.
-   **Gate:** A condition that enables a bag, effect, or state
    transition.
-   **Nested bag:** A bag reachable only through an outcome or gate.
-   **Condition:** A test against state, history, context, or an event
    sequence.
-   **Effect:** An approved game action or state change.
-   **Scope:** Owner of state: item instance, character, NPC,
    guild/faction, region, or world.
-   **Discovery:** A validated secret recorded in the discovery archive.
-   **Instance ID:** Stable unique identity for an individual
    item/NPC/entity, distinct from its item-definition ID.

## 3. Required bag configuration

Every bag must explicitly define:

-   Stable `id` and owner `scope`.
-   Token types and counts.
-   Draw eligibility and consumption timing.
-   Shuffle algorithm and refill policy.
-   Persistence requirements.
-   Empty-bag behavior.
-   Optional gate, outcomes, and effects.
-   Whether details are hidden from players.

Suggested policies:

  -----------------------------------------------------------------------
  Policy                              Meaning
  ----------------------------------- -----------------------------------
  `refill_shuffle`                    Recreate and shuffle the configured
                                      token pool when exhausted

  `persistent`                        Save bag state across
                                      sessions/restarts; this is a
                                      persistence property, not a refill
                                      rule

  `consumable`                        Drawn tokens are permanently
                                      removed

  `single_use`                        Resolve once, then mark the bag
                                      spent

  `no_refill`                         Exhaustion remains exhaustion

  `conditional`                       Drawing/activation is allowed only
                                      when a gate passes
  -----------------------------------------------------------------------

Policies may be combined only when their interaction is defined. For
example, a persistent bag may refill, but a consumed unique token must
not reappear unless explicitly configured.

## 4. Controlled-randomness example

A bag contains four `NORMAL` tokens and two `CRIT` tokens.

-   Each complete cycle contains exactly four normal outcomes and two
    critical outcomes.
-   On a fresh six-token cycle, the first draw has a `2/6` chance of
    being critical.
-   After one normal token is drawn, the next critical chance is `2/5`.
-   Outcomes may cluster; the system does not guarantee evenly spaced
    critical hits.
-   Shuffle without bias (e.g. Fisher--Yates) using a server-side random
    source.
-   Never let the client choose or predict authoritative outcomes.

Critical-hit frequency and critical-hit damage are separate settings.

### Consumption contract

Before integration, define when a token is consumed. Suggested initial
rule: one combat token per eligible landed hit. Explicitly decide what
happens on misses, dodges, multi-hit attacks, AoE attacks, cancelled
attacks, and simultaneous actions. Never let different code paths
consume tokens inconsistently.

## 5. Nested bags and condition gates

Example:

1.  `COMBAT_BAG` draws `NORMAL` or `CRIT`.
2.  A sequence or context condition satisfies `SECRET_GATE`.
3.  The gate unlocks `MASTERWORK_BAG`.
4.  A separate condition determines when the special outcome is
    eligible.
5.  `MASTERWORK_STRIKE` fires once and the item instance records it as
    spent.

Conditions may check:

-   Prior outcomes or event counts.
-   Ordered sequences within a defined time/event window.
-   Item origin, materials, crafter, recipe, and crafting history.
-   Location, weather, time, or world events.
-   NPC relationships, faction standing, or prior interactions.
-   Skills, tools, nearby entities, or environmental state.
-   Another gate's state.
-   Multiple conditions combined with `ALL`, `ANY`, or `NOT`.

Every sequence condition must define its event source, order, window,
reset rule, and whether unrelated events interrupt it. Prevent invalid
references, infinite evaluation loops, and unbounded nesting.

A gate is not a guarantee that an outcome will eventually occur. If a
secret must be guaranteed once unlocked, specify that explicitly rather
than relying on a random chance that could fail forever.

## 6. Example concept: unique masterwork bow

A bow crafted from low-tier materials by a master may have ordinary
attacks indefinitely but exactly one hidden, high-damage shot during its
lifetime.

Requirements:

-   The secret belongs to the **individual item instance**, not every
    bow of that type.
-   A hidden sequence/context may unlock the special bag.
-   A separate rule controls firing the shot.
-   The special shot is consumed exactly once.
-   Trading, logout, server restart, and ordinary repair do not reset
    the secret unless design explicitly says otherwise.
-   Upgrading, transferring ownership, destroying, or recreating the
    item must have defined behavior.
-   Two identical-looking bows may have different histories and hidden
    states.
-   Keep secret state hidden from the client until discovery rules allow
    disclosure.

Do not implement this example as a one-off hard-coded bow mechanic if
the general engine can express it.

## 7. Proposed data-driven shape

Illustrative JSON only; not an existing schema or implementation:

``` json
{
  "id": "masterwork_bow",
  "scope": "item_instance",
  "bags": {
    "combat": {
      "tokens": { "NORMAL": 4, "CRIT": 2 },
      "refill_policy": "refill_shuffle",
      "persist_state": true
    },
    "masterwork": {
      "tokens": { "NORMAL": 5, "MASTERWORK_STRIKE": 1 },
      "refill_policy": "no_refill",
      "persist_state": true,
      "unlock_gate": "masterwork_gate"
    }
  },
  "gates": {
    "masterwork_gate": {
      "operator": "ALL",
      "conditions": [
        {
          "type": "sequence_match",
          "source": "combat_outcomes",
          "sequence": ["NORMAL", "CRIT", "NORMAL", "NORMAL"],
          "window": "design-defined"
        },
        {
          "type": "state_equals",
          "key": "masterwork_spent",
          "value": false
        }
      ],
      "effect": "unlock_bag"
    }
  }
}
```

This is a conceptual illustration. Before using JSON, choose and
validate a schema that fits the game's actual language, server
architecture, persistence layer, and content pipeline. Do not interpret
placeholder values as production-ready configuration.

## 8. State, persistence, and security

State can be owned by:

-   `item_instance`: item secrets, provenance, one-time uses.
-   `character`: personal progress/discoveries.
-   `npc`: memory, relationships, story progress.
-   `guild` / `faction`: collective discoveries and unlocks.
-   `region` / `world`: shared events and global mysteries.

Persist only the state required by each mechanic: remaining tokens/order
where relevant, gate status, one-time consumption, and event history
needed for future conditions.

Server requirements:

-   Server owns all draws, gates, effects, and authoritative state.
-   Client receives only allowed results; never send hidden bag order or
    secret conditions.
-   Protect draws and state transitions against concurrent requests and
    duplicate execution.
-   Use transactions/locking or equivalent consistency controls where
    multiple actions can touch the same state.
-   Make retryable operations idempotent where practical.
-   Validate all configuration references and reject invalid definitions
    at load time.
-   Record diagnostic events for debugging and exploit investigation.
-   Avoid checking every secret every frame; evaluate on relevant events
    where possible.

## 9. Discovery archive (future extension)

The engine may emit validated events to a separate archive system. Keep
these categories distinct:

1.  Item identity discovered.
2.  Hidden property discovered.
3.  Recipe or condition discovered.
4.  Origin/provenance discovered.
5.  Regional/world mystery solved.

Possible rewards: first-discovery titles, personal archive entries,
guild/faction rankings, and world announcements.

Do not build the archive as a prerequisite for the core bag engine.
Prevent duplicate or spoofed credit, keep undiscovered data private, and
decide whether later discoverers receive completion credit even if
first-discovery credit is unique.

## 10. Architecture boundaries

Prefer small components with clear responsibilities:

-   **Bag definition/validator:** validates tokens, policies,
    references, and limits.
-   **Bag runtime:** owns token pool, shuffle, draw, consumption, and
    refill.
-   **Condition evaluator:** evaluates declared conditions against
    supplied state/events.
-   **Gate/state manager:** records unlocks and state transitions.
-   **Effect dispatcher:** invokes only registered, approved game
    effects.
-   **Persistence adapter:** saves/restores state using the project's
    actual storage layer.
-   **Event/audit log:** records relevant transitions for tests and
    debugging.
-   **Content definitions:** configuration for specific combat, item,
    crafting, NPC, or world behavior.

These are logical responsibilities, not mandatory class names. Match the
project's existing architecture rather than creating unnecessary
abstractions or duplicate systems.

## 11. Testing and acceptance criteria

At minimum, test:

-   Token counts are correct before and after draws.
-   A complete 4-normal/2-crit cycle produces exactly those totals.
-   Shuffle is unbiased and reproducible in tests with a controlled test
    RNG.
-   Empty-bag and refill behavior match configuration.
-   Gates correctly evaluate `ALL`, `ANY`, `NOT`, counts, and sequences.
-   Sequence window and reset semantics are correct.
-   Unique effects cannot fire twice, including under concurrent
    requests.
-   State survives logout, restart, trade, and supported item
    operations.
-   Invalid references, cycles, excessive depth, and malformed
    definitions fail safely.
-   Client payloads do not expose hidden state.
-   Discovery credit cannot be duplicated through retries or spoofed
    requests.

Add developer-only inspection tools for bag contents, gate evaluation,
and state history. Never expose these tools to production clients.

## 12. Integration plan for Claude

**Phase 0 --- Inspect only** 1. Inspect the repository and identify the
actual client/server boundaries, combat resolution, item-instance model,
persistence, event handling, and test framework. 2. Search for existing
random/critical-hit/loot/condition systems. 3. Report what already
exists, what is missing, and any architectural conflicts. 4. Do not edit
files in this phase.

**Phase 1 --- Design** 1. Propose a minimal interface that fits the
existing project. 2. Define state ownership, persistence,
draw-consumption rules, concurrency protection, and configuration
format. 3. List files to create/change and explain why. 4. Identify
migration or compatibility risks. 5. Wait for approval before
implementation.

**Phase 2 --- Minimal prototype** 1. Implement the smallest testable bag
primitive. 2. Add unit tests using an injectable test RNG. 3. Integrate
only one controlled 4-normal/2-crit use case if the current combat
architecture supports it. 4. Keep existing behavior intact unless the
user explicitly approves a change.

**Phase 3 --- Persistent secret prototype** 1. Add item-instance state
and one-time consumption. 2. Test persistence and trade/restart
behavior. 3. Add one data-driven secret item example. 4. Do not yet
build the full archive, NPC system, or global mystery network.

**Phase 4 --- Expand deliberately** Add crafting gates, NPC behavior,
world events, and discovery tracking only after the core has passed
tests and the user approves each scope.

### Mandatory implementation discipline

-   Treat this document as a **design proposal**, not proof of existing
    code.
-   Never claim a phase is complete unless files and tests confirm it.
-   Do not rewrite unrelated systems or introduce dependencies without
    justification.
-   Prefer incremental, reviewable changes.
-   If the current architecture cannot support a requirement cleanly,
    explain the issue and offer alternatives before coding.

## 13. Design laws

1.  One reusable engine; many data-driven configurations.
2.  Explicit draw, consume, refill, and persistence semantics.
3.  Item-instance secrets belong to stable instance identity.
4.  Server authority is absolute for hidden outcomes.
5.  Conditions are deterministic when their inputs are fixed.
6.  Secrets should be discoverable through clues, not arbitrary
    guesswork.
7.  Balance and architecture are separate concerns.
8.  Bound nesting, evaluation cost, history size, and configuration
    complexity.
9.  Start small; prove correctness before expanding scope.

## Summary

The Marble Bag Engine is a **proposed** data-driven foundation for
controlled randomness and persistent, nested conditions. It could
support combat outcomes, one-time item secrets, hidden crafting paths,
NPC stories, and world discoveries through shared primitives rather than
isolated hard-coded mechanics.

**Current status: concept only. Repository inspection and explicit
implementation approval are required before integration.**
