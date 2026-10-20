# Art and maps (V1.10.0.03)

Owner decision (V1.10.0.03): **semi-pixelated** art. Read one section: `node tools/sec.mjs docs/ART_AND_MAPS.md <id>`. Status: **plan only, nothing built.** Sprites and maps are view/data work; the only sim part is the collision grid (T2).

## 1. Decisions

| # | Decision | Default |
| - | -------- | ------- |
| A-D1 | Style | Semi-pixelated: sprites and tiles are pixel art; glows, lights, particles, UI stay smooth |
| A-D2 | World unit | 1 world unit = 1 art pixel |
| A-D3 | Tile | 32x32 art px |
| A-D4 | Character frame | 32x48 art px (existing `radius 12`, `height 40` fit; verify in A2) |
| A-D5 | Screen scale | Integer `PIXEL_SCALE` 2 (default) or 3, Settings row; never fractional |
| A-D6 | Directions | One side drawn, mirrored for the other (`flip`); 4 or 8 rows only if the owner asks |
| A-D7 | Maps | Tiled (external, free) JSON; no custom editor |
| A-D8 | Fallback | Missing art draws today's cylinder; art never blocks a feature |

Changing A-D3/A-D4 after art exists means redrawing: change only with the owner.

## 2. Pixel rules (apply to every new draw call)

1. `ctx.imageSmoothingEnabled = false` for sprites and tiles only; restore after.
2. Draw sprites at integer screen coordinates; camera position snaps to whole screen pixels.
3. One `PIXEL_SCALE` for the whole world layer; UI (DOM) is not scaled by it.
4. Never rotate or non-uniformly scale a sprite; mirror only.
5. Keep pseudo-3D: sprite drawn at `y - z`; ground rings/shadows stay squashed 0.5 and smooth; hit tests stay circles in `(x, y)`.
6. Sprite files are PNG with transparency, power-of-two not required, sheet rows = animations.
7. No sprite or tile logic in sim code (R1, R5). Sim exposes `kind`, facing, animation state as plain data.

## 3. Track A: art intake (view only)

| Stage | Work | Needs | Done when |
| ----- | ---- | ----- | --------- |
| A1 | `src/view/sprites/manifest.js` (data), loader (lazy, `null` on failure, pattern of `lobby/assets.js`), `drawSprite(ctx,id,anim,t,x,y,facing)`, cylinder fallback, preload as a `loadTasks` task | S1f (entity `kind` + views) | Game identical with an empty manifest; one placeholder sprite replaces one cylinder; headless draw test with Proxy ctx, no NaN |
| A2 | `PIXEL_SCALE` in Camera + Settings row; smoothing and snapping rules (section 2); verify radius/height vs frame | A1 | Same sim results at scale 2 and 3; no shimmer when moving |
| A3 | Animation state from sim: `idle walk cast hurt dead` derived from plain fields (`mode`, `act.type`, speed, `stunT`) in the view | A1, S1h | Every entity kind has all 5 anims or falls back per-anim |
| A4 | Effects art (optional): projectile and status icons as sprites; particles stay procedural | A1 | Optional; owner decides |

Manifest entry (data; paths relative to repo root):

```js
mage: { src: "assets/sprites/mage.png", frame: [32, 48], anchor: [16, 44], scale: 1,
        anims: { idle: { row: 0, frames: 4, fps: 6, loop: true },
                 walk: { row: 1, frames: 6, fps: 10, loop: true },
                 cast: { row: 2, frames: 4, fps: 12, loop: false } } }
```

Adding an asset = drop a PNG in `assets/sprites/`, add one manifest entry. Lookup key = entity `kind`. No code change.

## 4. Track T: tiles and maps

| Stage | Work | Needs | Done when |
| ----- | ---- | ----- | --------- |
| T1 | Tileset + map format (section 5), loader and validator (`src/sim/map/`, Node-importable), placeholder colored tileset, render layer with cull and batch | A2 | Test map loads in Node and browser; invalid maps fail at load with a clear message |
| T2 | Collision grid in the sim (`solid` tiles block movement, projectiles stop or pass per tile flag); same data on server | T1, S1h | Headless test: entity cannot enter solid tile; projectile rule tested; audit debt not up |
| T3 | Objects layer: spawn points, zone exits, NPC points; `RaidSystem` spawns from map points | T2 | Raid spawns only on spawn points; exits listed |
| T4 | Two zones + transition via `game.goto`/world load, lazy `import()` of zone data as a loading task | T3, L10 | Walk through an exit; state kept per rules |
| T5 | Dev overlay (Settings developer toggle): draw collision, spawn points, grid cells | T2 | Toggle shows overlays; zero cost when off |

W2 spatial cell size must be a multiple of the tile size (32 or 64).

## 5. Map format (Tiled JSON export)

- Orthogonal, tile 32x32, finite maps, one tileset image per map (`assets/tiles/<name>.png`).
- Layers (names fixed): `ground` (tile layer), `decor` (tile layer, no collision), `collision` (tile layer; any non-zero = solid), `objects` (object layer).
- Object `type` values: `spawn_player`, `spawn_enemy`, `exit` (property `target` zone id), `npc` (property `id`). Unknown types are rejected.
- Tile properties: `solid` (bool), `blocksProjectiles` (bool), `height` (number, optional, T-later).
- Files: `assets/maps/<zone>.json`. Validator limits: width/height at most 256 tiles, objects at most 512, layer names exactly as above.
- Pre-export checklist for the owner: embed no external files, set tile size 32, name layers exactly, save as JSON.

## 6. Owner setup (Tiled, when T1 is reached)

1. Install Tiled from mapeditor.org (free).
2. New map: orthogonal, tile 32x32, size per zone.
3. Add tileset from `assets/tiles/<name>.png`, embed in map.
4. Create the four layers (section 5) with exact names.
5. File > Export As > JSON to `assets/maps/<zone>.json`.

## 7. Risks

- Redrawing if tile or frame size changes later. Mitigation: A-D3/A-D4 frozen.
- Shimmer or blur from fractional scale. Mitigation: integer `PIXEL_SCALE` only.
- Collision data in the view would break server authority. Mitigation: T2 lives in the sim.
- Art volume (5 anims x every kind x directions). Mitigation: mirror, per-anim fallback, cylinder fallback.
- Asset load time. Mitigation: lazy load plus loading task; monitor first frame under 1 s.
