import { icon } from "./icons.js";
import { PROFILE } from "../lobby/lobbyData.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { UNIVERSAL } from "../classes/Universal.js";

const pct = (v) => `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
const PLACEHOLDER = "--";

/**
 * Character panel, opened by clicking the profile circle in the HUD (DOM overlay; the game pauses while it is open).
 * Tabs: Info (level and specialization progress, resources) · Skills · Attributes · Equipment.
 * Everything marked "placeholder" is layout only: the data arrives with the item, attribute and guild systems (see ROADMAP.md).
 * The character and specialization levels live here (they used to be a panel in the bottom-left corner).
 */
export class ProfilePanel {
  constructor(world) {
    this.world = world;
    this.tab = "info";
    this.el = document.createElement("div");
    this.el.className = "panel profile";
    this.el.style.display = "none";
    this.el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-a]");
      if (!t) return;
      const a = t.dataset.a;
      if (a === "close") world.closeProfile();
      else if (a === "tab") { this.tab = t.dataset.t; this.render(); }
      else if (a === "tree") { world.closeProfile(); world.openTree(); }
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

  xp(label, info, color) {
    return `<div class="lvline"><b>${label} ${info.level}${info.max ? ` / ${info.max}` : ""}</b><span>${info.need ? `${info.into} / ${info.need} XP` : "MAX"}</span></div>
      <div class="xpbar"><i style="width:${info.frac * 100}%;background:${color}"></i></div>`;
  }
  stat(k, v) {
    return `<div><small>${k}</small><b>${v}</b></div>`;
  }

  infoTab(p, prog) {
    const v = p.vitals;
    const res = (ic, cls, label, cur, max) =>
      `<div class="pr-res ${cls}">${icon(ic)}<span>${label}</span><b>${cur} / ${max}</b></div>`;
    return `
      ${this.xp("Character Level", prog.char, "#6aa8ff")}
      ${this.xp(`${p.cls.specialization.element[0].toUpperCase()}${p.cls.specialization.element.slice(1)} Specialization Level`, prog.specInfo, "#f2c46d")}
      <div class="pr-res-row">
        ${res("heart", "hp", "Health", Math.ceil(v.hp), v.maxHp)}
        ${res("drop", "mp", "Mana", Math.floor(v.mana), v.maxMana)}
        ${res("bolt", "st", "Stamina", Math.floor(v.stamina), v.maxStamina)}
      </div>
      <div class="pf-grid">
        ${this.stat("Class", p.cls.name)}
        ${this.stat("Title", PROFILE.title)}
        ${this.stat("Guild", "None (placeholder)")}
        ${this.stat("Faction", "Unaligned (placeholder)")}
        ${this.stat("Raid kills", this.world.raid?.kills ?? 0)}
        ${this.stat("Playtime", PLACEHOLDER)}
      </div>`;
  }

  skillsTab(p) {
    const spec = p.cls.specialization,
      ids = [...spec.start, ...Object.values(spec.unlocks), ...UNIVERSAL.skills].filter((id, i, a) => a.indexOf(id) === i);
    const rows = ids
      .map((id) => {
        const sk = SkillRegistry.get(id),
          has = p.caster.has(id),
          lv = Object.entries(spec.unlocks).find(([, s]) => s === id)?.[0],
          lo = sk.manaCost(sk.minCharge),
          hi = sk.manaCost(1),
          cost = sk.costText ?? (lo === hi ? `${lo} MP` : `${lo}-${hi} MP`);
        return `<div class="pr-skill${has ? "" : " locked"}">
          <span class="pr-sic">${icon(has ? sk.icon : "lock")}</span>
          <div><b>${sk.name}</b><small>${sk.hint ?? ""} · ${cost} · ${sk.cooldown}s cooldown</small></div>
          <em>${has ? "Unlocked" : `Spec Lv ${lv}`}</em></div>`;
      })
      .join("");
    return `${rows}<button class="btn sm" data-a="tree">Open skill tree (K)</button>`;
  }

  attributesTab(p, prog) {
    const m = prog.mods(),
      s = p.stats;
    const core = ["Strength", "Agility", "Intellect", "Vitality", "Spirit", "Luck"]
      .map((k) => this.stat(k, PLACEHOLDER))
      .join("");
    return `
      <div class="pr-h">Core attributes <span>placeholder</span></div>
      <div class="pf-grid">${core}</div>
      <div class="pr-h">Derived stats</div>
      <div class="pf-grid">
        ${this.stat("Max health", s.maxHp)}
        ${this.stat("Health regen", `${s.hpRegen}/s`)}
        ${this.stat("Max mana", s.maxMana)}
        ${this.stat("Mana regen", `${s.manaRegen}/s`)}
        ${this.stat("Max stamina", s.maxStamina)}
        ${this.stat("Stamina regen", `${s.staminaRegen}/s`)}
        ${this.stat("Move speed", s.speed)}
        ${this.stat("Cast time", pct(m.castTimeMult - 1))}
        ${this.stat("Skill cooldown", pct(m.cooldownMult - 1))}
        ${this.stat("Skill damage", pct(m.skillDamage))}
        ${this.stat(`${p.cls.specialization.element} damage`, pct(m.elementDamage))}
      </div>`;
  }

  equipmentTab() {
    const slots = ["Head", "Chest", "Hands", "Legs", "Feet", "Weapon", "Off-hand", "Ring", "Amulet"];
    return `
      <div class="pr-h">Equipment <span>placeholder</span></div>
      <div class="pr-equip">${slots.map((s) => `<div class="slot"><small>${s}</small></div>`).join("")}</div>
      <div class="note" style="margin:12px 0 0;text-align:center">Items and equipment arrive with the inventory system (ROADMAP lobby path L2).</div>`;
  }

  render() {
    const p = this.world.player,
      prog = p.prog,
      [r, g, b] = p.cls.color,
      tabs = [["info", "Info"], ["skills", "Skills"], ["attributes", "Attributes"], ["equipment", "Equipment"]];
    const body = { info: () => this.infoTab(p, prog), skills: () => this.skillsTab(p), attributes: () => this.attributesTab(p, prog), equipment: () => this.equipmentTab() }[this.tab]();
    this.el.innerHTML = `
      <button class="pr-x" data-a="close" aria-label="Close">${icon("close")}</button>
      <div class="pr-top">
        <div class="pr-avatar" style="--cc:${r},${g},${b}">${icon("user")}</div>
        <div class="pr-id"><div class="pr-name">${PROFILE.name}</div>
          <div class="pr-sub">${p.cls.name} · ${p.cls.specialization.element} specialization</div></div>
        <div class="pr-lv"><small>Level</small><b>${prog.char.level}</b></div>
      </div>
      <div class="tabs">${tabs.map(([id, l]) => `<button class="tab${id === this.tab ? " on" : ""}" data-a="tab" data-t="${id}">${l}</button>`).join("")}</div>
      <div class="pr-body">${body}</div>
      <div class="pr-foot">Esc to close</div>`;
  }
}
