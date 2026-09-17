# FRONTIER — フロンティア専用イベント管理

Next.js App Router / TypeScript / Tailwind CSS / Firebase Authentication / Cloud Firestore / Firebase Admin SDK / Resend。一般公開の会員登録はありません。スマートフォン優先の内部向けアプリです。

![メンバーホームの画面](docs/preview-desktop.png)

[スマートフォン表示](docs/preview-mobile.png)

## すぐに試す

Node.js 22以上で、このフォルダーを作業ディレクトリにします。

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Windows PowerShellでは `Copy-Item .env.example .env.local`。http://localhost:3000 を開き、試用アカウントを選択します。

`NEXT_PUBLIC_APP_MODE=prototype` はFirebase・Resendに接続しません。同一UIからMock Repositoryを使用し、イベント・回答・変更・通知履歴をブラウザーのlocalStorageへ保存します。ログインはタブごとのsessionStorageです。試用データには実在の個人情報を入れないでください。通知はシミュレーションで、画面にも「実送信なし」と表示します。ブラウザーのサイトデータ削除で初期状態に戻せます。

試用ホームには、サンプル参加予定・未回答イベント・最近の変更を表示します。管理者としてログインすると管理画面へ移動できます。環境変数未設定時もprototypeです。

## 本番セットアップ

### 1. Firebase

1. Firebase Consoleでプロジェクトを作成し、Webアプリを登録します。
2. Authentication → Sign-in methodで **メール/パスワード** を有効にします。
3. Authentication → Settings → Authorized domainsに本番Vercelドメインと使用する独自ドメインを追加します。
4. Cloud FirestoreをNative modeで作成します。ロケーションは運用地域に合わせます。テストモードの開放ルールは使用しません。
5. プロジェクト設定のWebアプリ構成を `.env.local` の `NEXT_PUBLIC_FIREBASE_*` に転記します。
6. サービスアカウントの認証情報を `FIREBASE_PROJECT_ID`、`FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY` に設定します。秘密鍵JSONをリポジトリに置きません。

Firestoreへアクセスする全管理APIはFirebase ID Tokenを `verifyIdToken(token, true)` で検証し、`users/{uid}` の `isActive` と `role` を毎回確認します。フロント側のロール表示だけでは権限を付与しません。Authenticationだけにユーザーが存在しても、usersドキュメントがなければ利用できません。

### 2. Rules・インデックス

```sh
npx firebase login
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

インデックス構築完了を確認してください。`firestore.rules` は未認証・無効ユーザーを拒否し、一般ユーザーには公開・未削除イベント、自分のユーザー情報、自分の回答だけを許可します。直接SDKからの回答作成/更新でもドキュメントID、所有者、状態、作成日時、更新日時を検証します。

管理者も含め **イベント・ユーザー・履歴へのクライアント直接書き込みは禁止** です。管理画面は認証済みサーバーAPIで管理でき、バージョン検査・履歴生成を迂回できません。Admin SDKはRulesを迂回するため、API側の管理者確認を併用します。

### 3. 初期管理者

1. Firebase ConsoleのAuthenticationで、初期管理者のメール・パスワードを登録します。
2. `.env.local` に `INITIAL_ADMIN_EMAIL` とFirebase Adminの環境変数を入力します。
3. `npm run admin:init` を実行します。

このスクリプトはサービスアカウントを持つ開発者だけが実行するセットアップ処理です。既存Authenticationアカウントをメールで検索し、usersにadminを設定します。公開された初期化APIやクライアントのメール判定による昇格はありません。初期設定後は管理画面の「ユーザー管理」で追加・権限変更・無効化・パスワード再設定ができます。12文字以上の初期パスワードを本人に安全な別経路で伝えます。招待メールは送信しません。

### 4. Resend

1. Resendで送信元ドメインを登録し、要求されたDNSレコードを設定して検証します。
2. `RESEND_API_KEY` を設定します。
3. `RESEND_FROM_EMAIL` を `フロンティア <events@your-verified-domain.example>` のように設定します。
4. `NEXT_PUBLIC_APP_URL` をログイン可能な本番URLに設定します。メールのリンクはこのURLの `/events/{eventId}` です。

秘密鍵・APIキーはNEXT_PUBLIC付き変数に入れないでください。Resendのテスト用送信元は送信先制約があるため、本番では検証済みドメインを使います。

### 5. 環境変数

| 変数                                     | 用途                                         |
| ---------------------------------------- | -------------------------------------------- |
| NEXT_PUBLIC_APP_MODE                     | prototype / production。切替後は再ビルド     |
| NEXT_PUBLIC_APP_URL                      | アプリの絶対URL                              |
| NEXT_PUBLIC_FIREBASE_API_KEY             | Firebase Web構成                             |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN         | Firebase Web構成                             |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID          | Firebase Web構成                             |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET      | Firebase Web構成。ストレージ機能は使いません |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Firebase Web構成。Push通知は使いません       |
| NEXT_PUBLIC_FIREBASE_APP_ID              | Firebase Web構成                             |
| FIREBASE_PROJECT_ID                      | Admin SDK用プロジェクト                      |
| FIREBASE_CLIENT_EMAIL                    | サービスアカウントのメール                   |
| FIREBASE_PRIVATE_KEY                     | サービスアカウントの秘密鍵                   |
| RESEND_API_KEY                           | Resend秘密キー                               |
| RESEND_FROM_EMAIL                        | 検証済み送信元                               |
| INITIAL_ADMIN_EMAIL                      | 初期管理者スクリプト用。Vercelには不要       |

`.env.local` の秘密鍵は引用符付きで `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` と設定できます。サーバー側で文字列の `\n` を実改行へ変換します。Vercelには実改行または `\n` どちらでも設定できます。`.env*` はGit除外済みで、例だけを共有します。

## GitHub・Vercel

このフォルダー単体をGitHubリポジトリのルートにしてください。既存の別アプリと混ぜないでください。

```sh
git init -b main
git add .
git commit -m "Build Frontier event management MVP"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

VercelでそのGitHubリポジトリをImportします。FrameworkはNext.js、Node.jsは22以降、Build Commandは `npm run build`、Install Commandは `npm ci` です。サブフォルダーとして保存した場合だけRoot Directoryを `frontier-events` にします。

VercelのEnvironment Variablesへ本番用設定を入力し、`NEXT_PUBLIC_APP_MODE=production` にします。`NEXT_PUBLIC_APP_URL` をVercel URLへ設定して再デプロイし、そのドメインをFirebase Authenticationの許可ドメインへ追加します。Preview環境は別Firebaseプロジェクトを使うかprototypeにします。

秘密情報はビルド時には不要で、Firebase Admin初期化はサーバーAPI呼び出し時に行います。公開設定変数はビルドに埋め込まれるため、設定変更後は再デプロイが必要です。APIはNode.js runtime、最大60秒を指定しています。Vercelプランの実行時間設定も確認してください。

## 保存と通知の仕組み

- 画面はRepositoryインターフェースを使用し、localStorage/Firestoreへ直接アクセスしません。本番Repositoryは認証トークン付きAPIを呼び、サーバーRepositoryがFirestoreを操作します。
- DBの日付はTimestamp。UIとの境界ではISO文字列に変換し、共通関数で日本時間表示します。集合時刻だけの変更は `12:30 → 12:00`、日付も変わると日付付きで表示します。
- イベント作成時はversion 1。編集はTransactionで最新versionを確認し、差分があれば更新・version加算・1件のChangeLogを原子的に保存します。作成・公開状態の変更・論理削除も履歴を残します。差分0件は保存・通知しません。
- 参加回答は `{eventId}_{userId}` にupsertします。未回答はドキュメントなしです。
- 「保存のみ」ではResendを呼びません。「保存して参加者へ通知」は差分・人数を確認してから保存し、明示的に通知APIを呼びます。
- 通知APIはFirestoreでattendingと有効ユーザーを再計算し、送信直前にも回答・ユーザー・公開状態を確認します。宛先配列をブラウザーから受け取りません。
- 通知IDをChangeLog IDに固定し、同一変更は1通知です。Firestoreの処理リースで同時要求を排他し、Resendにもユーザー単位のidempotency keyを渡します。完了済み要求は再送しません。
- 1リクエスト最大20人、1通ずつ間隔を空けて送信します。送信エラーは1人ごとに記録し、他ユーザーの送信を続けます。人数が多い場合はUIが同じ要求を繰り返し、続きから処理します。閉じた場合も履歴から再開できます。
- メール本文と送信元・宛先は初回要求時/試行時に固定し、クラッシュ後も同じidempotency key・同じ内容で再開します。本文はChangeLogのchangesから生成し、HTMLはエスケープします。他のメンバーのメールアドレスを共有しません。
- **保存と外部メール送信は同一Transactionにはできません。** 保存成功後の通知失敗は画面に明示し、変更履歴から再開します。部分失敗時は未送信者だけを再送します。
- Resendの重複防止キーの保持期間は24時間です。結果不明の送信を期限後に再実行しないよう、本アプリは初回要求から23時間で再開を停止します。その場合はResendの配信結果を確認します。自動で新規通知IDを作り直しません。[Resend公式](https://resend.com/docs/dashboard/emails/idempotency-keys)
- 送信成功はResend APIの受付成功を意味します。受信箱への到達・バウンス追跡は本MVPの対象外です。
- イベントの論理削除後もFirestoreに変更・通知履歴を保持します。通常の管理一覧は未削除イベントを表示します。

内部の小規模チーム向けMVPです。管理画面はイベント・回答・ユーザー・履歴を一括取得します。数万件規模で運用する場合はページングと取得範囲の限定が必要です。

## 動作確認

```sh
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
npx playwright install chromium
npm run test:e2e
```

Rules/サーバーテストにはJava 21以上が必要です。Firebase Emulatorはdemoプロジェクトを使い、本番Firestoreへ接続しません。サーバー統合テストは本物のFirestore EmulatorとAdmin SDKを使い、Firebaseのトークン検証結果とResendだけをテスト用に差し替えます。実Firebase Authのログインと実メール配信は以下の本番受入手順で確認してください。E2Eはprototypeビルドを使います。

### 本番受入手順

1. 管理者でログインし、メンバーを追加。有効な「参加」「未定」「不参加」「未回答」と無効ユーザーを準備します。
2. 管理者がイベントを作成・公開します。集合時刻を12:30にします。
3. メンバーでログインして詳細を開き、参加回答が保存され、未定にも変更できることを確認します。
4. 管理者が集合時刻を12:00へ編集。「保存して参加者へ通知」で差分と人数を確認します。
5. 有効な参加者だけに届き、本文に `12:30 → 12:00` と正しい詳細リンクがあることを確認します。
6. 履歴でバージョン・変更内容・通知結果を確認。同じ要求の再送で重複送信がないことを確認します。
7. 別の管理者画面で同じイベントを開き、片方を保存してから古い画面を保存し、競合エラーになることを確認します。
8. 「保存のみ」でメールが来ないこと、非公開・削除済みイベントをメンバーが閲覧できないことを確認します。

自動検証の範囲と実行結果は `VERIFICATION.md` を参照してください。GitHub Actionsにも同じチェックを用意しています。

## 主な構造

```text
app/                    App Router / 認証 / API
components/layout/      認証状態・共通ナビゲーション
components/events/      ホーム・一覧・詳細・回答
components/admin/       編集・確認・ユーザー管理・履歴
lib/auth/               ID TokenとDB権限検証
lib/firebase/           Firebase初期化（client/server分離）
lib/repositories/       共通契約 / prototype / Firestore
lib/events/             差分・日時表示・入力検証
lib/notifications/      対象判定・排他・個別送信結果
lib/email/              同じ差分からHTML/textを生成
scripts/init-admin.ts   開発者用の初期管理者設定
tests/                  単体・Rules・API統合・ブラウザー検証
```

LINE、チャット、コメント、AI、QR、GPS、カレンダー同期、写真共有、決済、SNS、PWA、Push通知は実装していません。
