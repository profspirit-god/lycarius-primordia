import { Scene } from "../core/Scene.js";
import { SettingsPanel } from "../ui/SettingsPanel.js";

/** Lobby Settings: player preferences only. Dummy and developer options live in the in-game settings (see ui/SettingsPanel.js). */
export class SettingsScene extends Scene {
  enter(game) {
    super.enter(game);
    this.panel = new SettingsPanel({ parent: this.ui, context: "home", onExit: () => game.goto("home") });
  }
  update() {
    if (this.game.input.wasPressed("Escape")) this.panel.requestBack();
  }
  render(ctx, w, h) {
    ctx.fillStyle = "#0a0b10";
    ctx.fillRect(0, 0, w, h);
  }
}
