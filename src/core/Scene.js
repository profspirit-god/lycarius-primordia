/** Base scene. Subclasses must call super.enter(game). */
export class Scene {
  enter(game) { this.game = game; this.ui = game.ui; }
  exit() {}
  update(dt) {}
  render(ctx, w, h) {}
}
