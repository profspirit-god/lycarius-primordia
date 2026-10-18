import { Scene } from "../core/Scene.js";
import { Settings } from "../core/Settings.js";
import { GameAudio } from "../audio/AudioEngine.js";
import { progressionFor } from "../progression/Progression.js";

export class SettingsScene extends Scene {
  enter(game) {
    super.enter(game);
    const s = Settings.data;
    const el = document.createElement("div");
    el.className = "panel";
    el.innerHTML = `
      <h2 class="title" style="font-size:28px">SETTINGS</h2><div class="subtitle">Preferences</div>
      <div class="row"><label>Master volume</label><input type="range" min="0" max="1" step="0.05" data-k="masterVolume" value="${s.masterVolume}"></div>
      <div class="note">Applies to all game sounds.</div>
      <div class="row"><label>Particle quality</label>
        <select data-k="particleQuality" data-num="1">
          <option value="0.35" ${s.particleQuality == 0.35 ? "selected" : ""}>Low</option>
          <option value="0.7" ${s.particleQuality == 0.7 ? "selected" : ""}>Medium</option>
          <option value="1" ${s.particleQuality == 1 ? "selected" : ""}>High</option></select></div>
      <div class="row"><label>Screen shake</label><input type="checkbox" data-k="screenShake" ${s.screenShake ? "checked" : ""}></div>
      <div class="row"><label>Damage numbers</label><input type="checkbox" data-k="damageNumbers" ${s.damageNumbers ? "checked" : ""}></div>
      <div class="row"><label>Show debug (FPS)</label><input type="checkbox" data-k="showDebug" ${s.showDebug ? "checked" : ""}></div>
      <div class="row"><label>Show cast timer (debug)</label><input type="checkbox" data-k="debugCastTimer" ${s.debugCastTimer ? "checked" : ""}></div>
      <div class="note">Shows elapsed / total cast time above the player while charging. The total includes specialization cast-time bonuses.</div>
      <div class="row"><label>Dummy attacks</label><input type="checkbox" data-k="dummyAttacks" ${s.dummyAttacks ? "checked" : ""}></div>
      <div class="note">On: the dummy uses the player's stats (50 HP, 100 mana, same regen), fights back, and can be defeated.</div>
      <div class="row"><label>Dummy uses skills</label><input type="checkbox" data-k="dummySkills" ${s.dummySkills ? "checked" : ""}></div>
      <div class="note">On (needs Dummy attacks): the hostile dummy also raises its Flame Shield when threatened and casts Burn Resistance. Applies when you press Training Ground.</div>
      <div class="row"><label>Dummy movement</label>
        <select data-k="dummyMovement">
          <option value="off" ${s.dummyMovement === "off" ? "selected" : ""}>Stationary</option>
          <option value="patrol" ${s.dummyMovement === "patrol" ? "selected" : ""}>Patrol</option>
          <option value="strafe" ${s.dummyMovement === "strafe" ? "selected" : ""}>Strafe (circles you)</option></select></div>
      <div class="note">Applies when you press Start. Patrol walks a line; Strafe circles the player at range and reverses at random.</div>
      <details class="dev">
        <summary>Developer options</summary>
        <div class="note" style="margin:8px 0">Test panel. Edits the saved Mage progression (applies the next time you enter Training Ground).</div>
        <div class="devstatus" data-s></div>
        <div class="row"><label>XP amount</label><input type="number" min="1" step="1" value="100" data-xp></div>
        <div class="devgrid">
          <button class="btn sm" data-a="addChar">+ Character XP</button>
          <button class="btn sm" data-a="addSpec">+ Spec XP</button>
          <button class="btn sm" data-a="nextSpec">Next spec level</button>
          <button class="btn sm" data-a="resetProg">Reset progression</button>
        </div>
      </details>
      <button class="btn" data-a="reset">Reset to defaults</button>
      <button class="btn" data-a="back">Back</button>`;
    el.addEventListener("input", (e) => {
      const t = e.target,
        k = t.dataset.k;
      if (!k) return;
      Settings.set(
        k,
        t.type === "checkbox"
          ? t.checked
          : t.type === "range" || t.dataset.num
            ? Number(t.value)
            : t.value,
      );
      if (k === "masterVolume") GameAudio.preview();
    });
    const prog = progressionFor("mage");
    const status = el.querySelector("[data-s]"),
      amount = () => Math.max(1, Math.round(Number(el.querySelector("[data-xp]").value) || 0));
    const refresh = () => {
      const c = prog.char,
        sp = prog.specInfo;
      status.innerHTML = `Character Lv ${c.level} (${c.into} / ${c.need || "max"} XP)<br>Specialization Lv ${sp.level} / ${sp.max} (${sp.into} / ${sp.need || "max"} XP)<br>Bonus picks pending: ${prog.pendingLevels().length}`;
    };
    refresh();
    el.addEventListener("click", (e) => {
      const a = e.target.dataset?.a;
      if (a === "addChar") prog.addCharXp(amount());
      if (a === "addSpec") prog.addSpecXp(amount());
      if (a === "nextSpec") prog.addSpecXp(prog.specXpToNext());
      if (a === "resetProg") prog.reset();
      if (a === "addChar" || a === "addSpec" || a === "nextSpec" || a === "resetProg") refresh();
      if (a === "back") game.goto("home");
      if (a === "reset") {
        Settings.reset();
        game.goto("settings");
      }
    });
    this.ui.appendChild(el);
  }
  render(ctx, w, h) {
    ctx.fillStyle = "#0a0b10";
    ctx.fillRect(0, 0, w, h);
  }
}
