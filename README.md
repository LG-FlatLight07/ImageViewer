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

本プロジェクトが使用するネイティブモジュール(react-native-webview等)は、現時点では
いずれもExpo Go(SDK 57)に標準搭載されたバージョンと互換のため、**Expo Goでの実機
プレビューが利用できます**(下記「実機プレビュー」セクション参照)。カスタムネイティブ
コードを追加した場合など、Expo Goで動かなくなった場合はDev Clientでのビルド・起動に
切り替えてください。

```bash
npx expo start --dev-client
```

- Android: `npm run android`
- iOS: `npm run ios` (macOS + Xcodeが必要)

### 実機プレビュー(Expo Go・推奨: Mac/Android Studio不要)

Windows PCからでも、Mac(Xcode)やAndroid Studioなしで、お手持ちのスマートフォンに
コードの変更をリアルタイムに反映しながら開発できます。iPhoneでもApple Developer
Programへの登録は不要です。iPhoneでうまく起動しない場合は、下記の
「Androidエミュレータでのプレビュー」の方が確実です。

1. PCにNode.js(LTS版)をインストールし、このリポジトリをclone後 `npm install`
2. スマートフォンに **Expo Go** アプリをインストール
   ([App Store](https://apps.apple.com/app/expo-go/id982107779) /
   [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent))
3. PCでdevサーバーを起動

   ```bash
   npm start
   ```

   ターミナルにQRコードが表示されます。

4. スマートフォンで読み取る
   - iPhone: 標準の**カメラアプリ**でQRコードを読み取り、通知をタップ(Expo Goが自動で開きます)
   - Android: Expo Goアプリ内の「Scan QR code」でQRコードを読み取り
5. PCとスマートフォンが同じWi-Fiに接続されていれば、そのままアプリが起動します。
   接続できない場合(モバイル回線・別ネットワーク・社内LANの分離など)は、代わりに

   ```bash
   npm run start:tunnel
   ```

   を使ってください(初回はトンネル用パッケージ `@expo/ngrok` のインストールを
   求められるので、指示に従ってインストールしてください)。

6. コードを保存すると、スマートフォン上のアプリが自動でリロードされます。
   ブラウザータブ(WebView)を含め、実機上ではすべての機能を確認できます。

**注意点**: Expo Goでは `react-native-reanimated` / `react-native-worklets` を
Expo SDKに同梱されたバージョンでしか利用できません。本プロジェクトの現在のバージョン
(`package.json` 参照)はExpo SDK 57のExpo Go対応範囲内ですが、将来これらのパッケージを
更新する際は [Expo公式の対応表](https://docs.expo.dev/versions/latest/sdk/reanimated/)
を確認してください。範囲外になった場合はExpo Goではなく、EAS Build等でのDev Client
ビルドが必要になります。

**「Project is incompatible with this version of Expo Go」と表示される場合**: Expo Go
アプリを最新版に更新しても解消しないことがあります。これは、SDKの新バージョン(現在は
SDK 57)がリリースされてから、App Store/Google Play版のExpo GoがそのSDKに対応するまでに
タイムラグが生じるためです。この場合、Expo GoがSDK 57に対応するまでの暫定策として、
下記の「Webプレビュー」を使って開発を進めてください。

### Androidエミュレータでのプレビュー(推奨: 検索→画像保存まで通しで確認したい場合)

`react-native-webview` はWeb実装を持たないため、下記の「Webプレビュー」ではブラウザータブ
そのものを確認できません。「実際にブラウザでページを検索して画像を保存する」までを通しで
試すには、**Androidの実行環境そのもの**が必要です。Windows PC上でも、
**Android Studio + Androidエミュレータ**を使えば無料・追加のアカウント登録なしで実現できます
(iOSと違い、Androidは実機/エミュレータともに開発者アカウント登録が不要です)。

1. [Android Studio](https://developer.android.com/studio) をインストールします。
   セットアップウィザードで Android SDK・Emulator・システムイメージも一式インストールされます。
2. Android Studioを開き、右側の **Device Manager** → **Create Device** で仮想デバイス(AVD)を
   作成します(Pixelシリーズ+比較的新しいAPIレベルのシステムイメージを選択)。
3. Device Managerの再生ボタンでエミュレータを起動します。
4. プロジェクトフォルダで開発サーバーを起動し、まずExpo Goでの起動を試します。

   ```bash
   npm start
   ```

   ターミナルで `a` キーを押すと、起動中のエミュレータにExpo Goが自動インストールされ
   アプリが起動します。

5. もしAndroid版のExpo GoもSDK 57に未対応で起動できない場合は、代わりに
   このプロジェクト専用のネイティブDev Clientをローカルでビルドして
   エミュレータに直接インストールします(EASのようなクラウドビルドは使わず、
   Android Studio付属のSDK/Gradleだけでビルドするため、Expo Goのバージョン互換性問題を
   回避できます)。

   ```bash
   npx expo run:android
   ```

   初回ビルドは数分〜十数分かかり、数GBのディスク容量を使用します。

6. 起動できれば、**Android実機と同じWebView実装**が使えるようになります。ブラウザータブで
   URLや検索ワードを入力してページを開き、「画像を保存」ボタンから連番画像の検出・選択・
   ダウンロード・ギャラリーでの確認まで、実際のアプリ操作で一気通貫にテストできます。

### Webプレビュー(簡易確認用)

`npm run web` でブラウザ上に簡易プレビューを表示できます。ただし
`react-native-webview` はWeb実装を持たないため、**ブラウザータブ(WebView本体)は
Web上では動作しません**。ギャラリー・設定・履歴・ブックマークなど他画面の確認や
UI/レイアウトの動作確認用途で使ってください。実際のWebView込みの動作確認は
Dev Client(`npx expo start --dev-client`)+実機/エミュレータで行ってください。

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
- **プライバシーポリシー**: [`PRIVACY.md`](./PRIVACY.md) を参照。閲覧履歴・ブックマーク・
  ダウンロード画像は端末内にのみ保存されますが、ダウンロードランキング機能のため
  URL・タイトル・ダウンロード枚数(個人を特定できる情報は含まない)をSupabaseへ送信します
- **バンドルID**: iOS `com.lgflatlight07.imageviewer` / Android `com.lgflatlight07.imageviewer`
  (`app.json`。実際に申請する場合は組織のドメインに合わせて変更してください)

### Android(Google Play)への公開手順

現状、iOSはApple Developer Program(年額$99)未登録のため配布できません。まずはAndroid
(Google Play)への公開を進める場合の手順は以下の通りです。ここから先はGoogleアカウントでの
登録・支払いが必要なため、開発者(ユーザー)自身の操作が必要です。

1. **Googleアカウントの準備**: 公開用に使うGoogleアカウントを決める
2. **Google Play Console への登録**(https://play.google.com/console/ ) — 初回のみ
   登録料 $25(一回のみ、以後の年会費なし)。個人/組織アカウントの選択、本人確認が必要
3. **アプリを新規作成**: Play Console上で「アプリを作成」→ アプリ名・言語・
   無料/有料・ポリシー系の宣言(広告の有無等)を入力
4. **ストア掲載情報を入力**: タイトル・説明文・アイコン・スクリーンショット・カテゴリ等。
   下書きは [`STORE_LISTING.md`](./STORE_LISTING.md) を参照してコピー&ペースト可能
   - **スクリーンショット**: このサンドボックス環境では `react-native-webview` が
     react-native-web上で動作しないため撮影できません。実機または
     「Androidエミュレータでのプレビュー」で実際にアプリを操作しながら撮影してください
5. **プライバシーポリシーのURL登録**: [`PRIVACY.md`](./PRIVACY.md) の内容を、
   誰でもアクセスできるURLとして登録する必要があります(GitHubのファイル表示URL
   `https://github.com/<owner>/<repo>/blob/main/PRIVACY.md` で構いません)
6. **データセーフティの入力**: 「収集するデータの種類」を聞かれるので、
   [`STORE_LISTING.md`](./STORE_LISTING.md) のデータセーフティ回答案を参照して入力
7. **コンテンツレーティングの質問に回答**(Play Console上のアンケート形式)
8. **アプリのビルド**: `npx eas build --profile production --platform android`
   (初回は `npx eas login` でExpoアカウントへのログインが必要。Androidの署名鍵は
   EASが自動生成・管理します)
9. **Play Consoleへの提出**:
   - 手動: ビルド完了後にダウンロードされる `.aab` ファイルをPlay Consoleの
     「テスト」→「内部テスト」トラックなどに手動アップロード
   - 自動: Google Cloudでサービスアカウントを作成しPlay Consoleに権限を付与、
     ダウンロードしたJSON鍵を `google-service-account.json` としてプロジェクト直下に置き
     (`.gitignore` 済み、絶対にコミットしないこと)、`npx eas submit --platform android`
     を実行(`eas.json` の `submit.production.android` を参照)
10. **内部テスト→本番公開**: まずは内部テスト/クローズドテストで動作確認してから、
    Play Consoleの審査を経て段階的に本番公開する
