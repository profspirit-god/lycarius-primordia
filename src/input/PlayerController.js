/**
 * CLIENT ONLY: turns the keyboard, the mouse and the camera into this tick's InputCommand for the local player (S1e).
 * This is the only code that knows which key is which skill; the Player and the rest of the sim see a command and nothing else.
 * Call `update(player)` once per frame, before the entities update. A server has no controller: its commands arrive over the network.
 */
const AIM_Z = 32; // the cursor is read at body height so shots land where the sprite visually is
const LEFT = ["KeyA", "ArrowLeft"],
  RIGHT = ["KeyD", "ArrowRight"],
  UP = ["KeyW", "ArrowUp"],
  DOWN = ["KeyS", "ArrowDown"];

export class PlayerController {
  /** @param {{ input: object, camera: object, game: { width: number, height: number } }} world */
  constructor(world) {
    this.world = world;
    this.seq = 0;
  }

  update(player) {
    const { input, camera, game } = this.world;
    const any = (keys) => keys.some((k) => input.isDown(k));
    const m = camera.screenToWorld(input.mouse.x, input.mouse.y, game.width, game.height);
    const slots = player.caster.slots;
    let btn = 0;
    for (let i = 0; i < slots.length; i++) if (slots[i].keys.some((k) => input.isDown(k))) btn |= 1 << i;
    player.applyCommand({
      seq: ++this.seq,
      mx: Number(any(RIGHT)) - Number(any(LEFT)),
      my: Number(any(DOWN)) - Number(any(UP)),
      aim: Math.atan2(m.y + AIM_Z - player.y, m.x - player.x),
      btn,
    });
  }
}
