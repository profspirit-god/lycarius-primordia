/**
 * Small DOM modal used by lobby scenes. `parent` is the scene's overlay element.
 * Returns { el, close }. Clicking the backdrop or the close button closes it.
 */
export function openModal(parent, { title, html, wide = false, onClose } = {}) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal${wide ? " wide" : ""}">
      <button class="modal-x" data-a="close" aria-label="Close">×</button>
      ${title ? `<h2 class="modal-title">${title}</h2>` : ""}
      <div class="modal-body">${html}</div></div>`;
  const close = () => { back.remove(); onClose?.(); };
  back.addEventListener("click", (e) => {
    if (e.target === back || e.target.dataset?.a === "close") close();
  });
  parent.appendChild(back);
  return { el: back, close };
}
