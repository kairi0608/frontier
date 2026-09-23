import "server-only";
import { requireAppMode } from "./app-mode";
import { ConfigurationError, requiredSetting } from "./error";
export function firebaseAdminConfig() {
  requireAppMode("production");
  return {
    projectId: requiredSetting(
      "FIREBASE_PROJECT_ID",
      process.env.FIREBASE_PROJECT_ID,
    ),
    clientEmail: requiredSetting(
      "FIREBASE_CLIENT_EMAIL",
      process.env.FIREBASE_CLIENT_EMAIL,
    ),
    privateKey: requiredSetting(
      "FIREBASE_PRIVATE_KEY",
      process.env.FIREBASE_PRIVATE_KEY,
    ).replace(/\\n/g, "\n"),
  };
}
export function resendConfig() {
  requireAppMode("production");
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from)
    throw new ConfigurationError(
      "メール送信設定が完了していません。管理者がRESEND_API_KEYとRESEND_FROM_EMAILを設定してください。",
    );
  const appUrl = requiredSetting(
    "NEXT_PUBLIC_APP_URL",
    process.env.NEXT_PUBLIC_APP_URL,
  );
  try {
    if (!["http:", "https:"].includes(new URL(appUrl).protocol))
      throw new Error();
  } catch {
    throw new ConfigurationError(
      "設定エラー: NEXT_PUBLIC_APP_URL に有効なhttp/https URLを設定してください。",
    );
  }
  return { key, from, appUrl };
}
