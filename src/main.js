import './content/index.js'; // registers skills + classes
import { Game } from './core/Game.js';
import { Settings } from './core/Settings.js';
import { MenuScene } from './scenes/MenuScene.js';
import { SettingsScene } from './scenes/SettingsScene.js';
import { ExitScene } from './scenes/ExitScene.js';
import { WorldScene } from './scenes/WorldScene.js';

Settings.load();
const game = new Game();
game.register('menu', () => new MenuScene());
game.register('settings', () => new SettingsScene());
game.register('exit', () => new ExitScene());
game.register('world', (params) => new WorldScene(params));
game.goto('menu');
game.start();
window.lycarius = { game }; // handy for console debugging
