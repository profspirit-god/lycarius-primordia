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
 * @property {number} [maxStamina]   Optional; 0 or missing means the entity has no stamina bar (Graugr keeps its own stamina field).
 * @property {number} [staminaRegen] Per second.
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
 * @property {number} [stunT]                         Seconds of stun left (0 = none), owned by StatusSystem.
 * @property {object|null} [manaBuff]                Running ManaRegenEffect { life, maxLife, mult, age }, if the owner used Mana Regen.
 * @property {object|null} [dodge]                    Running dodge { t, dur, iFr, fx, fy, tx, ty } (Player only).
 * @property {number} [lowStaminaFlash]               Set > 0 when a Dodge is refused for lack of stamina.
 * @property {object|null} [ward]                     Active BurnWardEffect, if the owner has cast Burn Resistance.
 * @property {(e: { damage: number, kind: string, source: object }, world: object) => void} [onDot]  Damage over time (burn tick).
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
 * @property {boolean} [instant]                      One key press fires it, no charge (Mana Regen, Dodge). SkillCaster checks cooldown, canStart(mana) and canUse(owner).
 * @property {(owner: CasterOwner) => boolean} [canUse]   Extra affordability check for instant skills (Dodge: stamina).
 * @property {(owner: CasterOwner) => void} [onDenied]    Called when canUse refuses (flash the stamina bar).
 * @property {(owner: CasterOwner) => number} [activeFrac] 0..1 shown on the HUD ring while the skill is active.
 * @property {string} [color]                         CSS colour for the HUD circle and ring (default orange).
 * @property {string} [costText]                      Cost shown in the character panel instead of the mana range.
 * @property {boolean} [self]                         Targets the caster only. AI casters skip it; Player draws an aura instead of the charge orb.
 * @property {boolean} [noAi]                        Player-only: enemy / dummy AI is not given this skill (Fire Blast).
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
 * @property {object} target                          Must have hittable=true; may implement onHit(e, world).
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
 * @property {{ duration: number }} [stun]            Stun offer: StatusSystem sets `target.stunT` (always applies).
 */

/**
 * Emitted on world.events as 'cast' when a skill is released.
 * @typedef {Object} CastEvent
 * @property {CasterOwner} owner
 * @property {number} charge
 * @property {SkillDef} skill
 * @property {number} [aim]                           Fireball only for now: aim angle at the release (radians).
 * @property {{x:number,y:number,z:number}} [origin]  Fireball only for now: where the cast came from.
 */

/**
 * Emitted on world.events as 'skill:charging' by SkillCaster on every step a hold-to-charge skill is held (S1f). Plain data only.
 * SkillViews feeds it to the skill's view (view/FireballCastView.js draws the charge look).
 * @typedef {Object} SkillChargingEvent
 * @property {CasterOwner} owner
 * @property {string} skill                           The skill id.
 * @property {number} charge                          0..1.
 * @property {number} aim
 * @property {{x:number,y:number,z:number}} origin
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
 * Emitted on world.events as 'manaRegen' by ManaRegen / ManaRegenEffect.
 * @typedef {Object} ManaRegenEvent
 * @property {'up'|'down'} type
 * @property {CasterOwner} owner
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {string} [reason]                        'expired' | 'downed' ('down').
 */

/**
 * Emitted on world.events as 'dodge' by Dodge when a dodge starts. DodgeFx draws the trail from owner.dodge.
 * @typedef {Object} DodgeEvent
 * @property {'start'} type
 * @property {CasterOwner} owner
 * @property {number} x                               Start point.
 * @property {number} y
 * @property {number} z
 * @property {{ x: number, y: number }} dir           Unit vector of the evade (backwards from the aim).
 * @property {number} distance
 * @property {number} duration
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
 * Emitted on world.events as 'projectile:fizzle' when a projectile's range runs out (S1f). Plain data only. FireballView draws the burst.
 * @typedef {Object} ProjectileFizzleEvent
 * @property {string} kind                            The projectile's view key ('fireball').
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} charge                          0..1.
 */

/**
 * Emitted on world.events as 'blast' by Fire Blast (self-centred AOE). The damage itself goes out as 'hit' events with aoe=true;
 * BlastFx draws the burst and AudioSystem plays the boom.
 * @typedef {Object} BlastEvent
 * @property {CasterOwner} source
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} radius                          Damage radius in px (caster centre to target body edge).
 * @property {string} element
 * @property {'fireBlast'} kind
 */

/**
 * Emitted on world.events as 'levelup' (re-emitted from Progression by WorldScene).
 * @typedef {Object} LevelUpEvent
 * @property {'char'|'spec'} track
 * @property {number} level                           The level just reached.
 * @property {string|null} [unlock]                   Skill id unlocked at this specialization level, if any.
 */

export {};
