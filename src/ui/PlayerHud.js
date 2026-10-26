import { icon } from "./icons.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { PROFILE } from "../lobby/lobbyData.js";
import { hungerBarModel } from "./hungerBar.js";

const RING_R = 26; // skill ring radius (px, in the 60 x 60 ring svg)
const RING_C = 2 * Math.PI * RING_R;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * In-game HUD (DOM, drawn over the canvas):
 *  - top-left card: profile circle (click = character panel) with the character level under it, the player name and,
 *    tight beside the circle, the health / mana / stamina / hunger bars (long and thin; hunger shows a percentage, H2a). Status-effect icons sit to the right of
 *    the card, outside its padding.
 *  - bottom-left: the skill circles (SVG icons, cooldown sweep, charge / shield / ward ring, key hint).
 * Reads the world every frame but only touches the DOM when a value changed. Nothing here changes gameplay.
 */
export class PlayerHud {
  constructor(world) {
    this.world = world;
    const p = world.player,
      [r, g, b] = p.cls.color;
    this.name = PROFILE.name;
    const bar = (id, label) => `<div class="hud-bar ${id}" title="${label}"><i data-f></i><u data-prev></u><b data-t></b></div>`;
    const root = (this.el = document.createElement("div"));
    root.className = "hud";
    root.innerHTML = `
      <div class="hud-tl">
        <div class="hud-left">
          <div class="hud-card">
            <div class="hud-id">
              <button class="hud-pfp" tabindex="-1" aria-label="Character profile" title="Character" style="--cc:${r},${g},${b}">${icon("user")}<i class="hud-pip" hidden></i></button>
              <div class="hud-lv" data-lv>Lv 1</div>
            </div>
            <div class="hud-main">
              <div class="hud-name">${this.name}</div>
              <div class="hud-bars">${bar("hp", "Health")}${bar("mp", "Mana")}${bar("st", "Stamina")}${bar("hg", "Hunger")}</div>
            </div>
          </div>
          <div class="hud-xp" data-xp></div>
        </div>
        <div class="hud-fx" data-fx></div>
      </div>
      <div class="hud-skills" data-skills></div>`;
    this.lv = root.querySelector("[data-lv]");
    this.pip = root.querySelector(".hud-pip");
    this.xp = root.querySelector("[data-xp]");
    this.fxBox = root.querySelector("[data-fx]");
    this.skillBox = root.querySelector("[data-skills]");
    this.bars = {};
    for (const id of ["hp", "mp", "st", "hg"]) {
      const el = root.querySelector(`.hud-bar.${id}`);
      this.bars[id] = { el, f: el.querySelector("[data-f]"), prev: el.querySelector("[data-prev]"), t: el.querySelector("[data-t]"), w: -1, txt: "" };
    }
    this.fx = new Map(); // key -> { el, t, bar, title, text, w }
    this.sig = ""; // skill layout signature; the circles are rebuilt only when it changes
    this.sk = [];
    this.stunMax = 1;
    const pfp = root.querySelector(".hud-pfp");
    pfp.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus off the button: Space is the fireball key
    pfp.addEventListener("click", () => world.toggleProfile());
    world.ui.appendChild(root);
    this.update();
  }

  setBar(id, frac, txt) {
    const b = this.bars[id],
      w = Math.round(clamp01(frac) * 1000) / 10;
    if (w !== b.w) { b.w = w; b.f.style.width = `${w}%`; }
    if (txt !== b.txt) { b.txt = txt; b.t.textContent = txt; }
  }

  update() {
    const world = this.world,
      p = world.player,
      v = p.vitals,
      prog = p.prog;

    // vitals
    this.setBar("hp", v.hp / v.maxHp, `${Math.ceil(v.hp)} / ${v.maxHp}`);
    this.setBar("mp", v.mana / v.maxMana, `${Math.floor(v.mana)} / ${v.maxMana}`);
    this.setBar("st", v.maxStamina ? v.stamina / v.maxStamina : 0, `${Math.floor(v.stamina)} / ${v.maxStamina}`);
    const cs = p.caster.chargingSlot,
      cost = cs ? cs.skill.manaCost(cs.charge) : 0,
      pv = this.bars.mp.prev; // preview of the mana the current cast will use
    if (cost > 0 && v.maxMana) {
      pv.style.display = "block";
      pv.style.left = `${(Math.max(0, v.mana - cost) / v.maxMana) * 100}%`;
      pv.style.width = `${(Math.min(cost, v.mana) / v.maxMana) * 100}%`;
    } else if (pv.style.display !== "none") pv.style.display = "none";
    this.bars.mp.el.classList.toggle("flash", p.lowManaFlash > 0);
    this.bars.mp.el.classList.toggle("boost", !!p.manaBuff); // Mana Regen running
    this.bars.st.el.classList.toggle("flash", p.lowStaminaFlash > 0);
    const hg = hungerBarModel(p.hunger), hb = this.bars.hg; // the fourth bar: a percentage after HP, Mana and Stamina
    this.setBar("hg", hg.frac, hg.text);
    if (hb.title !== hg.title) { hb.title = hg.title; hb.el.title = hg.title; }
    if (hb.tier !== hg.tier) { hb.tier = hg.tier; hb.el.dataset.tier = hg.tier; }

    // level, pending-pick pip, xp gain flash
    if (prog) {
      const lv = `Lv ${prog.char.level}`;
      if (this.lv.textContent !== lv) this.lv.textContent = lv;
      this.pip.hidden = prog.pendingLevels().length === 0;
    }
    const f = world.xpFlash;
    if (f.t > 0 && (f.char || f.spec)) {
      const txt = [f.char ? `+${f.char} XP` : "", f.spec ? `+${f.spec} spec XP` : ""].filter(Boolean).join("   ");
      if (this.xp.textContent !== txt) this.xp.textContent = txt;
      this.xp.style.opacity = clamp01(f.t / 0.6);
    } else if (this.xp.style.opacity !== "0") this.xp.style.opacity = "0";

    this.updateEffects(p);
    this.updateSkills(p, v);
  }

  // ---- status effects ----------------------------------------------------
  /** Show / refresh / remove one status icon. `d` = { icon, kind: "debuff"|"buff", frac, text, title } or null when inactive. */
  setFx(key, d) {
    let o = this.fx.get(key);
    if (!d) {
      if (o) { o.el.remove(); this.fx.delete(key); }
      return;
    }
    if (!o) {
      const el = document.createElement("div");
      el.className = `fx ${d.kind}`;
      if (d.tone) {
        el.style.color = d.tone;
        el.style.boxShadow = `0 0 8px ${d.tone}77`;
      }
      el.innerHTML = `${icon(d.icon)}<span class="fx-t"></span><i class="fx-bar"><b></b></i>`;
      o = { el, t: el.querySelector(".fx-t"), bar: el.querySelector(".fx-bar b"), title: "", text: "", w: -1 };
      this.fx.set(key, o);
      this.fxBox.appendChild(el);
    }
    const w = Math.round(clamp01(d.frac) * 100);
    if (w !== o.w) { o.w = w; o.bar.style.width = `${w}%`; }
    if (d.text !== o.text) { o.text = d.text; o.t.textContent = d.text; }
    if (d.title !== o.title) { o.title = d.title; o.el.title = d.title; }
  }

  updateEffects(p) {
    const b = p.burn;
    this.setFx("burn", b && {
      icon: "flame", kind: "debuff", frac: 1 - b.t / b.dur, text: `${Math.ceil(Math.max(0, b.dur - b.t))}`,
      title: `Burning: ${(b.dps * (p.ward ? 1 - p.ward.burnReduction : 1)).toFixed(0)} damage per second, ${Math.max(0, b.dur - b.t).toFixed(1)}s left`,
    });
    if (p.stunT > 0) this.stunMax = Math.max(this.stunMax, p.stunT);
    else this.stunMax = 1;
    this.setFx("stun", p.stunT > 0 && {
      icon: "stun", kind: "debuff", frac: p.stunT / this.stunMax, text: p.stunT.toFixed(1), title: `Stunned: cannot move or cast (${p.stunT.toFixed(1)}s)`,
    });
    const w = p.ward;
    this.setFx("ward", w && {
      icon: "ward", kind: "buff", frac: w.life / w.maxLife, text: `${Math.ceil(w.life)}`, title: `Burn Resistance: ${Math.ceil(w.life)}s left`,
    });
    const mb = p.manaBuff;
    this.setFx("manaRegen", mb && {
      icon: "manaRegen", kind: "buff", tone: "#5ab4ff", frac: mb.life / mb.maxLife, text: `${Math.ceil(mb.life)}`, title: `Mana Regen: x${mb.mult} mana regeneration, ${Math.ceil(mb.life)}s left`,
    });
    const s = p.shield;
    this.setFx("shield", s && {
      icon: "shield", kind: "buff", frac: s.points / s.maxPoints, text: `${Math.ceil(s.points)}`, title: `Flame Shield: ${Math.ceil(s.points)} / ${s.maxPoints} points (-${s.upkeep} MP/s)`,
    });
  }

  // ---- skills ------------------------------------------------------------
  rebuildSkills(p, locked) {
    const slots = p.caster.slots;
    this.skillBox.replaceChildren();
    this.sk = [];
    const mk = (cls, ic, label, title, tone) => {
      const el = document.createElement("div");
      el.className = `sk ${cls}`;
      if (tone) el.style.setProperty("--tone", tone);
      el.title = title;
      el.innerHTML = `<div class="sk-btn">${icon(ic)}<span class="sk-cd"></span>
        <svg class="sk-ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}"/></svg></div>
        <small>${label}</small>`;
      this.skillBox.appendChild(el);
      return { el, ring: el.querySelector("circle"), cd: -1, rf: -1, state: "" };
    };
    for (const s of slots) {
      const sk = s.skill,
        o = mk("", sk.icon, sk.hint ?? "", sk.name, sk.color);
      o.slot = s;
      this.sk.push(o);
    }
    for (const [lv, id] of locked) mk("locked", "lock", `SPEC Lv ${lv}`, `${SkillRegistry.get(id).name} (unlocks at specialization level ${lv})`);
  }

  updateSkills(p, v) {
    const locked = Object.entries(p.cls.specialization.unlocks).filter(([, id]) => !p.caster.has(id)),
      sig = `${p.caster.slots.map((s) => s.skill.id).join(",")}|${locked.map(([lv]) => lv).join(",")}`;
    if (sig !== this.sig) { this.sig = sig; this.rebuildSkills(p, locked); }
    for (const o of this.sk) {
      const s = o.slot,
        sk = s.skill,
        on = !!sk.isActive?.(p),
        cd = clamp01(s.cooldown / (s.cdMax || sk.cooldown || 1)),
        frac = sk.activeFrac ? sk.activeFrac(p) : sk.toggle ? (on && p.shield ? p.shield.points / p.shield.maxPoints : 0) : on && p.ward ? p.ward.life / p.ward.maxLife : s.charge,
        blocked = sk.canUse ? !sk.canUse(p) : !sk.canStart(v.mana), // not enough mana (or stamina for Dodge)
        state = (s.charging || on ? "on " : "") + (!s.charging && !on && blocked ? "nomana" : "");
      const cdq = Math.round(cd * 360);
      if (cdq !== o.cd) { o.cd = cdq; o.el.style.setProperty("--cd", `${cdq}deg`); }
      const rq = Math.round(clamp01(frac) * 200);
      if (rq !== o.rf) { o.rf = rq; o.ring.style.strokeDashoffset = (RING_C * (1 - rq / 200)).toFixed(2); }
      if (state !== o.state) { o.state = state; o.el.className = `sk ${state}`; }
    }
  }
}
