# gengoro

ツールバーのアイコンをクリックするたびに、**今のタブ**の優先言語を順繰りに切り替える Chrome 拡張です。ウェブアプリの i18n の表示確認を楽にするためのものです。

`ja` と `en` を登録しておくと、クリックのたびに `ja,en` と `en,ja` が入れ替わります。

## 何が変わるか

切り替えると、そのタブを自動でリロードします。

| 項目 | 変わるか |
| --- | --- |
| `Accept-Language` リクエストヘッダー (ページ、fetch/XHR、画像など全部) | 変わる |
| `navigator.language` / `navigator.languages` (iframe 内も) | 変わる |
| `Intl` の既定ロケール (`new Intl.DateTimeFormat().resolvedOptions().locale` など) | 変わらない |
| Web Worker / Service Worker 内の `navigator.language` | 変わらない |
| Chrome 本体の言語設定 | 変わらない |

- 上書きはそのタブだけです。ほかのタブや、そのタブから新しく開いたタブには効きません。タブを閉じると上書きも消えます。
- アイコンのバッジに、今の先頭の言語 (`EN` など) が出ます。
- アイコンを右クリックして「このタブの上書きを解除」を選ぶと元に戻ります。
- 最初のクリックでは、Chrome 本来の先頭言語の「次」の言語になります (Chrome が日本語なら、最初は `en` になります)。
- `chrome://` のページや Chrome ウェブストアには効きません。

## 読み込み方

1. このリポジトリを clone する
2. Chrome で `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにする
3. 「パッケージ化されていない拡張機能を読み込む」を押して、`extension/` フォルダを選ぶ
4. ツールバーのパズルアイコンから gengoro をピン留めする

言語の登録は、`chrome://extensions` の gengoro の「詳細」→「拡張機能のオプション」からできます (アイコンを右クリック →「オプション」でも開けます)。

## しくみ

Chrome の拡張 API には、Chrome の優先言語設定そのものを書き換える手段がありません。そこで、ページから見える値を上書きしています。

- `Accept-Language`: `chrome.declarativeNetRequest` のセッションルールで、タブを指定して書き換えます。
- `navigator.language(s)`: ページのスクリプトより先に動く content script (`world: "MAIN"`、`document_start`) で差し替えます。content script は、どのタブがどの言語かを同期的に知る手段を持たないので、同じルールで目印の `Server-Timing: gengoro;desc="en,ja"` レスポンスヘッダーを付け、content script がそれを `performance.getEntriesByType("navigation")` から読みます。
  - `Server-Timing` は HTTPS か localhost のページでしか JavaScript から読めません。それ以外 (localhost 以外の http) では、ページ遷移のたびに後からスクリプトを注入する予備の手段に頼るので、ページのスクリプトが先に `navigator.language` を読むと取りこぼすことがあります。
  - ページ側の `Server-Timing` に `gengoro` という項目が1つ増えます。

## テスト

```sh
npm install
CHROME_PATH="/path/to/Google Chrome for Testing" npm test
```

E2E テストは、拡張を読み込んだ Chrome をヘッドレスで起動して確かめます。通常の Google Chrome はコマンドラインからの拡張の読み込みを受け付けないので、[Chrome for Testing](https://googlechromelabs.github.io/chrome-for-testing/) を使ってください (`npx @puppeteer/browsers install chrome@stable` で入ります)。

## ライセンス

[0BSD](LICENSE)
