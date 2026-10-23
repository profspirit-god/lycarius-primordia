# Proposal: Account Inventory, Character Inventory, and Item Ownership

**Project:** Lycarius: Primordia  
**Document type:** Design and implementation proposal only  
**Status:** Adopted in stages by the owner. Phase A done, Phase B built in V1.13.0.00 and Phase C in V1.14.0.00 and Phase D in V1.15.0.00 (L2); every later phase needs its own owner approval. See section 13  
**Primary scope:** Home/Lobby inventory, in-game inventory, item definitions, ownership, and dependencies

> **Instruction to Claude:** This document is a proposal, not a command to implement everything. You may reject it, improve it, or integrate it as written. First compare it with the current repository, `Claude.md`, `ROADMAP.md`, `docs/ENGINES_AND_SYSTEMS.md`, and `SERVER_PATH.md`. Preserve established architecture and owner decisions. Do not claim a feature exists unless verified in code. Do not implement a phase until its prerequisites are checked and the owner approves the scope.

## Index and selective-reading guide

Read only the section needed for the current task, plus Sections 1, 2, 4, and 5 for shared constraints.

- **Section 1 — Goal and terminology:** required for all inventory work.
- **Section 2 — Current implementation audit:** read before changing connected code.
- **Section 3 — Proposed system boundaries:** read when deciding where a feature belongs.
- **Section 4 — Proposed item and ownership model:** read before defining item data or inventory state.
- **Section 5 — Dependency order and protected code:** mandatory before implementation.
- **Section 6 — Home/Account Inventory:** read only for the Home inventory feature.
- **Section 7 — In-game/Character Inventory:** read only for the gameplay inventory feature.
- **Section 8 — Related systems:** read only for the named related feature.
- **Section 9 — Persistence and online security:** read before save, economy, trading, or online integration.
- **Section 10 — Acceptance checks:** use for implementation and review.
- **Section 11 — Questions requiring owner decisions:** do not silently decide these.
- **Section 12 — Handoff rules** and **Section 13 — Adoption record:** what was decided and built, and where this file was corrected.

## 1. Goal and terminology

Design two related but distinct inventories. Do not treat Home promotional content, purchased ownership, and items physically carried by a character as one undifferentiated list.

- **Account Inventory:** account-owned items, unclaimed account rewards, and account-wide unlocks accessible from Home/Lobby.
- **Character Inventory:** items currently carried by a specific character for gameplay.
- **Item Definition:** static data describing an item type, such as ID, name, category, stack rules, rarity, and permitted actions.
- **Item Instance / Stack:** an owned copy or quantity of an item definition. Unique gear may require instance-specific data; stackable materials generally need a quantity.
- **Equipment:** the character's currently equipped items and their effects. It is related to, but not identical to, inventory.
- **Wallet:** balances of currencies. Currency is not an ordinary inventory item unless a later design explicitly requires physical currency objects.
- **Claimable Reward:** a reward earned but not yet transferred to its final ownership location.

Use these terms consistently in code, UI labels, comments, and tests. “Home inventory” is a UI location; “Account Inventory” is the ownership concept.

## 2. Current implementation audit — verify before edits

The uploaded repository snapshot shows the following relevant code. Re-check the active branch before acting because the working tree may differ from this snapshot.

### 2.1 Existing Home/Lobby

- `src/scenes/HomeScene.js`
  - Renders the Home/Lobby shell, currency line, Shop modal, Genesis Path modal, messages, and bottom-row buttons.
  - `onClick()` routes the `inventory` button through `openPlaceholder()` because it has no scene route.
  - `openPlaceholder()` currently renders empty placeholder slots. This is the initial UI integration point for Account Inventory, but should not own item rules or persistence.
  - `openShop()` reads `SHOP` and `Wallet`; the purchase button currently only displays a placeholder toast.
  - `openGenesis()` renders placeholder free/premium lanes. It does not implement a real reward track or claim flow.
- `src/lobby/lobbyData.js`
  - Holds placeholder `PROFILE`, `WALLET`, `SHOP`, `GENESIS_PATH`, `HOME_BUTTONS`, and `MESSAGES` data.
  - `HOME_BUTTONS` defines the Home Inventory and Character buttons.
  - Shop products are currently cosmetics represented as simple objects with `name`, `tab`, `price`, `cur`, and `rarity`; they do not have stable item IDs or ownership state.
- `src/lobby/Wallet.js`
  - In-memory placeholder wallet shared by Home and Shop.
  - `spend()` deducts a balance but is not connected to the purchase button and has no persistence or server authority.
- `src/ui/Modal.js` and `src/ui/icons.js`
  - Existing shared modal and icon helpers. Reuse them rather than introducing a separate modal framework or duplicate icon system.
- `css/style.css`
  - Existing application and lobby styling. Inspect current class names before adding styles; avoid broad selectors that could affect gameplay UI.

### 2.2 Existing content, registries, and saving

- `src/core/Registry.js` provides a generic ID-to-definition registry.
- `src/content/index.js` is the existing content manifest registering skills, classes, and specialization bonuses. Its comment explicitly anticipates later item definitions. If the item registry is approved, follow this central registration pattern rather than scattering item definitions across scenes.
- `src/core/LocalStorageAdapter.js` and `src/sim/storage.js` provide a versioned-adapter pattern currently used by progression. Do not assume the progression save already stores inventory or wallet data.
- `src/progression/Progression.js` and `src/scenes/WorldScene.js` save/load character progression. Do not merge inventory into progression by convenience without an explicit data-ownership design.
- `src/entities/Player.js` and `src/classes/*` relate to the current player and class behavior. Equipment-stat integration must be a separate, later decision; do not alter combat calculations while building a basic inventory UI.

### 2.3 Existing roadmap guidance

`ROADMAP.md`, under **Lobby path**, already defines:

- **L2:** item definitions in an `ItemRegistry`, registered through `src/content/index.js`, plus versioned save; plugs into the Home Inventory placeholder; no prerequisite listed.
- **L3:** character customization, applied through `Player.draw` / `drawCylinder` and `drawAura`; depends on L2.
- **L4:** wallet persistence, Shop purchase flow, ownership checks, and later server-side checks; depends on L2.
- **L5:** Genesis Path reward track and claim UI; depends on L2 and L4.

`docs/ENGINES_AND_SYSTEMS.md` identifies the item/inventory engine as planned L2 for definitions/data and M4 for item instances. `SERVER_PATH.md` and `docs/MMORPG_GUIDELINE.md` define the online/server path. Align with those plans; this proposal does not supersede them.

### 2.4 Current limitations that must remain explicit

- No complete inventory engine is confirmed in this snapshot.
- The Home inventory is a placeholder, not a functioning item collection.
- Shop data is placeholder content; purchases are not implemented.
- Wallet balances are in-memory placeholders and are not saved.
- Genesis Path has placeholder display only; reward claiming is not implemented.
- Account login, persistent online accounts, authoritative server transactions, and a production item database are not yet established by these files.

Do not describe any of these as implemented until verified against the active code.

## 3. Proposed system boundaries

### 3.1 Home/Lobby surfaces

- **Home Featured / News:** event announcements, patch notes, promotional cards, limited-time offer presentation, and links to relevant screens. This is presentation/content, not inventory storage.
- **Account Inventory:** owned account-wide cosmetics and unlocks; unclaimed rewards only if the reward flow explicitly stores them here.
- **Shop:** offers and purchase actions. Purchased items should be added to the correct ownership collection only after a successful transaction.
- **Genesis Path:** season progression, free/premium lanes, earned rewards, and claim actions. The pass screen is not the inventory.
- **Character Customization:** selects and equips owned cosmetics for the chosen character. Ownership and equipped state must be separate.
- **Wallet:** currency balances visible wherever useful. One canonical data source per currency scope.
- **Mailbox:** optional future delivery surface for gifts, compensation, or overflow rewards. Do not build until a real delivery requirement exists.

### 3.2 In-game surfaces

- **Character Inventory:** carried equipment, consumables, crafting materials, loot, quest items, and miscellaneous gameplay items.
- **Equipment panel:** currently equipped gear and relevant stats. It can be a tab or separate panel, but must use the same character ownership data.
- **Storage/Bank:** optional future container for items not carried. Do not assume it exists or add it to the first inventory milestone.
- **Loot and pickup interactions:** gameplay sources that grant items. They must use the same inventory rules as other grants, not directly edit UI state.
- **Trading:** optional future transfer between players; requires server authority and atomic ownership transfer. Not part of the first inventory implementation.

### 3.3 Ownership rules

Every item/reward must declare its intended scope:

- **Account-owned:** cosmetics, account-wide unlocks, and other items usable across characters where the design allows.
- **Character-owned:** equipment, consumables, materials, quest items, and items tied to one character.
- **Unclaimed reward:** a temporary state with a defined source and destination; do not create a third permanent ownership system without a requirement.
- **Currency:** account- or character-scoped according to an explicit rule. Do not infer scope from where the balance is displayed.

A UI may show an item in more than one place, but that must be a view of the same canonical ownership record, not duplicated ownership.

## 4. Proposed item and ownership model

This is a conceptual schema, not a mandate to use these exact field names. Claude should compare it with existing conventions and recommend the smallest compatible model before implementation.

### 4.1 Item definition

An item definition should contain only static shared properties, as needed:

- Stable unique `id`; never use display name as the persistent key.
- Display name and description.
- Category and optional subcategory.
- Rarity, icon/art reference, and optional display metadata.
- Ownership scope or allowed scope.
- Stackability and maximum stack size, if stackable.
- Allowed actions: use, equip, consume, sell, trade, discard, or open, where applicable.
- Optional equipment slot, stat modifiers, recipe/output, or reward-container definition only when those systems are approved.

Do not put a player's quantity, ownership, current equipment, or purchase history in the shared definition.

### 4.2 Owned item data

The owned record should identify:

- The item definition ID.
- The owner scope and owner ID when such IDs exist.
- Quantity for stackable items.
- A unique instance ID and instance-only properties for non-stackable or individually rolled items, if needed.
- Optional acquisition source/time only if useful for audit, support, or gameplay.

Do not add fields speculatively. Avoid mutable shared definition objects as player inventory state.

### 4.3 Initial item categories

**Account Inventory candidates:**

- Owned outfits/skins.
- Owned auras and visual effects.
- Owned emotes and titles.
- Account-wide collectibles and unlocks, if introduced.
- Unclaimed account rewards only when a defined claim flow uses this location.

**Character Inventory candidates:**

- Equipment: weapons, armor, helmets, gloves, boots, accessories.
- Consumables: potions, food, scrolls, and other usable items if added.
- Materials: ores, herbs, crafting components, monster drops, and upgrade materials.
- Quest items: keys, artifacts, clues, and mission objects.
- Reward containers: chests and boxes that can be opened through a defined reward rule.
- Miscellaneous: recipes, trade goods, collectibles, and access tokens when those mechanics exist.

These are planned categories, not claims that the corresponding content already exists. Do not invent a large item catalogue just to fill the interface.

## 5. Dependency order and protected code

Follow this order unless the owner explicitly approves a different sequence.

### Phase A — Audit and design (no behavior changes)

1. Read `Claude.md`, the relevant `ROADMAP.md` lobby path, `docs/ENGINES_AND_SYSTEMS.md`, and relevant `SERVER_PATH.md` sections.
2. Check the active branch, working tree, current tests, and any later inventory-related commits.
3. Trace the Home Inventory button, Shop data, wallet, registry/manifest, progression storage, and existing UI/modal conventions.
4. Present a short proposed schema and ownership decision list. Do not implement until approved.

### Phase B — Item definitions and registry (roadmap L2 foundation)

1. Implement only approved static item definitions and an `ItemRegistry` based on `src/core/Registry.js`.
2. Register definitions through `src/content/index.js`, preserving its existing registrations and import conventions.
3. Add tests for unique IDs, valid categories, required fields, stack rules, and lookup behavior as appropriate.
4. Do not yet implement equipment stat effects, Shop purchasing, Genesis Path claims, multiplayer, or a full inventory UI unless separately approved.

**Prerequisite:** approved item schema and registry placement.  
**Do not touch:** combat/damage/skill behavior, `Player.draw`, progression calculations, network/server architecture, or current registry behavior beyond the required additive registration.

### Phase C — Ownership state and local persistence

1. Decide account versus character ownership and define the first save boundary.
2. Create a small inventory service/model independent of DOM and scene rendering.
3. Validate grant, remove, stack, split/merge (if needed), and capacity rules before wiring UI.
4. Add versioned persistence using the repository's adapter pattern, without changing the existing progression save key or schema.
5. Add tests for round-trip saves, invalid/corrupt data, duplicate grants, invalid quantities, and failed mutations.

**Prerequisite:** Phase B and an approved save schema.  
**Do not touch:** `PROGRESS_KEY` or existing progression save shape; do not silently store inventory inside progression data. Do not represent localStorage as secure or authoritative for online play.

### Phase D — Home Account Inventory UI

1. Replace the Home Inventory placeholder with an Account Inventory view.
2. Render owned items from the inventory service; do not hardcode ownership in `HomeScene.js`.
3. Add category filters only for categories that exist in the data.
4. Show useful empty, loading/error, and item-detail states; actions must be enabled only when valid.
5. Reuse `openModal` and current styling conventions unless a separate screen is justified.

**Prerequisite:** tested item definitions and ownership service.  
**Do not touch:** Shop transaction behavior, Genesis Path reward claiming, or character combat logic. Do not label promotions as owned items.

### Phase E — Character Inventory UI and gameplay grants

1. Add a Character Inventory view with equipment, consumables, materials, quest items, containers, and miscellaneous filters as applicable.
2. Integrate one item source at a time, starting with a controlled test grant or an existing verified loot path.
3. Route pickups, rewards, and consumption through the inventory service; never modify UI arrays directly.
4. Define full-inventory behavior before connecting real loot: reject, leave loot in world, or another owner-approved rule.
5. Add tests for grants, stack limits, removal, invalid item IDs, and capacity handling.

**Prerequisite:** Phase C and approved character inventory rules.  
**Do not touch:** Graugr drop rates, combat damage, skill behavior, RNG/Marble Bag logic, or world simulation to fake inventory support. Connect to real loot only after tracing and approving the actual loot pipeline.

### Phase F — Shop ownership and wallet (roadmap L4)

1. Give each shop offer a stable item ID/reference and price/currency data.
2. On purchase, validate offer, price, currency, and existing ownership as appropriate.
3. Deduct currency and grant ownership as one logical transaction; failed purchases must not charge the player or grant the item.
4. Persist wallet and ownership consistently; add tests for insufficient funds, repeated clicks, already-owned items, and failures.
5. Keep the existing cosmetics-only shop rule: no gameplay power for sale unless the owner changes that rule.

**Prerequisite:** Phases B and C; the first version of item ownership must be stable.  
**Do not touch:** real-money top-ups, payment integrations, or server purchase claims unless separately designed and approved. Client-side `Wallet.spend()` alone is not safe for an online economy.

### Phase G — Character customization (roadmap L3)

1. Read owned cosmetics from account ownership.
2. Store equipped cosmetic selection separately from ownership.
3. Validate that the selected item is owned and compatible with the character/slot.
4. Apply visuals only after the ownership/equip model is tested.

**Prerequisite:** Phases B and C; coordinate with L3.  
**Do not touch:** `Player.draw`, `drawCylinder`, `drawAura`, or visual rendering until the customization data contract is agreed. Avoid changing combat stats for cosmetic-only items.

### Phase H — Genesis Path and event claims (roadmap L5)

1. Define reward IDs and reward destinations.
2. Define pass progression, claim eligibility, free/premium access, and duplicate-claim prevention.
3. Transfer claimed rewards through the same ownership/grant service used by other sources.
4. Add tests for locked tiers, duplicate claims, invalid rewards, and grant failures.

**Prerequisite:** Phases B, C, and L4 where wallet/premium ownership is involved.  
**Do not touch:** subscription pricing, payment flow, season XP rules, or premium entitlement assumptions without owner decisions. Home event banners remain presentation, not inventory data.

### Phase I — Online authority and trading (future; not first implementation)

When the live server and account/database path is ready, inventory mutations, purchases, loot grants, trades, and currency changes must be validated by the server. Client UI is a request/view layer, not the source of truth. Use atomic transactions and idempotency for operations that could duplicate or lose items.

**Prerequisite:** the relevant approved `SERVER_PATH.md` stages, accounts/persistence design, and owner approval.  
**Do not touch:** planned networking, database, or deployment files to create a premature parallel architecture. Do not add a database or dependency solely for the local prototype without approval.

## 6. Home / Account Inventory specification

### Purpose

Show what the account owns or can claim, especially account-wide cosmetics and unlocks. It is not the place for promotional banners or every gameplay item carried by a character.

### Suggested categories

- **All** — every account-inventory entry.
- **Outfits** — owned character outfits/skins.
- **Auras & Effects** — owned auras and visual effects, if these are account-wide cosmetics.
- **Emotes & Titles** — owned emotes and titles.
- **Collectibles** — account-wide collectibles if a real collection system exists.
- **Unclaimed** — only rewards explicitly assigned to the account claim queue.

Do not create empty tabs for features that have no data or implementation. Use data-driven categories.

### Item actions

- **Inspect:** show name, rarity, description, and relevant restrictions.
- **Equip/Use:** only if the item type supports it and the target character is valid.
- **Claim:** only for an eligible unclaimed reward.
- **Locate source:** optional; navigate to Shop, Genesis Path, or Event details when the source exists.

Ownership must not be created merely by previewing or clicking an offer. Shop offers belong in the Shop; event cards and news belong on Home Featured/News.

### Initial scope recommendation

Start with a read-only list of owned account cosmetics and a simple item-detail view. Add claim actions only after reward state and idempotency are implemented. Do not build mailbox, gifting, or event claim systems as part of the initial UI.

## 7. In-game / Character Inventory specification

### Purpose

Manage items belonging to the active character and used in gameplay. It should remain independent of scene rendering and be usable by loot, crafting, quests, and equipment systems later.

### Suggested categories

- **All**
- **Equipment**
- **Consumables**
- **Materials**
- **Quest Items**
- **Containers**
- **Miscellaneous**

Only show categories that have supported content. “Equipment” can later link to or share a view with the Equipment panel; it must not imply that every carried item is equipped.

### Minimum behavior to define before coding

- Item quantity and stack limits.
- Whether inventory capacity is slot-based, weight-based, or unlimited for the first prototype.
- Sort order and filtering behavior.
- Use, equip, consume, open, sell, discard, and trade eligibility by item definition.
- Full-inventory behavior for loot and quest rewards.
- Protection for quest-critical items.
- Whether equipment is stored as inventory instances plus an equipped reference, rather than removed from inventory on equip.

Recommendation: use inventory instances/stacks plus a separate equipped-item reference. This makes unequipping and ownership checks clearer. Confirm this against the intended equipment design before implementing.

### Initial scope recommendation

Build the data model and read-only inventory UI first. Add one controlled grant/removal path and tests. Do not implement crafting, durability, weight, trading, storage, item affixes, or equipment stat calculations unless separately approved.

## 8. Related systems — boundaries

### 8.1 Home Featured, Events, and promotional cards

**Belongs to:** Home/Lobby presentation and event data.  
**Does not belong to:** inventory ownership.  
Cards may link to Shop, Genesis Path, event information, or a claim screen. A card itself is not an owned item. If a promotional code grants an item, the code/reward flow must grant it through the ownership service.

### 8.2 Shop

**Belongs to:** offers, price/currency, purchase validation, and purchase result UI.  
**Depends on:** item definitions, ownership service, and wallet rules.  
Do not keep item ownership solely in `SHOP.items`; catalog entries are offers, not proof of ownership.

### 8.3 Wallet

Keep currency separate from item stacks unless physical currency is an explicit game mechanic. Each currency needs an explicit scope and permitted sources/sinks. Purchase and grant operations must be failure-safe. Home and Shop may render the same balance source but must not maintain separate copies.

### 8.4 Genesis Path

The pass owns progression and reward eligibility; inventory owns granted items. Claiming must be idempotent: the same reward cannot be granted repeatedly by repeated clicks, refreshes, or retries. Keep pass tiers and XP out of generic item definitions.

### 8.5 Character customization

Account ownership answers “does the account own this cosmetic?” Equipped selection answers “which cosmetic is this character currently using?” Do not combine these states. Cosmetic ownership must not grant combat power under the current cosmetic-only Shop rule.

### 8.6 Loot and RNG

Loot generation decides what is awarded; the inventory service validates and records the grant. Keep these responsibilities separate. Do not edit `src/sim/rng.js`, the Marble Bag proposal/engine, `Graugr.js`, or drop rates just to make inventory UI work. Before real loot integration, identify the actual authoritative loot source and its tests.

### 8.7 Equipment stats and combat

An item definition may eventually describe equipment modifiers, but applying them to player stats is a separate feature. Do not change `Player.js`, class stats, `DamageSystem`, skill files, or progression formulas during the initial inventory data/UI work. First propose and approve a stat aggregation contract and tests.

### 8.8 Storage and trading

Bank/storage and player-to-player trading are later features. Trading requires server-authoritative ownership checks, atomic transfer, and duplicate/loss prevention. Do not add these to the initial inventory milestone.

## 9. Persistence, migration, and online security

- Follow the existing storage-adapter pattern where appropriate, but create a separate versioned inventory save boundary unless the owner approves a unified schema.
- Never change `lycarius.primordia.progress` or its existing payload as a side effect of inventory work.
- Validate loaded data: unknown item IDs, invalid/negative quantities, malformed stacks, invalid owners, and unsupported save versions must not crash the game or create items.
- Preserve valid existing progression saves. Add migration tests if an existing inventory save schema changes.
- Browser localStorage is suitable only for prototype/local persistence. It can be edited by the player and is not authoritative for a live MMORPG economy.
- For online play, the server must validate item grants, purchases, consumption, equipment, and transfers. Never trust a client-submitted price, balance, item quantity, or reward claim.
- Avoid external dependencies unless the approved roadmap stage requires them.

## 10. Acceptance checks

A phase is not complete merely because its UI renders.

### Definitions and registry

- Every definition has a stable unique ID and required valid fields.
- Unknown IDs fail safely and are covered by tests.
- Existing skill/class/spec registrations still work.

### Ownership and persistence

- Account-owned and character-owned items cannot be confused.
- Stack quantities remain valid and obey defined limits.
- Save/load round-trips valid data.
- Corrupt or incompatible data does not create free items or crash the game.
- Inventory changes do not corrupt progression saves.

### UI

- Home Inventory shows account-owned data, not Shop offers.
- Character Inventory shows active-character items, not every account unlock.
- Empty states and unsupported actions are clear.
- All actions call the model/service; UI-only changes do not grant ownership.
- Modal close, Escape behavior, focus, and layout follow current UI conventions.

### Transactions and claims

- A failed purchase changes neither balance nor ownership.
- A successful purchase deducts and grants exactly once.
- A reward cannot be claimed twice.
- Invalid item IDs and quantities are rejected.
- Online implementations validate all consequential mutations server-side.

### Regression

Run the relevant tests and the repository's approved checks, including `npm test`, `npm run audit`, and `npm run docs` when applicable. Report failures accurately; do not modify unrelated code to hide a failing check.

## 11. Owner decisions required before implementation

Do not silently choose these questions when they affect architecture:

1. Is the first inventory milestone only a local prototype, or must it prepare a specific online API contract now?
2. Are cosmetics owned by the account and shared across all characters, or owned per character?
3. Is the first Character Inventory unlimited, slot-based, or weight-based?
4. Should equipment remain in inventory while equipped, with a separate equipped reference? Recommended: yes.
5. Should reward claims go directly to Account Inventory, Character Inventory, or a mailbox/claim queue depending on reward type?
6. Which currencies are account-scoped versus character-scoped? Current Gold, Crystals, and Points are placeholders; do not infer final rules from their labels.
7. Is Genesis Path free/premium access, season pricing, and reward eligibility ready to be specified, or should L5 remain untouched?
8. Should item selling, discarding, trading, and storage exist in the first playable inventory? Recommended: no.

## 12. Implementation handoff rules

Before changing code, Claude should return:

1. The exact files currently responsible for the requested feature and their call/data flow.
2. The relevant roadmap step and unmet prerequisites.
3. The smallest proposed change set, with files to modify and files explicitly left untouched.
4. Any conflicts between this proposal and current code or repository instructions.
5. Tests to add or run.

Then wait for owner approval if the scope, schema, ownership, persistence, or protected files would change. Implement one phase at a time. Update the roadmap only after the owner accepts the implementation and the feature is verified. This proposal alone does not authorize code edits.

## 13. Adoption record

### 13.1 Decisions taken (V1.13.0.00)

| Section 11 question | Decision | Applies from |
| ------------------- | -------- | ------------ |
| 1 First milestone | Local prototype only. New code follows `Claude.md` 5b (no browser, clock or random) so it can run on a server later | Phase B |
| 2 Cosmetic ownership | Account-wide (`scope: "account"`) | Phase B |
| 3 Character inventory capacity | Slot-based, one constant for the slot count (default, confirm at Phase E) | Phase E |
| 4 Equipped gear | Stays in the inventory, a separate equipped reference points at it (default) | Phase E |
| 5 Reward claims | Not decided; L5 stays untouched | Phase H |
| 6 Currency scope | Not decided; settle at L4. Saving the wallet turns the placeholder balances into real money, so a starting-balance rule is needed first | Phase F |
| 7 Genesis Path | Not ready; L5 stays untouched | Phase H |
| 8 Sell, discard, trade, storage | Not in the first playable inventory | Phase E |

### 13.2 Corrections to the original text

- The stylesheet is `css/style.css` (not `src/css/`).
- New simulation-side code lives in `src/sim/items/` and is audited as sim code; a new file must have zero audit hits.
- `Registry.get()` throws on an unknown id and `Registry.register()` replaces a duplicate silently. Item code therefore uses `findItem` / `hasItem` / `defineItem`; `Registry` is unchanged.
- Item definitions are validated, frozen and listed by id, never by registration order (`Claude.md` 5b R9).
- Item **instances** (unique ids, rolled properties) wait for M4, S1h and S5 (`SERVER_PATH.md`, assessment section 1). Phases B and C use stacks: an id and a quantity, with `maxStack: 1` for gear.
- "Character" means the class id today (progression is saved per class); real character ids arrive with accounts (S5).
- Until L4 links Shop offers to item ids, a test keeps `SHOP.items` and the cosmetic definitions in step (name, rarity, category).

### 13.3 Phase status

| Phase | Status |
| ----- | ------ |
| A Audit and design | Done (V1.13.0.00) |
| B Item definitions and `ItemRegistry` (L2) | **Built in V1.13.0.00**: `src/sim/items/ItemRegistry.js`, `cosmetics.js`, `tests/items.test.mjs`; nine cosmetics registered; nothing user-visible changed |
| C Ownership state and local persistence | **Built in V1.14.0.00**: `src/sim/items/Inventory.js`, `INVENTORY_KEY` in `core/LocalStorageAdapter.js`, `tests/inventory.test.mjs`; schema in 13.4; not wired into any scene |
| D Home Account Inventory UI | **Built in V1.15.0.00**: `src/ui/InventoryView.js`, `HomeScene.openInventory`, client `Inventory` in `main.js`, `tests/inventory-view.test.mjs`; read only (list, category tabs for owned categories, detail, empty / unavailable / newer-version / repaired states; Equip disabled until L3); no Claim, Shop or Genesis change |
| E to I | Not started |

### 13.4 Save schema, version 1 (Phase C, V1.14.0.00)

Built on the owner's request to work on Phase C; the schema below is the proposal that was implemented, and the owner can change it before Phase D relies on it. The decisions marked default are the ones to confirm.

| Item | Rule |
| ---- | ---- |
| Key and version | `lycarius.primordia.inventory`, `v: 1`. `PROGRESS_KEY` and the progression payload are untouched; a test compares the progression save byte for byte before and after grants |
| Shape | `{ v, account: { items: { id: qty } }, characters: { ownerId: { items: { id: qty } } } }`, keys in id order. Stacks only (an id and a quantity); instances wait for M4 |
| Collection | Chosen by the definition's `scope`, never by the caller. An account item with an owner id, or a character item without one, is refused |
| Account limit | At most `maxStack` of an id. A cosmetic (`maxStack` 1) is owned once; a second grant fails with `already_owned` |
| Character limit | Slot based, `ceil(qty / maxStack)` slots per id, `CHARACTER_SLOTS` = 30 (default, confirm at Phase E). Owner id = class id today (`^[a-z][a-z0-9_]{0,39}$`) |
| Failed calls | `unknown_item`, `bad_quantity`, `bad_owner`, `wrong_scope`, `already_owned`, `stack_full`, `inventory_full`, `not_enough`, `read_only`: nothing changes and nothing is saved |
| Bad data on load | An entry that is unknown, in the wrong collection, not an integer from 1 up, or over the account limit is dropped, never repaired into an item. `status` is `new`, `ok`, `repaired` or `corrupt`; a corrupt save starts empty and the next change replaces it |
| Newer version | A save with `v` above 1 is read-only: every change is refused so an older build cannot erase it (`status: newer_version`) |
| Not decided | Starting contents (none), currency scope (L4), claims (Phase H), equipped references (Phase E), grant-many in one step for the Shop (Phase F) |

localStorage is local prototype storage: the player can edit it, so it is not authoritative for an online economy (section 9).
