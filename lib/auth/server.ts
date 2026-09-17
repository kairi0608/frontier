import "server-only";
import { adminServices } from "@/lib/firebase/admin";
import { AppError } from "@/lib/errors";
import type { User } from "@/types/domain";
export async function authorize(
  request: Request,
  admin = false,
): Promise<User> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AppError("ログインしてください。", 401);
  const { auth, db } = adminServices();
  let uid: string;
  try {
    uid = (await auth.verifyIdToken(token, true)).uid;
  } catch {
    throw new AppError(
      "ログインの有効期限が切れました。再ログインしてください。",
      401,
    );
  }
  const doc = await db.doc(`users/${uid}`).get();
  if (!doc.exists || doc.data()?.isActive !== true)
    throw new AppError(
      "利用が許可されていません。管理者にお問い合わせください。",
      403,
    );
  const data = doc.data()!;
  const user = {
    ...data,
    id: uid,
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt.toDate().toISOString(),
  } as User;
  if (admin && user.role !== "admin")
    throw new AppError("管理者権限が必要です。", 403);
  return user;
}
