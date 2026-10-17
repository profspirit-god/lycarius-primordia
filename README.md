# Lycarius MMORPG: Primordia

> **Current version: V1.5.0.00** · 2D · Adventure / RPG / Management · HTML5 Canvas + vanilla JavaScript (ES modules)

**Primordia** is the first edition of _Lycarius MMORPG_, a 2D open-world MMORPG built around a deep lore, branching storylines, co-op progression and (eventually) faction, guild and territory wars. A later edition, **Proto**, will be a more refined second game built on what Primordia teaches us.

This repository currently holds the **combat MVP**: one class with three skills, a burn status effect, a training dummy that can fight back, health and mana, and a full audio-visual effect stack. Everything else is scaffolded so new features slot in without rewrites.

---

## 1. What is in V1.5.0.00

| Area           | Included                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Menu           | Start, Settings, Exit Game                                                                                                             |
| Settings       | Master volume, particle quality, screen shake, damage numbers, debug overlay (FPS), dummy attacks toggle, dummy movement mode. Persisted in `localStorage`. |
| Character      | One playable character (a cylinder) with smooth WASD movement and mouse aiming                                                         |
| Class          | **Mage** (the only class)                                                                                                              |
| Skills         | **Fireball**: hold to charge (magic circle), release to cast. **Flame Shield**: toggle a flame arc that absorbs damage. **Burn Resistance**: cast-time self buff against fire and burn |
| Burn           | Fireball hits can set the target on fire: 8 damage per second for 5 to 10 seconds, with a sound and a flash on every tick              |
| Vitals         | Health 50 (regen 0.1/s), mana 100 (regen 1/s), HUD bars, death and respawn                                                             |
| Mana cost      | Scales with charge: 5 at minimum charge up to 20 at full charge                                                                        |
| Dummy          | Passive mode: infinite health. Hostile mode: uses the player's stats, fights back, can be defeated                                     |
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

Set in **Settings → Dummy attacks** (applies when you press Start).

| Mode          | Behaviour                                                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off (default) | Passive training dummy with infinite health. Tracks total damage, hits, last hit and 5-second DPS                                                                                                                                       |
| On            | The dummy takes the player class's stats (50 HP, 100 mana, same regen), leads its target, charges to a random level and fires fireballs at you. A hit staggers it and cancels its cast. It can be defeated and respawns after 3 seconds |

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
| `Esc`                        | Pause menu      |

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
  scenes/                     MenuScene, SettingsScene, ExitScene, WorldScene
  entities/                   Entity (base), Player, TrainingDummy
  classes/                    ClassRegistry, Mage (data only)
  skills/                     SkillRegistry, Fireball, FlameShield, BurnResistance (definitions),
                              FireballProjectile, FlameShieldEffect, BurnWardEffect
  systems/                    SkillCaster, Vitals, ParticleSystem, Lights, Camera, DamageNumbers, HitEffects,
                              StatusSystem, BurnFx, Toasts, AudioSystem
  render/                     drawCylinder, drawGlow, drawGround, drawBar, drawChargeOrb, drawMagicCircle, drawAura
```

### Core concepts

- **Pseudo-3D space.** Every object has ground position `(x, y)` and height `z`. It is drawn at `y - z`. Particles apply gravity to `z`, so they truly fall, bounce and slide.
- **Event-driven combat.** A projectile only emits `hit`; a skill release emits `cast`. `HitEffects` (visuals), `AudioSystem` (sound) and the target's `onHit` (reaction) respond independently. Later systems (quests, threat, combat log, networking) can subscribe without touching the projectile.
- **Data-driven content.** A class lists stats, skill ids and key bindings. A skill is an object with `cooldown`, `chargeTime`, `minCharge`, optional `manaCost`, `canStart`, `maxAffordableCharge`, and the hooks `onChargeStart`, `onCharging`, `onRelease`.
- **Any entity can cast.** `SkillCaster` works with any owner that provides `vitals`, `aim`, `getCastOrigin()`, `wantsCast(slot, world)` and `applyImpulse()`. The player reads the keyboard; the hostile dummy reads its AI. Future enemies and NPCs reuse this.
- **Status effects.** Burn lives on `entity.burn` and is run by `StatusSystem`; a ward lives on `entity.ward`. Ignition is an offer carried by the `hit` event (`burn: { chance, duration, dps }`), so any future skill can burn by adding that field. `StatusSystem` emits `burn` events (`ignite`, `tick`, `nullify`, `end`); the skill emits `ward` events (`up`, `down`). `BurnFx`, `Toasts` and `AudioSystem` react to them. Entities take burn damage through `onDot(e)`.
- **Cast-time and self skills.** `autoRelease: true` fires a skill the moment its charge fills; `self: true` marks skills that only target the caster (AI casters skip them, the player draws an aura instead of the charge orb); `palette` recolours the magic circle.
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

**A new setting** — add a default in `Settings.js` and a row in `SettingsScene.js`.

---

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

## 6. Known limitations (V1.5.0.00)

- Characters are plain cylinders; the sprite/animation layer is planned.
- Sounds are synthesized placeholders, not recorded assets. There is no music yet.
- "Exit Game" shows an exit screen. Browsers cannot close themselves. A desktop wrapper will fix this.
- Single-player only; the networking layer is planned (see `ROADMAP.md`).
- Changing the **Dummy attacks** setting takes effect the next time you press Start.
- The hostile dummy never casts Burn Resistance (or Flame Shield) yet; only the player can use the defensive skills.
- Burn Resistance is tuned by constants at the top of `BurnResistance.js`; Burn numbers live in `Fireball.burn`.

See **[ROADMAP.md](ROADMAP.md)** for what comes next and **[CHANGELOG.md](CHANGELOG.md)** for history.
