# ImageViewer

Web閲覧機能と画像ビューアー/ギャラリー機能を併せ持つ、Android/iOS向けブラウザーアプリ。

## 主な機能

- **ブラウザー**: URLバー、戻る/進む/リロードを備えたWebViewブラウザー
- **画像の一括保存**: 閲覧中ページから広告を除いた連番画像を検出し、手動選択も併用して一括ダウンロード
  (ダウンロード時にページタイトル名のフォルダを自動作成)
- **画像ギャラリー**: ダウンロードしたフォルダの一覧・階層管理・タグ付け・名前/日時/タグ順ソート・
  名前/タグ検索、フォルダ内画像のグリッド表示とフルスクリーンビューアー(スワイプ・ピンチズーム)
- **画面レイアウトの自由配置**: 設定画面から「レイアウト編集モード」を有効にすると、各画面の
  操作用ボタンやバーをドラッグして好きな位置に配置できる(位置は端末に保存され、リセットも可能)
- **閲覧履歴・ブックマーク**: ページ遷移ごとに履歴を自動記録し、ワンタップでブックマーク登録。
  それぞれ一覧から選択したページをブラウザーで再度開ける
- **検索エンジン切替**: Google/Bing/Yahoo!/DuckDuckGoから検索エンジンを選択可能
- **ダークモード**: システムに従う/ライト/ダークを設定画面から選択可能(ナビゲーション・各画面に反映)
- **プライベートタブ**: 有効時はWebViewをincognitoモードで動作させ、閲覧履歴を記録しない

## 技術スタック

- [Expo](https://expo.dev/) (React Native + TypeScript)
- [React Navigation](https://reactnavigation.org/) (Bottom Tabs + Native Stack)
- [Zustand](https://github.com/pmndrs/zustand) (状態管理・画面レイアウト位置の永続化)
- [react-native-webview](https://github.com/react-native-webview/react-native-webview)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (フォルダ・タグのメタデータ管理)
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/) (画像の一括ダウンロード・フォルダ管理)
- [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) /
  [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/)
  (UIのドラッグ配置、画像ビューアーのピンチズーム)

## セットアップ

```bash
npm install
```

## 開発サーバーの起動

ネイティブモジュール(react-native-webview等)を使用するため、Expo Go ではなく
Dev Client でのビルド・起動を前提とします。

```bash
npx expo start --dev-client
```

- Android: `npm run android`
- iOS: `npm run ios` (macOS + Xcodeが必要)

## Lint / Format / Test

```bash
npm run lint          # ESLint
npm run format        # Prettier (自動整形)
npm run format:check  # Prettier (差分チェックのみ)
npm test              # Jest (ユニットテスト)
```

## ディレクトリ構成

```
src/
  navigation/   # 画面遷移構成 (Root Stack / Bottom Tabs / Gallery Stack)
  screens/      # 画面コンポーネント (Browser, Gallery, Settings)
  components/   # 共通UIコンポーネント (layout/ 配下はドラッグ配置システム)
  store/        # Zustand ストア (ブラウザー状態・画面レイアウト位置)
  db/           # SQLiteスキーマ・フォルダ/タグのリポジトリ関数
  services/     # 画像検出・グルーピング・ダウンロード・URL解析
```

## 開発ロードマップ

1. **Phase 1**: 単一タブのWebViewブラウザー(URLバー、戻る/進む/リロード) — 完了
2. **Phase 2**: 画像の一括保存・フォルダ/タグによるギャラリー管理・画面レイアウトの自由配置 — 完了
3. **Phase 3**: 閲覧履歴・ブックマークのローカル永続化 — 完了
4. **Phase 4**: 検索エンジン切替、ダークモード、プライベートタブなどの追加設定機能 — 完了
5. **Phase 5**: テスト整備とストア(App Store / Google Play)申請準備 — 完了

## リリース準備

- **ユニットテスト**: `src/services/**/__tests__` に画像検出・URL解析ロジックのテストを配置(`npm test`)
- **EAS Build**: `eas.json` にdevelopment/preview/productionのビルドプロファイルを用意
  (`npx eas build --profile production --platform android|ios` 等で利用)
- **プライバシーポリシー**: [`PRIVACY.md`](./PRIVACY.md) を参照。本アプリは外部サーバーへの
  データ送信を行わず、閲覧履歴・ブックマーク・ダウンロード画像はすべて端末内にのみ保存されます
- **バンドルID**: iOS `com.lgflatlight07.imageviewer` / Android `com.lgflatlight07.imageviewer`
  (`app.json`。実際に申請する場合は組織のドメインに合わせて変更してください)
