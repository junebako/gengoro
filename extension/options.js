import { DEFAULT_LANGUAGES, parseLanguages } from "./languages.js";

const input = document.getElementById("languages");
const status = document.getElementById("status");

const { languages } = await chrome.storage.sync.get("languages");
input.value = (Array.isArray(languages) && languages.length > 0 ? languages : DEFAULT_LANGUAGES).join(", ");

document.getElementById("save").addEventListener("click", async () => {
  const parsed = parseLanguages(input.value);
  if (parsed.length < 2) {
    status.style.color = "#c92a2a";
    status.textContent = "言語を2つ以上入れてください";
    return;
  }
  await chrome.storage.sync.set({ languages: parsed });
  input.value = parsed.join(", ");
  status.style.color = "";
  status.textContent = `保存しました: ${parsed.join(" > ")}`;
});
