# Lycarius MMORPG: Primordia

> **Current version: V1.1.0.00** · 2D · Adventure / RPG / Management · HTML5 Canvas + vanilla JavaScript (ES modules)

**Primordia** is the first edition of *Lycarius MMORPG*, a 2D open-world MMORPG built around a deep lore, branching storylines, co-op progression and (eventually) faction, guild and territory wars. A later edition, **Proto**, will be a more refined second game built on what Primordia teaches us.

This repository currently holds the **MVP**: the combat feel of a single class, a single skill, and a test dummy. Everything else is scaffolded so new features slot in without rewrites.

---

## 1. What is in V1.0.0.00 (MVP scope)

| Area | Included |
|---|---|
| Menu | Start, Settings, Exit Game |
| Settings | Master volume (stored, audio not yet implemented), particle quality, screen shake, damage numbers, debug overlay. Persisted in `localStorage`. |
| Character | One playable character (a cylinder) with smooth WASD movement and mouse aiming |
| Class | **Mage** (the only class) |
| Skill | **Fireball** (the only skill), hold to charge, release to cast |
| Dummy | Training dummy with infinite health, plus a stats panel (total damage, hits, last hit, 5s DPS) |
| Damage counter | Numbers pop up, arc and **fall with gravity**, then fade. Crits are larger and orange |
| Map | Infinite placeholder ground (deterministic noise + grass tufts) |
| Vitals | Health 50 (0.1/s regen), mana 100 (1/s regen), mana-cost fireball, death/respawn |
| Dummy mode | Settings toggle: passive (∞ HP) or hostile (uses player stats) |

### Fireball effect checklist

| Requirement | Where it happens |
|---|---|
| Attack charge | `SkillCaster` + `Fireball.onCharging`: orb grows, embers spiral inward, ground ring fills, light grows, movement slows to 55% |
| Attack recoil | `Fireball.onRelease`: backward impulse on the caster (scales with charge), body lean (`kick`), camera shake |
| Projectile trail | `FireballProjectile.draw`: tapered, colour-graded ribbon from the position history |
| Projectile glow | `drawGlow` (additive radial gradients) + a dynamic light that illuminates the ground |
| Projectile particles (real physics) | `ParticleSystem`: gravity, drag, ground bounce with restitution, ground friction |
| Burst behind the enemy | `HitEffects.backBurst`: a cone of fire/embers/smoke emitted from the far side of the target along the projectile direction |
| Freeze on hit | `TrainingDummy.onHit`: animation halts for 0.12–0.32s (longer with charge), plus a global hit-stop |
| Light on hit | Light flashes (`HitEffects.onHit`) and the dummy keeps emitting a decaying glow |
| Hit particle effect (real physics) | `HitEffects.frontSparks`: sparks that arc, fall and bounce |
| Falling damage counter | `DamageNumbers` |

---

## 2. Running the game

ES modules require a web server (opening `index.html` by double-click will not work).

1. Install [VS Code](https://code.visualstudio.com/).
2. Install the **Live Server** extension (`ritwickdey.LiveServer`). VS Code will suggest it automatically.
3. Open this folder in VS Code.
4. Right-click `index.html` → **Open with Live Server**.

Alternative (needs Node.js): `npx serve .` then open the printed address.

### Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` / arrows | Move |
| Mouse | Aim |
| Hold `Left Mouse` or `Space` | Charge Fireball |
| Release | Cast |
| `Esc` | Pause menu |

---

## 3. Versioning

Format: **`V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>`**, the first release being **`V1.0.0.00`**.

| Digit | Meaning | Example trigger |
|---|---|---|
| 1st: **MAJOR** | Major update | New edition, huge system (e.g. multiplayer networking), breaking save/data changes |
| 2nd: **MINOR** | Minor update | New feature or content (new skill, class, zone, faction) |
| 3rd: **FIX** | Bug fixes and other fixes | Crash fix, balance tweak, typo fix |
| 4th: **CLEANUP** | Clean-ups (two digits, `00`–`99`) | Refactor, formatting, dead-code removal, comments, docs |

Rules:
- Bumping a digit **resets every digit to its right to 0**. Example: `V1.2.3.07` → minor bump → `V1.3.0.00`.
- Only the **last** digit is zero-padded to two characters (`V1.0.0.05`, `V1.0.1.00`).
- **Where the version lives:** `src/config.js` (`VERSION`). Update it, `CHANGELOG.md` and the git tag together.
- **Edition names:** Primordia (this repo, `V1.x`), then Proto (a separate, more refined game).

Release checklist:
1. Edit `VERSION` in `src/config.js`.
2. Add a dated entry to `CHANGELOG.md`.
3. Commit: `chore(release): V1.0.1.00`.
4. Tag: `git tag -a V1.0.1.00 -m "V1.0.1.00"` then `git push origin main --tags`.

---

## 4. Architecture

Guiding rule: **nothing is written as if it were finished.** Systems communicate through events and registries, and content is data, so new features are additions, not edits.

```
index.html
css/style.css                 menu / panel styling
src/
  main.js                     bootstrap: settings, scenes, start loop
  config.js                   game name, edition, VERSION
  content/index.js            ONE manifest where skills + classes are registered
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
  skills/                     SkillRegistry, Fireball (definition), FireballProjectile
  systems/                    SkillCaster, ParticleSystem, Lights, Camera, DamageNumbers, HitEffects
  render/                     drawCylinder, drawGlow, drawGround
```

### Core concepts

- **Pseudo-3D space.** Every object has ground position `(x, y)` and height `z`. It is drawn at `y - z`. Particles apply gravity to `z`, so they truly fall, bounce and slide.
- **Event-driven combat.** A projectile only emits `hit`. `HitEffects` (visuals) and the target's `onHit` (reaction) respond. Later systems (quests, threat, combat log, networking) can subscribe without touching the projectile.
- **Data-driven content.** A class lists skill ids and key bindings; a skill is an object with `cooldown`, `chargeTime`, `minCharge`, `onChargeStart`, `onCharging`, `onRelease`.
- **Scene factory.** `game.register(name, factory)` and `game.goto(name, params)`.

### How to add things

**A new skill**
1. Create `src/skills/MySkill.js` exporting a definition (copy `Fireball.js`).
2. Register it in `src/content/index.js`.
3. Add its id to a class's `skills` and `bindings`.

**A new class** — copy `src/classes/Mage.js`, change stats / skills, register in `content/index.js`, and pass `{ classId }` to the `world` scene.

**A new entity (enemy, NPC)** — extend `Entity`, set `hittable = true` for damage, implement `update` / `draw` and optionally `onHit(e)`.

**A new hit reaction** — add a method in `HitEffects` and call it from `onHit`.

**A new setting** — add a default in `Settings.js` and a row in `SettingsScene.js`.

---

## 5. Git workflow

Branches:
- `main`: always runnable, tagged releases only.
- `dev`: integration branch.
- `feature/<name>`, `fix/<name>`, `cleanup/<name>`: short-lived branches from `dev`.

Commit style (Conventional Commits): `feat(skills): add charge slow-down`, `fix(particles): clamp bounce`, `chore(cleanup): remove unused import`, `docs: update roadmap`.

Mapping to versions: `feat` → minor, `fix` → fix digit, `chore/refactor/docs/style` → cleanup digit.

First push:
```bash
git init
git add .
git commit -m "feat: Primordia MVP V1.0.0.00"
git branch -M main
git remote add origin https://github.com/<you>/lycarius-primordia.git
git push -u origin main
git tag -a V1.0.0.00 -m "V1.0.0.00"
git push origin --tags
git checkout -b dev
```

---

## 6. Known limitations (V1.0.0.00)

- No audio yet (volume setting is stored for later).
- "Exit Game" shows an exit screen. Browsers cannot close themselves. A desktop wrapper will fix this.
- Single-player only; the networking layer is planned (see `ROADMAP.md`).

See **[ROADMAP.md](ROADMAP.md)** for what comes next and **[CHANGELOG.md](CHANGELOG.md)** for history.
