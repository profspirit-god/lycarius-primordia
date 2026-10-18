/**
 * Shared JSDoc contracts. No runtime code: VS Code reads these for autocomplete and hover docs.
 * Reference them from any file with:  @type {import('../types.js').SkillDef}
 */

/**
 * Point in the pseudo-3D world. (x, y) is on the ground plane, z is height above it.
 * @typedef {{ x: number, y: number, z: number }} Origin3
 */

/**
 * @typedef {Object} ClassStats
 * @property {number} speed      Walk speed in px/s.
 * @property {number} radius     Collision radius.
 * @property {number} height     Cylinder height.
 * @property {number} maxHp
 * @property {number} maxMana
 * @property {number} hpRegen    Per second.
 * @property {number} manaRegen  Per second.
 */

/**
 * Class definition: pure data, registered in src/content/index.js.
 * @typedef {Object} ClassDef
 * @property {string} id
 * @property {string} name
 * @property {number[]} color                         RGB, 0-255.
 * @property {ClassStats} stats
 * @property {string[]} skills                        Skill ids from SkillRegistry (everything the class can ever learn).
 * @property {{ element: string, maxLevel: number, start: string[], unlocks: Object<number,string> }} specialization
 *   Class specialization tree: `start` skills at level 1, `unlocks` level -> skill id, every other level above 1 grants a bonus pick.
 * @property {Object<string, string[]>} bindings      skillId -> input codes (e.g. 'Mouse0', 'Space').
 */

/**
 * Anything that can cast skills through SkillCaster (player, hostile dummy, future enemies).
 * @typedef {Object} CasterOwner
 * @property {import('./systems/Vitals.js').Vitals} vitals
 * @property {number} aim                             Aim angle in radians.
 * @property {number} x
 * @property {number} y
 * @property {number} kick                            Recoil lean amount (decays on its own).
 * @property {number} lowManaFlash                    Set > 0 when a cast is refused for lack of mana.
 * @property {() => Origin3} getCastOrigin
 * @property {(slot: object, world: object) => boolean} wantsCast   True while the owner is holding the skill.
 * @property {(slot: object, world: object) => boolean} [wantsToggle] True on the frame a toggle skill key is pressed. Omit for casters that never toggle.
 * @property {object|null} [shield]                   Active FlameShieldEffect, if the owner has raised one.
 * @property {object|null} [burn]                     Running burn { t, dur, dps, ticks, fx, source }, owned by StatusSystem.
 * @property {object|null} [ward]                     Active BurnWardEffect, if the owner has cast Burn Resistance.
 * @property {(e: { damage: number, kind: string, source: object }) => void} [onDot]  Damage over time (burn tick).
 * @property {(x: number, y: number) => void} applyImpulse          Recoil / knockback.
 * @property {{ element: string, castTimeMult: number, cooldownMult: number, elementDamage: number, skillDamage: number }|null} [mods]
 *   Specialization modifiers (Player only). SkillCaster applies castTimeMult / cooldownMult; damage code uses progression/Mods.js.
 */

/**
 * Context handed to every skill hook.
 * @typedef {Object} SkillContext
 * @property {CasterOwner} owner
 * @property {object} world                           The active WorldScene.
 * @property {SkillDef} skill
 * @property {number} charge                          0..1
 * @property {number} aim
 * @property {Origin3} origin
 */

/**
 * Skill definition: registered in src/content/index.js, referenced by id from a class.
 * @typedef {Object} SkillDef
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} [element]                       Damage element, e.g. 'fire'. Matched against the caster's specialization element.
 * @property {number} cooldown                        Seconds.
 * @property {number} chargeTime                      Seconds to reach full charge.
 * @property {number} minCharge                       0..1; releasing below this cancels the cast.
 * @property {(charge: number) => number} [manaCost]
 * @property {(mana: number) => boolean} [canStart]
 * @property {(mana: number) => number} [maxAffordableCharge]
 * @property {(ctx: SkillContext) => void} [onChargeStart]
 * @property {(ctx: SkillContext, dt: number) => void} [onCharging]
 * @property {(ctx: SkillContext) => void} onRelease
 * @property {string} [hint]                          Key hint shown on the HUD slot.
 * @property {boolean} [toggle]                       Toggle skill: press on, press off. Needs isActive, onActivate, onDeactivate.
 * @property {boolean} [self]                         Targets the caster only. AI casters skip it; Player draws an aura instead of the charge orb.
 * @property {boolean} [autoRelease]                  Cast-time skill: fires the moment charge hits 1 (hold until the bar fills; releasing early cancels).
 * @property {object} [palette]                       Magic circle colours (see drawMagicCircle.js). Defaults to the fire palette.
 * @property {(owner: CasterOwner) => boolean} [isActive]
 * @property {(ctx: SkillContext) => void} [onActivate]
 * @property {(ctx: SkillContext) => void} [onDeactivate]
 */

/**
 * Emitted on world.events as 'hit' by anything that deals damage.
 * @typedef {Object} HitEvent
 * @property {object} source                          The attacker.
 * @property {object} target                          Must have hittable=true; may implement onHit(e).
 * @property {number} damage
 * @property {boolean} crit
 * @property {{ x: number, y: number }} dir           Unit vector of travel.
 * @property {number} charge                          0..1
 * @property {number} x
 * @property {number} y
 * @property {number} z                               Impact point.
 * @property {number} [resisted]                      Damage removed by the target's ward (damage is already reduced).
 * @property {boolean} [aoe]                          Explosion splash: HitEffects skips hit-stop and the big burst.
 * @property {{ chance: number, duration: number, dps: number }} [burn]  Ignition offer: StatusSystem rolls `chance`.
 */

/**
 * Emitted on world.events as 'cast' when a skill is released.
 * @typedef {Object} CastEvent
 * @property {CasterOwner} owner
 * @property {number} charge
 * @property {SkillDef} skill
 */

/**
 * Emitted on world.events as 'shield' by FlameShield / FlameShieldEffect.
 * @typedef {Object} ShieldEvent
 * @property {'up'|'hit'|'break'|'down'} type
 * @property {CasterOwner} owner
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} [absorbed]                      Damage the shield soaked ('hit', 'break').
 * @property {number} [passed]                        Damage that went through ('break').
 * @property {string} [reason]                        'manual' | 'starved' | 'downed' ('down').
 */

/**
 * Emitted on world.events as 'burn' by StatusSystem.
 * @typedef {Object} BurnEvent
 * @property {'ignite'|'tick'|'nullify'|'end'} type   'nullify' = a ward snuffed the burn. 'end' = it burned out.
 * @property {object} target
 * @property {number} x
 * @property {number} y
 * @property {number} z                               Body height point.
 * @property {number} [damage]                        Tick damage ('tick').
 */

/**
 * Emitted on world.events as 'ward' by BurnResistance / BurnWardEffect.
 * @typedef {Object} WardEvent
 * @property {'up'|'down'} type
 * @property {CasterOwner} owner
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} [reason]                        'expired' | 'spent' | 'downed' ('down').
 */

/**
 * Emitted on world.events as 'explosion' when two projectiles clash (ProjectileClash).
 * ExplosionSystem deals the area damage as 'hit' events with aoe=true; ExplosionFx draws it.
 * @typedef {Object} ExplosionEvent
 * @property {object} source                          Owner credited with the damage (the stronger ball; on ties, the one that detected the clash).
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} charge                          0..1 strength: sets radius (70-190 px) and damage (6-24 at the centre).
 * @property {'clash'} kind
 * @property {string} element
 */

/**
 * Emitted on world.events as 'levelup' (re-emitted from Progression by WorldScene).
 * @typedef {Object} LevelUpEvent
 * @property {'char'|'spec'} track
 * @property {number} level                           The level just reached.
 * @property {string|null} [unlock]                   Skill id unlocked at this specialization level, if any.
 */

export {};
