# Hunger statuses: reconciled proposal (planned, not built)

> Origin: the "H2 Hunger System Proposal" written with ChatGPT, reviewed against the repo (V1.21.0.00) on 2026-10-24, then settled by the owner the same day. It is **design intent and extra information, not the absolute truth** (`Claude.md` rule 13). Authority: `Claude.md`, then `FOUNDER.md` section 12 (owner resolutions R12 to R21), then this file.
> Nothing here is built. Every status below is gated by the system rows it needs (section 7). Where a status needs a system that does not exist, **the system is built first** and the status waits (owner resolution R19).
> Companions: `FOUNDER.md` section 6 (hunger law and tiers), `docs/proposals/Marble-bag-engine.md` (randomness), `ROADMAP.md` track HS.

## 1. Law and goal

**Hunger is pressure, not erasure.** It escalates through efficiency, movement, regeneration and recoverable conditions. It must not permanently cripple a character, create an unavoidable death loop, or make food a soft-lock.

- **Hunger may damage, but it can never kill** (owner resolution R12). Hunger-caused damage is always non-lethal (never below 1 HP), bounded, never stacking, and always ends when the cause ends or the player is downed.
- **Tiers never damage.** A tier only carries multipliers. Damage comes only from statuses, which are separate data.
- **Four concepts stay separate:** the hunger value (simulation), the tier effects (deterministic multipliers), statuses (rolled or timed conditions), and the HUD (display only; it never rolls, drains, applies or times anything).
- **No duplicated penalties:** one path owns status application, expiry, stacking and removal (the status registry, section 7 row X3).

## 2. Shared rules

### 2a. Triggers and randomness

- All rolls draw from a **seeded `Bag`** (`src/sim/bag/`, M1) fed by `world.rng`, one bag per player per tier (scope `entity`, hidden, `refill_shuffle`). A bag guarantees exact counts per cycle, so luck cannot streak badly. Never `Math.random`, never per frame.
- **Stuffed:** one draw for every **successful eat that ends with the stat in the Stuffed tier** (90% or more): the eat that enters Stuffed, and every eat made while already in it. An eat that **overflows** past 100% triggers Overeating (deterministic) and **does not also draw**, so penalties do not pile up.
- **Gluttony** is outside the bag: before each Stuffed draw, `world.rng.chance(0.001)` (0.1%). It is too rare for a bag (the pool limit is 1000 tokens).
- **Full:** one draw for every successful eat that ends in the Full tier (60% to 89%).
- **Hungry** and **Starving:** one draw when the stat **enters** the tier by draining (once per entry). Re-entry after eating above the line rolls again.
- Exactly **one outcome per draw**. The owner's chances are used as **relative weights**; where they sum to more than 100 (Stuffed: 146%) they are scaled, and `NONE` tokens keep the debuff rate sane. Provisional bags are in sections 3 to 6.

### 2b. Stacking, duration and removal

- One instance per status id per player. A second trigger of the same id **refreshes its duration** and never stacks.
- A tier status (rolled from a tier bag) ends when the stat **leaves that tier** or when its own duration ends, whichever is first. Timer statuses (sections 5 and 6) end when their condition ends.
- Statuses of one family do not stack: the stronger replaces the weaker (Severely Weakened replaces Weakened; Malnourished and Weakened are separate families).
- Modifiers carry an **owner key** (`hunger:tier`, `hunger:<status id>`). Removing one removes only its own. A **total cap** applies to hunger-caused move speed: never below 75% of normal (R14).
- Downing the player ends all hunger statuses. Respawn raises the stat to at least 25% (R20).

### 2c. Non-lethal damage

- One shared primitive (system row N1): `damageNonLethal(n)` lowers HP but never below 1, never triggers `down()`, never knocks back, and reports what it really took.
- Damage over time from hunger has a **bounded total** per episode (a budget), ticks once per second of sim time, stops at 1 HP, and ends when its status ends. It can never "wait forever": a status always has a duration or an ending condition.
- The player at 1 HP is not protected from enemies: hunger damage is a danger to manage by eating, not a safe zone. Because food is always obtainable and respawn lifts the stat to 25%, there is no unavoidable loop.

### 2d. Timers and saves

- "Continuously hungry" means the stat stays **below 25%** (Hungry and Starving together). A timer counts sim time only (never while paused or downed), keeps running while the stat stays below 25%, and **resets only when the stat reaches 25% or more**. Eating that leaves the stat below 25% does not reset it (R17).
- The **Starving timer** counts sim time spent **in the Starving tier** (below 8%); it resets on leaving the tier.
- Hunger is saved with its timers and tier bags in one versioned record (`lycarius.primordia.hunger`), so reloading does not reset a timer or reroll a bag. Derived values (multipliers, active modifiers) are recomputed on load, never saved.

## 3. Stuffed (90% to 100%)

Tier effects (`FOUNDER.md` section 6a): slower movement, a little more HP regeneration. A temporary max-HP bonus is wanted but needs row X2 and a magnitude.

The Stuffed bag (provisional, 20 tokens, about 60% of rolls give a status):

| Token | Weight | Status | Effect (owner's design) | Visual concept | Needs |
| ----- | ------ | ------ | ----------------------- | -------------- | ----- |
| NONE | 8 | nothing | | | |
| BLOATED | 4 | Bloated | Further reduced speed (inside the 75% cap); larger hitbox | Yellowish character, exaggerated tummy | X1; hitbox needs X6 |
| STAMINA_DRAIN | 3 | Stamina Drain | Actions cost more stamina | Broken yellow/grey energy bolt | X1, X3 |
| EVASION_PENALTY | 2 | Evasion Penalty | Dodge and evasion less effective | Side-view silhouette, round stomach, red bullseye | X6 |
| NAUSEA | 2 | Nausea | Reduced accuracy, screen blur | Face in a toxic cloud | X6, X8 |
| VOMITING | 1 | Vomiting | The character stops briefly and loses HP (provisional: 1.5 s, 10% of max HP, never below 1) | Mouth vomiting | N1, X3 |

Separate rare event: **Gluttony** (0.1% per Stuffed roll): HP becomes the **lower** of current HP and 30 (provisional: it never heals and never kills), and character XP and specialization XP gain +20% for a duration to be set (provisional 5 min). Needs N1, X3, X5. Visual: dark orb, violet glow, open mouth.

**Overeating** is not a bag outcome (R13): food has a point value; when `stat + points` would exceed the maximum, the stat becomes 100%, the excess is wasted, and Overeating starts.

- **Effect (owner's design):** 2 damage per second for 30 s, non-lethal. Provisional budget: at most 50% of max HP per episode (2/s for 30 s is 60, more than a 50 HP character has).
- **After it:** the player cannot eat while the stat is at 100% **or** while Overeating is active (`reason: "overeating"` or `"cannot_eat"`). Needs N1, X3. Visual: mouth pierced vertically by a sword.

## 4. Full (60% to 89%)

Tier effect: a little more HP regeneration. The Full bag uses the owner's numbers exactly, with the remaining 2% as `NONE` (100 tokens):

| Token | Weight | Status | Effect (owner's design) | Visual concept | Needs |
| ----- | ------ | ------ | ----------------------- | -------------- | ----- |
| SATIATED | 50 | Satiated | "+5% status boost": **must be defined** (proposal: +5% to the tier's regeneration multipliers) | Glowing heart | X1, X3 and a definition |
| NOURISHED | 29 | Nourished | Environmental immunity and more max HP: **name the hazards** first | Gold shield | X2, X7 |
| WELL_FED | 19 | Well-Fed | XP multiplier for 2 minutes (magnitude to set; provisional +10%) | Gold mouth with an upward XP symbol | X3, X5 |
| NONE | 2 | nothing | | | |

Nothing here is built until its system exists. A status that only buffs is lower risk than the Stuffed debuffs, but it still waits for its system row.

## 5. Hungry (8% to 24%)

Tier effects: slower movement, less HP regeneration, less stamina regeneration.

| Status | Trigger | Effect (owner's design) | Visual concept | Needs |
| ------ | ------- | ----------------------- | -------------- | ----- |
| Famished | Entering Hungry; Hungry bag of 5 = 2 FAMISHED + 3 NONE (40%) | Reduced carry capacity (provisional -20%) | Weight icon with a down arrow | X4 |
| Malnourished | **15 minutes** continuously below 25% (owner changed 30 to 15; the band alone lasts 25.5 min, so it is reachable) | HP and HP regeneration severely reduced (provisional: max HP -20%, HP regen x0.5) | Skinny human silhouette | X1, X2, X3 |
| Weakened | 1 hour continuously below 25% | Reduced stats (set in the tuning doc; never below the stat floors) | Bent-over silhouette, blue palette | X1, X3 |

## 6. Starving (0% to 7%)

Tier effects: much slower movement (about -15% per tier, inside the 75% cap), much less HP and stamina regeneration. A temporary max-HP reduction is wanted but needs X2 and a magnitude.

| Status | Trigger | Effect (owner's design) | Visual concept | Needs |
| ------ | ------- | ----------------------- | -------------- | ----- |
| Severely Weakened | Entering Starving; bag of 10 = 7 SEVERELY_WEAKENED + 3 NONE (70%) | Stats severely reduced; replaces Weakened (the stronger wins, no double penalty) | Bent-over silhouette, red palette | X1, X3 |
| Perishing | 1 hour in the Starving tier | 5 damage per second, **non-lethal** (never below 1 HP); ends on leaving Starving or when downed | Silhouette turning to dust | N1, X3 |

Perishing is the one status that can leave a player at 1 HP for a long time. That is deliberate: it is a survival emergency solved by eating, and downing resets it. Provisional safety: it never starts while HP is already 1, and a budget per episode may be added in tuning.

## 7. Systems the statuses need (build these first)

Owner rule (R19): when a status needs a system that does not exist, the **system comes first** in the roadmap, and the status waits. Rows here are tracked in `ROADMAP.md` (track HS) and `docs/ENGINES_AND_SYSTEMS.md`.

| Row | System | Today | Needed by |
| --- | ------ | ----- | --------- |
| N1 | Non-lethal damage: `damageNonLethal`, a damage over time with a floor of 1 HP and a bounded budget | `Vitals.damage` floors at 0, burn ticks can kill | Overeating, Vomiting, Perishing, Gluttony |
| X1 | Owned **temporary** stat-modifier layer: per-owner keys, product, total caps, recalculated when one changes; covers HP, mana and stamina regeneration, move speed, stamina cost, damage, XP. It multiplies the **final** `player.stats`, never the permanent stat-ticket bonus (`StatTraining`) | `Player.syncProgression` builds `stats` from class, progression and the permanent ticket bonus (V1.21.0.00); the only temporary multiplier is `manaRegenMult` (owned by `ManaRegenEffect`); speed is read from `stats.speed` | Direct tier effects, Bloated, Stamina Drain, Satiated, Weakened |
| X2 | Max-HP **decreases** and owned max-HP modifiers with clamping (removing a bonus never kills, a reduction never kills) | `syncProgression` already fills what a **higher** maximum adds and never revives a downed player (stat tickets); a lower maximum is not handled | Max-HP tier effects, Malnourished, Nourished |
| X3 | Status registry: data-defined statuses (id, duration, stacking family, source, icon id, metadata) inside `StatusSystem` | Burn and stun are hard-coded fields | Every status here |
| X4 | Carry capacity as a **modifiable, enforced** rule | **Partly built (V1.19.0.00):** `carryCapacityMg(ownerId)` in `sim/items/weight.js` is the one function and the weight bar shows it, but it returns a constant (30 kg) and over capacity only changes the bar colour. Famished needs a modifier input through X1 and an owner decision on what over capacity does | Famished |
| X5 | XP multiplier hook for character and specialization XP | `XpSystem` pays flat amounts; job XP is separate (`JobProgress`, V1.20.0.00) and out of scope here | Well-Fed, Gluttony |
| X6 | Accuracy, evasion and hitbox model | No miss mechanic, hitbox is the collision radius | Nausea, Evasion Penalty, Bloated hitbox |
| X7 | Environmental hazards (zones) | None | Nourished |
| X8 | Screen blur (view only) | None | Nausea |

## 8. Dispositions of the proposal

| Item | Disposition |
| ---- | ----------- |
| Fourth bar order HP, Mana, Stamina, Hunger; icons in the existing status area | Accept (H2a, H2b) |
| Tier direct effects, separate HP, mana and stamina regen | Accept, mana unchanged until set (R18) |
| Hunger can damage but never kill | Accept (R12), law rewritten |
| Overeating at 100% | Revise: deterministic overflow rule (R13) |
| Speed penalties | Revise: total cap 75% (R14) |
| Probabilities over 100% | Revise: Bag with `NONE` tokens (R15) |
| 30 minutes hungry | Revise: 15 minutes, below 25% (R17) |
| Statuses needing missing systems | Defer behind the system rows (R19) |
| Max-HP tier effects | Defer behind X2 and magnitudes |
| Hunger on respawn | Floor 25% (R20) |

## 9. Acceptance tests (per step)

- All tier edges exact: 0, 7, 8, 24, 25, 59, 60, 89, 90 and 100 percent; no modifier stacking over repeated updates.
- Draws happen only at the defined events, from the player's seeded bag, never per frame and never from `Math.random`; same seed gives the same statuses.
- Repeated entry, duplicate prevention, refresh, expiry and simultaneous statuses; a tier status ends on leaving its tier.
- Timers across tier changes, eating, pause, downing and save and load (a reload does not reset a timer or reroll a bag).
- Non-lethal damage never goes below 1 HP, never calls `down()`, ends with its status, and stays inside its budget.
- Max-HP changes clamp current HP and never kill; removing a bonus is safe.
- Move speed never falls below 75% of normal from hunger; recovery by eating always works; eating is refused only at 100% or while Overeating.
- The HUD shows the stat as a percentage and the active statuses without changing gameplay state.
- The existing hunger, vitals, status, storage, combat and damage tests keep passing. Browser play is reported as not verified unless it was.

## 10. Open tuning (owner, later)

Every number marked provisional above: Stuffed and Full bag weights, Vomiting and Gluttony magnitudes and duration, Well-Fed and Satiated magnitudes, the Overeating budget, Famished and Malnourished amounts, the Weakened stat list, the max-HP tier bonuses, and the food point values (`FOUNDER.md` section 6c). Tune them in one tuning document once H2b is playable, with the 230 px/s Mage speed and a Graugr in front of you as the test.
