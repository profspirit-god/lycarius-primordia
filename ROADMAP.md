# Roadmap

Legend: ✅ done · 🔨 next · ⬜ planned · 💡 idea. Versions follow `V<MAJOR>.<MINOR>.<FIX>.<CLEANUP>`.
Dates are intentionally absent; order matters, not deadlines. Every milestone ships only when its **exit criteria** are met.

## Primordia (V1.x): the foundation edition

### ✅ V1.0.0.00 — MVP: Combat feel
Exit criteria met: menu, settings, exit; mage + fireball with full effect stack; infinite dummy; damage counter.

### 🔨 V1.1.0.00 — Combat depth
- Player health/mana, resource regeneration, skill cost.
- Second dummy type (moving, with health) and a respawn rule.
- Audio engine (volume setting becomes functional): charge hum, cast, impact.
- Sprite/animation layer replacing raw cylinders (keep cylinder fallback).
- *Exit:* player can die and respawn; audio plays at configured volume.

### ⬜ V1.2.0.00 — World
- Tilemap loader (data files), collision layers, multiple zones with transitions.
- Minimap and world map; camera bounds per zone.
- Day/night lighting pass using the existing `Lights` system.
- *Exit:* two connected zones with distinct art and collision.

### ⬜ V1.3.0.00 — Classes and skills
- Class selection screen; second class; skill bar with 4+ slots and rebindable keys.
- Cooldown/charge data moved to JSON; skill upgrade hooks.
- *Exit:* two classes playable with 3+ skills each.

### ⬜ V1.4.0.00 — Progression
- XP, levels, stats, inventory, equipment, loot tables.
- Save/load (local) with save-version migration.
- *Exit:* a full level-up loop against basic enemies.

### ⬜ V1.5.0.00 — NPCs, quests, lore delivery
- Dialogue system with branching choices; quest log; world flags that record decisions.
- Storyline branching (decisions change later content). Lore content slots in as data.
- *Exit:* one quest chain with at least two meaningful branches.

### ⬜ V1.6.0.00 — Enemies and bosses
- AI states (idle/chase/attack/flee), aggro/threat, elite and boss framework with phases.
- Group-required boss encounter (designed for party roles even if bots fill in).
- *Exit:* one boss that is impractical solo.

### ⬜ V2.0.0.00 — Online foundation (major)
- Authoritative server (Node.js + WebSocket), client prediction, entity interpolation.
- Accounts, character persistence, chat, presence.
- Party system: invites, shared quests, real-party-only missions (not bots).
- *Exit:* two players in the same zone fighting the same boss.

### ⬜ V2.1.0.00 — Factions
- Single starting faction, then faction framework (reputation, vendors, quests).
- Second and third factions as the map expands.

### ⬜ V2.2.0.00 — Guilds
- Guild creation, ranks, bank, guild quests.

### ⬜ V2.3.0.00 — Territory and wars
- Territory control points, faction wars, guild wars, siege rules, rewards and anti-abuse rules.

### ⬜ V3.0.0.00 — Primordia complete (major)
- Content pass, balance pass, performance and security pass; public test.

## Proto (separate game)
Starts after Primordia stabilises: refined art, rebuilt systems informed by Primordia, same lore universe. Planning begins with a post-mortem of Primordia. 💡

## Standing technical goals
- ⬜ Desktop wrapper (Electron/Tauri) for a real Exit.
- ⬜ Automated tests for math, registries, damage rules.
- ⬜ Linting and formatting (Prettier + ESLint) in CI.
- ⬜ Asset pipeline and atlas packing.
- ⬜ Performance budget: 60 FPS with 3,000+ particles on mid-range hardware.
- ⬜ Accessibility: rebindable keys, colour-safe damage numbers, reduced-flash option.
- ⬜ Localisation-ready text.

## Cleanup digit backlog (`V1.x.x.NN`)
- Share the per-file `n()` particle-count helper from one module.
- Add JSDoc types for entity and skill contracts.
- Unit-test `ParticleSystem` bounce behaviour.
