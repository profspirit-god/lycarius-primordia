// Lazy asset loading for lobby art. Every loader resolves to null on failure, so scenes keep their drawn placeholder
// when a file is missing or a format is unsupported. Nothing here blocks the first frame.
const images = new Map();
const videos = new Map();

/** @returns {Promise<HTMLImageElement|null>} */
export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!images.has(url)) {
    images.set(url, new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    }));
  }
  return images.get(url);
}

/**
 * Muted looping video element (cached). `urls` are tried in order by the browser (put WebM first, MP4 for Safari).
 * Resolves to null if nothing playable loads. Call `.play()` / `.pause()` from the scene.
 * @returns {Promise<HTMLVideoElement|null>}
 */
export function loadVideo(urls) {
  const key = urls.join("|");
  if (!videos.has(key)) {
    videos.set(key, new Promise((res) => {
      const v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
      let settled = false;
      const done = (val) => { if (!settled) { settled = true; res(val); } };
      v.addEventListener("loadeddata", () => done(v), { once: true });
      // With <source> children, errors fire on the last source only; that means nothing was playable.
      const srcs = urls.map((u) => {
        const s = document.createElement("source");
        s.src = u;
        v.appendChild(s);
        return s;
      });
      srcs[srcs.length - 1].addEventListener("error", () => done(null));
      v.load();
    }));
  }
  return videos.get(key);
}
