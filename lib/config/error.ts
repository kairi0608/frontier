/** Messages contain variable names only, never their values. Safe for UI/API errors. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}
export function requiredSetting(
  name: string,
  value: string | undefined,
): string {
  if (!value?.trim())
    throw new ConfigurationError(`設定エラー: ${name} を設定してください。`);
  return value.trim();
}
