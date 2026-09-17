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
  const key = requiredSetting("RESEND_API_KEY", process.env.RESEND_API_KEY);
  const from = requiredSetting(
    "RESEND_FROM_EMAIL",
    process.env.RESEND_FROM_EMAIL,
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
