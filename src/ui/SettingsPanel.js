import { Settings, DEFAULTS } from "../core/Settings.js";
import { GameAudio } from "../audio/AudioEngine.js";
import { openModal } from "./Modal.js";

/**
 * One settings panel for both places it is used (view only, no sim code):
 *  - context "home": the lobby Settings scene. Player preferences only (Audio, Graphics, Interface).
 *  - context "game": opened from the in-game pause menu. Adds Training Dummy (test opponent) and Developer (debug overlays, XP tools).
 * Editing is STAGED: changes apply live (so you can hear and see them) but are only written to storage by Save.
 * Back with unsaved changes asks Save / Discard; Discard restores the values the panel opened with.
 * The footer (Reset, Save, Back) never scrolls away: the body scrolls, the footer stays.
 *
 * Add a setting: default in Settings.js, then one row object in SECTIONS below.
 */

const row = (k, label, type, extra = {}) => ({ k, label, type, ...extra });

const SECTIONS = [
  { id: "audio", title: "Audio", rows: [row("masterVolume", "Master volume", "range", { note: "Applies to all game sounds." })] },
  {
    id: "graphics",
    title: "Graphics",
    rows: [
      row("particleQuality", "Particle quality", "select", { num: true, options: [[0.35, "Low"], [0.7, "Medium"], [1, "High"]], note: "Fewer particles run better on slow machines." }),
      row("screenShake", "Screen shake", "check"),
    ],
  },
  { id: "interface", title: "Interface", rows: [row("damageNumbers", "Damage numbers", "check")] },
  {
    id: "training",
    title: "Training Dummy",
    ctx: "game",
    blurb: "Test opponent for the Training Grounds. Saving rebuilds the dummy right away.",
    rows: [
      row("dummyAttacks", "Dummy attacks", "check", { note: "On: the dummy uses the player's stats (50 HP, 100 mana, same regen), fights back, and can be defeated." }),
      row("dummySkills", "Dummy uses skills", "check", { note: "Needs Dummy attacks. The dummy also raises its Flame Shield when threatened and casts Burn Resistance." }),
      row("dummyMovement", "Dummy movement", "select", { options: [["off", "Stationary"], ["patrol", "Patrol"], ["strafe", "Strafe (circles you)"]], note: "Patrol walks a line; Strafe circles the player at range and reverses at random." }),
    ],
  },
  {
    id: "dev",
    title: "Developer",
    ctx: "game",
    dev: true,
    blurb: "For building and testing. Not needed to play.",
    rows: [
      row("showDebug", "Show debug (FPS)", "check"),
      row("debugCastTimer", "Show cast timer", "check", { note: "Elapsed / total cast time above the player while charging, including specialization cast-time bonuses." }),
    ],
  },
];

const esc = (v) => String(v).replace(/"/g, "&quot;");

function controlHtml(r, v) {
  if (r.type === "range") return `<input type="range" min="0" max="1" step="0.05" data-k="${r.k}" value="${v}"><output data-o="${r.k}">${Math.round(v * 100)}%</output>`;
  if (r.type === "check") return `<input type="checkbox" data-k="${r.k}" ${v ? "checked" : ""}>`;
  return `<select data-k="${r.k}" ${r.num ? 'data-num="1"' : ""}>${r.options.map(([val, name]) => `<option value="${esc(val)}" ${val == v ? "selected" : ""}>${name}</option>`).join("")}</select>`;
}

export class SettingsPanel {
  /**
   * @param {object} o
   * @param {HTMLElement} o.parent        overlay element to attach to (the scene's `ui`)
   * @param {'home'|'game'} o.context
   * @param {() => void} o.onExit         called after the panel closed itself (Back with nothing to save, Save+Back, Discard)
   * @param {(keys:string[]) => void} [o.onSaved]  keys that changed on Save (the world rebuilds the dummy from this)
   * @param {object} [o.progression]      a Progression (game context): enables the XP tools
   * @param {() => void} [o.onProgression] called after an XP tool ran (the world re-syncs the player)
   * @param {{ status: () => string, set: (percent: number) => string, eat: (percent: number) => string }} [o.hunger] game context (H2a): the
   *   Developer hunger tools. `status()` is the line shown above them; `set` and `eat` act on the player and return a short result line
   */
  constructor({ parent, context, onExit, onSaved, progression, onProgression, hunger }) {
    Object.assign(this, { parent, context, onExit, onSaved, progression, onProgression, hunger });
    this.sections = SECTIONS.filter((s) => !s.ctx || s.ctx === context);
    this.keys = this.sections.flatMap((s) => s.rows.map((r) => r.k));
    this.saved = Settings.snapshot(); // what is in storage now; Discard returns here
    this.modal = null;
    this.build();
    this.refreshState();
  }

  build() {
    const el = (this.el = document.createElement("div"));
    el.className = "panel settings";
    const game = this.context === "game";
    el.innerHTML = `
      <div class="st-head">
        <h2 class="title" style="font-size:26px">SETTINGS</h2>
        <div class="subtitle">${game ? "In-game · Training Grounds" : "Preferences"}</div>
        <nav class="st-nav">${this.sections.map((s) => `<button class="chip st-chip${s.dev ? " dev" : ""}" tabindex="-1" data-a="jump" data-to="${s.id}">${s.title}</button>`).join("")}</nav>
      </div>
      <div class="st-body" data-body>
        ${this.sections.map((s) => this.sectionHtml(s)).join("")}
      </div>
      <div class="st-foot">
        <div class="st-state" data-state></div>
        <div class="st-btns">
          <button class="btn sm" data-a="reset">Reset</button>
          <button class="btn sm primary" data-a="save">Save</button>
          <button class="btn sm" data-a="back">Back</button>
        </div>
      </div>`;
    el.addEventListener("input", (e) => this.onInput(e));
    el.addEventListener("click", (e) => this.onClick(e));
    this.body = el.querySelector("[data-body]");
    this.stateEl = el.querySelector("[data-state]");
    this.parent.appendChild(el);
    if (this.progression) this.refreshDevStatus();
    if (this.hunger) this.refreshHungerStatus();
  }

  sectionHtml(s) {
    const rows = s.rows
      .map((r) => `<div class="row"><label>${r.label}</label><span class="ctl">${controlHtml(r, Settings.get(r.k))}</span></div>${r.note ? `<div class="note">${r.note}</div>` : ""}`)
      .join("");
    const tools = s.dev && this.progression
      ? `<div class="st-sub">XP tools <small>(apply immediately, not part of Save)</small></div>
         <div class="devstatus" data-devstatus></div>
         <div class="row"><label>XP amount</label><input type="number" min="1" step="1" value="100" data-xpamount></div>
         <div class="devgrid">
           <button class="btn sm" tabindex="-1" data-a="addChar">+ Character XP</button>
           <button class="btn sm" tabindex="-1" data-a="addSpec">+ Spec XP</button>
           <button class="btn sm" tabindex="-1" data-a="nextSpec">Next spec level</button>
           <button class="btn sm danger" tabindex="-1" data-a="resetProg">Reset progression</button>
         </div>`
      : "";
    const hungerTools = s.dev && this.hunger
      ? `<div class="st-sub">Hunger tools <small>(apply immediately, not part of Save)</small></div>
         <div class="devstatus" data-hungerstatus></div>
         <div class="row"><label>Hunger amount (%)</label><input type="number" min="0" max="100" step="1" value="50" data-hungeramount></div>
         <div class="devgrid">
           <button class="btn sm" tabindex="-1" data-a="hungerSet">Set hunger to amount</button>
           <button class="btn sm" tabindex="-1" data-a="hungerEat">Eat amount</button>
         </div>`
      : "";
    return `<section class="st-sec${s.dev ? " dev" : ""}" data-sec="${s.id}"><h3>${s.title}</h3>${s.blurb ? `<div class="st-blurb">${s.blurb}</div>` : ""}${rows}${tools}${hungerTools}</section>`;
  }

  // ---- state --------------------------------------------------------------
  changedKeys() {
    return this.keys.filter((k) => Settings.get(k) !== this.saved[k]);
  }
  get dirty() {
    return this.changedKeys().length > 0;
  }
  refreshState() {
    const d = this.dirty,
      atDefault = this.keys.every((k) => Settings.get(k) === DEFAULTS[k]);
    this.el.classList.toggle("dirty", d);
    this.stateEl.textContent = d ? "Unsaved changes" : "All changes saved";
    this.el.querySelector('[data-a="save"]').disabled = !d;
    this.el.querySelector('[data-a="reset"]').disabled = atDefault;
  }
  /** Write the live values into the controls (after Reset). */
  syncControls() {
    for (const c of this.el.querySelectorAll("[data-k]")) {
      const v = Settings.get(c.dataset.k);
      if (c.type === "checkbox") c.checked = !!v;
      else c.value = v;
      const o = this.el.querySelector(`[data-o="${c.dataset.k}"]`);
      if (o) o.textContent = `${Math.round(v * 100)}%`;
    }
  }

  // ---- events -------------------------------------------------------------
  onInput(e) {
    const t = e.target,
      k = t.dataset.k;
    if (!k) return;
    Settings.preview(k, t.type === "checkbox" ? t.checked : t.type === "range" || t.dataset.num ? Number(t.value) : t.value);
    const o = this.el.querySelector(`[data-o="${k}"]`);
    if (o) o.textContent = `${Math.round(Number(t.value) * 100)}%`;
    if (k === "masterVolume") GameAudio.preview();
    this.refreshState();
  }

  onClick(e) {
    const b = e.target.closest("[data-a]");
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === "jump") this.el.querySelector(`[data-sec="${b.dataset.to}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (a === "reset") this.reset();
    else if (a === "save") this.save();
    else if (a === "back") this.requestBack();
    else if (a === "hungerSet" || a === "hungerEat") this.hungerAction(a);
    else if (this.progression) this.devAction(a);
  }

  /** Back to defaults for the settings on this panel. Still needs Save to be kept. */
  reset() {
    for (const k of this.keys) Settings.preview(k, DEFAULTS[k]);
    this.syncControls();
    this.refreshState();
    GameAudio.preview();
  }

  save() {
    const changed = this.changedKeys();
    Settings.save();
    this.saved = Settings.snapshot();
    this.refreshState();
    if (changed.length) this.onSaved?.(changed);
  }

  discard() {
    Settings.restore(this.saved);
    this.syncControls();
    this.refreshState();
  }

  /** Back / Esc. Nothing to save: leave. Otherwise ask. Esc with the question open keeps editing. */
  requestBack() {
    if (this.modal) return this.modal.close();
    if (!this.dirty) return this.close();
    this.modal = openModal(this.parent, {
      title: "UNSAVED CHANGES",
      html: `<p class="st-ask">Your changes are not saved yet. Save them, or discard them and go back?</p>
        <div class="pf-actions"><button class="btn sm primary" data-a="ask-save">Save</button><button class="btn sm danger" data-a="ask-discard">Discard</button></div>
        <div class="note" style="margin:10px 0 0">Close this box (X or Esc) to keep editing.</div>`,
      onClose: () => (this.modal = null),
    });
    this.modal.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "ask-save") { this.modal.close(); this.save(); this.close(); }
      else if (a === "ask-discard") { this.modal.close(); this.discard(); this.close(); }
    });
  }

  close() {
    this.destroy();
    this.onExit?.();
  }
  destroy() {
    this.modal?.close();
    this.el.remove();
  }

  // ---- developer XP tools (game context) -----------------------------------
  amount() {
    return Math.max(1, Math.round(Number(this.el.querySelector("[data-xpamount]")?.value) || 0));
  }
  refreshDevStatus() {
    const s = this.el.querySelector("[data-devstatus]");
    if (!s) return;
    const p = this.progression,
      c = p.char,
      sp = p.specInfo;
    s.innerHTML = `Character Lv ${c.level} (${c.into} / ${c.need || "max"} XP)<br>Specialization Lv ${sp.level} / ${sp.max} (${sp.into} / ${sp.need || "max"} XP)<br>Bonus picks pending: ${p.pendingLevels().length}`;
  }
  devAction(a) {
    const p = this.progression;
    if (a === "addChar") p.addCharXp(this.amount());
    else if (a === "addSpec") p.addSpecXp(this.amount());
    else if (a === "nextSpec") p.addSpecXp(p.specXpToNext());
    else if (a === "resetProg") return this.confirmResetProgression();
    else return;
    this.refreshDevStatus();
    this.onProgression?.();
  }
  /** Hunger percentage typed in the Developer tools: a whole number 0 to 100 (anything else counts as 0 or 100). */
  hungerAmount() {
    return Math.min(100, Math.max(0, Math.round(Number(this.el.querySelector("[data-hungeramount]")?.value) || 0)));
  }
  refreshHungerStatus(result = "") {
    const s = this.el.querySelector("[data-hungerstatus]");
    if (s) s.textContent = `${this.hunger.status()}${result ? `  ·  ${result}` : ""}`;
  }
  hungerAction(a) {
    const result = a === "hungerSet" ? this.hunger.set(this.hungerAmount()) : this.hunger.eat(this.hungerAmount());
    this.refreshHungerStatus(result);
  }
  confirmResetProgression() {
    const m = openModal(this.parent, {
      title: "RESET PROGRESSION",
      html: `<p class="st-ask">Erase all Mage levels, specialization and picks?</p>
        <div class="pf-actions"><button class="btn sm danger" data-a="yes">Reset</button><button class="btn sm" data-a="no">Cancel</button></div>`,
    });
    m.el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "yes") { this.progression.reset(); this.refreshDevStatus(); this.onProgression?.(); }
      if (a === "yes" || a === "no") m.close();
    });
  }
}
