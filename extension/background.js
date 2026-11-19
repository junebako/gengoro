import { DEFAULT_LANGUAGES, rotate, toAcceptLanguage, toServerTiming } from "./languages.js";

const RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
  "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport",
  "webbundle", "other",
];
const MENU_RESET = "gengoro-reset";

async function getLanguages() {
  const { languages } = await chrome.storage.sync.get("languages");
  return Array.isArray(languages) && languages.length > 0 ? languages : DEFAULT_LANGUAGES;
}

// タブごとの状態: { [tabId]: index } (登録リストの何番目を先頭にしているか)
async function getTabStates() {
  const { tabStates } = await chrome.storage.session.get("tabStates");
  return tabStates ?? {};
}

async function setTabState(tabId, index) {
  const tabStates = await getTabStates();
  if (index === null) delete tabStates[tabId];
  else tabStates[tabId] = index;
  await chrome.storage.session.set({ tabStates });
}

async function getOverride(tabId) {
  const index = (await getTabStates())[tabId];
  if (index === undefined) return null;
  const languages = await getLanguages();
  return rotate(languages, index % languages.length);
}

async function applyHeaderRule(tabId, languages) {
  const rule = languages && {
    id: tabId,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{ header: "accept-language", operation: "set", value: toAcceptLanguage(languages) }],
      // ページ側の content script (navigator.js) が、読み込みと同時に言語順を知るための目印
      responseHeaders: [{ header: "server-timing", operation: "append", value: toServerTiming(languages) }],
    },
    condition: { tabIds: [tabId], resourceTypes: RESOURCE_TYPES },
  };
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: rule ? [rule] : [],
  });
}

async function updateBadge(tabId, languages) {
  await chrome.action.setBadgeText({ tabId, text: languages ? languages[0].slice(0, 4).toUpperCase() : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#3b5bdb" });
  await chrome.action.setTitle({
    tabId,
    title: languages
      ? `gengoro: ${languages.join(" > ")} (クリックで切り替え)`
      : "gengoro: クリックで優先言語を切り替え",
  });
}

// 今のタブの次の言語順を決める。初回は、ブラウザ本来の先頭言語の「次」から始める
async function nextIndex(tabId, languages) {
  const current = (await getTabStates())[tabId];
  if (current !== undefined) return (current + 1) % languages.length;
  const browserLangs = await chrome.i18n.getAcceptLanguages();
  const primary = (browserLangs[0] ?? "").toLowerCase();
  const found = languages.findIndex((l) => l.toLowerCase() === primary);
  return found === -1 ? 0 : (found + 1) % languages.length;
}

async function cycleTab(tab) {
  if (tab.id === undefined || tab.id < 0) return;
  const languages = await getLanguages();
  const index = await nextIndex(tab.id, languages);
  await setTabState(tab.id, index);
  const order = rotate(languages, index);
  await applyHeaderRule(tab.id, order);
  await updateBadge(tab.id, order);
  await chrome.tabs.reload(tab.id);
}

chrome.action.onClicked.addListener(cycleTab);
// E2E テストからアイコンのクリックを再現するための入口
globalThis.gengoroCycleTab = cycleTab;
globalThis.gengoroResetTab = resetTab;

async function resetTab(tabId) {
  await setTabState(tabId, null);
  await applyHeaderRule(tabId, null);
  await updateBadge(tabId, null);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_RESET, title: "このタブの上書きを解除", contexts: ["action"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_RESET || tab?.id === undefined) return;
  await resetTab(tab.id);
  await chrome.tabs.reload(tab.id);
});

// navigator.js が Server-Timing を読めないページ (HTTPS でも localhost でもない http など) 向けの予備。
// ページのスクリプトより後に走ることがあるので、こちらだけだと取りこぼす
function overrideNavigator(languages) {
  const frozen = Object.freeze([...languages]);
  const proto = Object.getPrototypeOf(navigator);
  Object.defineProperty(proto, "languages", { get: () => frozen, configurable: true, enumerable: true });
  Object.defineProperty(proto, "language", { get: () => frozen[0], configurable: true, enumerable: true });
}

chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId, url }) => {
  if (!/^(https?|file):/.test(url)) return;
  const languages = await getOverride(tabId);
  if (!languages) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      injectImmediately: true,
      func: overrideNavigator,
      args: [languages],
    });
  } catch {
    // 注入できないページ (chrome:// やウェブストアなど) は無視する
  }
});

// ページ遷移でバッジが消えるので付け直す
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  const languages = await getOverride(tabId);
  if (languages) await updateBadge(tabId, languages);
});

chrome.tabs.onRemoved.addListener((tabId) => resetTab(tabId).catch(() => {}));

// 言語リストが変わったら、上書き中のタブのヘッダーを付け直す
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync" || !changes.languages) return;
  const tabStates = await getTabStates();
  for (const tabId of Object.keys(tabStates).map(Number)) {
    const languages = await getOverride(tabId);
    await applyHeaderRule(tabId, languages);
    await updateBadge(tabId, languages);
  }
});
