/**
 * Universal abilities: every playable class gets these on top of its own skills, with no unlock level.
 * Pure data, like a class. Player.syncProgression adds them to the caster; the HUD shows them after the class skills.
 */
export const UNIVERSAL = {
  skills: ["dodge"],
  bindings: { dodge: ["ShiftLeft", "ShiftRight"] },
};
