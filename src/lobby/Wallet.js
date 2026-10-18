import { WALLET } from "./lobbyData.js";

/** In-memory wallet (placeholder: not saved yet). Home and Shop share this one object. */
export const Wallet = {
  list() { return WALLET.currencies; },
  get(id) { return WALLET.currencies.find((c) => c.id === id); },
  amount(id) { return this.get(id)?.amount ?? 0; },
  /** Returns true and deducts if affordable. Not wired to the shop buy button yet. */
  spend(id, n) {
    const c = this.get(id);
    if (!c || c.amount < n) return false;
    c.amount -= n;
    return true;
  },
  /** HTML for the currency line. The same markup is used on Home and inside the Shop. */
  barHtml() {
    return WALLET.currencies
      .map((c) => `<span class="cur" title="${c.hint}"><i style="color:${c.color}">${c.icon}</i><b>${c.amount.toLocaleString("en-US")}</b><button class="cur-plus" data-a="topup" data-cur="${c.id}" aria-label="Add ${c.label}">+</button></span>`)
      .join("");
  },
};
