import { EventBus } from './EventBus.js';
import { Input } from './Input.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.ctx = this.canvas.getContext('2d');
    this.input = new Input(this.canvas);
    this.events = new EventBus();
    this.scenes = new Map();
    this.scene = null;
    this._last = 0;
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }
  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth; this.height = window.innerHeight;
    this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  register(name, factory) { this.scenes.set(name, factory); }
  goto(name, params) {
    this.scene?.exit();
    this.ui.replaceChildren();
    const make = this.scenes.get(name);
    if (!make) throw new Error(`Unknown scene "${name}"`);
    this.scene = make(params);
    this.scene.enter(this);
  }
  start() { requestAnimationFrame((t) => { this._last = t; this._loop(t); }); }
  _loop(t) {
    const dt = Math.min(0.05, (t - this._last) / 1000);
    this._last = t;
    this.scene?.update(dt);
    this.scene?.render(this.ctx, this.width, this.height);
    this.input.endFrame();
    requestAnimationFrame(this._loop);
  }
}
