import { ConfigurationError } from "./error";
export type AppMode = "prototype" | "production";
export function getAppMode(): AppMode {
  // Keep a static property access: Next.js embeds this public value at build time.
  const value = process.env.NEXT_PUBLIC_APP_MODE;
  if (value === "prototype" || value === "production") return value;
  throw new ConfigurationError(
    '設定エラー: NEXT_PUBLIC_APP_MODE must be "prototype" or "production". 未設定・不正値では起動できません。',
  );
}
export const isPrototype = () => getAppMode() === "prototype";
export const isProduction = () => getAppMode() === "production";
export function requireAppMode(expected: AppMode): void {
  if (getAppMode() !== expected)
    throw new ConfigurationError(
      `この機能は ${expected} モードでのみ利用できます。`,
    );
}
