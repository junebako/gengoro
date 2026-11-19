// 拡張を読み込んだ Chrome でページを開き、クリック相当の操作で
// Accept-Language と navigator.languages が順に切り替わるかを確かめる。
// 拡張の読み込みは Chrome for Testing が要る (CHROME_PATH で指定、無ければ puppeteer の既定)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer";

const EXTENSION = path.resolve(import.meta.dirname, "../extension");
let server, origin, browser, worker;

before(async () => {
  server = http.createServer();
  server.on("request", (req, res) => {
    if (req.url === "/echo") return res.end(req.headers["accept-language"] ?? "");
    const header = req.headers["accept-language"] ?? "";
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (req.url === "/frame") {
      return res.end(`<script>window.result = { header: ${JSON.stringify(header)}, languages: [...navigator.languages] }</script>`);
    }
    res.end(`<!doctype html><script>
      window.result = { header: ${JSON.stringify(header)}, language: navigator.language, languages: [...navigator.languages] };
      window.fetched = fetch("/echo").then(r => r.text());
    </script><iframe src="/frame"></iframe>`);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;

  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    pipe: true,
    enableExtensions: [EXTENSION],
    args: ["--lang=ja", "--accept-lang=ja,en-US;q=0.9,en;q=0.8"],
  });
  const target = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("background.js"));
  worker = await target.worker();
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function read(page) {
  await page.waitForFunction(() => window.result && document.querySelector("iframe")?.contentWindow?.result);
  return page.evaluate(async () => ({
    ...window.result,
    fetchHeader: await window.fetched,
    frame: document.querySelector("iframe").contentWindow.result,
  }));
}

async function click(page) {
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url: url + "/*" }))[0].id, origin);
  const navigated = page.waitForNavigation();
  await worker.evaluate((id) => globalThis.gengoroCycleTab({ id }), tabId);
  await navigated;
  return tabId;
}

test("クリックするたびに ja,en と en,ja が入れ替わる", async () => {
  const page = await browser.newPage();
  await page.goto(origin + "/");
  const initial = await read(page);
  assert.match(initial.header, /^ja/);
  assert.equal(initial.language, "ja");

  await click(page);
  let r = await read(page);
  assert.equal(r.header, "en,ja;q=0.9");
  assert.equal(r.fetchHeader, "en,ja;q=0.9");
  assert.equal(r.language, "en");
  assert.deepEqual(r.languages, ["en", "ja"]);
  assert.deepEqual(r.frame, { header: "en,ja;q=0.9", languages: ["en", "ja"] });

  await click(page);
  r = await read(page);
  assert.equal(r.header, "ja,en;q=0.9");
  assert.equal(r.language, "ja");
  assert.deepEqual(r.languages, ["ja", "en"]);

  // ページ内の遷移でも上書きが続く
  await click(page);
  await page.goto(origin + "/?again");
  r = await read(page);
  assert.equal(r.header, "en,ja;q=0.9");
  assert.equal(r.language, "en");
});

test("上書きは今のタブだけ", async () => {
  const other = await browser.newPage();
  await other.goto(origin + "/?other");
  const r = await read(other);
  assert.match(r.header, /^ja/);
  assert.equal(r.language, "ja");
  await other.close();
});

test("解除すると元に戻る", async () => {
  const page = (await browser.pages()).find((p) => p.url().includes("again"));
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url: url + "/*" }))[0].id, origin);
  await worker.evaluate((id) => globalThis.gengoroResetTab(id), tabId);
  await page.reload();
  const r = await read(page);
  assert.match(r.header, /^ja/);
  assert.equal(r.language, "ja");
});
