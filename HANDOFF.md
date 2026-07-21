# ImageViewer 引き継ぎドキュメント

最終更新: 2026-07-21 / 対象ブランチ: `claude/android-ios-browser-app-ljupsx`
(最新コミット: `62b086c` ブラウザー/ランキング: URL取り違えとランキング集計のバグを修正)

このファイルは、次回セッション(コンテキストをクリアした後)で作業をスムーズに再開するための
引き継ぎ資料です。次のステップでは**バックエンド(サーバー)導入の相談**を行う予定であるため、
現状のローカル実装・データモデル・未解決事項を詳細にまとめています。

---

## 1. アプリの概要

**ImageViewer** は Android/iOS 向けの「ブラウザー + 画像ビューアー/ギャラリー」アプリ。
ユーザーがアプリ内蔵ブラウザーでサイトを閲覧し、ページ内の連番画像(漫画・イラスト投稿サイト等を
想定)をワンタップで一括検出・ダウンロードし、フォルダ単位で管理・閲覧できることが中核機能。
現時点では **完全ローカル動作**(サーバー・バックエンドなし、全データは端末内 SQLite +
AsyncStorage + ファイルシステムのみ)。

### リポジトリ / 環境

- GitHub: `LG-FlatLight07/ImageViewer`
- 作業ブランチ: `claude/android-ios-browser-app-ljupsx` (このブランチに全てコミット・プッシュ済み)
- 技術スタック: Expo SDK 57 (React Native 0.86 / React 19) + TypeScript、React Navigation
  (Bottom Tabs + Native Stack)、Zustand(状態管理・永続化)、expo-sqlite(構造化データ)、
  expo-file-system(画像ファイル本体)、react-native-webview、react-native-gesture-handler +
  react-native-reanimated(ドラッグ配置・ピンチズーム・アニメーション)。
- **重要な開発ルール**: `AGENTS.md` に「Expo が変更されているので、コードを書く前に必ず
  https://docs.expo.dev/versions/v57.0.0/ の版指定ドキュメントを読むこと」と明記されている
  (SDK 57 向けの最新ドキュメントを都度確認する運用)。

---

## 2. 実装済み機能の全体像

### ブラウザー(Browser タブ)

- WebView ベースのタブブラウザー(複数タブ、タブバー、新規タブ/クローズ、自動スクロール)
- URL バー(アドレス入力 or 検索ワード、検索エンジン切替: Google/Bing/Yahoo!/DuckDuckGo)
- 戻る/進む/リロード、ブックマーク登録(★トグル)
- 閲覧履歴の自動記録(ページ遷移ごと)、履歴・ブックマーク一覧画面から再度開ける
- プライベートモード相当(`disableHistory` 設定 ON で WebView を incognito 動作にし履歴も残さない)
- 広告・ポップアップブロック(`src/services/adBlock.ts` を `injectedJavaScriptBeforeContentLoaded`
  で注入。広告らしき要素のクラス名/ID/src文字列を正規表現で判定して非表示化 + `window.open` を
  無効化 + `setSupportMultipleWindows`/`onOpenWindow` でポップアップウィンドウを開かせない。
  設定でON/OFF可能、デフォルトON)
- **画像の一括保存**: ツールバーの保存ボタン → WebView に `IMAGE_SCAN_SCRIPT` を注入し、
  ページ内の `<img>` を走査(広告祖先要素・広告ドメイン・小サイズ画像は除外)→
  `detectImageGroups`(`src/services/imageGrouping.ts`)がURL末尾の数字列から「連番グループ」を
  自動検出(最大グループを primaryGroup、残りを otherImages)→ `ImageSelectionScreen` で
  サムネイル選択 UI を表示 → `downloadImagesToNewFolder` で一括ダウンロード。
  - `autoSelectSequentialImages` 設定(デフォルトON)で、画面表示時に primaryGroup を
    自動選択済みにするかどうかを切り替え可能。

### ブラウザーの URL 管理(直近のバグ修正で確定した設計 — 重要)

`src/store/browserStore.ts` の `BrowserTab` は **3つの URL 関連フィールド**を役割分担している:

- `url`: WebView の `source.uri`。**明示的なナビゲーション**(アドレスバー送信、ホーム URL 適用、
  URL ジャンプ機能での新規タブオープン)でのみ更新される。サイト内リンクのクリックや SPA の
  ルーティングでは変化しない。
- `inputValue`: アドレスバーのテキスト。ユーザーが編集中のバッファでもあるため「今表示中の
  正しいページ URL」として信頼してはいけない。
- `currentUrl`: **実際に表示中のページ URL**。`onNavigationStateChange` が発火するたび
  (サイト内遷移含む)に必ず同期される。ブックマーク判定/保存・画像保存時の `sourceUrl` は
  **必ずこれを使う**。

  → 過去のバグ「サイトは合っているがページ内の場所が違う URL が保存される」は、
  ブックマーク/画像保存が誤って `url`(またはアドレスバーテキスト)を参照していたことが原因で、
  `currentUrl` 導入により解消済み(2026-07-21 の修正、詳細は §6 参照)。

### ギャラリー(Gallery タブ)

- ダウンロード済みフォルダの一覧・階層管理(サブフォルダ作成・移動)
- ソート: 名前順/ダウンロード日時順/タグ名順/閲覧回数順
- 検索: フォルダ名 or タグ名(タグ候補チップからの選択も可)
- フォルダへのタグ付け(複数、既存タグからの選択 + 新規入力)
- フォルダ名変更、フォルダ削除(削除確認ポップアップに「次回から確認しない」オプションあり
  → 設定画面の「ギャラリー」セクションでいつでも再度確認を有効化可能)
- フォルダ行のスワイプ操作: 左スワイプで削除、右スワイプで「ダウンロード元 URL へジャンプ」
  (新規タブで開く)。一定時間で自動的にスワイプが元に戻る仕組みがあり、同時に複数の行が
  開いた状態にならないよう `SwipeRowCoordinator` で調整
- フォルダ詳細画面: 画像のグリッド表示、複数選択削除、フルスクリーンビューアーへの遷移
- **スライドビューワー**(`ImageViewerScreen.tsx`): 独自実装の Reanimated ベース画像ビューアー。
  横スライド/縦スライドを設定で選択可能。ページ間の隙間を極小にしたフリースクロール
  (スナップなし)、軸ロック(斜め移動禁止)、慣性を通常の 1/4 に抑制、縦スワイプでギャラリーへ戻る、
  各画像のアスペクト比に応じた正確な高さ計算(縦モード時)

### ランキング(Ranking タブ)

- この端末でのダウンロード統計を「ダウンロード先ページ URL」単位で集計して表示
- 期間フィルタ: 日別/週間/全期間(左右スワイプ or ボタンタップで切替、Reanimated による
  スライド+フェードアニメーション付き)
- 表示: 順位、サムネイル(ダウンロード時の先頭画像)、ページタイトル(長い場合はマーキー/
  文字送りアニメーション)、ページ URL、累計ダウンロード画像枚数
- 行タップでそのURLを新規タブで開きブラウザーへ遷移
- ダウンロード完了時に自動リロード(画面を離れず待っていても反映される)
- **データソース**: `ranking_stats` テーブル(§4 参照)。`folders` テーブルとは完全に独立
  (フォルダを削除してもランキングの実績は消えない設計。将来サーバー化する際の布石)

### 設定(Settings タブ)

- 検索エンジン切替、テーマ(システム/ライト/ダーク)
- ブラウジング: 履歴を残さない、広告・ポップアップをブロック
- 画像のダウンロード: 連番画像を自動選択
- ギャラリー: 削除前に確認する(トグル。OFFで確認なしの即時削除)
- フォルダ名の除外文字列リスト(ページタイトルからフォルダ名を自動生成する際に除去する文字列)
- スライドビューワーの方向(横/縦)
- 画面レイアウト: レイアウト編集モードのON/OFF、レイアウトのリセット
- サポート: 開発者へメッセージを送る(ローカル保存、将来のサーバー送信を見据えた設計)、
  アプリの使い方・仕様ガイド画面

### 画面レイアウトの自由配置システム(全画面共通の重要な基盤機能)

`src/components/layout/` 配下(`ControlGroup.tsx`, `DraggableLayoutArea.tsx`, `anchors.ts`)+
`src/store/layoutStore.ts` で実装。詳細は複雑なため要点のみ:

- 画面の外周を **32方向のアンカー**(`EDGE_TOP_ANCHOR=0` 〜 `EDGE_BOTTOM_ANCHOR=16` など)として
  離散化し、`ControlGroup`(ボタン群やバーのまとまり)をドラッグで好きなアンカーにドッキングできる
- `variant: 'buttons' | 'bar'` の2種類。`edgesOnly` を指定した bar 系 UI は上下端のみに制限
  (`clampToEdgeAnchor`)
- `RegistryContext`(誰がどこにいるか)+ `RegistryVersionContext`(変更検知用カウンタ)により、
  兄弟 UI 同士が重ならないよう自動回避
- `stackPeerId` により「指定した相手とだけは重ねて配置してよい」スタック機構があり、
  `movedAt` タイムスタンプで「直近ドラッグした方が上」を決定(未ドラッグ時は screenId 文字列の
  決定的な tie-break)
- レイアウト編集モード中は各 UI の操作(タップ等)を無効化し、ドラッグ専用にする隔離機構あり
- 位置は `layoutStore`(zustand + persist）に永続化、画面ごとにリセット可能
- 対応画面: Browser(戻る/進む/保存ボタン群、URLバー+タブバー)、Gallery の FolderList(検索/
  ソート/新規フォルダ UI)、FolderDetail(ヘッダー + アクションツールバー)

---

## 3. ディレクトリ構成(主要ファイル)

```
src/
  components/
    layout/           ドラッグ配置システム(ControlGroup, DraggableLayoutArea, anchors, LayoutEditBanner)
    FolderRow.tsx      ギャラリーのフォルダ行(スワイプ操作)
    SwipeRowCoordinator.tsx  スワイプ行の自動クローズ調整(id基準、直近修正済み)
    URLBar.tsx / BrowserTabBar.tsx
    ActionMenuModal.tsx / PromptModal.tsx / TagEditorModal.tsx
    DownloadProgressBar.tsx / DownloadCompleteToast.tsx
  db/
    schema.ts          SQLiteマイグレーション定義(現在 SCHEMA_VERSION = 7)
    DatabaseProvider.tsx
    foldersRepository.ts     folders テーブル CRUD(download_history と LEFT JOIN して sourceUrl 解決)
    downloadHistoryRepository.ts  download_history / ranking_stats への書き込み担当
    rankingRepository.ts     ranking_stats からランキング集計(URL正規化・グルーピング)
    historyRepository.ts / bookmarksRepository.ts / feedbackRepository.ts
    folderImages.ts    フォルダ内画像ファイルの列挙・削除(expo-file-system)
    types.ts
  navigation/          RootNavigator / BrowserNavigator / GalleryNavigator, 型定義(types.ts)
  screens/
    Browser/           BrowserScreen, HistoryScreen, BookmarksScreen, ImageSelectionScreen
    Gallery/            FolderListScreen, FolderDetailScreen, FolderPickerScreen, ImageViewerScreen
    Ranking/            RankingScreen(マーキーアニメーション含む)
    Settings/           SettingsScreen, AppGuideScreen
  services/
    imageExtraction.ts  WebView注入スキャンスクリプト(IMAGE_SCAN_SCRIPT)
    imageGrouping.ts    連番グループ検出ロジック(detectImageGroups)
    downloadService.ts  一括ダウンロード実行 + フォルダ作成 + download_history/ranking_stats 記録
    adBlock.ts          広告ブロック注入スクリプト
    urlUtils.ts         アドレスバー入力の URL/検索クエリ判定
  store/
    browserStore.ts     タブ状態(url/inputValue/currentUrl の分離、直近修正)
    settingsStore.ts    全設定値(persist・AsyncStorage)
    layoutStore.ts      UI配置の永続化
    downloadStore.ts    ダウンロード進捗のグローバル表示用
  utils/
    confirmDeleteFolder.ts  フォルダ削除確認ダイアログ(「次回から確認しない」対応)
  theme/theme.ts
```

---

## 4. データベース設計(expo-sqlite、`src/db/schema.ts`)

手動マイグレーション方式(`PRAGMA user_version` を見て `MIGRATIONS[nextVersion]` を順次
`execAsync`)。**現在 `SCHEMA_VERSION = 7`**。

| version | 内容                                                                                    |
| ------- | --------------------------------------------------------------------------------------- |
| 1       | `folders`(id, name, parent_id, dir_path, source_url, created_at)、`tags`、`folder_tags` |
| 2       | `history`、`bookmarks`                                                                  |
| 3       | `folders.view_count` 追加                                                               |
| 4       | `folders.image_count` 追加、`idx_folders_source_url`                                    |
| 5       | `feedback_messages`(開発者へのメッセージ、将来サーバー送信予定)                         |
| 6       | `download_history`(**folder_id を PK かつ FK(ON DELETE CASCADE)** として持つ、          |

    1フォルダにつき1行。`page_url` / `page_title`(除外ワード適用前の生タイトル) /
    `first_image_uri` / `created_at`。**用途: フォルダ行の「URLへジャンプ」機能**。
    フォルダが削除されれば一緒に消えてよいデータ) |

| 7 | `ranking_stats`(**folder_id を一切持たない、完全に独立した追記専用テーブル**。
`id`(UUID) / `page_url` / `page_title` / `thumbnail_uri` / `image_count` / `created_at`。
**用途: ランキング集計専用**。フォルダ削除の影響を受けない。マイグレーション時に
`folders` LEFT JOIN `download_history` から一度だけバックフィルして、既存データが
消えないようにしてある) |

### なぜ `download_history` と `ranking_stats` を分けたか(重要な設計判断)

最初は `download_history` 1本で両方(フォルダ行ジャンプ用とランキング用)を賄っていたが、
ユーザーから以下の指摘を受けて分離した:

> 「ランキングについては、本来はローカル環境ではなく、アプリ利用者全員でのダウンロードURL
> ランキングにしたいので、ローカルのフォルダについてのデータとは別で管理する必要がある。
> (本来ならサーバ)」

- `download_history`: 「このフォルダはこのURLからダウンロードした」という **フォルダに紐づく**
  情報 → フォルダ削除と運命を共にすべき(FK CASCADE で良い)
- `ranking_stats`: 「このURLから何回・何枚ダウンロードされたか」という **フォルダの存在に依存
  しない統計** → 将来的にサーバー側の「全ユーザー共通ランキング」に置き換える前提のデータ形状
  にしておくべき、という設計意図。今回はサーバーがないためローカル SQLite に置いているだけで、
  スキーマ形状(page_url / page_title / thumbnail_uri / image_count / created_at)はそのまま
  サーバーAPIのレスポンス/リクエスト形にスライドできることを意識している。

### `rankingRepository.ts` の集計ロジック

- `ranking_stats` を期間(day/week/all)でフィルタして全件取得
- `normalizeUrlKey()` で host + path + query を正規化(末尾スラッシュ・大文字小文字・
  フラグメントは無視、**クエリ文字列は保持**— 過去に「クエリを落としてマージしすぎる」
  バグがあったため意図的に残している)してグルーピング
- 同じ正規化キーの行は `totalImages` 合算・`downloadCount` 加算、表示用の `displayName` /
  `thumbnailUri` / `sourceUrl` は **最新の `created_at` を持つ行**の値を採用
- 上位 `RANKING_LIMIT = 20` 件を `totalImages` 降順で返す

---

## 5. ダウンロードフロー詳細(`src/services/downloadService.ts`)

1. `BrowserScreen` の保存ボタン → `currentUrl` と `title`(なければ `inputValue`)を
   `scanContextRef` に退避 → `IMAGE_SCAN_SCRIPT` を注入
2. WebView からのメッセージ(`postMessage`)を `handleMessage` が受信 → `detectImageGroups`
3. `ImageSelectionScreen` に `pageTitle`(生タイトル)・`sourceUrl`(= `currentUrl` 由来)・
   検出画像を渡して選択 UI 表示
4. ダウンロード実行 `downloadImagesToNewFolder(db, { folderName, sourceUrl, imageUrls,
folderNameExclusions, onProgress })`:
   - `sanitizeFolderName()`: 除外ワード適用 + 使用不可文字除去 + 80文字丸め →
     `resolveUniqueDirectory()` で重複しないフォルダ名を確保
   - `downloadWithConcurrency()`: 同時実行数 4 で `File.downloadFileAsync`。連番ゼロパディング
     ファイル名(`01.jpg` 等)。**最も小さいインデックスで成功した画像の URI** を
     `firstImageUri` として追跡(将来スレッド完了順が不定でも先頭画像が安定するように)
   - `createFolder()`: `folders` テーブルに1行追加(name, dirPath, sourceUrl, imageCount)
   - `recordDownloadHistory()`: 上記 §4 の通り `download_history`(upsert)と
     `ranking_stats`(insert のみ)の**両方**に、同一トランザクションで書き込み

---

## 6. 直近のセッションで行ったバグ修正・機能追加(詳細)

このセッション内で対応した、ユーザーからの2回の連続フィードバックへの対応:

### 6-1. 1回目のフィードバックへの対応(コミット `07f4f23`)

> 「フォルダ行スワイプの自動クローズタイマーがリセットされない」
> 「フォルダ削除確認に『次回から表示しない』機能を」
> 「ランキング/フォルダ行ジャンプのURLが間違っている」「ダウンロードしてもランキングに出ない」
> 「ダウンロード履歴を1フォルダごとに保存してキャッシュに」「URLジャンプ機能に力を入れて」

- **`SwipeRowCoordinator`**: `notifyOpen` が `close` 関数の**参照**で「同じ行か」を判定していた
  ため、同じ行を再スワイプした際に古い参照が即座に呼ばれて一瞬で閉じるバグがあった →
  `folder.id` などの**安定したid**で判定するよう修正
- **削除確認「次回から表示しない」**: `settingsStore.skipDeleteConfirmation`(デフォルトfalse)
  追加。`src/utils/confirmDeleteFolder.ts` に共通ヘルパーを新設し、FolderListScreen /
  FolderDetailScreen の削除確認をこれに統一。設定画面に再度確認を有効化するトグル追加
- **`download_history` テーブル新設**(マイグレーション6、この時点ではまだ `ranking_stats` は
  存在せず、`download_history` がランキングとフォルダジャンプの両方を兼ねていた)
- `foldersRepository.ts` の `listFolders`/`getFolder` を `download_history` と LEFT JOIN + COALESCE
  して `sourceUrl` を解決するよう変更(フォルダ行ジャンプの精度向上)
- `rankingRepository.ts` を `download_history` 基準に書き換え(この時点の設計)
- `RankingScreen.tsx` の `MarqueeText` を、不可視の計測用テキストクローンを使う旧実装から、
  単一の `Text` を `Animated.View` で包むシンプルな実装に再設計

### 6-2. 2回目のフィードバックへの対応(コミット `62b086c`、**今回セッションの本題**)

> 「ランキングが最後にダウンロードしたものしか表示されない。今までの統計を出してほしい」
> 「ランキング/フォルダスワイプのURLが、サイトは合っているがページが間違っている」
> 「ランキングは本来サーバーで全ユーザー共通にしたい。ローカルのフォルダデータとは別管理に」

根本原因の特定と対応:

- **URL取り違えの真因**: `BrowserTab` には `url`(WebView用、明示的ナビゲーション時のみ更新)
  と `inputValue`(アドレスバーの編集バッファ)しかなく、「サイト内リンクをクリックして
  移動した後の実際のページURL」を追跡するフィールドが存在しなかった。ブックマーク判定/保存・
  画像保存の `sourceUrl` 取得がいずれも古い `url` を参照していたため、サイト内を移動しても
  常に「タブを開いた最初のURL」が記録されていた
  → **`currentUrl` フィールドを新設**(`onNavigationStateChange` で毎回同期)し、
  ブックマーク・画像保存の両方をこれに統一(§2「ブラウザーのURL管理」参照)
- **「最後の1件しか出ない」の真因**: 上記のURL取り違えにより、実際には異なるページを
  ダウンロードしていても記録されるURLが常に同じ(誤った)値になっていたため、
  `normalizeUrlKey` によるグルーピングで**大量のダウンロードが1エントリに過剰マージ**されて
  いた。件数・枚数の合算自体は行われていたが、表示されるのは「最新のタイトル/URL」1行だけ
  だったため、ユーザーからは「最後にダウンロードしたものしか出ない」ように見えていた。
  → `currentUrl` 修正により今後のダウンロードは正しいページ単位で記録され、
  自然に複数エントリへ分かれるようになる
- **ランキングのフォルダデータからの分離**: `ranking_stats` テーブルを新設(マイグレーション7、
  §4参照)。`recordDownloadHistory()` が `download_history`(フォルダ単位・カスケード削除)と
  `ranking_stats`(独立・追記専用)の両方に書き込むよう変更。`rankingRepository.ts` を
  `ranking_stats` のみを参照するよう全面書き換え(`folders` への依存を完全排除)。
  移行時に既存データを失わないよう、マイグレーション内で一度だけ
  `folders LEFT JOIN download_history` からのバックフィル INSERT を実行済み

### 検証内容(両コミットとも実施)

- `npx prettier --check` / `npx tsc --noEmit` / `npx eslint src/` / `npx jest` 全て通過
- `npx expo start --web` + Playwright(Chromium)でRanking/Gallery/Settings画面を操作し、
  コンソールエラーなし・新スキーマ/マイグレーションが正常実行されることを確認
  (WebView自体はreact-native-webviewがWeb未対応のため、ブラウザータブの動作確認は
  コードレビューのみ。詳細は §7 参照)

---

## 7. 既知の制約・サンドボックス環境の限界

- **`react-native-webview` は react-native-web 上で未対応**(`WebView` はプレースホルダー
  「React Native WebView does not support this platform」を表示するのみ)。そのため
  ブラウザータブ・広告ブロックの実機的な動作確認は**この開発環境(コンテナ)内では不可能**で、
  コードレビューのみで担保している。実機(Android/iOS)またはAndroidエミュレータでの確認が
  別途必要
- Playwright の生のマウスイベントは `react-native-gesture-handler` の Pan/Swipeable
  ジェスチャーを確実にはシミュレートできない(スワイプ関連機能はコードレビュー中心の検証)
- `LayoutAnimation` は react-native-web 上で信頼できない(過去に Reanimated の明示的な
  アニメーションへ置き換え済み)
- 開発サーバーは `npx expo start --web --port 8099` を bash background で起動し、
  Playwright(`executablePath: '/opt/pw-browsers/chromium'`, `args: ['--no-sandbox',
'--ignore-certificate-errors']`, `NODE_PATH=/opt/node22/lib/node_modules node ...`)で
  スクリーンショット・コンソールエラーを確認する運用
- expo-sqlite の web バックエンドは各 Playwright セッションごとに揮発する(永続ストレージを
  意図的に使っていないため)ので、「既存データがある状態でのマイグレーション」の実地検証は
  この環境では難しい(コードレビューで整合性を担保)

---

## 8. 開発ワークフロー・規約

- 検証コマンド: `npx prettier --check .`(または `--write`) → `npx tsc --noEmit` →
  `npx eslint src/` → `npx jest` → 必要に応じ Playwright(web)での目視確認
- コミット: 日本語での詳細な複数行メッセージ、末尾に
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01C4i5v6i1ffpJXhhJF46tZ8
  ```
  を付与。`git add` は対象ファイルを明示指定(`-A -- <ファイルリスト>`)、`-A` 単独は使わない
- プッシュ: `git push -u origin claude/android-ios-browser-app-ljupsx`
- **`react-hooks/immutability` ESLint の既知の落とし穴**: `useSharedValue` の `.value` への
  代入は、その shared value 参照がファイル内のどこかの hook の依存配列に**一度でも**現れると
  エラーになる。対処は依存配列からその参照を外し、直前の行に
  `// eslint-disable-next-line react-hooks/exhaustive-deps` を付ける(`ImageViewerScreen.tsx`
  と `RankingScreen.tsx` の `changePeriod` で実例あり)

---

## 9. 次のステップ: バックエンド導入の相談(このドキュメントを読んだ後にやること)

ユーザーの発言から読み取れる要望・前提:

- 「ランキングは本来、アプリ利用者全員でのダウンロードURLランキングにしたい」
  → **全ユーザー共通・グローバルなランキング機能をサーバーで実現したい**という明確な意向
- 現状、アプリは完全ローカル動作(認証・アカウント・ネットワークAPIは一切なし)
- `ranking_stats` テーブルは既に「フォルダ管理データから独立」した形状にしてあり、
  `page_url` / `page_title` / `thumbnail_uri` / `image_count` / `created_at` という
  最小限のカラムだけを持つ → サーバーAPIの送信ペイロード/レスポンス形にほぼそのまま転用できる
  ことを意図した設計
- `feedback_messages` テーブル(開発者へのメッセージ機能)も「将来のサーバー送信を見据えた
  ローカル保存」という位置づけで、同様にサーバー化候補
- `download_history` テーブル(フォルダ単位のジャンプ用URL)は **ローカルのみで良い**
  (フォルダはその端末にしか存在しないため)

### 相談・検討が必要になりそうな論点(たたき台)

1. **バックエンドの構成**: どんな技術スタック/ホスティングを想定するか(サーバーレス関数 +
   マネージドDB、専用サーバー、Firebase/Supabase 等のBaaS、等)
2. **認証・端末識別**: ユーザーアカウントを作るか、匿名の端末IDだけで統計を送るか
   (プライバシー・アカウント登録の手間とのトレードオフ)
3. **送信データとタイミング**: ダウンロード完了時に `ranking_stats` 相当のデータをどうサーバーへ
   送るか(即時送信 or バッチ、オフライン時のリトライ・キュー)
4. **集計方法**: サーバー側でも同じ `normalizeUrlKey` 相当のURL正規化ロジックが必要
   (クエリ文字列を保持する現在の方針を踏襲するか要検討)
5. **不正対策**: 同一URLへの水増し投稿(実際にダウンロードしていない/大量automated投稿)を
   どう防ぐか。グローバルランキングである以上、乱用対策は避けて通れない論点
6. **プライバシー**: ページタイトル・URL・サムネイル画像をサーバーに送ることになるため、
   利用規約・プライバシーポリシーの整備、送信内容の透明性(オプトアウト可否)も検討が必要
7. **ローカル/サーバーの表示切り替え**: 移行期間中、ローカル統計とグローバル統計を両方
   見せるのか、置き換えるのか(UI設計)
8. **フォルダ削除時の扱い**: 現状「フォルダを消してもランキング実績は消えない」設計にしてあるが、
   これがサーバー送信後のデータにも同じ考え方で良いか(送信は不可逆的な集計への参加、という
   整理でよいか)
9. **feedback_messages のサーバー送信**: 同時に着手するか、別スコープにするか

これらは全て未確定・未着手であり、次のセッションでユーザーと相談しながら方針を固める必要がある。
コード面では現状、バックエンド関連の実装は一切行っていない(API クライアント、認証、
ネットワーク層はゼロから設計することになる)。

---

## 10. タスク管理ツールの状態

このセッションのタスクリストは #1〜#112 まで全て `completed`。次回セッションでは
新しいタスクリスト(バックエンド関連)をゼロから作ることになる想定。
