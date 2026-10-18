import { Scene } from "../core/Scene.js";
import { ParticleSystem } from "../systems/ParticleSystem.js";
import { drawCylinder } from "../render/drawCylinder.js";
import { drawCover } from "../render/drawCover.js";
import { rand } from "../core/math.js";
import { VERSION_LABEL } from "../config.js";
import { openModal } from "../ui/Modal.js";
import { Wallet } from "../lobby/Wallet.js";
import { PROFILE, SHOP, GENESIS_PATH, HOME_BUTTONS, MESSAGES, ART } from "../lobby/lobbyData.js";
import { loadImage, loadVideo } from "../lobby/assets.js";

const RARITY = { common: "#9aa3b2", rare: "#5aa8ff", epic: "#c27bff" };

/**
 * Home / lobby (PUBG-style). Layout (all DOM over the canvas):
 *  top-left profile circle · top-right currency line + bell · shop panel under it · Genesis Path under the shop
 *  bottom-left Play · bottom row: inventory, character, season, rank, settings.
 * The canvas draws a placeholder scenery and character; replace with the real 3D / sprite showcase later.
 */
export class HomeScene extends Scene {
  enter(game) {
    super.enter(game);
    this.t = 0;
    this.bg = null;
    this.bgFade = 0;
    this.modals = [];
    this.particles = new ParticleSystem(400);
    const el = (this.root = document.createElement("div"));
    el.className = "lobby";
    el.innerHTML = `
      <div class="lb-tl">
        <button class="profile-btn" data-a="profile" aria-label="Profile"><span>${PROFILE.name[0]}</span></button>
        <div class="profile-meta"><b>${PROFILE.name}</b><small>Lv ${PROFILE.level} · ${PROFILE.id}</small></div>
        <button class="chip" data-a="title">‹ Title</button>
      </div>
      <div class="lb-tr">
        <div class="curbar" data-cur>${Wallet.barHtml()}</div>
        <button class="bell" data-a="bell" aria-label="Messages">🔔<i class="dot"></i></button>
      </div>
      <div class="lb-right">
        <button class="shop-panel" data-a="shop">
          <div class="sp-head"><b>SHOP</b><small>Cosmetics</small></div>
          <div class="sp-tiles"><i>▲</i><i>●</i><i>◆</i></div>
          <div class="sp-foot">Tap to open</div>
        </button>
        <button class="genesis" data-a="genesis">
          <div class="gn-head"><b>${GENESIS_PATH.name.toUpperCase()}</b><small>${GENESIS_PATH.blurb}</small></div>
          <div class="gn-track"><i style="width:${(GENESIS_PATH.tier / GENESIS_PATH.tiers) * 100}%"></i></div>
          <div class="gn-foot">Tier ${GENESIS_PATH.tier} / ${GENESIS_PATH.tiers}</div>
        </button>
      </div>
      <div class="lb-bottom">
        <button class="play-btn" data-a="play">PLAY</button>
        <div class="lb-row">
          ${HOME_BUTTONS.map((b) => `<button class="lb-btn" data-a="btn" data-id="${b.id}"><i>${b.icon}</i><span>${b.label}</span></button>`).join("")}
        </div>
        <div class="lb-ver">${VERSION_LABEL}</div>
      </div>
      <div class="lobby-toast" data-toast></div>`;
    el.addEventListener("click", (e) => this.onClick(e));
    this.ui.appendChild(el);
    loadImage(ART.homeScenery).then((img) => { if (this.game.scene === this) this.bg = img; });
    loadVideo(ART.modeVideo); // warm the Mode Select video so it starts instantly
  }

  toast(msg) {
    const t = this.root.querySelector("[data-toast]");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove("on"), 1800);
  }
  refreshWallet() {
    this.root.querySelectorAll(".curbar").forEach((b) => (b.innerHTML = Wallet.barHtml()));
  }
  modal(opts) {
    const m = openModal(this.root, { ...opts, onClose: () => (this.modals = this.modals.filter((x) => x !== m)) });
    this.modals.push(m);
    return m;
  }

  onClick(e) {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (!a) return;
    const d = e.target.closest("[data-a]").dataset;
    if (a === "play") this.game.goto("modes");
    else if (a === "title") this.game.goto("menu");
    else if (a === "profile") this.openProfile();
    else if (a === "shop") this.openShop();
    else if (a === "genesis") this.openGenesis();
    else if (a === "bell") this.openMessages();
    else if (a === "topup") this.toast("Currency top-up is a placeholder.");
    else if (a === "btn") {
      const b = HOME_BUTTONS.find((x) => x.id === d.id);
      if (b.scene) this.game.goto(b.scene);
      else this.openPlaceholder(b);
    }
  }

  openProfile() {
    this.modal({
      title: "PLAYER PROFILE",
      html: `<div class="pf-top"><div class="pf-avatar">${PROFILE.name[0]}</div>
          <div><div class="pf-name">${PROFILE.name}</div><div class="pf-mail">${PROFILE.email}</div><div class="pf-mail">${PROFILE.title} · Lv ${PROFILE.level}</div></div></div>
        <div class="pf-grid">${[["Player ID", PROFILE.id], ...PROFILE.fields].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("")}</div>
        <div class="pf-actions"><button class="btn sm" disabled>Edit profile</button><button class="btn sm" disabled>Link Google account</button><button class="btn sm" disabled>Sign out</button></div>
        <div class="note" style="margin:10px 0 0">Placeholder: real account, stats and friends come with the online work.</div>`,
    });
  }

  openShop() {
    let tab = "featured";
    const items = () => (tab === "featured" ? SHOP.items.filter((_, i) => i % 3 === 0 || i === 5) : SHOP.items.filter((i) => i.tab === tab));
    const body = () => `
      <div class="curbar shop-cur" data-cur>${Wallet.barHtml()}</div>
      <div class="tabs">${SHOP.tabs.map((t) => `<button class="tab${t.id === tab ? " on" : ""}" data-a="tab" data-t="${t.id}">${t.label}</button>`).join("")}</div>
      <div class="shop-grid">${items().map((it) => {
        const c = Wallet.get(it.cur);
        return `<div class="item" style="--rar:${RARITY[it.rarity]}"><div class="item-img"><span>${c.icon}</span></div>
          <div class="item-name">${it.name}</div><div class="item-rar">${it.rarity}</div>
          <button class="item-buy" data-a="buy" data-n="${it.name}"><i style="color:${c.color}">${c.icon}</i> ${it.price.toLocaleString("en-US")}</button></div>`;
      }).join("")}</div>
      <div class="note" style="margin:10px 0 0">Placeholder items. Cosmetics only: no gameplay power. Buying is not wired yet.</div>`;
    const m = this.modal({ title: "SHOP", wide: true, html: body() });
    const holder = m.el.querySelector(".modal-body");
    holder.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (!b) return;
      if (b.dataset.a === "tab") { tab = b.dataset.t; holder.innerHTML = body(); }
      else if (b.dataset.a === "buy") this.toast(`${b.dataset.n}: purchase is a placeholder.`);
    });
  }

  openGenesis() {
    this.modal({
      title: "GENESIS PATH",
      html: `<div class="note" style="margin:0 0 10px">Seasonal reward track with a free and a premium lane (like a Starlight pass). Placeholder.</div>
        <div class="gp-lane">${Array.from({ length: 10 }, (_, i) => `<div class="gp-cell"><small>${i + 1}</small><i>${i % 5 === 4 ? "◆" : "○"}</i></div>`).join("")}</div>
        <div class="gp-lane prem">${Array.from({ length: 10 }, (_, i) => `<div class="gp-cell"><small>${i + 1}</small><i>${i % 2 ? "✦" : "◆"}</i></div>`).join("")}</div>
        <div class="pf-actions"><button class="btn sm" disabled>Subscribe (soon)</button></div>`,
    });
  }

  openMessages() {
    this.root.querySelector(".bell .dot")?.remove();
    this.modal({
      title: "MESSAGES",
      html: MESSAGES.map((m) => `<div class="msg"><b>${m.from}</b><small>${m.time}</small><div>${m.text}</div></div>`).join(""),
    });
  }

  openPlaceholder(b) {
    this.modal({
      title: b.label.toUpperCase(),
      html: `<div class="note" style="margin:0 0 10px">${b.blurb} Placeholder.</div>
        <div class="slot-grid">${Array.from({ length: 12 }, () => `<div class="slot"></div>`).join("")}</div>`,
    });
  }

  update(dt) {
    this.t += dt;
    if (this.bg) this.bgFade = Math.min(1, this.bgFade + dt * 1.5);
    if (this.modals.length && this.game.input.wasPressed("Escape")) this.modals[this.modals.length - 1].close();
    const { width: w, height: h } = this.game;
    if (Math.random() < 0.6)
      this.particles.emit({ x: rand(0, w), y: rand(h * 0.55, h + 20), z: 0, vx: rand(-12, 12), vy: 0, vz: rand(25, 90),
        gravity: 0, drag: 0.1, life: rand(3, 6), size: rand(1, 2.4), sizeEnd: 0.2, color: [255, 160, 60], colorEnd: [200, 40, 10], alpha: 0.6 });
    this.particles.update(dt);
  }

  render(ctx, w, h) {
    // Scenery: the art when loaded, otherwise a drawn dusk placeholder.
    const gy = h * 0.8;
    if (this.bg) {
      ctx.fillStyle = "#07080c"; ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = this.bgFade;
      drawCover(ctx, this.bg, this.bg.naturalWidth, this.bg.naturalHeight, w, h, 0.5, 0.65);
      ctx.globalAlpha = 1;
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#0b0e1c"); sky.addColorStop(0.55, "#2a1a24"); sky.addColorStop(0.75, "#4a2410"); sky.addColorStop(1, "#120b08");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      const ridge = (base, amp, color, seed) => {
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, base + Math.sin(x * 0.006 + seed) * amp + Math.sin(x * 0.017 + seed * 2) * amp * 0.4);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      };
      ridge(h * 0.58, 46, "#1a1218", 1); ridge(h * 0.66, 34, "#120d10", 4);
      ctx.fillStyle = "#0c0a0c"; ctx.fillRect(0, gy, w, h - gy);
    }
    this.particles.render(ctx);

    // Character placeholder (cylinder) with a slow idle sway and a ground glow.
    const cx = w / 2, bob = Math.sin(this.t * 1.6) * 3;
    const glow = ctx.createRadialGradient(cx, gy, 6, cx, gy, 150);
    glow.addColorStop(0, "rgba(255,140,60,.35)"); glow.addColorStop(1, "rgba(255,140,60,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.ellipse(cx, gy, 150, 40, 0, 0, Math.PI * 2); ctx.fill();
    drawCylinder(ctx, { x: cx, y: gy, r: 30, h: 110 + bob, color: [200, 90, 50], lean: [Math.sin(this.t * 0.8) * 3, 0] });
    ctx.fillStyle = "rgba(234,223,200,.35)"; ctx.font = "12px Georgia"; ctx.textAlign = "center";
    ctx.fillText("CHARACTER PLACEHOLDER", cx, gy + 34);
    if (!this.bg) ctx.fillText("SCENERY PLACEHOLDER", cx, h * 0.5);
    ctx.textAlign = "start";
  }
}
