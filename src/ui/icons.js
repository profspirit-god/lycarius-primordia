/**
 * Inline SVG icon set. The game uses no emoji or symbol glyphs: every icon is a name in ICONS.
 * `icon(name)` returns an <svg> string that inherits `color` and scales with `font-size` (1em square, see .ic in style.css),
 * so it drops into any template literal: `${icon("flame")}`. Unknown names render a blank box instead of throwing.
 * Skills, classes and spec bonuses store the icon NAME in their `icon` field (data over code).
 * All shapes use a 24 x 24 viewBox. Outline icons use `currentColor` strokes; filled ones set `fill`.
 */

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const F = 'fill="currentColor" stroke="none"';

/** Gear outline: 8 teeth computed once, so the path stays exact and short in the source. */
function gearPath(teeth = 8, rIn = 7.2, rOut = 9.6, cx = 12, cy = 12) {
  const pts = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    for (const [da, r] of [[-0.32, rIn], [-0.2, rOut], [0.2, rOut], [0.32, rIn]])
      pts.push(`${(cx + Math.cos(a + da * step) * r).toFixed(2)} ${(cy + Math.sin(a + da * step) * r).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** name -> inner SVG markup. */
export const ICONS = {
  // --- skills and status effects ---
  flame: `<path ${F} d="M12 2.2c.7 3.2-1.3 4.9-3 6.9C7.3 11.1 6 13 6 15.4 6 19 8.6 21.8 12 21.8s6-2.8 6-6.4c0-2.3-1-4-2.3-5.5-.4 1.2-1.1 2-2.1 2.4.5-3.5-.1-7.2-1.6-10.1z"/><path fill="#fff" fill-opacity=".35" stroke="none" d="M12 21.8c-1.8 0-3.2-1.4-3.2-3.2 0-1.6 1-2.6 1.9-3.6.6-.7 1-1.4 1.3-2.5 1.4 1.1 3.2 2.8 3.2 5.8 0 1.8-1.4 3.5-3.2 3.5z"/>`,
  shield: `<path ${F} d="M12 2.4 4.6 5.4v6.1c0 4.6 3.1 8.3 7.4 10.1 4.3-1.8 7.4-5.5 7.4-10.1V5.4z"/><path fill="#fff" fill-opacity=".35" stroke="none" d="M12 6.2v12.3c-2.7-1.4-4.6-4-4.6-7.1V7.6z"/>`,
  blast: `<circle cx="12" cy="12" r="3.2" ${F}/><path ${S} d="M12 2.5v3.6M12 17.9v3.6M2.5 12h3.6M17.9 12h3.6M5.3 5.3l2.5 2.5M16.2 16.2l2.5 2.5M18.7 5.3l-2.5 2.5M7.8 16.2l-2.5 2.5"/>`,
  ward: `<circle cx="12" cy="12" r="9.6" ${S}/><path ${F} d="M12 6.2c.4 1.8-.8 2.8-1.8 4-1 1.1-1.7 2.2-1.7 3.6 0 2.1 1.5 3.7 3.5 3.7s3.5-1.6 3.5-3.7c0-1.3-.6-2.3-1.3-3.1-.2.7-.6 1.2-1.2 1.4.3-2-.1-4.2-.9-5.9z"/>`,
  stun: `<path ${F} d="M12 2.8l2.2 5.6 6 .5-4.6 3.9 1.5 5.9L12 15.5l-5.1 3.2 1.5-5.9-4.6-3.9 6-.5z"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10.5" rx="2.4" ${S}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ${S}/><circle cx="12" cy="15.6" r="1.3" ${F}/>`,
  help: `<circle cx="12" cy="12" r="9.5" ${S}/><path d="M9.3 9.4a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9" ${S}/><circle cx="12" cy="17" r="1.1" ${F}/>`,

  // --- resources and spec bonuses ---
  heart: `<path ${F} d="M12 21S3 15.4 3 9.1A4.9 4.9 0 0 1 12 6.6a4.9 4.9 0 0 1 9 2.5C21 15.4 12 21 12 21z"/>`,
  drop: `<path ${F} d="M12 2.6s6.4 6.5 6.4 11.4a6.4 6.4 0 0 1-12.8 0C5.6 9.1 12 2.6 12 2.6z"/>`,
  bolt: `<path ${F} d="M13.4 2.2 5 13.4h5.6l-1.1 8.4 8.5-11.6h-5.7z"/>`,
  regen: `<path d="M20 12a8 8 0 0 1-13.8 5.5M4 12a8 8 0 0 1 13.8-5.5" ${S}/><path d="M18.5 2.8v4.2h-4.2M5.5 21.2V17h4.2" ${S}/>`,
  hourglass: `<path d="M7 3h10M7 21h10M8 3v3.6c0 1.8 1.4 3 4 5.4-2.6 2.4-4 3.6-4 5.4V21M16 3v3.6c0 1.8-1.4 3-4 5.4 2.6 2.4 4 3.6 4 5.4V21" ${S}/>`,
  stopwatch: `<circle cx="12" cy="13.6" r="7.6" ${S}/><path d="M12 13.6V9.5M9.5 2.6h5M12 2.6v3.4M18.6 6.6l1.2-1.2" ${S}/>`,
  sparkles: `<path ${F} d="M10.5 3l1.9 6.1 6.1 1.9-6.1 1.9-1.9 6.1-1.9-6.1L2.5 11l6.1-1.9z"/><path ${F} d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>`,

  // --- profile, lobby and currencies ---
  user: `<circle cx="12" cy="8.2" r="4.2" ${F}/><path ${F} d="M3.8 21c0-4.5 3.6-7.2 8.2-7.2s8.2 2.7 8.2 7.2z"/>`,
  bell: `<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.1H4.4z" ${S}/><path d="M10 21a2 2 0 0 0 4 0" ${S}/>`,
  coin: `<circle cx="12" cy="12" r="9.2" ${F}/><circle cx="12" cy="12" r="5.8" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.6"/>`,
  gem: `<path ${F} d="M6.6 3.6h10.8l4.1 5.4L12 21.4 2.5 9z"/><path d="M2.5 9h19M9.2 3.6 7.6 9 12 21.4M14.8 3.6 16.4 9 12 21.4" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.2" stroke-linejoin="round"/>`,
  star: `<path ${F} d="M12 2l2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3z"/>`,
  box: `<path d="M3.5 7.6 12 3l8.5 4.6v8.8L12 21l-8.5-4.6zM3.5 7.6 12 12.2l8.5-4.6M12 12.2V21" ${S}/>`,
  calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.6" ${S}/><path d="M3.5 10h17M8 3v4M16 3v4" ${S}/><path ${F} d="M12 12.2l1 2.1 2.2.3-1.6 1.6.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.6 2.2-.3z"/>`,
  crown: `<path d="M3.5 8.5l4.6 4 3.9-7 3.9 7 4.6-4-1.6 10.6H5.1z" ${S}/>`,
  gear: `<path d="${gearPath()}" ${S}/><circle cx="12" cy="12" r="3" ${S}/>`,
  triangle: `<path ${F} d="M12 3.5 21.5 20h-19z"/>`,
  dot: `<circle cx="12" cy="12" r="8" ${F}/>`,
  ring: `<circle cx="12" cy="12" r="7.5" ${S}/>`,
  close: `<path d="M6 6l12 12M18 6 6 18" ${S}/>`,
  chevronLeft: `<path d="M14.5 5 7.5 12l7 7" ${S}/>`,
};

/** @param {string} name key of ICONS @param {string} [cls] extra class names @returns {string} SVG markup */
export function icon(name, cls = "") {
  const inner = ICONS[name] ?? "";
  return `<svg class="ic ic-${name}${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
}
