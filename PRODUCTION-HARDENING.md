# 本番モード設定の厳格化 — 変更報告

既存のFRONTIER Eventsへ差分修正しました。UIデザイン、イベント管理、参加回答、Firebase/Firestore、Resend、変更・通知履歴、Rules、データ構造を維持しています。新規アプリへの置き換えはしていません。

## 変更理由・動作

- APP_MODEを `prototype` / `production` の完全一致で検証。未設定・空文字・大文字違い・前後空白・その他の値はConfigurationErrorです。
- 明示的なprototypeだけMockRepositoryを生成します。FirestoreRepositoryはproductionだけです。モード確認を通らず過去のRepositoryインスタンスを再利用するフォールバックも排除しました。
- MockRepository自体でもモードを検証し、本番からの直接生成や試用ストレージへの読み書きを拒否します。
- 本番ログインはメール／パスワードのみ。試用バッジ・確認メッセージ・通知完了メッセージ・通知履歴も共通判定に統一しました。履歴にsimulatedフラグが混入しても、本番では試用表示しません。
- next.config.tsでモードと本番Firebase公開設定を検証し、設定ミスのbuild/start/devを停止します。
- Firebase Admin・Resendの秘密情報はserver-onlyで処理時に検証します。不足時は変数名だけを含む設定エラーにし、APIは503を返します。
- APIはprototypeで404、本番で通常の認証・認可処理、不正モードで503です。
- .env.exampleはproductionを明示し、公開URL・接続値・秘密情報は空にしました。READMEを本番導入中心へ再編しました。

## 変更ファイル一覧（30ファイル）

### 設定・実装（17ファイル）

| ファイル                              | 変更理由                                        |
| ------------------------------------- | ----------------------------------------------- |
| lib/config/app-mode.ts（新規）        | モードの共通検証・判定・ガード                  |
| lib/config/error.ts（新規）           | 安全な設定エラーと必須値検証                    |
| lib/config/firebase-public.ts（新規） | 本番Firebase公開設定4項目を検証                 |
| lib/config/server.ts（新規）          | Admin・Resendの秘密情報をサーバーだけで検証     |
| next.config.ts                        | 起動・ビルド時に設定を検証                      |
| lib/repositories/index.ts             | 暗黙のMockフォールバックを廃止                  |
| lib/repositories/prototype/index.ts   | 生成・読み書き・ログアウトにprototype限定ガード |
| lib/repositories/firestore/client.ts  | 本番設定検証、ログイン時に設定エラーを保持      |
| lib/firebase/client.ts                | Firebase初期化前の必須公開設定検証              |
| lib/firebase/admin.ts                 | Firebase初期化前の必須秘密設定検証              |
| lib/notifications/send.ts             | Resend設定の共通検証を利用                      |
| app/api/[...path]/route.ts            | モードの明示分岐・設定エラー503                 |
| app/auth/page.tsx                     | 明示prototypeだけ試用ログインを表示             |
| components/layout/workspace.tsx       | 試用バッジを明示prototypeに限定                 |
| components/admin/event-editor.tsx     | 通知確認の試用文言を限定                        |
| components/admin/admin-pages.tsx      | 試用通知・履歴ラベルを限定                      |
| .env.example                          | 本番導入向けの必須設定例                        |

### テスト・依存・CI（10ファイル）

| ファイル                             | 変更理由                                                     |
| ------------------------------------ | ------------------------------------------------------------ |
| tests/config.test.ts（新規）         | Repository切替、未設定・不正モード、必須設定検証             |
| tests/api-mode.test.ts（新規）       | 本番APIのモード分岐・設定エラーを検証                        |
| tests/ui-mode.test.ts（新規）        | 実コンポーネントの本番／試用表示を検証                       |
| tests/e2e/production.spec.ts（新規） | productionビルドの画面・試用ストレージ非使用を検証           |
| tests/prototype.test.ts              | 試用テストでモードを明示                                     |
| scripts/test-browser.mjs（新規）     | モードを明示してビルドとE2Eを実行                            |
| playwright.config.ts                 | モード別のテスト・ポートを分離し、既存サーバーを誤利用しない |
| package.json                         | 本番E2Eコマンド・UIテスト用依存の追加                        |
| package-lock.json                    | 依存ロック更新                                               |
| .github/workflows/ci.yml             | CIでprototypeとproductionの両方を検証                        |

### 文書（3ファイル）

| ファイル                        | 変更理由                                                        |
| ------------------------------- | --------------------------------------------------------------- |
| README.md                       | Firebaseから本番受入までの導入順に整理、Prototypeを開発用補足へ |
| VERIFICATION.md                 | 今回の検証結果・実サービス検証との区別                          |
| PRODUCTION-HARDENING.md（新規） | この変更報告・ファイル一覧                                      |

## 検証結果

| 検証                                    | 結果                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| npm run lint                            | 成功・警告なし                                             |
| npm run typecheck                       | 成功                                                       |
| npm test                                | 45件成功（設定・API・UI・既存ドメイン・Prototype）         |
| npm run test:rules                      | 16件成功（Firestore Emulatorで既存機能の回帰確認）         |
| npm run test:e2e                        | prototypeビルド成功、スマートフォン・PCの2件成功           |
| npm run test:e2e:production             | productionでnpm run build成功、スマートフォン・PCの2件成功 |
| 未設定APP_MODEでのbuild                 | 期待どおり設定エラーで拒否                                 |
| 不正APP_MODEでのbuild                   | 期待どおり設定エラーで拒否                                 |
| productionでFirebase公開設定不足のbuild | 期待どおり不足変数名を示して拒否                           |

合計65件の自動テストに加え、3条件のビルド拒否を確認しました。本番のログイン・通常画面へのアクセスで試用ボタン、試用バッジ、試用通知文言が表示されず、ブラウザー内の試用データでログインできないことを確認しました。ログイン後のホーム・管理画面・通知履歴は、Repositoryの外部アクセスのみ差し替えて実コンポーネントの表示も検証しました。

本番UIテストの公開Firebase設定は架空値です。実Firebase認証・本番DBへの反映・実メール受信・Vercel公開を実施したという意味ではありません。本番へ配備する際は、以下の実設定で再ビルドしてください。

## 本番の環境変数

必須：

```dotenv
NEXT_PUBLIC_APP_MODE=production
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

初期管理者スクリプト用：`INITIAL_ADMIN_EMAIL`。

任意のFirebase Web構成：`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`、`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`。

公開設定はビルド時、Admin設定はサーバー操作時、Resend設定とAPP_URLは通知処理時に検証します。秘密情報はブラウザーへ渡しません。
