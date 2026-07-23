# ImageViewer 引き継ぎドキュメント

最終更新: 2026-07-22 / 対象ブランチ: `claude/android-ios-browser-app-ljupsx`
(最新コミット: `eceb179` バックエンド(Supabase)導入: 全ユーザー共通ランキングと開発者メッセージ送信)

このファイルは、次回セッション(コンテキストをクリアした後)で作業をスムーズに再開するための
引き継ぎ資料です。**バックエンド(Supabase)導入は完了し、実機で全ユーザー共通ランキングが
正常に動作することまで確認済み**です。現状のアーキテクチャ・データモデル・既知の制約・
今後の検討事項を詳細にまとめています。

---

## 1. アプリの概要

**ImageViewer** は Android/iOS 向けの「ブラウザー + 画像ビューアー/ギャラリー」アプリ。
ユーザーがアプリ内蔵ブラウザーでサイトを閲覧し、ページ内の連番画像(漫画・イラスト投稿サイト等を
想定)をワンタップで一括検出・ダウンロードし、フォルダ単位で管理・閲覧できることが中核機能。

**アーキテクチャは「ローカルファースト + 最小限のバックエンド」のハイブリッド構成**:

- フォルダ・タグ・履歴・ブックマーク・設定・レイアウト位置など、**個人的なデータはすべて端末内**
  (expo-sqlite + AsyncStorage + ファイルシステム)に閉じている
- **「全ユーザー共通ランキング」と「開発者メッセージ/エラーログ」の2つだけ**、Supabase
  (無料枠のBaaS)をバックエンドとして使っている(詳細は §5)

### リポジトリ / 環境

- GitHub: `LG-FlatLight07/ImageViewer`
- 作業ブランチ: `claude/android-ios-browser-app-ljupsx` (このブランチに全てコミット・プッシュ済み)
- 技術スタック: Expo SDK 57 (React Native 0.86 / React 19) + TypeScript、React Navigation
  (Bottom Tabs + Native Stack)、Zustand(状態管理・永続化)、expo-sqlite(構造化データ)、
  expo-file-system(画像ファイル本体)、react-native-webview、react-native-gesture-handler +
  react-native-reanimated(ドラッグ配置・ピンチズーム・アニメーション)、
  **@supabase/supabase-js(バックエンドAPIクライアント、今回追加)**。
- **重要な開発ルール**: `AGENTS.md` に「Expo が変更されているので、コードを書く前に必ず
  https://docs.expo.dev/versions/v57.0.0/ の版指定ドキュメントを読むこと」と明記されている
  (SDK 57 向けの最新ドキュメントを都度確認する運用)。
- **ユーザーの技術レベル**: プログラミング知識はほぼない。コマンド操作(`git pull`,
  `npm install` 等)は指示すれば実行できるが、エラーメッセージの意味は分からないことが多いので
  「何を」「どこで」「何と入力するか」を具体的に示す必要がある。Supabaseダッシュボードの操作も
  毎回具体的なメニュー名で案内してきた。

---

## 2. 実装済み機能の全体像

### ブラウザー(Browser タブ)

- WebView ベースのタブブラウザー(複数タブ、タブバー、新規タブ/クローズ、自動スクロール)
- URL バー(アドレス入力 or 検索ワード、検索エンジン切替: Google/Bing/Yahoo!/DuckDuckGo)
- 戻る/進む/リロード、ブックマーク登録(★トグル)、**ブックマークの表示名編集**
  (`BookmarksScreen.tsx` に鉛筆アイコン→`PromptModal`で編集、`renameBookmark()`)
- 閲覧履歴の自動記録(ページ遷移ごと)、履歴・ブックマーク一覧画面から再度開ける。履歴の全削除は
  `confirmDelete`(§2の削除確認統一、後述)経由
- プライベートモード相当(`disableHistory` 設定 ON で WebView を incognito 動作にし履歴も残さない)
- 広告・ポップアップブロック(`src/services/adBlock.ts` を `injectedJavaScriptBeforeContentLoaded`
  で注入。広告らしき要素のクラス名/ID/src文字列を正規表現で判定して非表示化 + `window.open` を
  無効化 + `setSupportMultipleWindows`/`onOpenWindow` でポップアップウィンドウを開かせない)。
  **デフォルトOFFに変更済み**(一部サイトが正しく開けなくなる副作用があったため)。設定画面の
  説明文に「サイトが正しく開けないときはオフにしてみてください」を追記
- **画像の一括保存**: ツールバーの保存ボタン → WebView に `IMAGE_SCAN_SCRIPT` を注入し、
  ページ内の `<img>` を走査(広告祖先要素・広告ドメイン・小サイズ画像は除外)→
  `detectImageGroups`(`src/services/imageGrouping.ts`)がURL末尾の数字列から「連番グループ」を
  自動検出(最大グループを primaryGroup、残りを otherImages)→ `ImageSelectionScreen` で
  サムネイル選択 UI を表示 → `downloadImagesToNewFolder` で一括ダウンロード。
  - `autoSelectSequentialImages` 設定(デフォルトON)で、画面表示時に primaryGroup を
    自動選択済みにするかどうかを切り替え可能。
  - **ダウンロード失敗の根本対応(§4に詳細)**: 画像URL解決・Referer/Originヘッダー・
    フォルダ名の禁止文字、の3つの独立したバグを特定・修正済み

### ブラウザーの URL 管理(重要な設計)

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
  `currentUrl` 導入により解消済み。

**リロードボタンが✕(読み込み中)のまま固まる不具合も修正済み**: `loading` 状態が
`onNavigationStateChange` の `navState.loading` だけに依存していたため、一部サイトで最終的な
`loading: false` イベントが来ずに固まることがあった。`onLoadStart`/`onLoadEnd`
(成功・失敗どちらでも発火するメインフレームの読み込み完了イベント)でも同期するようにし、
念のため15秒のタイムアウトで強制解除するフォールバックも追加した。

### ギャラリー(Gallery タブ)

- ダウンロード済みフォルダの一覧・階層管理(サブフォルダ作成・移動)
- ソート: 名前順/ダウンロード日時順/タグ名順/閲覧回数順
- 検索: フォルダ名 or タグ名(タグ候補チップからの選択も可)
- フォルダへのタグ付け(複数、既存タグからの選択 + 新規入力)
- フォルダ名変更、フォルダ削除・画像の複数選択削除は共通の `confirmDelete()` ヘルパー経由
  (次項参照)
- フォルダ行のスワイプ操作: 左スワイプで削除、右スワイプで「ダウンロード元 URL へジャンプ」
  (新規タブで開く)。一定時間で自動的にスワイプが元に戻る仕組みがあり、同時に複数の行が
  開いた状態にならないよう `SwipeRowCoordinator` で調整
- フォルダ詳細画面: 画像のグリッド表示、複数選択削除、フルスクリーンビューアーへの遷移
- **スライドビューワー**(`ImageViewerScreen.tsx`): 独自実装の Reanimated ベース画像ビューアー。
  横スライド/縦スライドを設定で選択可能。ページ間の隙間を極小にしたフリースクロール
  (スナップなし)、軸ロック(斜め移動禁止)、慣性を通常の 1/4 に抑制、縦スワイプでギャラリーへ戻る、
  各画像のアスペクト比に応じた正確な高さ計算(縦モード時)

**削除確認の仕組みが統一された** (`src/utils/confirmDeleteFolder.ts`):

- `confirmDelete({ title, message, confirmLabel?, onConfirm })`: 汎用の削除確認。
  `settingsStore.skipDeleteConfirmation` が true なら確認なしで即実行。false なら
  「キャンセル / 削除 / 削除(次回から確認しない)」の3択ダイアログを表示
- `confirmDeleteFolder(folderName, onConfirm)`: フォルダ削除向けの文言を固定した薄いラッパー
- **以前のバグ**: フォルダ削除だけがこの設定を見ていて、画像の複数選択削除・履歴の全削除は
  独自の `Alert.alert` を直接呼んでいたため、「削除前に確認する」をOFFにしても両者では毎回
  確認が出ていた → 全ての削除箇所を `confirmDelete` に統一して解消

### ランキング(Ranking タブ)— **全ユーザー共通(Supabase)に移行済み**

- **アプリ利用者全員でのダウンロード統計**を「ダウンロード先ページ URL」単位で集計して表示
  (以前は端末内のみの統計だったが、Supabase導入により真にグローバルになった)
- 期間フィルタ: 日別/週間/全期間(左右スワイプ or ボタンタップで切替、Reanimated による
  スライド+フェードアニメーション付き)
- 表示: 順位、サムネイル、ページタイトル(長い場合はマーキー/文字送りアニメーション)、
  ページ URL、**「◯回」(ダウンロードされた回数、主表示・ソート基準)と「◯枚」(累計画像枚数、
  補助表示)**
- 行タップでそのURLを新規タブで開きブラウザーへ遷移
- ダウンロード完了時に自動リロード(画面を離れず待っていても反映される)
- **サムネイルはサーバーに一切送らない方針**: 各端末がランキングの各URLを非表示WebViewで
  軽く読み込み、ダウンロード時と同じ `IMAGE_SCAN_SCRIPT`/`detectImageGroups` で連番1枚目
  (なければページ最初の画像)を検出し、ローカルDB(`ranking_thumbnail_cache`)にキャッシュして
  次回から即表示する(詳細は §5)
- **データソース**: Supabase の `ranking_daily_counts` テーブル(§5参照)。ローカルの
  `ranking_stats` テーブルは**もう画面表示には使われていない**(書き込みだけ継続、将来的な
  完全撤去候補)

### 設定(Settings タブ)

- 検索エンジン切替、テーマ(システム/ライト/ダーク)
- ブラウジング: 履歴を残さない、**広告・ポップアップをブロック(デフォルトOFF、説明文に注意書き追加)**
- 画像のダウンロード: 連番画像を自動選択
- ギャラリー: 削除前に確認する(トグル。OFFで確認なしの即時削除。**全ての削除箇所に適用**)
- フォルダ名の除外文字列リスト(ページタイトルからフォルダ名を自動生成する際に除去する文字列)
- スライドビューワーの方向(横/縦)
- 画面レイアウト: レイアウト編集モードのON/OFF、レイアウトのリセット
- サポート: 開発者へメッセージを送る(**ローカル保存 + Supabaseへも自動送信**、送信成否を
  ローカルの`status`列に記録)、アプリの使い方・仕様ガイド画面

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
    SwipeRowCoordinator.tsx  スワイプ行の自動クローズ調整(id基準)
    RankingThumbnailScanner.tsx  ランキングのサムネイルを非表示WebViewで検出(新規)
    URLBar.tsx / BrowserTabBar.tsx
    ActionMenuModal.tsx / PromptModal.tsx / TagEditorModal.tsx
    DownloadProgressBar.tsx / DownloadCompleteToast.tsx
  db/
    schema.ts          SQLiteマイグレーション定義(現在 SCHEMA_VERSION = 8)
    DatabaseProvider.tsx
    foldersRepository.ts     folders テーブル CRUD(download_history と LEFT JOIN して sourceUrl 解決)
    downloadHistoryRepository.ts  download_history(ローカル)書き込み + Supabase record_download RPC呼び出し
    rankingRepository.ts     Supabaseのranking_daily_countsから全ユーザー共通ランキングを集計・取得(新)
    rankingThumbnailRepository.ts  ランキングサムネイルのローカルキャッシュ(新規)
    historyRepository.ts / bookmarksRepository.ts(renameBookmark追加) / feedbackRepository.ts(Supabase送信追加)
    folderImages.ts    フォルダ内画像ファイルの列挙・削除(expo-file-system)
    types.ts
  navigation/          RootNavigator / BrowserNavigator / GalleryNavigator, 型定義(types.ts)
  screens/
    Browser/           BrowserScreen, HistoryScreen, BookmarksScreen(表示名編集追加), ImageSelectionScreen
    Gallery/            FolderListScreen, FolderDetailScreen, FolderPickerScreen, ImageViewerScreen
    Ranking/            RankingScreen(全ユーザー共通ランキング + サムネイル自動検出 + マーキー)
    Settings/           SettingsScreen, AppGuideScreen
  services/
    imageExtraction.ts  WebView注入スキャンスクリプト(IMAGE_SCAN_SCRIPT)。ランキングのサムネイル検出でも再利用
    imageGrouping.ts    連番グループ検出ロジック(detectImageGroups)
    downloadService.ts  一括ダウンロード実行(Referer/Origin+リトライ、URI非対応文字除去) + download_history/Supabase記録
    adBlock.ts          広告ブロック注入スクリプト(デフォルトOFF)
    urlUtils.ts         アドレスバー入力の URL/検索クエリ判定
    urlNormalization.ts  normalizeUrlKey共有モジュール(新規、ローカル/Supabase両方で同じキー生成に使用)
    supabaseClient.ts   Supabaseクライアント初期化(新規、EXPO_PUBLIC_環境変数から)
  store/
    browserStore.ts     タブ状態(url/inputValue/currentUrl の分離)
    settingsStore.ts    全設定値(persist・AsyncStorage)。adBlockEnabledデフォルトfalseに変更
    layoutStore.ts      UI配置の永続化
    downloadStore.ts    ダウンロード進捗のグローバル表示用
  utils/
    confirmDeleteFolder.ts  汎用confirmDelete + confirmDeleteFolderラッパー(「次回から確認しない」対応、全削除箇所で共用)
  theme/theme.ts
.env                    Supabaseの接続情報(gitignore対象、各開発者が個別に作成)
.env.example            .envに必要な変数名のテンプレート(コミット済み)
```

---

## 4. ダウンロード失敗バグの調査で判明した3つの独立したバグ(重要・再発注意)

ユーザーから複数回「ダウンロードに失敗する」という報告があり、段階的に原因を特定した。
**すべて `src/services/downloadService.ts` / `src/services/imageExtraction.ts` に関連**:

1. **遅延読み込み画像の相対URL未解決**: `data-src` 等の遅延読み込み属性は `getAttribute()` で
   取得すると相対URLのまま返ってくる(`img.src`プロパティと違い自動解決されない)。
   `resolveSrc()` で `new URL(lazy, document.baseURI)` により絶対URL化するよう修正。
   **通常の `<img src="...">` のケースは触らず `img.src` のまま**(最初の修正でここまで
   厳格なURL解決に巻き込んでしまい退行を起こした反省を踏まえた設計)
2. **ホットリンク対策(Referer検証)への対応と、その副作用への対処**: 多くの画像CDNは
   Refererを検証するため、`Referer`/`Origin` ヘッダーを付与するよう修正。ただし一部サイトは
   逆に合成ヘッダーを拒否するため、**ヘッダー付きで失敗したらヘッダーなしで1回リトライ**する
   フォールバックを追加(`downloadWithConcurrency` 内)
3. **【実機ログで特定した本当の根本原因】フォルダ名の未エスケープ文字**: ページタイトルに
   含まれる半角の `[進行中]` のような角括弧が、`sanitizeFolderName()` では許可されたまま
   フォルダ名に使われていた。Androidの `java.net.URI` パーサーは `file://` パス中の
   未エスケープの `[` `]` を許容しない(IPv6アドレス表記専用の予約文字のため)ため、
   フォルダの存在確認のたびに `IllegalArgumentException: Illegal character in path` で
   クラッシュしていた(画像・フォルダ自体は保存済みなのに「失敗」と表示される)。
   `INVALID_FILENAME_CHARS` に `[ ] { } ^ \` # % ;`を追加して解決。`src/services/**tests**/downloadService.test.ts` に実際にクラッシュした文字列を使った
   回帰テストあり。

   **教訓**: エラーを握りつぶさず開発者メッセージ/コンソールに出力するようにしたことで、
   この根本原因(実機の生のJavaエラーログ)が初めて見えた。それまでは推測で2回外している。
   ダウンロード関連の不具合報告を受けたら、まず実際のエラーメッセージを聞くこと。

4. **副次的な誤判定バグ**: `recordDownloadHistory()`(ローカルdownload_history/ranking_stats
   書き込み + Supabase送信)が失敗しても、画像・フォルダ自体は既に保存済みなのに全体が
   「失敗」と表示されていた。この記録処理を独立したtry/catchで分離し、失敗してもユーザーには
   「失敗」と伝えずログのみ出力するよう修正済み。

---

## 5. バックエンド(Supabase)アーキテクチャ

### 5-1. 導入の経緯・要件

ユーザーの要件(そのまま引用):

> 今のところ、サーバーの使い道は、「ランキング機能のためのダウンロード履歴保存」
> 「開発者へのメッセージ＆ダウンロードエラーログ送信先」だけです。サーバーにお金を
> かけたくありません。ダウンロード履歴はプライバシーに関わるので漏洩リスクにも気を配りたい。

→ **Supabase(無料枠のマネージドPostgreSQL + 自動生成REST API + Row Level Security)** を採用。
理由: サーバーコードを一切書かずに済む、無料枠で十分足りる規模、「URLごとの件数を集計して
期間で絞って多い順に並べる」というランキングのクエリ形状がSQL(Postgres)と相性が良い
(Firestore等はGROUP BY相当が苦手)。

### 5-2. Supabase側のセットアップ(ユーザーがSQL Editorで実行済み)

```sql
-- ランキング(全ユーザー共通の集計テーブル)
create table ranking_daily_counts (
  url_key text not null,
  source_url text not null,
  page_title text not null,
  day date not null,               -- UTC日付。1URL・1日につき1行(件数を積み上げる)
  download_count integer not null default 0,
  image_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (url_key, day)
);
-- RLS: anonロールにはSELECTのみ許可。直接のINSERT/UPDATE権限は与えない

-- 書き込みは「+1する」専用関数経由のみ(不正な大量書き込み対策)
create function record_download(p_url_key text, p_source_url text, p_page_title text, p_image_count integer)
  returns void language plpgsql security definer
  -- ON CONFLICT (url_key, day) DO UPDATE で download_count/image_count を+1するUPSERT
-- anonロールにEXECUTE権限のみ付与

-- 開発者メッセージ・エラーログ(書き込み専用、読み出しはダッシュボードのみ)
create table feedback_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now()
);
-- RLS: anonロールにINSERTのみ許可(SELECTポリシーなし = 誰も読めない、ダッシュボードは別経路)
```

**重要な設計上の判断**: `ranking_daily_counts` は「URL×日付」で1行に集計する方式にしており、
ダウンロードの延べ回数に比例して行が増え続けることはない(異なるURL×日付の組み合わせ数にしか
比例しない)ため、無料枠(500MB)で長期間問題にならない設計。

### 5-3. アプリ側の実装

- `src/services/supabaseClient.ts`: `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (`.env`、gitignore対象)から初期化。**未設定の場合は `supabase` が `null` になり、関連機能は
  静かに無効化される**(ローカルファーストの機能は一切壊れない設計)
- `src/services/urlNormalization.ts`: `normalizeUrlKey()` を共有モジュールとして切り出し
  (host+path+query、末尾スラッシュ・大文字小文字・フラグメント無視、クエリ文字列は保持)。
  ダウンロード時の書き込み(`downloadHistoryRepository.ts`)とランキング表示
  (`rankingRepository.ts`)の両方で同じキー生成を使う必要があるため
- `downloadHistoryRepository.recordDownloadHistory()`: ローカルの `download_history`/
  `ranking_stats` 書き込みに加えて、`supabase.rpc('record_download', {...})` を呼ぶ。
  **独立したtry/catchで囲み、ネットワーク失敗等がローカルのダウンロード成功/失敗判定に
  一切影響しないようにしている**
- `feedbackRepository.submitFeedbackMessage()`: ローカル保存(常に先に実行、オフラインでも
  失われない)→ Supabaseへも送信を試み、成否をローカルの `status`列(`sent`/`failed`)に記録
- `rankingRepository.getDownloadRanking(period)`: `db`引数なし(Supabaseのみ参照)。
  期間はUTC日付文字列でフィルタし(`day >= cutoff`)、JS側で `url_key` ごとに集計
  (SQLのGROUP BYではなく「最新日の行のタイトル/URLを採用」という集計ロジックが
  PostgRESTで表現しづらいため)
- **サムネイル(§2で前述)**: `RankingThumbnailScanner.tsx` が非表示WebView
  (`position:absolute, opacity:0`)で1件ずつキューを処理し、`IMAGE_SCAN_SCRIPT`/
  `detectImageGroups` を再利用して画像URLを検出、`rankingThumbnailRepository.ts` 経由で
  ローカルDB(`ranking_thumbnail_cache`、マイグレーション8)にキャッシュする。
  **画像そのものは一度もサーバーに送らない**(著作権・ストレージコストへの配慮)

### 5-4. `.env` セットアップ(新しい開発マシンで必要な手順)

`.env` は `.gitignore` 対象のため `git pull` では来ない。プロジェクトルート
(`package.json` と同階層)に手動で作成する必要がある:

```
EXPO_PUBLIC_SUPABASE_URL=https://iveikuyuosjpddidfael.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ggilmEu19iELkFWMWNmunw_0V8_nSNz
```

(`.env.example` に変数名だけのテンプレートあり。値は本セッションでユーザーから共有された実際の
プロジェクトの認証情報 — publishable/anonキーなのでクライアントアプリに埋め込む前提のキーであり、
機密情報ではない)

### 5-5. プライバシー・セキュリティに関するQ&A(ユーザーへの説明済み内容)

- `ranking_daily_counts` は **RLSでSELECTが公開**されているため、技術的には誰でも(アプリ経由
  でなくても直接APIを叩けば)全件を読める。ただし**保存しているのはURL・タイトル・件数の集計
  のみで、ユーザーを特定できる情報(アカウント・端末ID等)は一切含まれない**。個人の閲覧履歴が
  流出する形ではない
- `feedback_messages` はINSERTのみ許可(SELECTポリシーなし)のため、**アプリ利用者からは
  絶対に読めない**。開発者本人がSupabaseダッシュボードにログインした時のみ閲覧可能
- 現状、水増し投稿(botによる大量ダウンロード偽装)への対策は「1回の関数呼び出しで+1しか
  できない」という制限のみ。IPレート制限等は未実装(§6の今後の検討事項)

### 5-6. 動作確認済みの内容

- このサンドボックス環境から実際にユーザーのSupabaseプロジェクトへHTTPS接続し、
  ランキング取得クエリが正常に成功する(空データが正しく返る)ことを確認済み
  ("`ranking_daily_counts is empty`" → アプリのランキング画面も正しく「実績なし」と表示)
- ユーザーの実機(Windows PC + Expo)で実際にダウンロード→Supabaseへのデータ反映→
  ランキング画面での表示、まで一気通貫で動作確認済み
- **ハマったポイント(参考)**: `git pull` が「ローカルの `package-lock.json` の変更が
  上書きされる」エラーで失敗し、最新コミットに進めないことがあった
  (`git checkout -- package-lock.json` → `git pull` → `npm install` で解決)。
  npm installだけ実行してgit pullをしていないと最新コードが反映されない点は今後も注意

---

## 6. 今後の検討事項(未着手・要相談)

1. **不正投稿対策の強化**: 現状は「+1のみ許可するRPC」という最小限の対策のみ。
   本格的なレート制限や異常検知は未実装
2. **ローカル `ranking_stats` テーブルの扱い**: 現在は書き込みのみで画面表示には使われていない
   (vestigial)。完全に撤去するか、オフライン時のフォールバック表示として活用するかは未決定
3. **`ranking_daily_counts` の「全期間」クエリのページネーション**: 現状は無制限に全件取得
   している。将来データ量が増えた場合はページネーションや集計ビューの検討が必要
4. **iOS(iPhone)配布**: コードは完全にクロスプラットフォーム対応済みだが、
   (a) Expo Go アプリがまだ SDK 57 に対応しておらずiPhoneでの簡易プレビューができない、
   (b) TestFlight配布や正式インストールには Apple Developer Program(年額$99)への登録が必要
   — ユーザーは未登録。開発中の動作確認はAndroidエミュレータで代替可能(README参照)
5. **feedback_messagesの活用**: 現状はSupabaseに送信・蓄積されるのみで、閲覧・対応するための
   管理画面や通知の仕組みは未整備(Supabaseダッシュボードで手動確認する運用)

---

## 7. 既知の制約・サンドボックス環境の限界

- **`react-native-webview` は react-native-web 上で未対応**(`WebView` はプレースホルダー
  「React Native WebView does not support this platform」を表示するのみ)。そのため
  ブラウザータブ・広告ブロック・ランキングのサムネイル自動検出の実機的な動作確認は
  **この開発環境(コンテナ)内では不可能**で、コードレビューのみで担保している。実機
  (Android/iOS)またはAndroidエミュレータでの確認が別途必要
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
- **一方でSupabaseへのHTTPS通信は実際に到達可能**(エージェントプロキシ経由)なので、
  Supabase関連の読み取りクエリはこのサンドボックスから実際にライブ検証できる
  (§5-6参照)。ただし**書き込み(record_downloadの実行等)はユーザーの実データを汚染する
  ため、ユーザーの許可なくこのサンドボックスから実行すべきではない**(今回も実施していない)

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
- **ダウンロード関連の不具合報告を受けたときの鉄則(§4の教訓)**: 推測で直しにいく前に、
  実際のエラーメッセージ(コンソールログ、開発者メッセージに送られたエラー内容)を確認する。
  このセッションでは2回推測で外し、3回目に実機のJavaエラーログを見せてもらって初めて
  真因(フォルダ名の未エスケープ文字)が判明した

---

## 10. Android公開準備(#129〜#134)

ユーザーの希望で、まずAndroid(Google Play)への公開準備のみを先行して進めた
(iOSはApple Developer Program未登録のため後回し)。

- **`PRIVACY.md`**: これまで「外部送信は一切なし」という記述のままSupabase導入前の内容で
  放置されていたため、実態(ランキング用のURL・タイトル・枚数送信、開発者メッセージ送信)に
  合わせて全面的に書き直した。ストア審査に出す前に気づけて良かったポイント
- **`README.md`**:「リリース準備」節に「Android(Google Play)への公開手順」を追加。
  Play Console登録($25・一回のみ)→ストア掲載情報入力→プライバシーポリシーURL登録→
  データセーフティ回答→コンテンツレーティング→`eas build`→`eas submit`、という一連の
  流れと、スクリーンショットはサンドボックスで撮影不可(実機/エミュレータで撮る必要あり)
  な旨を明記
- **`STORE_LISTING.md`(新規)**: ストア掲載用のタイトル・説明文・カテゴリ・
  データセーフティ回答案の下書き。Play Consoleにそのままコピー&ペーストできる想定
- **`eas.json`**: `submit.production.android` に `serviceAccountKeyPath` と
  `track: "internal"` を追加(内部テストトラックへの自動提出用)。鍵ファイル
  `google-service-account.json` は `.gitignore` に追加済み(未作成・ユーザーがPlay Console
  でサービスアカウントを発行した後に配置する想定)

### 10-1. ここから先はユーザー自身の操作が必要(私はアカウント作成・支払いができない)

1. Google Play Consoleへの登録($25・本人確認あり)
2. アプリの新規作成・ストア掲載情報の入力(`STORE_LISTING.md`参照)
3. プライバシーポリシーを公開URLとして登録(GitHubのファイル表示URLで可)
4. 実機またはAndroidエミュレータでの操作画面のスクリーンショット撮影
5. `npx eas login` → `npx eas build --profile production --platform android`
6. (自動提出する場合)Google Cloudでサービスアカウントを作成しPlay Consoleに権限付与、
   JSON鍵を `google-service-account.json` として配置 → `npx eas submit --platform android`
7. 内部テスト→クローズドテスト→本番公開、の順にPlay Console上で審査・公開を進める

iOS側は上記が一段落し、Apple Developer Program登録の意思があれば別途着手する想定。

---

## 11. 収益化(広告・買い切り課金、#135〜#144)

ユーザーとの相談の結果、「報酬型広告(視聴でその日のダウンロード無制限)」+
「買い切り課金(非消耗型IAP、すべて無制限+ランキング上位50位まで解放)」の
組み合わせで実装した。

### 11-1. エンタイトルメント(制限・解放状態)の一元管理

`src/store/monetizationStore.ts` が唯一の情報源(AsyncStorageに永続化):

- `purchasedPremium: boolean` — 買い切り課金の有無
- `rewardedAdDate: string | null` — 広告を最後に視聴した「その日」の日付(端末のローカル日付、
  UTCではない。ユーザー体験として「日本時間の深夜0時にリセット」を期待されるため)
- `dailyDownloadDate` / `dailyDownloadUsed` — 当日のダウンロード実行回数(1操作=1カウント。
  画像の枚数ではなく「保存ボタンを押した回数」で数える)

各種ゲーティング判定(`canStartDownload`, `canCreateNewTag`, `rankingVisibleCount` 等)は
すべてこのストアの値から計算する純粋関数として実装し、`src/store/__tests__/
monetizationStore.test.ts` で単体テスト済み。

### 11-2. 各制限の実装箇所

- **ダウンロード1日3回まで**: `ImageSelectionScreen.tsx` の `handleDownload` で
  `canStartDownload()` を確認し、超過時はAlertで案内(ギャラリーへの導線を明示)。
  ダウンロード開始時に `consumeDownloadUse()` でカウントを消費(成功/失敗に関わらず
  1回分を消費— 失敗時の無限リトライによる回数制限の骨抜きを防ぐため)
- **報酬型広告ボタン**: `RewardedAdButton.tsx`。ギャラリー画面(`FolderListScreen.tsx`)に
  `ControlGroup`(既存のドラッグ配置レイアウトシステム)の1要素として追加、
  `defaultAnchor="bottomRight"`。購入済みなら非表示(すでに無制限のため無意味)
- **タグ全体で5個まで**: `TagEditorModal.tsx`。「アプリ全体で今までに作られた
  ユニークなタグ名の数」が上限対象で、既存タグの再利用(このフォルダへの追加)は
  何個でも自由。新規タグ名を追加しようとした時だけ上限チェックする
- **ランキング上位3位まで/上位50位まで**: `RankingScreen.tsx`。未購入時は
  rank>3の行の画像・タイトルを `expo-blur` の `BlurView` でモザイク表示し、タップも
  無効化。ロック中の行はサムネイル自動検出(WebViewスキャン)の対象からも除外し、
  見えない情報のために無駄なページ読み込みをしない設計とした。
  `rankingRepository.ts` の取得件数は20→50に拡張(未購入者向けにも「あと何位で
  何位まで見えるか」を示すため、ロックされた行のデータ自体は取得しておく)

### 11-3. 広告(react-native-google-mobile-ads)・課金(expo-iap)の統合

- どちらもExpo Goに同梱されていないネイティブモジュールのため、**この変更以降
  Expo Goでの起動が一切できなくなった**(README「実機プレビュー(Dev Client)」に
  全面改訂済み)。実機・エミュレータともにDev Clientビルドが必須
- `src/services/rewardedAdService.ts`: `useRewardedAd` フックのラッパー。
  Platform.OS==='web'の場合はhookを一切呼ばずスタブを返す(react-native-web用の
  実装が存在しないSDKのため)
- `src/services/purchaseService.ts` + `src/components/PurchaseSync.tsx`: `expo-iap`
  の `useIAP` はフックとしてしか提供されないため、App.tsxのルート直下に一度だけ
  マウントする`PurchaseSync`が接続を保持し、モジュールレベルの「ブリッジ」経由で
  他画面(設定画面)から`requestPremiumPurchase()`/`restorePremiumPurchases()`を
  呼べるようにした(複数箇所で`useIAP`を呼んで接続が重複するのを避けるため)
- 広告ユニットID/商品IDは `.env` 未設定時、それぞれGoogle公式のテスト広告ID/
  プレースホルダー商品IDにフォールバックする(Supabaseクライアントの
  「未設定ならnullを返し呼び出し側が握りつぶす」と同じ設計思想)

### 11-4. 開発者機能(実機テスト用コマンド)

設定画面の「開発者機能(実機テスト用)」セクションに3つのボタンを追加
(`SettingsScreen.tsx`)。いずれも`monetizationStore`を直接書き換えるだけで、
広告SDK/課金SDKには一切触れないため、Web環境でも(Dev Clientがなくても)動作確認できる。

- 「報酬型広告を視聴したことにする」→ `grantRewardedAdToday()`
- 「買い切り課金をしたことにする」→ `setPurchasedPremium(true)`
- 「買い切り課金をしていないことにする」→ `setPurchasedPremium(false)`

### 11-5. サンドボックスでの検証状況

このサンドボックス環境にはAndroid SDK/エミュレータも実機もないため、広告表示・実際の
購入フローの動作確認は一切できていない(react-native-google-mobile-ads/expo-iapは
react-native-web向けの実装を持たないネイティブモジュールのため、Web環境でも動作確認
不可)。`npx tsc --noEmit` / `npx eslint` / `npx jest` は全てパス、
`monetizationStore.ts` の純粋関数部分は単体テストで担保しているが、**実際にAndroid実機
またはエミュレータのDev Clientビルドでの一気通貫の確認は未実施**。ユーザー側での
実機確認を強く推奨する

### 11-6. プライバシーポリシーへの反映

広告SDK(AdMob)・課金SDK(Google Play Billing)の導入に伴い、`PRIVACY.md`に
「広告(Google AdMob)について」「アプリ内課金について」の2セクションを追加し、
従来の「広告SDKは組み込んでいない」という記述を削除・修正した(ストア審査に
出す前に気づけて良かったポイント。今回は自分で見つけて先に直した)

---

## 12. タスク管理ツールの状態

このセッションのタスクリストは #1〜#144 まで全て `completed`。バックエンド導入・
Android公開準備(ドキュメント整備まで)・収益化(広告・買い切り課金)の実装は完了。
実際のPlay Console登録・ビルド提出・AdMob/IAPの実機動作確認はユーザー側の操作待ち。
次回セッションで新しい依頼があれば、そこから新規タスクを起こす想定。
