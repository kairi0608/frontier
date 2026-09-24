import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { AppError } from "@/lib/errors";
import { firebasePublicConfig } from "@/lib/config/firebase-public";
import { ConfigurationError } from "@/lib/config/error";
import type {
  EventInput,
  NotificationLog,
  ResponseStatus,
  SaveResult,
  Snapshot,
  UserInput,
} from "@/types/domain";
import type { Repository } from "../contract";
export class FirestoreRepository implements Repository {
  constructor() {
    firebasePublicConfig();
  }
  async login(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(clientAuth(), email, password);
    } catch (error) {
      if (error instanceof ConfigurationError) throw error;
      throw new AppError(
        "ログインできませんでした。メールアドレスとパスワードを確認してください。",
      );
    }
  }
  async register(name: string, email: string, password: string) {
    const auth = clientAuth();
    let user = null;
    let profileCreated = false;
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      user = credential.user;
      await updateProfile(user, { displayName: name.trim() });
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok)
        throw new AppError(data.error || "登録に失敗しました。", res.status);
      profileCreated = true;
    } catch (error) {
      if (!profileCreated && user && auth.currentUser?.uid === user.uid) {
        try {
          await deleteUser(user);
        } catch {
          // Server profile creation may already have completed. Avoid masking the original error.
        }
      }
      if (error instanceof AppError || error instanceof ConfigurationError)
        throw error;
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "auth/email-already-in-use")
        throw new AppError("このメールアドレスはすでに登録されています。");
      if (code === "auth/weak-password")
        throw new AppError("より強いパスワードを設定してください。");
      if (code === "auth/invalid-email")
        throw new AppError("メールアドレスの形式を確認してください。");
      throw new AppError("アカウント登録に失敗しました。もう一度お試しください。");
    }
  }

  async logout() {
    await signOut(clientAuth());
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const auth = clientAuth();
    await auth.authStateReady();
    if (!auth.currentUser) throw new AppError("ログインしてください。", 401);
    let res: globalThis.Response;
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
    } catch {
      throw new AppError(
        "通信できませんでした。接続を確認して再試行してください。",
        503,
      );
    }
    const data = await res.json();
    if (!res.ok)
      throw new AppError(data.error || "処理に失敗しました。", res.status);
    return data;
  }
  snapshot() {
    return this.request<Snapshot>("/data");
  }
  respond(eventId: string, status: ResponseStatus) {
    return this.request<void>(`/events/${eventId}/response`, "PUT", { status });
  }
  save(input: EventInput, id?: string, version?: number) {
    return this.request<SaveResult>(
      `/admin/events${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      { input, version },
    );
  }
  remove(id: string, version: number) {
    return this.request<void>(`/admin/events/${id}`, "DELETE", { version });
  }
  notify(id: string, changeLogId: string) {
    return this.request<NotificationLog>(`/admin/events/${id}/notify`, "POST", {
      changeLogId,
      notificationRequestId: changeLogId,
    });
  }
  saveUser(input: UserInput, id?: string) {
    return this.request<void>(
      `/admin/users${id ? `/${id}` : ""}`,
      id ? "PUT" : "POST",
      input,
    );
  }
}
