# Roadmap

Current version: **V1.5.0.00**. Completed work is recorded in `CHANGELOG.md`; this file lists what is planned. Order is a guide, not a promise, and each step ships as its own version.

## Done

| Version  | Content                                                                 |
| -------- | ----------------------------------------------------------------------- |
| V1.0.0.00 | MVP: menu, settings, Mage, Fireball, training dummy, effect stack      |
| V1.1.0.00 | Vitals (health, mana), mana-cost Fireball, hostile dummy               |
| V1.2.0.00 | Procedural audio engine and positional sound                           |
| V1.2.0.01 | Cleanup: shared helpers, JSDoc contracts                               |
| V1.3.0.00 | Moving dummy: Stationary, Patrol and Strafe modes                      |
| V1.4.0.00 | Magic circle casting, Flame Shield (toggle skill with shield points)   |
| V1.5.0.00 | Burn status effect, Burn Resistance (cast-time self buff, nullify toast) |

## Next: combat depth (continued)

- Sprites and animation for characters (replace the plain cylinders; keep the pseudo-3D `(x, y, z)` model).
- Dummy behaviours beyond movement: dodging, retreating at low health.
- Hostile dummy that raises its own Flame Shield (the shield already works for any caster that implements `wantsToggle`) and casts its own Burn Resistance (the skill is flagged `self`, so the AI currently skips it).
- More status effects on the new `StatusSystem` (any skill can offer one through the `burn` field on its `hit` event).
- Skill hotkey rebinding and a Settings row for it.

## Then: world

- Tilemap and collision replacing the infinite placeholder ground.
- Two zones and zone transitions; lazy-load zone data with dynamic `import()`.

## Later

1. More classes and skills; cooldowns and a skill bar.
2. Progression: levels, stats, items, inventory.
3. NPCs, dialogue, quests and branching story.
4. Enemies and bosses with reusable AI built on `SkillCaster`.
5. Desktop wrapper (real "Exit Game").
6. **V2.0.0.00**: server-authoritative multiplayer, parties and co-op missions.
7. Factions, guilds, guild wars and territory wars.
8. **Proto**: the refined second edition, as a separate repository.
