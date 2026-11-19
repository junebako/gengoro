export const DEFAULT_LANGUAGES = ["ja", "en"];

// 登録順のリストを、先頭が index 番目になるように回す
export function rotate(languages, index) {
  return languages.slice(index).concat(languages.slice(0, index));
}

// ["en", "ja", "fr"] -> "en,ja;q=0.9,fr;q=0.8"
export function toAcceptLanguage(languages) {
  return languages
    .map((lang, i) => (i === 0 ? lang : `${lang};q=${Math.max(0.1, 1 - i * 0.1).toFixed(1)}`))
    .join(",");
}

// " ja, en-US ,, fr " -> ["ja", "en-US", "fr"]
export function parseLanguages(text) {
  const seen = new Set();
  return text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z]{1,8}(-[A-Za-z0-9]{1,8})*$/.test(s))
    .filter((s) => (seen.has(s.toLowerCase()) ? false : seen.add(s.toLowerCase())));
}

export const SERVER_TIMING_NAME = "gengoro";

// ["en", "ja"] -> 'gengoro;desc="en,ja"'
export function toServerTiming(languages) {
  return `${SERVER_TIMING_NAME};desc="${languages.join(",")}"`;
}
