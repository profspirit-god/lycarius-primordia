// The first item content: the nine cosmetics of the placeholder Shop, as account-owned definitions (L2).
// Name, category and rarity live HERE; price and currency stay in the Shop offer (lobby/lobbyData.js SHOP) until L4 links
// an offer to an item id. tests/items.test.mjs keeps the two lists in step until then.
const cosmetic = (id, name, category, rarity, description) => ({
  id, name, description, category, rarity, scope: "account", maxStack: 1, actions: ["equip"],
});

export const COSMETIC_ITEMS = [
  cosmetic("ember_robe", "Ember Robe", "outfit", "rare", "A robe woven with glowing embers."),
  cosmetic("ashen_cloak", "Ashen Cloak", "outfit", "rare", "A cloak of grey ash that never quite settles."),
  cosmetic("primordial_garb", "Primordial Garb", "outfit", "epic", "Ancient garb from the first fires."),
  cosmetic("cinder_halo", "Cinder Halo", "aura", "common", "A ring of drifting cinders."),
  cosmetic("molten_veil", "Molten Veil", "aura", "epic", "A veil of slow molten light."),
  cosmetic("blue_flame_fireball", "Blue Flame Fireball", "effect", "epic", "Turns your Fireball blue."),
  cosmetic("spark_trail", "Spark Trail", "effect", "common", "Sparks that follow your steps."),
  cosmetic("bow_of_respect", "Bow of Respect", "emote", "common", "A formal bow."),
  cosmetic("fire_dance", "Fire Dance", "emote", "rare", "A short dance among flames."),
];
