/** Unified keyboard + mouse. Mouse buttons are codes "Mouse0" (left), "Mouse1", "Mouse2". */
export class Input {
  constructor(canvas) {
    this.down = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mouse = { x: 0, y: 0 };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target === document.body) e.preventDefault();
      if (!e.repeat) this._press(e.code);
    });
    window.addEventListener('keyup', (e) => this._release(e.code));
    canvas.addEventListener('mousedown', (e) => this._press('Mouse' + e.button));
    window.addEventListener('mouseup', (e) => this._release('Mouse' + e.button));
    window.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.down.clear());
  }
  _press(c) { if (!this.down.has(c)) this.pressed.add(c); this.down.add(c); }
  _release(c) { this.down.delete(c); this.released.add(c); }
  isDown(c) { return this.down.has(c); }
  wasPressed(c) { return this.pressed.has(c); }
  endFrame() { this.pressed.clear(); this.released.clear(); }
}
