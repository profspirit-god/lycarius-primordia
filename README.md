# Lycarius MMORPG: Primordia

> **Current version: V1.21.0.01** · 2D · Adventure / RPG / Management · HTML5 Canvas + vanilla JavaScript (ES modules)

**Primordia** is the first edition of _Lycarius MMORPG_, a 2D open-world MMORPG built around a deep lore, branching storylines, co-op progression and (eventually) faction, guild and territory wars. A later edition, **Proto**, will be a more refined second game built on what Primordia teaches us.

This repository currently holds the **combat MVP**: one class with three skills unlocked through a class specialization tree, an experience system, a burn status effect, projectile collisions, a training dummy that can fight back and use skills, a melee enemy (Graugr) with smart AI and a mock raid mode, health and mana, and a full audio-visual effect stack. Everything else is scaffolded so new features slot in without rewrites.

---

## 1. What is in V1.21.0.01

| Area           | Included                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Menu           | Title menu: Play, Creator Support (placeholder), Exit. Play opens the Home lobby (placeholders), then Mode Select: Live Server (placeholder), Campaign (placeholder), Training Grounds (playable, with a loading screen). Settings is on the Home bottom row |
| Settings       | Sectioned (Audio, Graphics, Interface) with a footer that stays put: Reset, Save, Back (Back asks Save / Discard when there are unsaved changes). Pause menu → Settings adds Training Dummy (attacks, skills, movement) and Developer (FPS overlay, cast timer, XP tools). Persisted in `localStorage`. |
| Items          | Item definitions in an `ItemRegistry` (`src/sim/items/`): id, name, category, rarity, scope, stack size, allowed actions. The nine Shop cosmetics are registered as account-owned items. An `Inventory` service (`src/sim/items/Inventory.js`) records who owns how many of each item (account cosmetics, owned once; character items in 30 slots) and saves it under its own key, `lycarius.primordia.inventory`, separate from your progression save. The Home **Inventory** button opens a read-only Account Inventory: owned cosmetics as cards with a tab per category you own something in, and a detail view (rarity, description, how many, account-wide). It starts empty, and nothing grants items yet (inventory phases F to I, `docs/proposals/Inventory-and-ownership.md`) |
| Character Inventory | Press `I` in the Training Grounds (the game pauses): the items your character carries, in 30 slots, with your **gold** at the top. Gold is the first item. It is separate from the Home Account Inventory and from the Home wallet. Nothing in the world gives gold yet; with Settings, Developer, Show debug on, the panel has +100, +1,000, -100 and -1,000 gold buttons for testing. Saved in the inventory save, so gold is still there after a reload. **Weight:** each gold weighs 31.10 g and the panel shows what you carry against a capacity of 30 Theryn (30 kg), in the game's own units (Veyt, Kirel, Draum, Velkar, Theryn, Korvath, Maelor, Dravon, Aethron, Graveth, Taurak, Orynth, Vaelthar, Kharvorn). Going over capacity turns the bar red; nothing slows or stops you yet. Click an item to see it; a stat ticket has a **Use ticket** button |
| Gold and John | Every Graugr you defeat drops **1 to 10 gold** and every cleared mock raid pays **20 + 10 x the raid number**, straight into your inventory (a full inventory loses it). **John the Merchant** stands left of the start point: walk up and press `T` to buy **stat tickets** with gold, one per stat (Max Health 150, Health Regen 200, Max Mana 100, Mana Regen 120, Max Stamina 100, Stamina Regen 100, Move Speed 250). Press `I`, select a ticket and use it: the stat rises for good (up to 10 tickets per stat), and stays after a reload (its own save, `lycarius.primordia.training`) |
| Bags           | The Marble Bag primitive (`src/sim/bag/`, stage M1 of `docs/proposals/Marble-bag-engine.md`): a pool of outcome tokens, for example 4 NORMAL and 2 CRIT, dealt as one shuffled cycle and drawn without replacement, so every complete cycle holds exactly the configured counts. Refill policy `refill_shuffle` or `no_refill`, versioned `serialize` / `restore`, a validator. **Not used by any skill yet**: Fireball crits still roll the old way until stage M2, so nothing about play changed |
| Hunger         | The hunger primitive (`src/sim/hunger/`, stage H1 of `ROADMAP.md`, design in `FOUNDER.md` section 6): a stat that falls 1 per 90 s of sim time and is raised by eating, five tiers (Stuffed, Full, Not hungry, Hungry, Starving) as data, versioned save. Hunger may damage but never kill (through statuses, planned). Stage H1b moves it to 0 to 1000 points. **Not wired into the game yet** (nothing is visible until H2a) |
| Lumberjack job | The first job (`C` to chop): 12 Velthorn trees stand in the Training Ground. A Basic Axe (you get one for free) fells a tree in 5 swings for 10 to 15 Velwood and job XP; fire ruins a tree. Job XP is shown in the character panel. See "Lumberjack job" below |
| Character      | One playable character (a cylinder) with smooth WASD movement and mouse aiming                                                         |
| Class          | **Mage** (the only class)                                                                                                              |
| Skills         | **Fireball**: hold to charge (magic circle), release to cast. **Flame Shield**: toggle a flame arc that absorbs damage. **Burn Resistance**: cast-time self buff against fire and burn. **Fire Blast**: cast-time AOE burst around you with knockback and a chance to burn. You start with Fireball only; the other three unlock in the specialization tree |
| Progression    | Experience system with two separate tracks: character level and class specialization level. Class specialization tree (press `K`). Saved in `localStorage` through a storage adapter |
| Projectile clash | Two enemy fireballs that meet explode and hurt anything near. A stronger charge destroys a weaker one                                |
| Burn           | Fireball hits can set the target on fire: 8 damage per second for 5 to 10 seconds, with a sound and a flash on every tick              |
| Vitals         | Health 50 (regen 0.1/s), mana 100 (regen 1/s), stamina 100 (regen 8/s, spent by Dodge), death and respawn                      |
| HUD            | DOM overlay: profile circle (click for the character panel) with the level under it, name and thin health / mana / stamina bars, status-effect icons beside the card; skill circles with SVG icons in the bottom-left |
| Loading        | Real task-based loading screen (data check, fonts, art, audio, renderer warm-up, world dry run). Starts the game only when everything is ready; shows Retry / Back on a fatal error |
| Icons          | Every icon is an inline SVG from `src/ui/icons.js` (no emoji)                                                                           |
| Mana cost      | Scales with charge: 5 at minimum charge up to 20 at full charge                                                                        |
| Dummy          | Passive mode: infinite health. Hostile mode: uses the player's stats, fights back, can be defeated                                     |
| Graugr         | Melee enemy: 25 HP, 50 stamina, three arm skills (Arm Swing Barrage, Piercing Poke, Leap), smart AI (attack, buy time, retreat, dodge)  |
| Mock raid      | Training Ground button: removes the dummy, spawns raids of Graugr (raid N = N + 1 enemies, enhanced N - 1 tiers). Kill and one-shot kill counters |
| Stun           | Status effect: a stunned player cannot move or cast. Applied by Graugr's Leap                                                          |
| Damage counter | Numbers pop up, arc and **fall with gravity**, then fade. Crits are larger and orange. Damage taken by the player is red               |
| Audio          | Procedural sound effects (no asset files), positional for the hostile dummy, working master volume                                     |
| Map            | Infinite placeholder ground (deterministic noise + grass tufts)                                                                        |

### Vitals and mana

| Stat                | Value          |
| ------------------- | -------------- |
| Max health          | 50             |
| Health regeneration | 0.1 per second |
| Max mana            | 100            |
| Mana regeneration   | 1 per second   |

Fireball mana cost is `ceil(lerp(5, 20, charge))`:

| Charge        | Cost |
| ------------- | ---- |
| Minimum (12%) | 7    |
| 25%           | 9    |
| 50%           | 13   |
| 75%           | 17   |
| Full (100%)   | 20   |

Rules:

- You cannot start charging with less than 7 mana (the HUD slot dims and a dud sound plays).
- While charging, the charge is capped at what your current mana can pay for.
- The mana bar shows a white preview of the cost while you charge.
- Fireball damage ranges from 8 (low charge) to 30 (full charge) on a curve; 12% of hits are critical (x1.75).
- At 0 health you are downed for 3 seconds, then respawn at the start point with full health and mana.

### Dummy modes

Set in **Pause → Settings → Training Dummy → Dummy attacks** (Save rebuilds the dummy at once).

| Mode          | Behaviour                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off (default) | Passive training dummy with infinite health. Tracks total damage, hits, last hit and 5-second DPS                                                                                                                                       |
| On            | The dummy takes the player class's stats (50 HP, 100 mana, same regen), leads its target, charges to a random level and fires fireballs at you. A hit staggers it and cancels its cast. It can be defeated and respawns after 3 seconds |

**Pause → Settings → Training Dummy → Dummy uses skills** (needs Dummy attacks; Save rebuilds the dummy). Off: the dummy only fires Fireball. On: it also uses the rest of the Mage kit:

| Skill           | When the dummy uses it                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Flame Shield    | Raises it while you are charging a fireball (above 25%) or have a fireball in the air within 700 px, keeps it 1.2 s longer, drops it when the threat ends. Needs more than 14 mana to raise |
| Burn Resistance | Casts it whenever it has no ward and at least 45 mana (it holds the cast like you do; a hit during the cast cancels it)             |

### Graugr and the mock raid (V1.9.0.00)

Press **Start Mock Raid** (top-right in the Training Ground). The training dummy leaves and raid 1 begins. **Stop Mock Raid** removes the enemies and brings the dummy back. Raid N spawns N + 1 Graugr; 4 seconds after the last one dies the next raid starts. Enemies in raid N are **enhanced N - 1 tiers** (raid 1 is base strength): each tier adds 20% max health and 20% damage, shown as one yellow up-arrow per tier above the name (above 5 tiers: one arrow and `xN`). A panel under the top-right panel counts **kills** and **one-shot kills** (an enemy that died from the first damage it ever took). Both reset when a new raid session starts.

**Graugr stats:** 25 health (regen 1/s), 50 stamina (regen 4/s). Walks at 150 px/s (you walk at 230). Only attacks with its arms.

| Skill                | Stamina | Cooldown | What it does                                                                                                                                                                     |
| -------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Arm Swing Barrage  | 10      | 35 s     | 0.6 s red-circle wind-up, then both arms spin for 10 s: 12 damage per hit, one hit per 0.5 s, reach 78 px past its body. While spinning, 40% of projectiles that reach the arms are batted back |
| 2 Piercing Poke      | 13      | 60 s     | Stops and charges for 3 s (the telegraph strip is shown while it charges; aim locks at 70%), then stretches one arm 250 px in a line for 25 damage                               |
| 3 Leap               | 20      | 8 s      | Instant 170 px dash to attack, dodge or escape. Hitting a body deals 8 damage and stuns it for 1.5 s                                                                             |

**AI modes** (health and stamina are fractions of the maximum):

| Mode      | When                                                                                  | Behaviour                                                                                  |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Attack    | health above 50% and stamina above 31%                                                | Walks in. Barrage when you are in reach, Poke within 212 px, Leap in from 90-170 px         |
| Buy time  | stamina 30% or less (also health 40-50%, which the rules left open)                  | Keeps about 250 px away and strafes while stamina and health come back. Leaps away if you get within 80 px and it can afford it |
| Retreat   | health below 40% and stamina below 5%                                                 | Runs away; stays in retreat until stamina is back above 31%                                 |

In any mode (leap ready, 20+ stamina) it **dodges** a fireball that is about to hit by leaping sideways. It is committed during Barrage and Poke: it does not dodge then, so a charging Graugr is the moment to hit it.

All Graugr numbers are the `GRAUGR` constant at the top of `src/entities/Graugr.js`. Raid numbers (4 s intermission, spawn distance) are at the top of `src/systems/RaidSystem.js`.

### Menus and lobby (V1.7.0.00, art added in V1.8.0.00)

Flow: **Title menu** (Play, Creator Support, Exit) → **Home** → **Mode Select** → **Loading** → game. All lobby content is placeholder data in `src/lobby/lobbyData.js`.

| Screen         | Contents                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title menu     | Play (to Home), Creator Support, Exit                                                                                                                         |
| Creator Support | Monetary Support and Idea Support cards (placeholders)                                                                                                       |
| Home           | Profile circle (top-left; click shows name, Gmail, ID, placeholder fields), currency line (Gold, Crystals, Points) and a bell for messages (top-right), Shop panel, Genesis Path (season pass) under it, Play (bottom-left), bottom row: Inventory, Character, Season Info, Rank, Settings. Placeholder character and scenery on the canvas |
| Shop           | Click the panel: modal with the same currency line on top, category tabs and cosmetic cards. Buying is a placeholder                                           |
| Mode Select    | Live Server, Campaign, Training Grounds. Picture placeholder per card; hover shows the definition and stats. Video placeholder background. Esc or Home goes back |
| Loading        | Custom loading screen for Training Grounds (rune rings, bar, tips, art placeholder), then the world                                                           |

| Mode            | What it does                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Campaign        | Placeholder screen. Planned single-player story (quests, NPCs, branching story)                            |
| Training Grounds | The current playable scene (dummy, combat sandbox), reached through the loading screen                    |
| Live Server     | Placeholder screen. Planned open-world MMORPG; needs the V2.0.0.00 multiplayer work                        |

### Experience and levels

Two separate tracks (`src/progression/Progression.js`). Both are saved per class (versioned save format) through a storage adapter: the game passes `core/LocalStorageAdapter.js` (browser `localStorage`, key `lycarius.primordia.progress`, so existing saves still load); tests and the loading dry run pass `sim/storage.js` (in memory).

| Track                        | How you earn it                                                                                              | Curve (XP from level L to L+1) | Cap |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------ | --- |
| Character level              | 1 XP per point of damage you deal to anything but yourself (fireball, explosion, burn tick); +50 for defeating the hostile dummy | `round(100 x L^1.5)`           | 50  |
| Class specialization level   | 1 XP per point of damage you deal (same sources); +2 to +5 per Fireball cast (by charge)                     | `round(50 x L^1.4)`            | 10  |

Character level has no gameplay effect yet; it is tracked and shown so stats can hang off it later. Both levels and XP bars are shown bottom-left, with a `+N XP` flash on every gain. A level-up shows a banner, a ring of sparks and a jingle.

### Class specialization tree (Mage, element: fire)

Press `K` to open the tree (pauses the game; `K` or `Esc` closes). It is a single path of 10 specialization levels:

| Spec level      | Reward                                                                                  |
| --------------- | --------------------------------------------------------------------------------------- |
| 1 (start)       | **Fireball** (the only skill you begin with)                                            |
| 2, 3, 4         | Pick one bonus each (see below)                                                         |
| 5               | **Flame Shield** unlocked                                                               |
| 6, 7, 9         | Pick one bonus each                                                                     |
| 8               | **Fire Blast** unlocked                                                                 |
| 10 (max)        | **Burn Resistance** unlocked                                                            |

Locked skills show as greyed slots (with the level needed) on the HUD. Reaching a bonus level adds a pending pick; the `K` hint turns green and pulses while you have unspent picks. Picks fill the lowest pending level first.

| Bonus            | Per pick                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Max Mana         | +10 max mana (current mana rises by the same amount)                                              |
| Mana Regen       | +0.25 mana per second                                                                             |
| Cast Time        | x0.95 cast time (multiplies; applies to Fireball charge time and the Burn Resistance cast)        |
| Skill Cooldown   | x0.95 cooldown on all skills ("Skill CC" in the design notes was read as cooldown)                |
| Element Damage   | +5% fire damage: Fireball, explosions and burn ticks                                              |
| Skill Damage     | +5% skill hit damage: Fireball and explosions (burn ticks are not affected)                       |

Element and skill damage multiply each other (`(1 + skill) x (1 + element)`). The same bonus can be picked repeatedly. The dummy never gets specialization bonuses.

### Projectile collision

Two projectiles from different owners that touch collide (your own projectiles pass through each other). Rules (`src/skills/ProjectileClash.js`):

| Situation                                    | Result                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Charges differ by less than 0.12             | Both are destroyed in one explosion of strength `0.6 x (charge A + charge B)` (max 1)                       |
| Charges differ by 0.12 or more               | The stronger survives, the weaker is destroyed in an explosion of strength `0.9 x weaker charge`. The survivor loses power: damage x`(1 - 0.4 r)` and size x`(1 - 0.25 r)` with `r = weaker / stronger`. Full vs half: damage x0.8, size x0.875 |

Explosion (`src/systems/ExplosionSystem.js`): radius `70 + 120 x strength` px; damage at the centre `6 + 18 x strength`, falling to 30% at the edge, modified by the source's skill and element damage. **Every** entity whose body edge is inside the radius takes damage, including the caster and including the dummy. Flame Shields do not stop explosions; a Burn Resistance ward reduces it by 30%. Explosions do not ignite. Damage dealt by the player earns XP. The explosion is credited to the owner of the stronger ball (on equal charges, to the owner of the ball that detected the clash first).

### Debug: cast timer

**Pause → Settings → Developer → Show cast timer** draws `Skill  elapsed / total s` and a small bar above the player while charging. The total is the effective cast time, so cast-time bonuses are visible. The text turns green once the time is full.

### Developer options (test panel)

**Pause → Settings → Developer → XP tools** edit the running Mage progression (the player levels up live; Reset progression asks to confirm): add character XP, add specialization XP (amount box, default 100), jump to the next specialization level, or reset all progression. A status line shows both levels and pending picks.

### Magic circle casting

Holding Fireball builds two circles, both drawn procedurally (`src/render/drawMagicCircle.js`):

| Circle        | Where                                  | Behaviour                                                                                                 |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Ground circle | Under the caster                       | Outer ring sweeps with the charge, runes light one by one (2 at start, 12 at full), rings and triangles counter-rotate. Rune motes rise from it |
| Casting circle | In front of the caster, facing the aim | The orb forms inside it. Thin when you aim sideways, a full circle when you aim toward or away from the camera |

On release the ground circle discharges as a ring of sparks and a shockwave. The hostile dummy uses the same circles.

### Flame Shield

Press `Right Mouse` or `E` to raise, press again to drop. Rules:

| Rule                     | Value                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Shield points            | 50                                                                                          |
| Cast cost                | 10 mana (you need at least 10 mana to cast)                                                 |
| Upkeep                   | 5 mana per second while raised (mana regeneration of 1/s still applies)                     |
| Shape                    | 115 degree arc, 56 px from the caster, 60 px high, follows the aim with a slight lag        |
| Limit                    | One shield per caster. After raising or dropping it, 0.6 s before it can be raised again    |
| Damage below the points  | Fully absorbed; the points drop by that amount                                              |
| Damage equal to points   | Fully absorbed; the shield breaks                                                           |
| Damage above the points  | The shield breaks and the **remainder** hits you (the fireball shrinks as it flies through) |
| Mana runs out            | The shield collapses                                                                        |
| Caster is downed         | The shield drops                                                                            |
| From behind / your shots | Not blocked. Your own fireballs pass through your shield                                    |

Example: shield at 50, fireball deals 20 → shield 30. Next fireball deals 40 → shield breaks, you take 10.

### Burn

A body hit from Fireball can ignite the target (`StatusSystem`). Burn works on the player and on the dummy.

| Rule            | Value                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Ignite chance   | 20% at minimum charge up to 50% at full charge, rolled once per body hit. A hit fully soaked by a Flame Shield does not roll |
| Duration        | Random 5 to 10 seconds, rolled per ignition                                                                        |
| Damage          | 8 per second, applied as one tick every second (so 5 to 10 ticks)                                                  |
| Re-ignite       | Refreshes the timer (and keeps the higher damage); burns never stack                                               |
| Ends early      | When the target is downed, or when a Burn Resistance ward nullifies it                                             |
| Tick feedback   | Burn sound, the body flashes and lights up, an orange damage number, a burst of sparks. The dummy counts burn damage in Total damage and DPS, not in Hits |
| Visuals         | Fire particles rise from the body and a flickering light follows it. In the last 1.2 seconds the fire shrinks and thins out, then a puff of smoke drifts off |
| Flame Shield    | Unchanged: it absorbs raw fireball damage first. Burn can only start from the part that reaches the body           |

### Fire Blast

Self-centred AOE with a cast time. **Hold `R`** until the circle completes; releasing early cancels for free (no mana, no cooldown). Holding on after it completes does not recast. Unlocks at specialization level 8.

| Rule               | Value                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Type               | Fire mage skill, AOE around the caster in all directions. Mage with the fire element only                  |
| Cast               | 0.5 s hold, 40 mana paid when the cast completes (you need 40 mana to start)                               |
| Cooldown           | 60 seconds (the Skill Cooldown bonus shortens it)                                                          |
| Range              | 240 px from your centre to the target's body edge (the last ground ring marks it)                          |
| Damage             | 70 to every target in range, no falloff, no crit. Skill and element damage multiply it (`70 x (1 + skill) x (1 + element)`). You are never hurt by your own blast |
| Knockback          | 1500 px/s push away from you, about 215 px of travel, on top of the target's normal hit reaction            |
| Burn               | 40% chance per target: 6 s of burn, 8 damage per second (element damage boosts it). A Burn Resistance ward can nullify it |
| Fire resistance    | A Burn Resistance ward reduces the damage by 30%. Flame Shields do not stop it                              |
| Enemies            | The hostile dummy never uses it (`noAi`)                                                                    |

Example: two enemies at 100 px and 200 px, a third at 300 px. The first two take 70 and fly back, each with a 40% chance to burn; the third is out of range.

### Mana Regen (Mage passive)

Mage-only boost. You own it right after choosing the Mage (no unlock level). **Press `F`**: no cost, no cast time.

| Rule        | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Cost        | Free                                                                                    |
| Effect      | Mana regeneration x5 for 30 seconds (the Mage's base 1/s becomes 5/s). Specialization regen bonuses are multiplied too |
| Cooldown    | 3 minutes (the specialization cooldown bonus shortens it)                               |
| Ending      | After 30 s, or when you are downed                                                      |
| Visual      | Hollow blue circles (bubbles) rising around the body, a faint blue light, a status icon with a time-left bar beside the bars, and a blue glow on the mana bar |
| Skill icon  | Human silhouette with a blue enhancement arrow stack                                    |

### Dodge (universal ability)

Every class has it, no unlock level. **Press `Shift`**.

| Rule        | Value                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Cost        | 20 stamina (refused with a red flash on the stamina bar if you have less)               |
| Movement    | Slides 130 px straight backwards, away from where you aim, over 0.32 s. Fast at first, then it settles |
| Protection  | Nothing can hit you for the first 0.18 s                                                |
| Cooldown    | 25 seconds                                                                              |
| While dodging | A cast in progress is cancelled and you cannot start a new one until it ends; you cannot steer |
| Not allowed | While stunned or downed                                                                 |
| Visual      | Yellow line trail: a streak through the body plus fading yellow body outlines, and a few sparks |
| Skill icon  | Yellow human silhouette leaning back with speed lines                                   |

### Lumberjack job (V1.20.0.00)

A job is a career you level by doing its work, separate from your class. The first one is **Lumberjack**. Walk up to a **Velthorn** tree in the Training Ground, face it with the mouse and **press `C`**.

| Rule | Value |
| ---- | ----- |
| Tool | **Basic Axe**: a new character receives one once; it is in your Character Inventory (`I`). Owning it is what lets you chop |
| Swing | 8 stamina, 0.7 s cooldown, reaches 44 px from your body to the trunk, in front of you. A swing at nothing still costs stamina |
| Tree | 5 landed swings fell it. It drops **10 to 15 Velwood** into your inventory, then it is a stump and grows back after 60 s. A chop bar above the tree shows what is left |
| Job XP | 3 per landed swing, +15 for the swing that fells it (30 per tree). Level cap 20. Shown in the character panel (profile circle, Info tab), saved in the browser |
| Fire | A Fireball, Fire Blast or explosion that hits a Velthorn sets it on fire at once. A burning tree cannot be chopped and **drops nothing**; it burns for 6 s, stays as a charred stump for 20 s, then grows back |
| Cover | A Velthorn is solid and stops Fireballs. Graugr's arms and poke are cut off by a tree standing between it and you, and its Leap stops in front of a tree |
| Full bag | The Velwood that fits goes in; the rest is lost and a red message says how many |
| Not allowed | While stunned, downed or dodging |

### Burn Resistance

Self-only buff with a cast time. **Hold `Q`** until the circle completes; releasing early cancels for free (no mana, no cooldown). Holding on after it completes does not recast.

| Rule                 | Value                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cast                 | 1.2 s hold, 25 mana paid when the cast completes (you need 25 mana to start). Movement slows to 55% while casting |
| While casting        | Red-orange magic circle under the caster, rising and spiralling motes, the body tints red-orange and glows, light grows |
| Duration             | 30 seconds. The ribbons flicker in the last 4 seconds                                                           |
| Fire skill damage    | Reduced by 30% (Fireball hits on the body, after any Flame Shield absorption). Never below 1                  |
| Burn damage          | Burn ticks do 50% damage (8 becomes 4) while the ward is up, including a burn that was already running         |
| Burn ignites         | 50% chance the ward **nullifies** it: no burn (a running burn is snuffed too), the ward is consumed, and a toast shows a burn icon being slashed in two above the target. Otherwise the burn starts, with reduced ticks, and the ward stays |
| While active         | Long red-orange ribbons winding up the body, a few embers, and short thin dashes streaking behind you while you move |
| Ending               | Expiry, being nullified-and-spent, or being downed. The ribbons fade over 0.9 s and leaves hanging embers behind |
| Recast               | Casting again while active refreshes the 30 s timer (full cost)                                               |
| HUD                  | Third skill slot with the time-left bar, a time-left bar under the mana bar, and a BURNING line with time left and damage per second |

Example: ward up, a fireball hits for 20 → you take 14. It ignites you: half the time the burn is nullified and the ward is gone; otherwise you burn for 4 per second and keep the ward.

### Dummy movement

Set in **Pause → Settings → Training Dummy → Dummy movement** (Save rebuilds the dummy). Works with both passive and hostile dummies.

| Mode                 | Behaviour                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Stationary (default) | Stays at its start point and springs back after a hit                                                                      |
| Patrol               | Walks back and forth along a 520 px line through its start point (peak speed about 130 px/s)                               |
| Strafe               | Circles the player at 340 px and reverses direction every 3 to 6 seconds. Returns to its start point if you are downed     |

Hits still freeze the dummy and knock it back; it steers back onto its path afterwards.

### Fireball effect checklist

| Requirement                         | Where it happens                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Attack charge                       | `SkillCaster` + `FireballCastView` (view of the Fireball cast, fed by `skill:charging`): orb grows, embers spiral inward, ground ring fills, light grows, movement slows to 55%   |
| Attack recoil                       | `Fireball.onRelease`: backward impulse on the caster (scales with charge), body lean (`kick`), camera shake                     |
| Projectile trail                    | `FireballView.draw`: tapered, colour-graded ribbon from the position history                                              |
| Projectile glow                     | `drawGlow` (additive radial gradients) + a dynamic light that illuminates the ground                                            |
| Projectile particles (real physics) | `ParticleSystem`: gravity, drag, ground bounce with restitution, ground friction                                                |
| Burst behind the enemy              | `HitEffects.backBurst`: a cone of fire, embers and smoke emitted from the far side of the target along the projectile direction |
| Freeze on hit                       | `TrainingDummy.onHit`: animation halts for 0.12–0.32s (longer with charge), plus a global hit-stop                              |
| Light on hit                        | Light flashes (`HitEffects.onHit`) and the dummy keeps emitting a decaying glow                                                 |
| Hit particle effect (real physics)  | `HitEffects.frontSparks`: sparks that arc, fall and bounce                                                                      |
| Falling damage counter              | `DamageNumbers`                                                                                                                 |

### Audio

All sounds are synthesized at runtime with the Web Audio API. Nothing to download or license.

| Sound           | Trigger                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| Charge hum      | While charging; pitch, brightness and volume rise with charge                        |
| Cast whoosh     | Fireball release; deeper at full charge                                              |
| Impact          | Fireball hits a target; low boom, noise burst and spark crackle, extra ping on crits |
| Hurt            | The player is hit; heavier and lower                                                 |
| Dud             | Not enough mana to start a charge                                                    |
| Death / respawn | Falling tone / rising three-note chime                                               |
| Menu tick       | Any menu button                                                                      |
| Ignite          | A target catches fire; low fwoomp with a few crackles                                |
| Burn tick       | Every burn damage tick; short sizzle and pop                                         |
| Burn nullified  | A ward snuffs a burn; metallic slash, then the fire hissing out                      |
| Ward up / down  | Burn Resistance completes (rising shimmer) / expires or ends (falling tone)          |

Other behaviour:

- Sounds from the hostile dummy are quieter with distance and panned left/right.
- Audio starts after the first click or key press (browser rule); clicking **Start** unlocks it.
- Audio is muted when the tab is hidden, and the charge hum stops when you pause.

---

## 2. Running the game

ES modules require a web server (opening `index.html` by double-click will not work).

1. Install [VS Code](https://code.visualstudio.com/).
2. Install the **Live Server** extension (`ritwickdey.LiveServer`). VS Code will suggest it automatically.
3. Open this folder in VS Code.
4. Right-click `index.html` → **Open with Live Server**.

Alternative (needs Node.js): `npx serve .` then open the printed address.

### Controls

| Input                        | Action          |
| ---------------------------- | --------------- |
| `W` `A` `S` `D` / arrows     | Move            |
| Mouse                        | Aim             |
| Hold `Left Mouse` or `Space` | Charge Fireball |
| Release                      | Cast            |
| `Right Mouse` or `E`         | Raise / drop Flame Shield |
| Hold `Q`                     | Cast Burn Resistance (hold until the circle completes) |
| Hold `R`                     | Cast Fire Blast (level 8; hold until the circle completes) |
| `F`                          | Mana Regen (Mage passive, free)  |
| `Shift`                      | Dodge backwards (20 stamina)     |
| `C`                          | Chop a tree in front of you (needs an axe, 8 stamina) |
| `K`                          | Skill tree (class specialization) |
| Click the profile circle     | Character panel (info, skills, attributes, equipment) |
| `Esc`                        | Pause menu (or close the skill tree / character panel) |
| **Start / Stop Mock Raid** button | Training Ground, top-right (mouse only) |

---

## 3. Versioning

Format: **`V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>`**, the first release being **`V1.0.0.00`**.

| Digit            | Meaning                           | Example trigger                                                                    |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| 1st: **MAJOR**   | Major update                      | New edition, huge system (e.g. multiplayer networking), breaking save/data changes |
| 2nd: **MINOR**   | Minor update                      | New feature or content (new skill, class, zone, faction)                           |
| 3rd: **FIX**     | Bug fixes and other fixes         | Crash fix, balance tweak, typo fix                                                 |
| 4th: **CLEANUP** | Clean-ups (two digits, `00`–`99`) | Refactor, formatting, dead-code removal, comments, docs                            |

Rules:

- Bumping a digit **resets every digit to its right to 0**. Example: `V1.2.3.07` → minor bump → `V1.3.0.00`.
- Only the **last** digit is zero-padded to two characters (`V1.0.0.05`, `V1.0.1.00`).
- **Where the version lives:** `src/config.js` (`VERSION`). Update it, `CHANGELOG.md` and the git tag together.
- **Edition names:** Primordia (this repo, `V1.x`), then Proto (a separate, more refined game).

Release checklist:

1. Edit `VERSION` in `src/config.js`.
2. Add a dated entry to `CHANGELOG.md`.
3. Commit: `chore(release): V1.3.0.00`.
4. Tag: `git tag -a V1.3.0.00 -m "V1.3.0.00"` then `git push origin main --tags`.
5. Publish a GitHub Release from the tag, using the CHANGELOG entry as notes.

---

## 4. Architecture

Guiding rule: **nothing is written as if it were finished.** Systems communicate through events and registries, and content is data, so new features are additions, not edits.

```
index.html
css/style.css                 menu / panel styling
src/
  main.js                     bootstrap: settings, scenes, audio unlock, start loop
  config.js                   game name, edition, VERSION
  content/index.js            ONE manifest where skills + classes are registered
  audio/
    AudioEngine.js            procedural sounds (Web Audio API)
  core/
    Game.js                   canvas, loop, scene switching
    Scene.js                  scene base class
    Input.js                  keyboard + mouse (Mouse0/1/2 codes)
    EventBus.js               pub/sub between systems
    Registry.js               id -> definition store
    Settings.js               persisted settings
    math.js                   helpers (lerp, rand for visuals only, hash2, colour)
  sim/
    rng.js                    Rng: seeded mulberry32 (`world.rng`), the only source of gameplay dice
    bag/                      Bag (shuffled token cycles drawn without replacement, serialize / restore) and validateBagDef; not wired in until M2
  scenes/                     MenuScene, HomeScene, ModeSelectScene, LoadingScene, CreatorSupportScene, SettingsScene, ExitScene, WorldScene, PlaceholderScene (Campaign, Live Server)
  lobby/                      lobbyData (lobby content + art paths), Wallet (shared currencies), assets (lazy image / video loaders), loadTasks (loading-screen readiness tasks)
  progression/                Progression (XP, levels, picks, save), SpecBonuses (bonus data + computeMods), Mods (damage multipliers)
  ui/                         PlayerHud (in-game HUD), ProfilePanel (character panel), SkillTreePanel (specialization tree), Modal (lobby modals), SettingsPanel (sectioned settings, staged edit), icons (SVG icon set)
  input/                      PlayerController (client only: keyboard, mouse and camera become the player's InputCommand)
  sim/                        rng (seeded dice), InputCommand (the command shape and its validation)
  entities/                   Entity (base), Player, TrainingDummy, Graugr
  classes/                    ClassRegistry, Mage (data only)
  skills/                     SkillRegistry, Fireball, FlameShield, BurnResistance (definitions),
                              FireballProjectile, FlameShieldEffect, BurnWardEffect, ProjectileClash
  systems/                    pipeline (the one ordered list of systems), SkillCaster, Vitals, ParticleSystem, Lights, Camera, DamageNumbers,
                              DamageSystem (applies hits), HitEffects (hit visuals), StatusSystem (burn, stun), BurnFx, Toasts, AudioSystem,
                              ExplosionSystem, ExplosionFx, XpSystem, RaidSystem
  view/                       EntityViews (draws and ticks entities by their `kind`), SkillViews (feeds `skill:charging` and `cast` to the view of that skill id), FireballCastView (the Fireball cast: charge look, release effects), FireballView (the fireball's trail, particles, light, drawing), index (the view manifest)
  render/                     drawCover, drawCylinder, drawGlow, drawGround, drawBar, drawChargeOrb, drawMagicCircle, drawAura, drawRibbons, drawEnhance, drawStun
```

### Core concepts

- **Pseudo-3D space.** Every object has ground position `(x, y)` and height `z`. It is drawn at `y - z`. Particles apply gravity to `z`, so they truly fall, bounce and slide.
- **Event-driven combat.** A projectile only emits `hit`; a skill release emits `cast`. `DamageSystem` (calls the target's `onHit`, the sim reaction: health, knock), `HitEffects` (visuals, including the target's flash and glow) and `AudioSystem` (sound) respond independently, so a world without the view still takes damage. Later systems (quests, threat, combat log, networking) can subscribe without touching the projectile.
- **Data-driven content.** A class lists stats, skill ids and key bindings. A skill is an object with `cooldown`, `chargeTime`, `minCharge`, optional `manaCost`, `canStart`, `maxAffordableCharge`, and the hooks `onChargeStart`, `onCharging`, `onRelease`.
- **Input is a command.** The `Player` never reads the keyboard, the mouse or the camera. Each frame `PlayerController` (client) builds an `InputCommand { seq, mx, my, aim, btn }` and hands it over with `player.applyCommand`; the command is validated at that boundary. A server will receive the same command over the network. A skill's key is data of the class (`bindings`); `btn` bit i means "the i-th skill slot is held".
- **Any entity can cast.** `SkillCaster` works with any owner that provides `vitals`, `aim`, `getCastOrigin()`, `wantsCast(slot, world)` and `applyImpulse()`. The player reads the keyboard; the hostile dummy reads its AI. Future enemies and NPCs reuse this.
- **Status effects.** Burn lives on `entity.burn` and is run by `StatusSystem`; a ward lives on `entity.ward`. Ignition is an offer carried by the `hit` event (`burn: { chance, duration, dps }`), so any future skill can burn by adding that field. `StatusSystem` emits `burn` events (`ignite`, `tick`, `nullify`, `end`); the skill emits `ward` events (`up`, `down`). `BurnFx`, `Toasts` and `AudioSystem` react to them. Entities take burn damage through `onDot(e)`.
- **Cast-time and self skills.** `autoRelease: true` fires a skill the moment its charge fills; `self: true` marks skills that only target the caster (AI casters skip them, the player draws an aura instead of the charge orb); `palette` recolours the magic circle.
- **Progression.** `Progression` owns XP, levels and bonus picks; `XpSystem` feeds it from `hit`, `burn` and `cast` events. The class declares `specialization { element, maxLevel, start, unlocks }`; bonuses are data in `SpecBonuses.js` (registered through `SpecBonusRegistry` in `content/index.js`). `Player.syncProgression()` turns it into `player.stats`, `player.mods` and new `SkillCaster` slots (`addSkill`). Casters apply `mods.castTimeMult` and `mods.cooldownMult`; damage code uses `progression/Mods.js`.
- **Projectile clash and explosions.** Projectiles set `isProjectile = true` and call `clashProjectiles()` when they touch a foreign projectile. That emits `explosion`; `ExplosionSystem` deals area damage as `hit` events with `aoe: true`, `ExplosionFx` draws it and `AudioSystem` plays it.
- **Reusable vitals.** `Vitals` holds health, mana, regeneration and damage/spend helpers.
- **Seeded gameplay randomness.** Every roll that changes an outcome (crit, damage spread, ignition and nullify chances, explosion spread, raid spawns, enemy and dummy AI choices) is drawn from `world.rng` (`next()`, `range(a, b)`, `chance(p)`), a seeded generator created in `WorldScene.enter`. The same seed and the same inputs give the same fight, which is what tests and a future server need. Visual randomness (particles, shake, audio) keeps `rand()` from `core/math.js`; it must never decide a gameplay result.
- **Simulation clock.** `world.time` is the game's own time in seconds. It advances once per simulation step with the same `dt` the entities get (so it stops in pause and slows in hit-stop), and anything in the simulation that needs "how long ago" (today the dummy's 5-second DPS) reads it instead of the browser's clock.
- **Scene factory.** `game.register(name, factory)` and `game.goto(name, params)`.
- **Audio is a listener, not a caller.** Combat code never plays sounds; `AudioSystem` reads events and entity state. `AudioEngine` can be swapped for real sound files without touching gameplay code.

### How to add things

**A new skill**

1. Create `src/skills/MySkill.js` exporting a definition (copy `Fireball.js`).
2. Register it in `src/content/index.js`.
3. Add its id to a class's `skills` and `bindings`.
4. If it needs a sound, add a method to `AudioEngine` and trigger it from `AudioSystem` (listen for an event).

**A new class** — copy `src/classes/Mage.js`, change stats / skills, register in `content/index.js`, and pass `{ classId }` to the `world` scene.

**A new entity (enemy, NPC)** — extend `Entity`, set `hittable = true` for damage, give it `vitals` if it has health, implement `update` / `draw` and optionally `onHit(e, world)` (sim reaction only: health, knock, status; no flash or sound). To let it cast, implement the caster interface above.

**A new hit reaction** — a visual or sound: add a method in `HitEffects` (or a listener) and call it from its `onHit`. A change to health, knock or status goes in the target's `onHit`, which `DamageSystem` calls. A new system goes in `src/systems/pipeline.js`, in the sim or the view group.

**A new sound** — add a public method to `AudioEngine` and call it from `AudioSystem`.

**A new icon** — add an entry to `ICONS` in `src/ui/icons.js` (24 x 24 viewBox, `currentColor`) and refer to it by name: `icon("name")` in templates, or `icon: "name"` in a skill or bonus definition. Do not use emoji or symbol glyphs.

**Something the loading screen must wait for** — add a task to `buildTasks` in `src/lobby/loadTasks.js` (`run` returns a promise; mark it `fatal` if the game cannot start without it).

**A new setting** — add a default in `Settings.js` and one row object to `SECTIONS` in `src/ui/SettingsPanel.js` (choose its section; `ctx: "game"` keeps it out of the lobby).

**A new specialization bonus** — add an entry to `SPEC_BONUSES` in `src/progression/SpecBonuses.js` (stat add, modifier add, or modifier multiply). The tree lists it automatically; a modifier that is new must also be read where it applies.

**A new projectile** — set `isProjectile = true`, `owner`, `charge` and `weaken(ratio)`, call `clashProjectiles` in its hit check, and check shields first (see `FireballProjectile`).

---

## 4b. Developer checks (optional, needs Node.js)

| Command | What it does |
| ------- | ------------ |
| `node tests/graugr.test.mjs` | Headless gameplay tests (Graugr AI, skills, stun, deflect, raid). Exit 0 = pass |
| `node tests/mage.test.mjs` | Safety-net tests that pin the Mage kit: Fireball numbers, cooldowns and mana, burn, Flame Shield, explosions, clashes, XP and levels (52 tests). Shared helpers in `tests/helpers.mjs` |
| `node tests/rng.test.mjs` | Seeded RNG tests: the generator, same-seed Fireball damage lists, and three scripted fights that must repeat exactly for one seed and must not change when `Math.random` does (10 tests). Exit 0 = pass |
| `node tests/clock.test.mjs` | Sim clock tests: `world.time` stepping and the dummy's 5-second DPS window, which must not read a wall clock (4 tests). Exit 0 = pass |
| `node tests/input.test.mjs` | Input command tests (S1e): the command is validated and clamped, scripted commands drive movement, aim and skills with no `input`, `camera` or `game` in the world, stun and downed players ignore commands, `PlayerController` builds the same command from keys and mouse (8 tests). Exit 0 = pass |
| `node tests/damage.test.mjs` | Damage tests (S1d): hit and burn damage land through `DamageSystem` in a world with no `HitEffects`, a killing blow downs the target before ignition, view flash and glow come from events, and a seeded fight ends in the same sim state with and without the view systems (9 tests). Exit 0 = pass |
| `node tests/projectile-view.test.mjs` | Projectile view tests (S1f-a): the fireball runs range, hit, shield and clash with no presentation object in the world, `projectile:fizzle` is plain data, `FireballView` and `EntityViews` behave, same seeded volley with and without the view (9 tests). Exit 0 = pass |
| `node tests/bag.test.mjs` | Bag primitive tests (M1): definition validation, exact counts in every cycle for 400 seeds, a Fisher-Yates shuffle pinned with a scripted RNG and shown unbiased, refill and empty behaviour, serialize / restore round trips and refused saves, no hidden state in `JSON.stringify`, import in a bare Node process (24 tests). Exit 0 = pass |
| `node tests/skill-view.test.mjs` | Skill view tests (S1f-b): the Fireball cast runs with no presentation object in the world, `skill:charging` and the `cast` payload, `SkillViews` dispatch, `FireballCastView` numbers, the same seeded volley with and without the views (8 tests). Exit 0 = pass |
| `node tests/fireblast.test.mjs` | Headless Fire Blast tests: range, damage, knockback, burn, cost, cooldown, modifiers, AI exclusion, plus draw and full-cast render checks (15 tests). Exit 0 = pass |
| `node tools/audit-server-ready.mjs` | Counts simulation code that could not run on a server and fails if the count rose above `tools/server-ready-baseline.json`. `--verbose` lists file and line, `--strict` fails on any debt |
| `node tools/sec.mjs <file> [id]` | Prints one section of a markdown doc (no id lists the headings). Ids: `5b`, `S1f`, `M2`, `V1.9.0.00` or any heading text. Saves reading whole docs |
| `node tools/check-docs.mjs` | Checks that every markdown doc has a title, `##` sections, consistent line endings, no oversized leaf section, and that every file in the `Claude.md` doc map exists. `--strict` also fails on warnings |
| `npm test` (all fifteen test files), `npm run audit`, `npm run sec -- <file> [id]`, `npm run docs` | Shortcuts for the commands above |

### Design proposals (not built)

`docs/proposals/` keeps two design proposals for reference, with a feasibility assessment and staged plan: `Marble-bag-engine.md` (controlled randomness, persistent hidden conditions, item secrets) and `World-Division-and-Lag-Management.md` (zones, instances, spatial cells, interest management, tiered NPC simulation). Neither is implemented. Verdicts and prerequisites: `docs/proposals/ASSESSMENT.md`; plan: ROADMAP "Proposals".

### MMORPG guideline (reference)

`docs/MMORPG_GUIDELINE.md` keeps a seven-part MMORPG development sequence (shared data, server loop, rendering, sessions and saves, entities and combat, AI rules, load testing) reconciled with this repository: each part has a verdict, what to do, what not to do, the roadmap step it lands in and a gate. It is a guide, not the truth. When the user has no preference for what to work on, sessions follow ROADMAP "Choosing work" and read the matching guideline section.

### Art style and maps (planned)

The game's art style is **semi-pixelated**: pixel-art sprites and tiles with smooth effects, 32 px tiles, 32x48 px characters, integer screen scale. Sprites will be added through a data manifest and maps made in Tiled; see `docs/ART_AND_MAPS.md` and the ROADMAP "Art and maps" section. Nothing of this is built yet; characters are still cylinders.

## 5. Git workflow

Branches:

- `main`: always runnable, tagged releases only.
- `dev`: integration branch.
- `feature/<name>`, `fix/<name>`, `cleanup/<name>`: short-lived branches from `dev`.

Commit style (Conventional Commits): `feat(skills): add charge slow-down`, `fix(particles): clamp bounce`, `chore(cleanup): remove unused import`, `docs: update roadmap`.

Mapping to versions: `feat` → minor, `fix` → fix digit, `chore/refactor/docs/style` → cleanup digit.

Typical cycle:

```bash
git checkout dev && git pull
git checkout -b feature/<name>
# ...work, test...
git add src && git commit -m "feat(<scope>): <summary>"
git add README.md CHANGELOG.md ROADMAP.md && git commit -m "docs: update for V<x.y.z.nn>"
git push -u origin feature/<name>
# GitHub: PR feature -> dev (merge, delete branch), then PR dev -> main (merge)
git checkout main && git pull
git tag -a V<x.y.z.nn> -m "V<x.y.z.nn> - <title>"
git push origin --tags
git checkout dev && git pull
```

---

## 6. Known limitations (V1.16.0.00)

- Lumberjack (V1.20.0.00): there is no equip slot yet, so owning the Basic Axe is enough; Velwood has no use yet (no crafting, shop or building); job levels have no gameplay effect yet; chopping has no sound of its own; the Home Inventory does not list character items. Trees do not block the Fire Blast area itself, only fireballs and Graugr's attacks.
- The Home Inventory shows what you own but is always empty for now: Shop purchases are placeholders and nothing grants items yet. Equip is shown disabled until character customization (L3). To try the screen, run `lycarius.inventory.grant("ember_robe")` in the browser console (any id from the Shop list, e.g. `molten_veil`, `spark_trail`); it is saved in your browser only.
- The bag primitive exists but nothing uses it: Fireball crit is still a flat 12% roll. Moving it to a per-caster bag is stage M2 and needs two owner decisions (crit rate, bag scope).
- Characters are plain cylinders; the sprite/animation layer is planned.
- Sounds are synthesized placeholders, not recorded assets. There is no music yet.
- "Exit Game" shows an exit screen. Browsers cannot close themselves. A desktop wrapper will fix this.
- Single-player only. The road to online (server, accounts, co-op, hosting on the owner's own PC, an optional exe build) is planned phase by phase in `SERVER_PATH.md`; the code is being kept server-ready (see `Claude.md` section 5b).
- Dummy settings rebuild the dummy when saved; during a Mock Raid the new dummy appears when the raid ends.
- Campaign and Live Server are placeholder screens. Home (profile, shop, Genesis Path, messages, inventory, character, season, rank), Creator Support and the Mode Select pictures / video are placeholders. The wallet is in-memory and not saved. The loading bar is driven by real tasks, but they are small today; Campaign and Live have no loading screen. The Home character is still a cylinder placeholder; shop item images and the profile avatar are still placeholders.
- Character level has no gameplay effect yet. Specialization is Mage / fire only, and capped at level 10.
- The skill tree has no respec: picks are permanent until you reset progression in Developer → XP tools.
- Only the Training Ground exists, so progression is saved in the browser's `localStorage` (not on a server).
- Graugr has no sounds of its own yet. Barrage damage (12 per 0.5 s) is very high against 50 HP: outrun it (you walk 230 px/s, it walks 105 while spinning). Raids are not saved, and kill counts reset when a raid session starts.
- A deflected fireball keeps its burn, so it can ignite you. Flame Shield does not stop Graugr's melee.
- Burn Resistance is tuned by constants at the top of `BurnResistance.js`; Burn numbers live in `Fireball.burn`. Fire Blast is tuned by the constants at the top of `FireBlast.js`.
- Every run starts from a fresh random seed. There is no seed setting in the UI yet; `new WorldScene({ seed })` fixes it for tests and replays.

See **[ROADMAP.md](ROADMAP.md)** for what comes next and **[CHANGELOG.md](CHANGELOG.md)** for history.
