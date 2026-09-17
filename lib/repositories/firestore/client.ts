import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { AppError } from "@/lib/errors";
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
  async login(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(clientAuth(), email, password);
    } catch {
      throw new AppError(
        "ログインできませんでした。メールアドレスとパスワードを確認してください。",
      );
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
