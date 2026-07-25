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
- **ダウンロードランキング**: 全ユーザー共通のダウンロード実績ランキング(上位3位まで無料公開)
- **収益化**: リワード広告の視聴でその日のダウンロードが無制限に、買い切り課金で
  ダウンロード無制限・タグ無制限・ランキング上位50位までの閲覧が可能(詳細は後述)

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
- [Supabase](https://supabase.com/) (`@supabase/supabase-js`) — 全ユーザー共通ランキング・
  開発者へのメッセージ送信
- [react-native-google-mobile-ads](https://docs.page/invertase/react-native-google-mobile-ads) —
  リワード広告(視聴でその日のダウンロード無制限)
- [expo-iap](https://github.com/hyochan/expo-iap) — 買い切り課金(プレミアム機能の解放)
- [expo-blur](https://docs.expo.dev/versions/latest/sdk/blur-view/) — ランキング未解放行の
  モザイク表示

## セットアップ

```bash
npm install
```

## 開発サーバーの起動

⚠️ **重要**: 広告(AdMob / react-native-google-mobile-ads)と買い切り課金(expo-iap)を
導入したことで、これらはExpo Goに同梱されていないネイティブモジュールとなり、**以後
Expo Goでの起動は一切できなくなりました**(iPhone・Android共通)。実機・エミュレータの
どちらでも、このプロジェクト専用の **Dev Client** ビルドが必須です。詳しくは下記
「実機プレビュー(Dev Client)」を参照してください。

```bash
npx expo start --dev-client
```

- Android: `npm run android`
- iOS: `npm run ios` (macOS + Xcodeが必要)

### 実機プレビュー(Dev Client)

Expo Goの代わりに、このプロジェクト専用のDev Clientアプリをスマートフォンに一度だけ
インストールすれば、以後はこれまでのExpo Goと同じ「コードを保存すると実機に即反映される」
開発体験が続けられます。Androidであれば、下記の方法でもMac(Xcode)やAndroid Studioの
ローカルインストールは不要です(ビルド自体をクラウド(EAS)で行うため)。

1. PCにNode.js(LTS版)をインストールし、このリポジトリをclone後 `npm install`
2. 無料のExpoアカウントを作成し、CLIでログイン

   ```bash
   npx eas-cli login
   ```

3. Android用のDev Clientをクラウドでビルド(初回は数分〜十数分かかります)

   ```bash
   $env:EAS_NO_VCS=1
   npx eas-cli build --profile development --platform android
   ```

   ビルド完了後にターミナルへ表示されるURL(またはQRコード)から、実機にAPKを
   直接インストールしてください。

4. PCでdevサーバーを起動

   ```bash
   npx expo start --dev-client
   ```

   表示されるQRコードを、インストールしたDev Clientアプリで読み取ります(Expo Goでは
   なくDev Clientアプリで読み取る点に注意)。PCとスマートフォンが同じWi-Fiに接続されて
   いない場合は、代わりに `npm run start:tunnel` を使ってください。

5. コードを保存すると、スマートフォン上のアプリが自動でリロードされます。
   ブラウザータブ(WebView)・広告・課金を含め、実機上ではすべての機能を確認できます
   (広告・課金の実際の動作確認については後述の「収益化」セクションを参照)。

iPhoneでの実機プレビューは、Apple Developer Program(年額$99)へ未登録のため現状
できません。Android実機が用意できない場合は、次の「Androidエミュレータでのプレビュー」
を利用してください。

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
4. プロジェクトフォルダで、このプロジェクト専用のネイティブDev Clientをローカルビルドして
   エミュレータに直接インストールします(EASのようなクラウドビルドは使わず、Android Studio
   付属のSDK/Gradleだけでビルドします)。前述の通り、広告・課金SDKを含むため
   **Expo Goでは起動できません**。

   ```bash
   npx expo run:android
   ```

   初回ビルドは数分〜十数分かかり、数GBのディスク容量を使用します。

5. 起動できれば、**Android実機と同じWebView実装**が使えるようになります。ブラウザータブで
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
  (`npx eas-cli build --profile production --platform android|ios` 等で利用)
- **プライバシーポリシー**: [`PRIVACY.md`](./PRIVACY.md) を参照。閲覧履歴・ブックマーク・
  ダウンロード画像は端末内にのみ保存されますが、ダウンロードランキング機能のため
  URL・タイトル・ダウンロード枚数(個人を特定できる情報は含まない)をSupabaseへ送信するほか、
  広告(Google AdMob)・買い切り課金(Google Play Billing)を利用します
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
8. **アプリのビルド**: `npx eas-cli build --profile production --platform android`
   (初回は `npx eas-cli login` でExpoアカウントへのログインが必要。Androidの署名鍵は
   EASが自動生成・管理します)
9. **Play Consoleへの提出**:
   - 手動: ビルド完了後にダウンロードされる `.aab` ファイルをPlay Consoleの
     「テスト」→「内部テスト」トラックなどに手動アップロード
   - 自動: Google Cloudでサービスアカウントを作成しPlay Consoleに権限を付与、
     ダウンロードしたJSON鍵を `google-service-account.json` としてプロジェクト直下に置き
     (`.gitignore` 済み、絶対にコミットしないこと)、`npx eas-cli submit --platform android`
     を実行(`eas.json` の `submit.production.android` を参照)
10. **内部テスト→本番公開**: まずは内部テスト/クローズドテストで動作確認してから、
    Play Consoleの審査を経て段階的に本番公開する
11. **アプリ内商品の作成**: 買い切り課金を実際に販売するには、Play Console →
    対象アプリ → 「収益化」→「商品」→「アプリ内アイテム」から、非消耗型(買い切り)の
    商品を1つ作成する。商品IDは `.env` の `EXPO_PUBLIC_PREMIUM_PRODUCT_ID`
    (未設定時は `com.lgflatlight07.imageviewer.premium`)と**完全に一致**させること。
    価格を設定し「有効」にする(下記「収益化」セクションも参照)

## 収益化(広告・買い切り課金)

無料利用時はダウンロード回数(1日3回)・タグ作成数(全体で5個)・ランキング閲覧
(上位3位まで)に制限があり、リワード広告の視聴(その日は無制限)または買い切り課金
(すべて無制限+ランキング上位50位まで解放)で制限を外せる仕組みです。

### 実装の仕組み

- `src/store/monetizationStore.ts`: 購入済みフラグ・当日の広告視聴状況・当日のダウンロード
  利用回数を端末内(AsyncStorage)に保持する唯一の情報源。他のすべてのゲーティングロジックは
  ここから計算される
- `src/services/rewardedAdService.ts`: `react-native-google-mobile-ads` の
  `useRewardedAd` フックをラップし、広告視聴が最後まで完了した(報酬を獲得した)場合にのみ
  `true` を返す
- `src/services/purchaseService.ts` + `src/components/PurchaseSync.tsx`: `expo-iap` の
  `useIAP` フックはアプリ起動時に一度だけ接続し(App.tsx)、購入・復元の結果を
  `monetizationStore` に反映する。他画面(設定画面)からはこのモジュールが公開する
  `requestPremiumPurchase()` / `restorePremiumPurchases()` を呼ぶだけでよい
- 広告ユニットID・商品IDは、未設定の場合はそれぞれGoogleの公式テスト広告ID /
  デフォルトのプレースホルダー商品IDにフォールバックするため、`.env` を設定しなくても
  アプリは動作する(ただし本物の広告・購入は行われない)

### AdMobアカウントの準備

1. [Google AdMob](https://admob.google.com/) にGoogleアカウントでログインし、アプリを登録
2. 「広告ユニット」からリワード広告(動画)のユニットを1つ作成し、広告ユニットIDを取得
3. `.env` に以下を追加(`.env.example` 参照)

   ```
   EXPO_PUBLIC_ADMOB_REWARDED_AD_UNIT_ID=取得した広告ユニットID
   ```

4. `app.json` の `plugins` にある `react-native-google-mobile-ads` の
   `androidAppId`(現在はGoogle公式のテスト用App ID)を、AdMobダッシュボードで
   確認できる自分のアプリのApp IDに差し替える(本番公開前に必須)

### アプリ内商品(買い切り課金)の準備

上記「Android(Google Play)への公開手順」11番の通り、Play Consoleでアプリ内商品を
作成してください。商品IDを `EXPO_PUBLIC_PREMIUM_PRODUCT_ID` としてデフォルト値から
変更する場合は、`.env` にも同じ値を設定してください。

### 実機での確認方法

広告・課金ともにネイティブモジュールのため、**Expo Goでは一切動作せず、Dev Client
ビルド(前述「実機プレビュー(Dev Client)」参照)が必須**です。また、実際の課金は
Play Consoleで内部テストトラックへの提出まで済ませ、テスターとして登録した
Googleアカウントでログインした状態でないと購入できません(この段階では課金は
発生しません)。

そのため、開発中は設定画面の「開発者機能(実機テスト用)」にあるコマンドで、
実際に広告を視聴・購入することなく制限解除後の挙動を確認できます。

- 「報酬型広告を視聴したことにする」: その日はダウンロード無制限になる
- 「Premium機能を購入したことにする」: すべての制限が解除される
- 「Premium機能を購入していないことにする」: 購入前の状態に戻す
- 「サーバーのダウンロード履歴をリセット」: Supabaseの`ranking_daily_counts`を全削除する
  (開発中のテストデータ整理用。本番公開前に「開発者機能」セクション自体の扱いを
  検討してください — 現状は誰でも操作できてしまいます)

### 収益を受け取るまでに必要なこと

AdMob(広告収入)とGoogle Play Console(アプリ内課金の収益)は、Googleの中でも
それぞれ別の支払いの仕組みです。

- 普段お使いの個人名義の銀行口座で構いません(専用口座や法人口座は不要)。
  口座名義とGoogleへの登録氏名が一致している必要があります
- **AdMob**: AdMob管理画面 →「お支払い」から、氏名・住所と銀行口座情報、
  簡易な税務情報(オンラインで回答するのみ)を登録する。収益が最低支払額
  (通常$100相当)に達すると日本の銀行口座へ振り込まれる
- **Google Play Console**: Play Console → 設定 →「お支払いプロファイル」から、
  販売者としての口座情報を別途登録する
- どちらも源泉徴収はされないため、得た収入は確定申告の対象になり得ます
  (給与所得者は年間20万円超の副収入で申告義務が生じるのが一般的です)。
  この点は税務署・税理士へ確認してください
