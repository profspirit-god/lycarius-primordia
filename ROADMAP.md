# Roadmap

Current version: **V1.7.0.00**. Completed work is recorded in `CHANGELOG.md`; this file lists what is planned. Order is a guide, not a promise, and each step ships as its own version.

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
| V1.6.0.00 | Experience, class specialization tree, projectile clash and explosions, dummy uses skills, Campaign / Training Ground / Live Server menu, cast-timer debug, dev XP panel |
| V1.7.0.00 | Lobby menus: title menu (Play / Creator Support / Exit), Home scene, Shop, Mode Select, Training loading screen. All placeholders |

## Lobby path (for the next sessions)

The lobby shell exists with placeholder data. Everything below plugs into it without restructuring. Scenes: `menu` → `home` → `modes` → (`loading` →) `world` / `campaign` / `live`; `home` → `settings`. Scenes talk only through `game.goto(name, params)`. Placeholder content lives in `src/lobby/lobbyData.js`; shared helpers are `lobby/Wallet.js` and `ui/Modal.js`.

| Step | Work | Where it plugs in | Depends on |
| ---- | ---- | ----------------- | ---------- |
| L1 | Real art: Home character and scenery, mode pictures, Mode Select video, Training loading art | `HomeScene.render`, `.mode-pic`, `ModeSelectScene.render`, `LoadingScene` (`LOADING[target].art`) | Decision on asset loading (images / video files break the "no asset files" rule; needs the user's approval and a lazy-load plan) |
| L2 | Items and inventory data model: items as definitions in a `Registry` (`ItemRegistry`), registered in `content/index.js`; versioned save | Inventory button (placeholder modal in `HomeScene.openPlaceholder`) | None |
| L3 | Character customization: pick outfit / aura / skill effect and apply it in `Player.draw` / `drawCylinder` tint and `drawAura` | Character button; Shop cosmetics | L2 |
| L4 | Wallet persistence and the Shop buy flow (`Wallet.spend`, ownership check, versioned save), then server-side checks | `Wallet.js`, `HomeScene.openShop` (`data-a="buy"`) | L2 |
| L5 | Genesis Path: reward track data (free and premium lanes), XP source (play time / quests), claim UI. Subscription price and model are the user's decision | `GENESIS_PATH`, `HomeScene.openGenesis` | L2, L4 |
| L6 | Season Info and Rank: season calendar, ranked ladder and tiers | Bottom row placeholders | Rank needs V2.0.0.00 (server) |
| L7 | Messages inbox: subscribe the bell to events (system, creator, events); unread dot | `HomeScene.openMessages`, `MESSAGES` | EventBus |
| L8 | Profile and login (Google sign-in), friends, guild | Profile circle, `PROFILE` | V2.0.0.00 |
| L9 | Creator Support: real support links / provider and an idea form or community link. Ask the user which provider | `CreatorSupportScene` | User decision |
| L10 | Real loading: drive `LoadingScene.progress` from dynamic `import()` of zone / class data instead of the fixed timer; add `LOADING` entries for Campaign and Live | `LoadingScene` | World work (tilemap, zones) |
| L11 | Live Server and Campaign replace their `PlaceholderScene`s; Mode Select stats (players, ping, progress) come from real data | `MODES` in `lobbyData.js` | V2.0.0.00 / Campaign work |

Rules for this area: keep content as data in `lobbyData.js` (or registries once real); no direct imports between scenes; reuse `openModal`; keep the cosmetic-only shop rule (no gameplay power for sale) unless the user decides otherwise; one lobby feature per version.

## Next: combat depth (continued)

- Sprites and animation for characters (replace the plain cylinders; keep the pseudo-3D `(x, y, z)` model).
- Dummy behaviours beyond movement: dodging, retreating at low health.
- More status effects on the new `StatusSystem` (any skill can offer one through the `burn` field on its `hit` event).
- Skill hotkey rebinding and a Settings row for it.
- Make character level matter (stat growth per level) and add a respec option for the specialization tree.
- Second class and a second specialization element; explosions that can ignite; clash rules for other projectile types.

## Then: world

- Tilemap and collision replacing the infinite placeholder ground.
- Two zones and zone transitions; lazy-load zone data with dynamic `import()`.

## Later

1. More classes and skills; cooldowns and a skill bar.
2. Progression (levels and specialization exist; still to do): stats, items, inventory.
2b. **Campaign** (single-player story) and **Live Server** (online open world) replace the menu placeholders.
3. NPCs, dialogue, quests and branching story.
4. Enemies and bosses with reusable AI built on `SkillCaster`.
5. Desktop wrapper (real "Exit Game").
6. **V2.0.0.00**: server-authoritative multiplayer, parties and co-op missions.
7. Factions, guilds, guild wars and territory wars.
8. **Proto**: the refined second edition, as a separate repository.
