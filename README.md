# ImageViewer

Web閲覧機能と画像ビューアー/ギャラリー機能を併せ持つ、Android/iOS向けブラウザーアプリ。

## 技術スタック

- [Expo](https://expo.dev/) (React Native + TypeScript)
- [React Navigation](https://reactnavigation.org/) (Bottom Tabs)
- [Zustand](https://github.com/pmndrs/zustand) (状態管理)
- [react-native-webview](https://github.com/react-native-webview/react-native-webview)
- expo-file-system / expo-media-library (画像保存・ギャラリー連携。Phase 3で利用予定)

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

## Lint / Format

```bash
npm run lint          # ESLint
npm run format        # Prettier (自動整形)
npm run format:check  # Prettier (差分チェックのみ)
```

## ディレクトリ構成

```
src/
  navigation/   # 画面遷移構成 (Bottom Tabs)
  screens/      # 画面コンポーネント (Browser, Gallery, History, Bookmarks, Settings)
  components/   # 共通UIコンポーネント
  store/        # Zustand ストア
  db/           # ローカルDB (履歴・ブックマーク、Phase 2で実装予定)
  services/     # URL解析やダウンロード処理などのユーティリティ
```

## 開発ロードマップ

1. **Phase 1 (現在)**: 単一タブのWebViewブラウザー(URLバー、戻る/進む/リロード)
2. **Phase 2**: ブックマーク・閲覧履歴のローカル永続化
3. **Phase 3**: Webページ内画像の保存とアプリ内ギャラリー/フルスクリーンビューアー
4. **Phase 4**: 検索エンジン切替、ダークモード、プライベートタブなどの設定機能
5. **Phase 5**: テスト整備とストア(App Store / Google Play)申請準備
