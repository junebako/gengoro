// ページのスクリプトより先に走り、background.js が付けた Server-Timing の目印を読んで
// navigator.language / navigator.languages を差し替える。目印が無いページでは何もしない。
(() => {
  const entry = performance.getEntriesByType("navigation")[0];
  const mark = entry?.serverTiming?.find((t) => t.name === "gengoro");
  if (!mark?.description) return;
  const languages = Object.freeze(mark.description.split(",").filter(Boolean));
  if (languages.length === 0) return;
  const proto = Object.getPrototypeOf(navigator);
  Object.defineProperty(proto, "languages", { get: () => languages, configurable: true, enumerable: true });
  Object.defineProperty(proto, "language", { get: () => languages[0], configurable: true, enumerable: true });
})();
