import "./content/index.js"; // registers skills + classes
import { Game } from "./core/Game.js";
import { Settings } from "./core/Settings.js";
import { GameAudio } from "./audio/AudioEngine.js";
import { MenuScene } from "./scenes/MenuScene.js";
import { SettingsScene } from "./scenes/SettingsScene.js";
import { ExitScene } from "./scenes/ExitScene.js";
import { WorldScene } from "./scenes/WorldScene.js";
import { PlaceholderScene } from "./scenes/PlaceholderScene.js";
import { CreatorSupportScene } from "./scenes/CreatorSupportScene.js";
import { HomeScene } from "./scenes/HomeScene.js";
import { ModeSelectScene } from "./scenes/ModeSelectScene.js";
import { LoadingScene } from "./scenes/LoadingScene.js";

Settings.load();
const game = new Game();
game.register("menu", () => new MenuScene());
game.register("settings", () => new SettingsScene());
game.register("exit", () => new ExitScene());
game.register("creator", () => new CreatorSupportScene());
game.register("home", () => new HomeScene());
game.register("modes", () => new ModeSelectScene());
game.register("loading", (params) => new LoadingScene(params));
game.register("world", (params) => new WorldScene(params));
game.register("campaign", () => new PlaceholderScene({
  title: "Campaign",
  blurb: "Single-player story mode.",
  plan: "Placeholder. Planned: branching story, quests and NPCs (see ROADMAP.md).",
  back: "modes",
}));
game.register("live", () => new PlaceholderScene({
  title: "Live Server",
  blurb: "The open-world MMORPG, played online.",
  plan: "Placeholder. Needs the V2.0.0.00 server-authoritative multiplayer work (see ROADMAP.md).",
  back: "modes",
}));

// Browsers block audio until the first user gesture.
for (const ev of ["pointerdown", "keydown"])
  window.addEventListener(ev, () => GameAudio.unlock(), { passive: true });
document.addEventListener("click", (e) => {
  if (e.target.closest?.(".btn, .chip, .play-btn, .lb-btn, .mode-card, .shop-panel, .genesis, .profile-btn, .bell, .tab, .item-buy")) GameAudio.ui();
});
document.addEventListener("visibilitychange", () =>
  GameAudio.setSuspended(document.hidden),
);

game.goto("menu");
game.start();
window.lycarius = { game }; // handy for console debugging
