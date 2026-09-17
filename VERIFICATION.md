# 検証記録 — 本番モード設定の厳格化

2026-09-17 / Node.js 22.20.0 / Next.js 16.3.5 / Windows。

既存アプリを変更し、未設定・不正APP_MODEからPrototypeへ自動移行する処理を廃止しました。変更ファイル一覧・理由・環境変数は [PRODUCTION-HARDENING.md](PRODUCTION-HARDENING.md) を参照してください。

| コマンド・確認                   | 結果                                           |
| -------------------------------- | ---------------------------------------------- |
| npm run lint                     | 成功、警告なし                                 |
| npm run typecheck                | 成功                                           |
| npm test                         | 45件成功                                       |
| npm run test:rules               | 16件成功                                       |
| npm run test:e2e                 | prototypeビルドと2件の操作テスト成功           |
| npm run test:e2e:production      | productionでnpm run buildと2件の操作テスト成功 |
| APP_MODE未設定・不正値           | 実際のビルドが設定エラーで終了                 |
| productionのFirebase公開設定不足 | 実際のビルドが不足変数名を示して終了           |

本番の必須Firebase公開4項目と、Admin/Resendの秘密設定の不足をテストしています。productionログインにはメール・パスワードだけを表示し、試用ボタン・バッジ・試用通知文言を表示しません。試用データがブラウザーに残っていても、それを利用して本番へログインできないことを実ブラウザーで確認しました。

既存のイベント作成・公開・参加回答・回答変更・1人1回答・変更差分・Transaction・version競合・参加者限定通知・部分失敗の記録・再送・権限制御・論理削除を回帰検証しました。スマートフォン相当390px幅とPC1280px幅で確認しています。

単体/UI/APIモードテスト45件、Firestore統合16件、ブラウザー4件の合計65件。これとは別にビルド拒否を3条件で確認しました。

## 外部環境の確認範囲

- Firestore統合検証は本物のAdmin SDKとローカルFirestore Emulatorを使用しています。
- Firebase ID Tokenの外部検証応答とResendの配信応答はテスト用に差し替えています。
- 本番UI用ビルドの公開Firebase設定は架空値です。この成果物をそのまま配備せず、実環境変数で再ビルドしてください。
- 実Firebaseログイン・実メール受信・本番Rules反映・Vercel公開は未実施です。
- ローカルリポジトリにはGitHub remoteが未設定のため、GitHubへのpushは実施していません。
