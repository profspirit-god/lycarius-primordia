# CLAUDE.md: Lycarius MMORPG: Primordia

Read first, every session. Keep it short (it is loaded each time). Update it when a rule changes.

## 1. Snapshot

- 2D open-world MMORPG (adventure / RPG / management). Edition 1 = **Primordia**; edition 2 = **Proto** (later, separate).
- Stack: HTML5 Canvas + vanilla JS ES modules. No bundler, deps or build step. Run with VS Code Live Server on `index.html` (modules need http).
- Version: `VERSION` in `src/config.js`. History `CHANGELOG.md`, plan `ROADMAP.md`, full docs `README.md`.
- Pseudo-3D: characters are cylinders; entities have ground `(x,y)` + height `z`, drawn at `y - z`. Ground rings are drawn squashed (0.5) but hit tests are circles in `(x,y)`.
- Long-term: factions, guild wars, branching story, real-party missions, server-authoritative multiplayer (V2).

## 2. Session protocol (save tokens)

1. **Start:** read this file. Do **not** ask for or unzip the whole repo for a small task. Use the code map (section 4) to name the 3-8 files needed. If the user attached a full zip, unzip once, then `grep -n` / `view_range`; never `cat` big files.
2. **Work in a copy.** Source files are **CRLF**. Read with `tr -d '\r'`; edit in LF with exact-match replace (assert one match); convert back to CRLF before packaging (`sed -i 's/$/\r/'`). Never leave mixed endings.
3. **Verify before delivering:** `node --check` on every `src/**/*.js`; for logic, a tiny headless harness (stub `world` with `events`, `entities`, `player`, `particles`, `damageNumbers`, `lights`) run with `node`. For drawing, call `draw` with a Proxy ctx and assert no NaN args. State what was and was not tested (browser play is the user's test).
4. **Deliver a changes-only zip**, never the whole repo: `lycarius-primordia-V<x.y.z.nn>-changes.zip`, paths relative to the repo root (`src/...`, `css/...`, docs), CRLF kept, only new + changed files, docs and `Claude.md` included. List the files in chat. User extracts into the repo root and overwrites. Make the zip with python `zipfile`, forward slashes.
5. **Chat reply, in order:** design decisions with numbers (only the non-obvious ones, flag ambiguities and the default taken) → what changed (file list) → test checklist (concrete, observable) → GitHub steps (exact commands, section 7) → known difficulties. No code dumps in chat unless the user asks.
6. **Ask at most one question**, only if blocked or at a real roadmap fork. Do not bundle unrequested features. Bugs: cause in 1-2 lines, then the fix as the next FIX version.
7. If the chat gets long, end with a <10 line state summary (version, branch, last change, next step).

## 3. Versioning and git

`V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>` (cleanup is two digits). MAJOR = new edition / huge system; MINOR = feature / content; FIX = bug or balance; CLEANUP = refactor, format, docs. A bump resets the digits to its right. Bump `config.js` + CHANGELOG + README + ROADMAP + git tag together. Docs are public and meticulous: full prose, never skipped.

Commits (Conventional): `feat` → minor, `fix` → fix, `chore/refactor/docs/style` → cleanup. Branches: `main` stable + tags only, `dev` integration, work on `feature/*`, `fix/*`, `cleanup/*` from `dev`. Code and docs in separate commits. In `git add`, **list files explicitly** (a plain `git add .` can pick up line-ending noise).

## 4. Code map (read this instead of opening files)

```
main.js            bootstrap: settings, scenes, audio unlock, loop
config.js          GAME_NAME, EDITION, VERSION
types.js           JSDoc: SkillDef, ClassDef, CasterOwner, HitEvent (+burn, stun), CastEvent, ExplosionEvent
content/index.js   ONE manifest: register skills, classes, spec bonuses
core/              Game (loop, goto(name,params) clears #ui), Scene, Input (isDown/wasPressed, mouse), EventBus (on/off/emit),
                   Registry, Settings (DEFAULTS keys), math (clamp lerp rand dist lerpColor rgba hash2 TAU)
scenes/            Menu, Home, ModeSelect, Loading, CreatorSupport, Settings, Exit, Placeholder (campaign, live), World
  WorldScene       THE game scene = `world` object. enter() builds systems in order; update(); render(); canvas HUD (drawHud, drawRaidPanel,
                   drawKillPanel, drawBanners); DOM HUD = `hud` (PlayerHud) + `profile` (ProfilePanel); spawn(), hitstop(), pushBanner(),
                   removeDummy()/restoreDummy(), openTree/openProfile (pause the game), buildPauseMenu(), buildRaidButton(); fields: player,
                   dummy (can be null in a raid), raid, entities, events, particles, lights, damageNumbers, camera, audio, progression, banners
lobby/             lobbyData (content + art paths), Wallet, assets (lazy loaders), loadTasks (loading-screen readiness tasks: buildTasks)
entities/          Entity (x y z radius height dead hittable solid burn ward stunT; hooks onHit onDot),
                   Player (stats, syncProgression, stun-aware, downed/respawn), TrainingDummy (passive/hostile, thinkSkills),
                   Graugr (melee enemy; GRAUGR consts; AI pickMode/think/dodge; startBarrage/startPoke/leap; tryDeflect; emits 'kill')
classes/           ClassRegistry, Mage (data)
skills/            SkillRegistry; defs Fireball FlameShield BurnResistance; FireballProjectile (checkHit order: clash → deflect →
                   shield → body; roll(); hit()), FlameShieldEffect, BurnWardEffect, ProjectileClash
progression/       Progression (XP, levels, picks, save), SpecBonuses (data), Mods (skillMult, elementMult)
ui/                PlayerHud (top-left card, status icons, bottom-left skill circles), ProfilePanel (character panel), SkillTreePanel,
                   Modal (openModal), icons (`icon(name)` SVG set; skills / bonuses store the icon NAME)
systems/           SkillCaster (casters: vitals aim getCastOrigin wantsCast applyImpulse kick lowManaFlash), Vitals (hp/mana/stamina),
                   HitEffects ('hit' → target.onHit → VFX), StatusSystem (burn + stun), ExplosionSystem, XpSystem,
                   RaidSystem (start/stop/nextRaid/update; kills, oneShots), ParticleSystem (emit; `scaled as n`), Lights, Camera,
                   DamageNumbers.spawn(x,y,text,{crit,color}), Toasts, BurnFx, ExplosionFx, AudioSystem (events → GameAudio)
audio/AudioEngine  procedural Web Audio, no asset files
render/            drawCylinder drawGlow drawGround drawBar drawChargeOrb drawMagicCircle drawAura drawCover drawEnhance drawStun
```

World events: `hit` `cast` `explosion` `burn` `ward` `shield` `levelup` `kill` `stun`. HitEvent: `{source,target,damage,crit,dir,charge,x,y,z,aoe?,burn?,stun?}`.

## 5. Architecture rules

1. **Data over code.** Classes, skills (later items, quests) are definition objects registered in `content/index.js`.
2. **Events over calls.** Combat emits; VFX, audio, UI, quests subscribe. Never call audio/VFX from combat logic.
3. **Any entity can cast** through `SkillCaster` + the `CasterOwner` shape. Melee enemies (Graugr) run their own small state machine instead.
4. Entities extend `Entity`; optional `hittable`, `solid`, `onHit(e)`, `onDot(e)`, `damageColor`. Scenes extend `Scene`, call `super.enter(game)`, register via `game.register`; they talk via `game.goto`, never by importing each other.
5. Settings: default in `Settings.js` + row in `SettingsScene.js`. Shared helpers live once (`scaled as n` for particle counts).
6. Annotate new skills/classes/events with `@type {import('../types.js').X}`. No dependency or bundler without approval and a roadmap entry.
7. New features are additions, not edits. Keep damage integers. Constants for tuning go at the top of the file.

## 6. Performance and tokens

- Targets: 60 FPS with 3,000+ particles, first frame < 1 s, zero external requests. Hot paths (`update`, `render`, particles): no `new`, spread, `.map/.filter/.sort` copies when an in-place loop works. Scale particle counts with `scaled()`; hard cap 6000. Cull off-screen; batch by composite mode. Measure with Settings → debug before optimizing.
- Tokens: smallest diff wins; do not re-read files already in context; do not repeat unchanged code; one tool call per file; batch independent calls; `sh` has no brace expansion (`mkdir -p a b c`). Chat: answer first, short sentences, numbers over adjectives, one recommendation. Shorthand (`→ w/ cfg impl req perf alloc ctx`) in notes only; docs stay in full prose. No emoji in code, UI or commits: use `icon(name)` from `ui/icons.js`.

## 7. GitHub steps (give these, with the real branch and version)

```
git checkout dev; git pull
git checkout -b feature/<name>
Expand-Archive -Path "$HOME\Downloads\<zip>" -DestinationPath . -Force   # from the repo root
git status                                  # only the delivered files should appear
git add <explicit file list>; git commit -m "feat(<scope>): <summary>"
git add README.md CHANGELOG.md ROADMAP.md Claude.md; git commit -m "docs: update for V<x.y.z.nn>"
git push -u origin feature/<name>
# GitHub: PR feature → dev (merge, delete branch), then PR dev → main (merge)
git checkout main; git pull
git tag -a V<x.y.z.nn> -m "V<x.y.z.nn> - <title>"; git push origin V<x.y.z.nn>
git checkout dev; git pull
```

Undo before pushing: `git restore .` (and `git clean -fd` for new files), or `git switch dev; git branch -D feature/<name>`.

## 8. Definition of done

- [ ] Works; console clean; no gameplay regression. `node --check` passes. No duplicate helpers.
- [ ] `VERSION` bumped; CHANGELOG, README, ROADMAP, this file updated if a rule or the code map changed.
- [ ] Changes-only zip, test checklist, GitHub steps delivered.

## 9. Gotchas

- Opening `index.html` directly fails (modules). Use Live Server or `npx serve .`. Audio unlocks on the first gesture. "Exit Game" cannot close a tab.
- Dummy "attacks" and "skills" settings are read at world start (and again by `restoreDummy`). Dummy skills AI needs both.
- `Lights` with `once:true` live one frame; re-add every update. Hit-stop scales entity `dt` to 8% and particle `dt` to 40%; real-time code uses the raw `dt`.
- Toggle skills: caster calls `isActive/onActivate/onDeactivate`; owner needs `wantsToggle(slot, world)`. Cast-time skills: `autoRelease` fires at charge 1; `self:true` skills are skipped by AI `wantsCast`.
- Projectiles: set `isProjectile`, `owner`, `charge`, `weaken(ratio)`; skip `update` work if `dead`; call `clashProjectiles`, then the deflect loop (`e.deflecting` → `e.tryDeflect(proj, world)`), then shields (`isShield` `blocks/absorb`), then bodies. Fire projectiles call `target.ward.resist(dmg)` before emitting `hit`.
- Status: burn on `entity.burn` (ignition offered by `hit.burn`); stun on `entity.stunT` (offered by `hit.stun`, always applies, refreshes not stacks). Create `StatusSystem` and `BurnFx` AFTER `HitEffects`; `BurnFx.update` after `lights.update`. Entities that can burn implement `onDot(e)`; a stunned entity must honour `stunT` itself (Player, Graugr do).
- Create `XpSystem` AFTER `HitEffects` + `StatusSystem`. It pays kill XP for `downed && attack && !xpGiven`, so enemies that die set `downed = true` and `attack = true` (Graugr does).
- `world.dummy` is `null` during a mock raid. Anything touching it must use `?.` (AudioSystem does). `restoreDummy()` rebuilds it from Settings.
- Graugr: emits `kill {target, source, oneShot, tier}` on the first update after death (it has no world in `onHit`). One-shot = it died on its first damage event. Barrage ticks are `aoe` hits (no hit-stop spam). A deflected projectile gets `owner = Graugr`.
- DOM buttons over the canvas: `#ui` has `pointer-events:none`; give the control `pointer-events:auto`. A focused button reacts to Space (the fireball key), so use `tabIndex=-1` and `preventDefault` on `mousedown`.
- Player starts with Fireball only; skills come from `Progression.unlockedSkills()`; call `Player.syncProgression()` after any pick or level-up. Cast time / cooldown use `owner.mods?.castTimeMult / cooldownMult`; damage uses `skillMult` / `elementMult`.
- Explosions: emit `explosion`; `ExplosionSystem` deals area damage as `hit` events with `aoe:true`.
- Loading: `LoadingScene` runs every task from `loadTasks.buildTasks` and starts the next scene only when all are done and `minTime` has passed; a `fatal` task shows Retry / Back. Add anything the world needs to wait for as a task.
- HUD is DOM (`#ui`): `.hud` is `pointer-events:none`, only the profile circle and status icons take pointer events. The HUD writes to the DOM only when a value changes. Stamina exists on `Vitals` but nothing spends it yet.
- Scene flow: `menu → home → modes → loading({target}) → world`. Settings and pause return to `home`. Lobby content is data in `lobbyData.js`; art loads only via `lobby/assets.js` (resolve `null` on failure) and `render/drawCover.js`. Modals: `openModal(parent,{title,html})`.
- `drawGround.js` has a local `const n` unrelated to the particle helper. Leave it.

## 10. Next

See `ROADMAP.md` (lobby path L1-L11; combat depth; world; classes; NPCs/quests; V2.0.0.00 online). Ask the user which fork when starting; one lobby feature per version.
