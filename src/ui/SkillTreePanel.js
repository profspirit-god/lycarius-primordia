import { SPEC_BONUSES } from "../progression/SpecBonuses.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";

const pct = (v) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;

/**
 * Class specialization tree (DOM overlay, opened with K). A single path of levels:
 * Lv 1 starting skill, bonus levels (pick one of six), skill unlock levels.
 * Reads the player's Progression; picking calls prog.pick() then player.syncProgression().
 */
export class SkillTreePanel {
  constructor(world) {
    this.world = world;
    this.el = document.createElement("div");
    this.el.className = "panel tree";
    this.el.style.display = "none";
    this.el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-pick],[data-a]");
      if (!t) return;
      if (t.dataset.a === "close") world.closeTree();
      else if (t.dataset.pick && world.player.prog.pick(t.dataset.pick)) {
        world.player.syncProgression();
        this.render();
      }
    });
    world.ui.appendChild(this.el);
  }
  get isOpen() {
    return this.el.style.display !== "none";
  }
  open() {
    this.render();
    this.el.style.display = "";
  }
  close() {
    this.el.style.display = "none";
  }

  node(lv, prog) {
    const spec = prog.spec,
      reached = lv <= prog.specLevel,
      skillId = lv === 1 ? spec.start[0] : spec.unlocks[lv];
    let icon, name, kind, state;
    if (skillId) {
      const sk = SkillRegistry.get(skillId);
      icon = sk.icon;
      name = sk.name;
      kind = lv === 1 ? "Starting skill" : "Skill unlock";
      state = reached ? "done" : "locked";
    } else {
      const id = prog.picks[lv],
        b = SPEC_BONUSES.find((x) => x.id === id);
      icon = b ? b.icon : reached ? "❓" : "🔒";
      name = b ? b.name : reached ? "Choose a bonus" : "Bonus";
      kind = "Bonus";
      state = b ? "done" : reached ? "choose" : "locked";
    }
    return `<div class="node ${state} ${skillId ? "skill" : ""}"><div class="ni">${icon}</div><div class="nl">Lv ${lv}</div><div class="nn">${name}</div><div class="nk">${kind}</div></div>`;
  }

  totals(m) {
    const rows = [
      ["Max mana", `+${m.stats.maxMana}`],
      ["Mana regen", `+${m.stats.manaRegen.toFixed(2)}/s`],
      ["Cast time", pct(m.castTimeMult - 1)],
      ["Skill cooldown", pct(m.cooldownMult - 1)],
      ["Fire damage", pct(m.elementDamage)],
      ["Skill damage", pct(m.skillDamage)],
    ];
    return rows.map(([k, v]) => `<span><b>${v}</b> ${k}</span>`).join("");
  }

  render() {
    const p = this.world.player,
      prog = p.prog,
      spec = prog.spec,
      si = prog.specInfo,
      ci = prog.char,
      pending = prog.pendingLevels(),
      m = prog.mods();
    const nodes = Array.from({ length: spec.maxLevel }, (_, i) => this.node(i + 1, prog)).join("");
    const choices = pending.length
      ? `<div class="pick-title">Choose a bonus for specialization level ${pending[0]} <span>(${pending.length} pick${pending.length > 1 ? "s" : ""} available)</span></div>
         <div class="picks">${SPEC_BONUSES.map(
           (b) => `<button class="btn pick" data-pick="${b.id}"><span class="pi">${b.icon}</span><span><b>${b.name}</b><br><small>${b.text}${m.counts[b.id] ? ` · taken x${m.counts[b.id]}` : ""}</small></span></button>`,
         ).join("")}</div>`
      : `<div class="note" style="text-align:center">${si.level >= si.max ? "Specialization complete." : "No bonus to pick right now. Earn specialization XP to reach the next level."}</div>`;
    this.el.innerHTML = `
      <h2 class="title" style="font-size:26px">${p.cls.name.toUpperCase()} · ${spec.element.toUpperCase()}</h2>
      <div class="subtitle" style="margin-bottom:14px">Class specialization</div>
      <div class="lvline"><b>Specialization Lv ${si.level} / ${si.max}</b><span>${si.level >= si.max ? "MAX" : `${si.into} / ${si.need} XP`}</span></div>
      <div class="xpbar"><i style="width:${si.frac * 100}%;background:#f2c46d"></i></div>
      <div class="lvline dim"><span>Character Lv ${ci.level} (separate track)</span><span>${ci.into} / ${ci.need} XP</span></div>
      <div class="path">${nodes}</div>
      ${choices}
      <div class="totals">${this.totals(m)}</div>
      <button class="btn" data-a="close">Close (K / Esc)</button>`;
  }
}
