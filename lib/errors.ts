export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const conflictMessage =
  "他の管理者によってイベントが更新されています。最新情報を再取得してください。";
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "処理に失敗しました。時間をおいて再度お試しください。";
}
