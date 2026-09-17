# FRONTIER Events — 本番導入ガイド

既存のイベント管理・参加回答・変更履歴・参加者限定メール・通知履歴を維持した、フロンティア内部向けアプリです。Next.js / TypeScript / Firebase Authentication / Cloud Firestore / Firebase Admin SDK / Resendを使用します。

**productionは実運用、prototypeは開発・画面確認専用です。NEXT_PUBLIC_APP_MODEが未設定・空文字・不正値の場合、設定エラーで停止します。試用モードへフォールバックしません。** 大文字や前後の空白も許可しません。

## 1. Firebase Project作成

Firebase Consoleでプロジェクトを作成し、Webアプリを登録します。Web構成とサービスアカウントの認証情報を取得してください。秘密鍵JSONはGitHubに保存しません。

Node.js 22以上を用意し、このフォルダーで以下を実行します。

```sh
npm ci
cp .env.example .env.local
```

PowerShellでは `Copy-Item .env.example .env.local`。例はproduction指定ですが、接続情報は空です。必要な値を設定するまでは起動・ビルドに失敗するのが正常です。

## 2. Authentication設定

- Authenticationの「メール／パスワード」を有効にします。
- Authorized domainsに本番Vercelドメインと使用する独自ドメインを追加します。
- 公開の会員登録ページはありません。Authenticationだけにアカウントが存在しても、usersドキュメントがない／isActiveがfalseなら利用できません。
- 本番ログイン画面にはメールアドレス・パスワードだけを表示します。試用ログインボタンは表示しません。

## 3. Firestore設定

Cloud FirestoreをNative modeで作成し、運用地域に合うロケーションを選びます。テストモードの開放ルールで運用しないでください。コレクションは初期管理者スクリプトとアプリ操作で作成されます。

DBの日付はTimestamp、Repository境界ではISO文字列、画面・メールは日本時間です。イベントは論理削除し、変更・通知履歴を残します。

## 4. Firestore Rules・インデックス

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

インデックス構築完了を確認します。Rulesは未認証・無効ユーザーを拒否し、メンバーには公開・未削除イベント、自分のプロフィール、自分の回答だけを許可します。

管理者も含め、イベント・ユーザー・履歴へのクライアント直接書き込みは禁止です。管理画面は認証済みサーバーAPIで操作します。サーバーではID Tokenの失効も検証し、usersのrole/isActiveを確認します。Admin SDKはRulesを迂回するため、APIでの認可を併用します。

## 5. Resend設定

1. Resendへ送信元ドメインを登録。
2. 指定されたDNSレコードを設定し、ドメインを検証。
3. APIキーを取得。
4. RESEND_FROM_EMAILに検証済み送信元を設定。表示名付きアドレスも使用可能。

通知は参加予定かつ有効なユーザーへ個別送信します。未定・不参加・未回答・無効ユーザーには送信しません。テスト用送信元は送信先制約があるため、本番では検証済みドメインを使用します。

## 6. 環境変数

ローカルは.env.local、VercelはEnvironment Variablesに設定します。秘密情報をGitHubやチャットへ貼り付けないでください。

| 変数                                     | 必須範囲・用途                                    |
| ---------------------------------------- | ------------------------------------------------- |
| NEXT_PUBLIC_APP_MODE                     | 必須。本番は完全一致で production                 |
| NEXT_PUBLIC_APP_URL                      | メール通知時に必須。本番アプリのhttp/https絶対URL |
| NEXT_PUBLIC_FIREBASE_API_KEY             | 本番の起動・ビルド時に必須                        |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN         | 本番の起動・ビルド時に必須                        |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID          | 本番の起動・ビルド時に必須                        |
| NEXT_PUBLIC_FIREBASE_APP_ID              | 本番の起動・ビルド時に必須                        |
| FIREBASE_PROJECT_ID                      | サーバーFirebase操作時に必須                      |
| FIREBASE_CLIENT_EMAIL                    | サービスアカウント。サーバー操作時に必須          |
| FIREBASE_PRIVATE_KEY                     | 秘密鍵。サーバー操作時に必須                      |
| RESEND_API_KEY                           | 秘密キー。メール送信処理時に必須                  |
| RESEND_FROM_EMAIL                        | 検証済み送信元。メール送信処理時に必須            |
| INITIAL_ADMIN_EMAIL                      | 初期管理者スクリプト時に必須。Vercelには不要      |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET      | Firebase Web構成の任意項目。ストレージ機能なし    |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase Web構成の任意項目。Push通知なし          |

秘密鍵に含まれる文字列の `\n` はサーバーで実改行へ変換します。実改行を設定しても利用できます。.envファイルはGit除外し、空の例だけを共有します。

検証をlib/config/へ集約しています。エラーには不足する変数名を表示し、値や秘密情報は表示しません。公開設定だけをブラウザーで扱い、秘密情報の検証はserver-onlyに分離しています。サーバー秘密情報はビルド時でなく、該当API・送信処理の利用時に検証します。

## 7. Vercelデプロイ

1. このフォルダーをGitHubへ保存し、VercelでImportします。
2. FrameworkはNext.js、Node.jsは22以上、Install Commandは `npm ci`、Build Commandは `npm run build`。
3. サブフォルダー構成の場合だけRoot Directoryを指定します。
4. Production環境に上記の本番環境変数を入力してデプロイします。
5. 確定した公開URLをNEXT_PUBLIC_APP_URLとFirebase認証の許可ドメインへ反映し、再デプロイします。

```sh
npm run build
npm run start
```

モード未設定・不正値、または本番Firebase公開設定不足なら、build/start/devを設定エラーで停止します。Mockを代わりに起動しません。Previewでも実運用データを扱う場合はproductionと別のFirebaseプロジェクトを設定します。試用するPreviewに限り明示的にprototypeを指定します。

_*NEXT_PUBLIC_* はビルド時に確定します。_* prototypeで作った成果物を環境変数の変更だけで本番へ転用せず、productionで再ビルドしてください。[Next.js公式](https://nextjs.org/docs/pages/guides/environment-variables)

## 8. 初期管理者設定

1. Firebase ConsoleのAuthenticationで管理者アカウントを作成。
2. ローカル.env.localにINITIAL_ADMIN_EMAILとFirebase Adminの認証情報を設定。
3. 以下を実行。

```sh
npm run admin:init
```

サービスアカウントを持つ開発者が、既存Authenticationアカウントを検索しusersにadminを設定するスクリプトです。公開初期化APIやクライアント側のメール判定による昇格はありません。

以後は管理画面でユーザー追加・権限変更・無効化・パスワード再設定を行えます。初期パスワードは12文字以上を設定し、本人へ安全な別経路で伝えてください。パスワードはFirestoreに保存しません。

## 9. 動作確認

```sh
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
```

test:rulesにはJava 21以上が必要です。demoプロジェクトのFirestore EmulatorでRules・Transaction・参加回答・履歴・通知ログ・再送を検証します。Firebaseトークン検証の外部応答とResend配信応答だけはテスト用に置き換えます。

ブラウザーテスト：

```sh
npx playwright install chromium
npm run test:e2e
npm run test:e2e:production
```

各テストが明示したモードでビルドしてテストサーバーを起動します。前者は既存prototype操作フロー、後者はproductionビルドのログイン・試用文言非表示・試用ストレージ非使用を検証します。本番UIテストのFirebase公開設定は架空のテスト専用値で、実認証・実配信はしません。**テストビルドを本番配備せず、実際の設定でnpm run buildを再実行してください。**

本番受入では以下を確認します。

1. 管理者ログイン、イベント作成・公開。
2. メンバーログイン、閲覧、参加回答、回答変更。
3. 集合時刻12:30→12:00の編集と通知前の確認。
4. 有効な参加者だけへの実メール、変更前後と詳細リンク。
5. 変更・通知・受信者別結果、同じ要求の重複送信抑止。
6. 保存のみの非送信、非公開・削除済みイベント拒否、古いversionの拒否。

検証記録はVERIFICATION.md、今回の変更一覧はPRODUCTION-HARDENING.mdを参照してください。

## 保存・通知の実装

- UIは共通Repository契約を使用。productionはFirestoreRepository、明示的なprototypeだけMockRepository。
- 編集はTransactionでversionを確認し、イベント更新・version加算・1回の保存につき1件のChangeLogを保存。差分0件は更新しません。
- 回答はeventId_userIdへupsert。未回答はレコードなし。
- 「保存のみ」ではメールを送りません。通知確認後、サーバーで対象を再計算します。
- メールと画面は同じchangesを使用。HTMLはエスケープしtext版も生成。
- 通知IDをChangeLog IDに固定し、リース排他とResendの個別idempotency keyを併用。最大20人ずつ処理し、失敗を個別記録、履歴から未送信者の処理を再開できます。
- 外部メールとイベント保存は同一Transactionにはできません。保存後の送信失敗を明示します。
- Resendのキー保持は24時間。本アプリは23時間後の再開を停止し、結果不明の重複送信を避けます。その際はResend履歴を確認してください。[Resend公式](https://resend.com/docs/dashboard/emails/idempotency-keys)
- 成功はResend API受付成功です。バウンス・受信箱への到達追跡は対象外です。

内部の小規模チーム向けで、管理画面はデータを一括取得します。大規模運用ではページング等が別途必要です。

## 開発用補足：Prototype

画面確認だけの場合、.env.localに明示的に設定します。

```dotenv
NEXT_PUBLIC_APP_MODE=prototype
```

npm run devで起動します。Firebase・Resendに接続せず、既存の試用アカウント・画面を利用できます。データはブラウザー内、ログインはタブ内に保存し、試用通知は実配信しません。未設定ではprototypeになりません。

本番では試用ボタン・試用バッジ・試用通知文言を表示せず、Mock Repository生成も拒否します。同じブラウザーに残った試用データを本番の認証・データには利用しません。
