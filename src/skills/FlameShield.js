import { FlameShieldEffect } from "./FlameShieldEffect.js";

const CAST_COST = 10; // mana, once, on cast
const UPKEEP = 5; // mana per second while active
const POINTS = 50; // shield points

/**
 * Toggle skill: press to raise a flame arc in front of the caster, press again to drop it.
 * One shield per caster (`owner.shield`). Hit logic lives in FlameShieldEffect; projectiles call it.
 */
/** @type {import('../types.js').SkillDef} */
export const FlameShield = {
  id: "flameShield",
  name: "Flame Shield",
  icon: "shield",
  element: "fire",
  hint: "RMB / E",
  toggle: true,
  cooldown: 0.6, // after cast or drop, before it can be raised again
  chargeTime: 0,
  minCharge: 0,
  points: POINTS,
  upkeep: UPKEEP,

  manaCost() {
    return CAST_COST;
  },
  canStart(mana) {
    return mana >= CAST_COST;
  },
  isActive(owner) {
    return !!owner.shield;
  },

  onActivate({ owner, world }) {
    owner.vitals.spend(CAST_COST);
    owner.shield = world.spawn(
      new FlameShieldEffect({
        world,
        owner,
        points: POINTS,
        upkeep: UPKEEP,
        radius: owner.radius + 40,
        arc: (115 * Math.PI) / 180,
        height: 60,
      }),
    );
    world.events.emit("shield", {
      type: "up",
      owner,
      shield: owner.shield,
      x: owner.x,
      y: owner.y,
      z: 0,
    });
    owner.shield.fade(); // opening burst of embers
  },

  onDeactivate({ owner }) {
    owner.shield?.deactivate("manual");
  },

  onRelease() {},
};
