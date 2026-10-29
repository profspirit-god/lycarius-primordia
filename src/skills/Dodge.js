const STAMINA_COST = 20; // stamina, paid when the dodge starts
const DISTANCE = 130; // px travelled, straight backwards from where the player is aiming
const TIME = 0.32; // seconds the roll takes (not instant); it decelerates, so it starts fast and settles
const IFRAMES = 0.18; // seconds from the start during which nothing can hit the dodger (0 = movement only)

/**
 * Universal ability (every class, see classes/Universal.js): evade backwards from point A to point B over `TIME` seconds.
 * 20 stamina, 25 s cooldown. It is an `instant` skill, so SkillCaster checks `canUse` (stamina) before it starts the cooldown.
 * The movement itself is Player.startDodge / stepDodge (sim); the yellow trail is systems/DodgeFx.js listening to 'dodge'.
 * Starting a dodge cancels any cast in progress and blocks new casts until it ends.
 */
/** @type {import('../types.js').SkillDef} */
export const Dodge = {
  id: "dodge",
  name: "Dodge",
  icon: "dodge",
  color: "#ffd23a",
  hint: "Shift",
  instant: true,
  cooldown: 25,
  chargeTime: 0,
  minCharge: 0,
  staminaCost: STAMINA_COST,
  distance: DISTANCE,
  duration: TIME,
  iFrames: IFRAMES,
  costText: `${STAMINA_COST} stamina`,

  manaCost() {
    return 0;
  },
  canStart() {
    return true;
  },
  canUse(owner) {
    return !owner.dodge && owner.vitals.stamina >= owner.vitals.staminaCost(STAMINA_COST);
  },
  /** Refused for lack of stamina: flash the bar. */
  onDenied(owner) {
    if (!owner.dodge && owner.vitals.stamina < owner.vitals.staminaCost(STAMINA_COST)) owner.lowStaminaFlash = 0.4;
  },
  isActive(owner) {
    return !!owner.dodge;
  },

  onRelease({ owner, world, aim }) {
    if (!owner.vitals.spendStamina(STAMINA_COST)) return;
    const a = aim + Math.PI; // backwards = away from where the player faces
    owner.caster.cancel();
    owner.startDodge(a, DISTANCE, TIME, IFRAMES);
    world.events.emit("dodge", {
      type: "start",
      owner,
      x: owner.x,
      y: owner.y,
      z: 0,
      dir: { x: Math.cos(a), y: Math.sin(a) },
      distance: DISTANCE,
      duration: TIME,
    });
  },
};
