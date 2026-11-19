import { test } from "node:test";
import assert from "node:assert/strict";
import { rotate, toAcceptLanguage, parseLanguages } from "../extension/languages.js";

test("rotate", () => {
  assert.deepEqual(rotate(["ja", "en", "fr"], 0), ["ja", "en", "fr"]);
  assert.deepEqual(rotate(["ja", "en", "fr"], 1), ["en", "fr", "ja"]);
  assert.deepEqual(rotate(["ja", "en", "fr"], 2), ["fr", "ja", "en"]);
});

test("toAcceptLanguage", () => {
  assert.equal(toAcceptLanguage(["en", "ja"]), "en,ja;q=0.9");
  assert.equal(toAcceptLanguage(["en", "ja", "fr"]), "en,ja;q=0.9,fr;q=0.8");
});

test("parseLanguages", () => {
  assert.deepEqual(parseLanguages(" ja, en-US ,, fr EN-us x_y "), ["ja", "en-US", "fr"]);
});
