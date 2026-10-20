# Lycarius MMORPG: Primordia

> **Current version: V1.10.0.04** · 2D · Adventure / RPG / Management · HTML5 Canvas + vanilla JavaScript (ES modules)

**Primordia** is the first edition of _Lycarius MMORPG_, a 2D open-world MMORPG built around a deep lore, branching storylines, co-op progression and (eventually) faction, guild and territory wars. A later edition, **Proto**, will be a more refined second game built on what Primordia teaches us.

This repository currently holds the **combat MVP**: one class with three skills unlocked through a class specialization tree, an experience system, a burn status effect, projectile collisions, a training dummy that can fight back and use skills, a melee enemy (Graugr) with smart AI and a mock raid mode, health and mana, and a full audio-visual effect stack. Everything else is scaffolded so new features slot in without rewrites.

---

## 1. What is in V1.10.0.04

| Area           | Included                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Menu           | Title menu: Play, Creator Support (placeholder), Exit. Play opens the Home lobby (placeholders), then Mode Select: Live Server (placeholder), Campaign (placeholder), Training Grounds (playable, with a loading screen). Settings is on the Home bottom row |
| Settings       | Master volume, particle quality, screen shake, damage numbers, debug overlay (FPS), cast-timer debug, dummy attacks toggle, dummy uses skills toggle, dummy movement mode, Developer options test panel. Persisted in `localStorage`. |
| Character      | One playable character (a cylinder) with smooth WASD movement and mouse aiming                                                         |
| Class          | **Mage** (the only class)                                                                                                              |
| Skills         | **Fireball**: hold to charge (magic circle), release to cast. **Flame Shield**: toggle a flame arc that absorbs damage. **Burn Resistance**: cast-time self buff against fire and burn. You start with Fireball only; the other two unlock in the specialization tree |
| Progression    | Experience system with two separate tracks: character level and class specialization level. Class specialization tree (press `K`). Saved in `localStorage` |
| Projectile clash | Two enemy fireballs that meet explode and hurt anything near. A stronger charge destroys a weaker one                                |
| Burn           | Fireball hits can set the target on fire: 8 damage per second for 5 to 10 seconds, with a sound and a flash on every tick              |
| Vitals         | Health 50 (regen 0.1/s), mana 100 (regen 1/s), stamina 100 (regen 8/s, no skill spends it yet), death and respawn                      |
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

Set in **Settings → Dummy attacks** (applies when you press Training Ground).

| Mode          | Behaviour                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off (default) | Passive training dummy with infinite health. Tracks total damage, hits, last hit and 5-second DPS                                                                                                                                       |
| On            | The dummy takes the player class's stats (50 HP, 100 mana, same regen), leads its target, charges to a random level and fires fireballs at you. A hit staggers it and cancels its cast. It can be defeated and respawns after 3 seconds |

**Settings → Dummy uses skills** (needs Dummy attacks; applies when you press Training Ground). Off: the dummy only fires Fireball. On: it also uses the rest of the Mage kit:

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

Two separate tracks (`src/progression/Progression.js`). Both are saved per class in `localStorage` (versioned save format).

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
| 6, 7, 8, 9      | Pick one bonus each                                                                     |
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

**Settings → Show cast timer (debug)** draws `Skill  elapsed / total s` and a small bar above the player while charging. The total is the effective cast time, so cast-time bonuses are visible. The text turns green once the time is full.

### Developer options (test panel)

**Settings → Developer options** edits the saved Mage progression (it applies the next time you enter the Training Ground): add character XP, add specialization XP (amount box, default 100), jump to the next specialization level, or reset all progression. A status line shows both levels and pending picks.

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

### Burn Resistance

Self-only buff with a cast time. **Hold `Q`** until the circle completes; releasing early cancels for free (no mana, no cooldown). Holding on after it completes does not recast.

| Rule                 | Value                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cast                 | 1.2 s hold, 25 mana paid when the cast completes (you need 25 mana to start). Movement slows to 55% while casting |
| While casting        | Red-orange magic circle under the caster, rising and spiralling motes, the body tints red-orange and glows, light grows |
| Duration             | 30 seconds. The glow flickers in the last 4 seconds                                                           |
| Fire skill damage    | Reduced by 30% (Fireball hits on the body, after any Flame Shield absorption). Never below 1                  |
| Burn damage          | Burn ticks do 50% damage (8 becomes 4) while the ward is up, including a burn that was already running         |
| Burn ignites         | 50% chance the ward **nullifies** it: no burn (a running burn is snuffed too), the ward is consumed, and a toast shows a burn icon being slashed in two above the target. Otherwise the burn starts, with reduced ticks, and the ward stays |
| While active         | Red-orange glow on the body, embers rising, and a trail of glowing particles behind you while you move        |
| Ending               | Expiry, being nullified-and-spent, or being downed. The glow fades over 0.9 s and leaves hanging embers behind |
| Recast               | Casting again while active refreshes the 30 s timer (full cost)                                               |
| HUD                  | Third skill slot with the time-left bar, a time-left bar under the mana bar, and a BURNING line with time left and damage per second |

Example: ward up, a fireball hits for 20 → you take 14. It ignites you: half the time the burn is nullified and the ward is gone; otherwise you burn for 4 per second and keep the ward.

### Dummy movement

Set in **Settings → Dummy movement** (applies when you press Start). Works with both passive and hostile dummies.

| Mode                 | Behaviour                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Stationary (default) | Stays at its start point and springs back after a hit                                                                      |
| Patrol               | Walks back and forth along a 520 px line through its start point (peak speed about 130 px/s)                               |
| Strafe               | Circles the player at 340 px and reverses direction every 3 to 6 seconds. Returns to its start point if you are downed     |

Hits still freeze the dummy and knock it back; it steers back onto its path afterwards.

### Fireball effect checklist

| Requirement                         | Where it happens                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Attack charge                       | `SkillCaster` + `Fireball.onCharging`: orb grows, embers spiral inward, ground ring fills, light grows, movement slows to 55%   |
| Attack recoil                       | `Fireball.onRelease`: backward impulse on the caster (scales with charge), body lean (`kick`), camera shake                     |
| Projectile trail                    | `FireballProjectile.draw`: tapered, colour-graded ribbon from the position history                                              |
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
    math.js                   helpers (lerp, rand, hash2, colour)
  scenes/                     MenuScene, HomeScene, ModeSelectScene, LoadingScene, CreatorSupportScene, SettingsScene, ExitScene, WorldScene, PlaceholderScene (Campaign, Live Server)
  lobby/                      lobbyData (lobby content + art paths), Wallet (shared currencies), assets (lazy image / video loaders), loadTasks (loading-screen readiness tasks)
  progression/                Progression (XP, levels, picks, save), SpecBonuses (bonus data + computeMods), Mods (damage multipliers)
  ui/                         PlayerHud (in-game HUD), ProfilePanel (character panel), SkillTreePanel (specialization tree), Modal (lobby modals), icons (SVG icon set)
  entities/                   Entity (base), Player, TrainingDummy, Graugr
  classes/                    ClassRegistry, Mage (data only)
  skills/                     SkillRegistry, Fireball, FlameShield, BurnResistance (definitions),
                              FireballProjectile, FlameShieldEffect, BurnWardEffect, ProjectileClash
  systems/                    SkillCaster, Vitals, ParticleSystem, Lights, Camera, DamageNumbers, HitEffects,
                              StatusSystem (burn, stun), BurnFx, Toasts, AudioSystem, ExplosionSystem, ExplosionFx, XpSystem, RaidSystem
  render/                     drawCover, drawCylinder, drawGlow, drawGround, drawBar, drawChargeOrb, drawMagicCircle, drawAura, drawEnhance, drawStun
```

### Core concepts

- **Pseudo-3D space.** Every object has ground position `(x, y)` and height `z`. It is drawn at `y - z`. Particles apply gravity to `z`, so they truly fall, bounce and slide.
- **Event-driven combat.** A projectile only emits `hit`; a skill release emits `cast`. `HitEffects` (visuals), `AudioSystem` (sound) and the target's `onHit` (reaction) respond independently. Later systems (quests, threat, combat log, networking) can subscribe without touching the projectile.
- **Data-driven content.** A class lists stats, skill ids and key bindings. A skill is an object with `cooldown`, `chargeTime`, `minCharge`, optional `manaCost`, `canStart`, `maxAffordableCharge`, and the hooks `onChargeStart`, `onCharging`, `onRelease`.
- **Any entity can cast.** `SkillCaster` works with any owner that provides `vitals`, `aim`, `getCastOrigin()`, `wantsCast(slot, world)` and `applyImpulse()`. The player reads the keyboard; the hostile dummy reads its AI. Future enemies and NPCs reuse this.
- **Status effects.** Burn lives on `entity.burn` and is run by `StatusSystem`; a ward lives on `entity.ward`. Ignition is an offer carried by the `hit` event (`burn: { chance, duration, dps }`), so any future skill can burn by adding that field. `StatusSystem` emits `burn` events (`ignite`, `tick`, `nullify`, `end`); the skill emits `ward` events (`up`, `down`). `BurnFx`, `Toasts` and `AudioSystem` react to them. Entities take burn damage through `onDot(e)`.
- **Cast-time and self skills.** `autoRelease: true` fires a skill the moment its charge fills; `self: true` marks skills that only target the caster (AI casters skip them, the player draws an aura instead of the charge orb); `palette` recolours the magic circle.
- **Progression.** `Progression` owns XP, levels and bonus picks; `XpSystem` feeds it from `hit`, `burn` and `cast` events. The class declares `specialization { element, maxLevel, start, unlocks }`; bonuses are data in `SpecBonuses.js` (registered through `SpecBonusRegistry` in `content/index.js`). `Player.syncProgression()` turns it into `player.stats`, `player.mods` and new `SkillCaster` slots (`addSkill`). Casters apply `mods.castTimeMult` and `mods.cooldownMult`; damage code uses `progression/Mods.js`.
- **Projectile clash and explosions.** Projectiles set `isProjectile = true` and call `clashProjectiles()` when they touch a foreign projectile. That emits `explosion`; `ExplosionSystem` deals area damage as `hit` events with `aoe: true`, `ExplosionFx` draws it and `AudioSystem` plays it.
- **Reusable vitals.** `Vitals` holds health, mana, regeneration and damage/spend helpers.
- **Scene factory.** `game.register(name, factory)` and `game.goto(name, params)`.
- **Audio is a listener, not a caller.** Combat code never plays sounds; `AudioSystem` reads events and entity state. `AudioEngine` can be swapped for real sound files without touching gameplay code.

### How to add things

**A new skill**

1. Create `src/skills/MySkill.js` exporting a definition (copy `Fireball.js`).
2. Register it in `src/content/index.js`.
3. Add its id to a class's `skills` and `bindings`.
4. If it needs a sound, add a method to `AudioEngine` and trigger it from `AudioSystem` (listen for an event).

**A new class** — copy `src/classes/Mage.js`, change stats / skills, register in `content/index.js`, and pass `{ classId }` to the `world` scene.

**A new entity (enemy, NPC)** — extend `Entity`, set `hittable = true` for damage, give it `vitals` if it has health, implement `update` / `draw` and optionally `onHit(e)`. To let it cast, implement the caster interface above.

**A new hit reaction** — add a method in `HitEffects` and call it from `onHit`.

**A new sound** — add a public method to `AudioEngine` and call it from `AudioSystem`.

**A new icon** — add an entry to `ICONS` in `src/ui/icons.js` (24 x 24 viewBox, `currentColor`) and refer to it by name: `icon("name")` in templates, or `icon: "name"` in a skill or bonus definition. Do not use emoji or symbol glyphs.

**Something the loading screen must wait for** — add a task to `buildTasks` in `src/lobby/loadTasks.js` (`run` returns a promise; mark it `fatal` if the game cannot start without it).

**A new setting** — add a default in `Settings.js` and a row in `SettingsScene.js`.

**A new specialization bonus** — add an entry to `SPEC_BONUSES` in `src/progression/SpecBonuses.js` (stat add, modifier add, or modifier multiply). The tree lists it automatically; a modifier that is new must also be read where it applies.

**A new projectile** — set `isProjectile = true`, `owner`, `charge` and `weaken(ratio)`, call `clashProjectiles` in its hit check, and check shields first (see `FireballProjectile`).

---

## 4b. Developer checks (optional, needs Node.js)

| Command | What it does |
| ------- | ------------ |
| `node tests/graugr.test.mjs` | Headless gameplay tests (Graugr AI, skills, stun, deflect, raid). Exit 0 = pass |
| `node tools/audit-server-ready.mjs` | Counts simulation code that could not run on a server and fails if the count rose above `tools/server-ready-baseline.json`. `--verbose` lists file and line, `--strict` fails on any debt |
| `node tools/sec.mjs <file> [id]` | Prints one section of a markdown doc (no id lists the headings). Ids: `5b`, `S1f`, `M2`, `V1.9.0.00` or any heading text. Saves reading whole docs |
| `node tools/check-docs.mjs` | Checks that every markdown doc has a title, `##` sections, consistent line endings, no oversized leaf section, and that every file in the `Claude.md` doc map exists. `--strict` also fails on warnings |
| `npm test`, `npm run audit`, `npm run sec -- <file> [id]`, `npm run docs` | Shortcuts for the commands above |

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

## 6. Known limitations (V1.10.0.04)

- Characters are plain cylinders; the sprite/animation layer is planned.
- Sounds are synthesized placeholders, not recorded assets. There is no music yet.
- "Exit Game" shows an exit screen. Browsers cannot close themselves. A desktop wrapper will fix this.
- Single-player only. The road to online (server, accounts, co-op, hosting on the owner's own PC, an optional exe build) is planned phase by phase in `SERVER_PATH.md`; the code is being kept server-ready (see `Claude.md` section 5b).
- Changing **Dummy attacks** or **Dummy uses skills** takes effect the next time you press Training Ground.
- Campaign and Live Server are placeholder screens. Home (profile, shop, Genesis Path, messages, inventory, character, season, rank), Creator Support and the Mode Select pictures / video are placeholders. The wallet is in-memory and not saved. The loading bar is driven by real tasks, but they are small today; Campaign and Live have no loading screen. The Home character is still a cylinder placeholder; shop item images and the profile avatar are still placeholders.
- Character level has no gameplay effect yet. Specialization is Mage / fire only, and capped at level 10.
- The skill tree has no respec: picks are permanent until you reset progression in Developer options.
- Only the Training Ground exists, so progression is saved in the browser's `localStorage` (not on a server).
- Graugr has no sounds of its own yet. Barrage damage (12 per 0.5 s) is very high against 50 HP: outrun it (you walk 230 px/s, it walks 105 while spinning). Raids are not saved, and kill counts reset when a raid session starts.
- A deflected fireball keeps its burn, so it can ignite you. Flame Shield does not stop Graugr's melee.
- Burn Resistance is tuned by constants at the top of `BurnResistance.js`; Burn numbers live in `Fireball.burn`.

See **[ROADMAP.md](ROADMAP.md)** for what comes next and **[CHANGELOG.md](CHANGELOG.md)** for history.
