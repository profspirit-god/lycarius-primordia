/**
 * Simulation: the input command (S1e). A player entity never reads a keyboard, a mouse or a camera; each tick it is handed one
 * command that says what the player wants. A local client builds it (`input/PlayerController.js`), a server will receive it over the
 * network and must treat it as untrusted (R11), so it is validated here, once, at the boundary.
 *
 *   seq  integer, rises by 1 per command; an older or repeated seq is ignored
 *   mx   steer left (-1) to right (+1)        my  steer up (-1) to down (+1)        both clamped to -1..1; a longer diagonal is scaled to length 1
 *   aim  facing in radians (0 = +x, y down), wrapped to -PI..PI
 *   btn  bitmask: bit i set = the player's i-th skill slot is held (Player.caster.slots order, which grows as skills unlock)
 *
 * A skill press is a rising edge of its bit (this tick set, last tick clear): the Player keeps the previous mask. Hold-to-charge
 * skills read the bit itself.
 */
export const MAX_SLOTS = 16; // bits a command carries; a class with more skills than this needs a wider mask
export const BTN_MASK = (1 << MAX_SLOTS) - 1;
export const MAX_SEQ = 2 ** 31 - 1;

/** @typedef {{ seq: number, mx: number, my: number, aim: number, btn: number }} InputCommand */

/** @returns {InputCommand} a command that does nothing */
export const idleCommand = () => ({ seq: 0, mx: 0, my: 0, aim: 0, btn: 0 });

const axis = (v) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

/**
 * Validate a raw command from an untrusted source. Returns a fresh clean command, or null when it is not newer than `lastSeq`
 * (a replayed or reordered packet). Bad numbers become 0, never an exception.
 * @param {any} raw
 * @param {number} lastSeq seq of the command applied last
 * @returns {InputCommand | null}
 */
export function sanitizeCommand(raw, lastSeq) {
  if (!raw || !Number.isInteger(raw.seq) || raw.seq <= lastSeq || raw.seq > MAX_SEQ) return null;
  let mx = axis(raw.mx),
    my = axis(raw.my);
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  let aim = Number.isFinite(raw.aim) ? raw.aim : 0;
  aim = Math.atan2(Math.sin(aim), Math.cos(aim)); // wrap into -PI..PI
  const btn = Number.isInteger(raw.btn) ? raw.btn & BTN_MASK : 0;
  return { seq: raw.seq, mx, my, aim, btn };
}
