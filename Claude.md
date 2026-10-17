# CLAUDE.md: Lycarius MMORPG: Primordia

Read this first. It says how we work, how to code here, and how to spend tokens well.
Keep this file short; it is loaded every session. Update it when a rule changes.

## 1. Project snapshot

- 2D open-world MMORPG (adventure / RPG / management). Edition 1 = **Primordia**; edition 2 = **Proto** (separate, later).
- Stack: HTML5 Canvas + vanilla JS ES modules. No bundler, no deps, no build step.
- Run: VS Code Live Server on `index.html` (modules need http).
- Current: see `VERSION` in `src/config.js`. History: `CHANGELOG.md`. Plan: `ROADMAP.md`. Full docs: `README.md`.
- Characters are cylinders. Pseudo-3D: objects have ground `(x,y)` + height `z`, drawn at `y - z`.
- Long-term: factions, guild wars, territory wars, branching story, real-party missions, server-authoritative multiplayer (V2).

## 2. How we work (the user's workflow)

- **User codes in VS Code by copy-paste.** Claude gives code + exact location. User is on Windows / PowerShell.
- **No guessing the repo state.** If unsure a file matches, ask the user to paste it (or grep if files are uploaded).
- Every feature ships as one version with a full guide, in this order:
  1. Design decisions (short, with numbers).
  2. New files (full code, path above each block).
  3. Replace-whole-file list (only when most of the file changes).
  4. Small edits (find → replace snippets, with the exact anchor line).
  5. Docs updates (CHANGELOG, README, ROADMAP, `config.js` version).
  6. Test checklist (concrete, observable steps).
  7. GitHub steps (branch, commit, PR, tag).
- The user tests and reports back. Fixes ship as the next FIX version.
- User wants docs **meticulous and punctual** (README, ROADMAP, CHANGELOG). Never skip doc updates.
- Do not bundle unrequested features. Ask which direction when the roadmap forks (one question max).

### Versioning: `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>`

| Digit     | Use                                                                 |
| --------- | ------------------------------------------------------------------- |
| 1 MAJOR   | new edition, huge system (e.g. networking), breaking data           |
| 2 MINOR   | new feature / content                                               |
| 3 FIX     | bug fix, balance tweak, typo                                        |
| 4 CLEANUP | refactor, format, dead code, comments, docs. Two digits (`00`-`99`) |

- Bump resets all digits to the right to 0. First release was `V1.0.0.00`.
- Version lives in `src/config.js`. Bump it + CHANGELOG + git tag together.
- Commits (Conventional): `feat` → minor, `fix` → fix, `chore/refactor/docs/style` → cleanup.

### Git flow

- `main` = stable, tagged releases only. `dev` = integration. Work on `feature/*`, `fix/*`, `cleanup/*` from `dev`.
- Cycle: branch from `dev` → commit code, commit docs separately → push → PR to `dev` → PR `dev`→`main` → tag `V#.#.#.##` on `main` → pull `dev`.
- Cleanup releases may skip the GitHub Release page; tag + CHANGELOG suffice.

## 3. Architecture rules (keep new code easy to integrate)

Principle: **nothing is written as if finished.** New features are additions, not edits.

```
src/
  main.js            bootstrap
  config.js          name, edition, VERSION
  types.js           JSDoc contracts (SkillDef, ClassDef, CasterOwner, HitEvent, CastEvent)
  content/index.js   ONE manifest: register skills + classes here
  core/              Game, Scene, Input, EventBus, Registry, Settings, math
  scenes/            Menu, Settings, Exit, World
  entities/          Entity base, Player, TrainingDummy
  classes/           ClassRegistry + class data (Mage)
  skills/            SkillRegistry + skill defs + projectiles
  systems/           SkillCaster, Vitals, ParticleSystem, Lights, Camera, DamageNumbers, HitEffects, AudioSystem
  audio/             AudioEngine (procedural Web Audio, no asset files)
  render/            drawCylinder, drawGlow, drawGround, drawBar, drawChargeOrb
```

Rules:

1. **Data over code.** Classes, skills, (later) items/quests/factions are plain definition objects registered in `content/index.js` via `Registry`.
2. **Events over calls.** Gameplay emits (`hit`, `cast`); visuals (`HitEffects`), audio (`AudioSystem`), UI, quests subscribe. Never call audio/VFX directly from combat logic.
3. **Any entity can cast.** `SkillCaster` needs the `CasterOwner` shape (`vitals`, `aim`, `getCastOrigin`, `wantsCast`, `applyImpulse`, `kick`, `lowManaFlash`). Reuse it for enemies/NPCs.
4. **Entities** extend `Entity`; optional hooks: `hittable`, `solid`, `onHit(e)`, `damageColor`.
5. **Scenes** extend `Scene`, call `super.enter(game)`, registered via `game.register(name, factory)`.
6. **Settings:** add default in `Settings.js` + row in `SettingsScene.js`. Persisted automatically.
7. **Shared helpers live once.** Particle count: `import { scaled as n } from '../systems/ParticleSystem.js'`. Do not re-declare.
8. **Annotate** new skills/classes/events with `@type {import('../types.js').X}`.
9. No new dependency or bundler without the user's approval and a roadmap entry.
10. Import cycles: scenes talk via `game.goto(name)`, never by importing each other.

## 4. Performance and load goals

Targets: 60 FPS with 3,000+ particles on mid-range hardware; first interactive frame < 1 s on local; zero external requests.

- **Load:** keep modules small and static. As content grows, lazy-load zones/classes with dynamic `import()`. Audio stays asset-free or lazy-loaded; unlock audio on first gesture only.
- **Per-frame hot paths** (`update`, `render`, particles, trail): avoid allocating (no `new`/spread/`.map`/`.filter`/`.sort` copies when an in-place loop works). Existing code uses some `filter`/`slice`; do not copy that into new hot paths, and fix it opportunistically in cleanups.
- **Particles:** pool or compact in place (see `ParticleSystem.update`). Hard cap exists (6000). Always scale counts with `scaled()`.
- **Canvas:** batch by composite mode (non-additive pass, then additive pass). Pre-render repeated gradients/sprites to offscreen canvases. Cull anything off-screen. Cache static layers (ground) once a real tilemap exists.
- **Audio:** reuse buffers (shared noise buffer). Cap simultaneous voices when sound count grows.
- **Data:** keep saves/definitions as small JSON-able objects. Version every save format.
- Measure before optimizing: use the Settings → debug FPS/particle readout. State the cost you saw, not a guess.

## 5. Token efficiency (how Claude should work here)

Goal: same quality, fewer tokens. The user's context and limits are finite.

### Reading

- Do not re-read a file already in context. Do not dump whole files to inspect them.
- Locate with `grep -n` / `rg`; read with a `view_range`. Read one file fully only when editing most of it.
- Trust this file and `types.js` for structure before opening source.

### Writing code

- **Smallest diff wins.** Prefer `str_replace`-style edits or "find this line → replace with this" snippets over rewriting files.
- Give a **full file only if**: it is new, or >~40% changes, or the user must replace it wholesale to avoid mistakes.
- Never repeat unchanged code, long comments, or the whole file "for context". Show a unique anchor line instead.
- Reference things by symbol/file path, not by re-pasting them.
- Put one-line comments only where intent is non-obvious. No decorative banners.
- Batch independent tool calls in one turn. One syntax check (`node --check`) over all files, not per file.
- Create files with a single heredoc/`create_file` per file; do not write then rewrite.
- Use the shell correctly: the sandbox shell is `sh` (no `{a,b}` brace expansion). Create dirs with explicit `mkdir -p a b c`.

### Replying (chat)

- Lead with the answer or the artifact. No preamble, no "Great question", no recap of what the user just said.
- Don't restate the plan after doing it. Don't list what was obviously done.
- Short sentences; fragments OK. Numbers over adjectives. One recommendation, not five options.
- Ask **at most one** question, only if blocked or at a real roadmap fork.
- On bug reports: state the cause in 1-2 lines, give the fix. No lecture.
- Explanations only when asked or when a pitfall would otherwise bite (e.g. "run Live Server, not file://").
- Don't re-explain git every time; give the exact commands, once, per the standard cycle.

### Word compression (chat + internal notes only)

Use shorthand in working notes, commit bodies, and internal comments. Keep **public docs (README, ROADMAP, CHANGELOG) in full clear prose**; the user wants those meticulous.

| Write                       | Instead of                                             |
| --------------------------- | ------------------------------------------------------ |
| `→`                         | leads to / then                                        |
| `w/`, `w/o`                 | with, without                                          |
| `cfg`, `impl`, `dep`, `req` | configuration, implementation, dependency, requirement |
| `perf`, `alloc`, `ctx`      | performance, allocation, context                       |
| `e.g.`, `i.e.`, `vs`        | for example, that is, versus                           |
| drop articles/filler        | "the", "a", "just", "basically", "in order to"         |
| active, imperative          | "you may want to consider adding"                      |

Rules: no emoji in code or commits. Don't compress code identifiers or user-facing text (menus, HUD, errors).

### Long sessions

- Prefer finishing a feature per session; end with the GitHub steps so state is clear.
- If the conversation is getting long, summarize repo state in <10 lines (version, branch, last change, next step) so a fresh session can resume from this file + that summary.

## 6. Definition of done (per version)

- [ ] Works; console clean (no red errors); no gameplay regression.
- [ ] `node --check` passes on all `src/**/*.js` (if sandbox available).
- [ ] No duplicate helpers; new content registered in `content/index.js`.
- [ ] `VERSION` bumped; CHANGELOG, README, ROADMAP updated.
- [ ] Test checklist + GitHub steps delivered in the standard format.

## 7. Gotchas

- Opening `index.html` directly fails (ES modules). Use Live Server or `npx serve .`.
- "Exit Game" cannot close a browser tab; it shows an exit screen. Real quit needs a desktop wrapper (roadmap).
- Audio is blocked until a user gesture; `main.js` unlocks on first pointer/key.
- Dummy "attacks" setting is read at world start; takes effect next Start.
- `Lights` with `once:true` live one frame; re-add every update. Timed lights expire by `life`.
- `drawGround.js` uses a local `const n` for tile noise; unrelated to the `n` particle helper. Leave it.
- Hit-stop scales entity `dt` to 8% and particle `dt` to 40%; code that must keep real time uses the raw `dt`.
- Aim reads the cursor at body height (`AIM_Z = 32`) so shots land where the sprite looks.

## 8. Roadmap pointer

Next candidates (see `ROADMAP.md`): more combat depth (sprites/animation, dummy behaviours, second skill) or world (tilemap, collision, two zones). Then classes/skills, progression, NPCs/quests, enemies/bosses, then V2.0.0.00 online. Ask the user which fork when starting.
