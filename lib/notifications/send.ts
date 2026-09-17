import "server-only";
import { resendConfig } from "@/lib/config/server";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminServices } from "@/lib/firebase/admin";
import { AppError } from "@/lib/errors";
import { decode } from "@/lib/repositories/firestore/server";
import { eventChangeEmail } from "@/lib/email/event-change-email";
import { hasNotifiableChanges } from "@/lib/events/diff";
import { selectRecipients } from "./targets";
import type {
  ChangeLog,
  Event,
  EventResponse,
  NotificationLog,
  Recipient,
  User,
} from "@/types/domain";

// One immutable notification per change. Lease + durable recipient results + provider
// idempotency cover concurrent requests and a crash between delivery and persistence.
export async function sendNotification(
  actor: User,
  eventId: string,
  changeLogId: string,
): Promise<NotificationLog> {
  const { db } = adminServices();
  const ref = db.doc(`notificationLogs/${changeLogId}`);
  const { key, from, appUrl } = resendConfig();
  const claim = await db.runTransaction(async (tx) => {
    const [eventDoc, changeDoc, existing] = await Promise.all([
      tx.get(db.doc(`events/${eventId}`)),
      tx.get(db.doc(`eventChangeLogs/${changeLogId}`)),
      tx.get(ref),
    ]);
    if (
      !eventDoc.exists ||
      eventDoc.data()!.deletedAt ||
      eventDoc.data()!.publicationStatus !== "published"
    )
      throw new AppError("公開中のイベントだけ通知できます。", 404);
    if (!changeDoc.exists || changeDoc.data()!.eventId !== eventId)
      throw new AppError("変更履歴が見つかりません。", 404);
    const old = existing.data();
    if (old?.status === "completed") return { done: true, data: old };
    if (old?.leaseUntil?.toMillis() > Date.now())
      throw new AppError(
        "通知処理が進行中です。少し待って履歴を更新してください。",
        409,
      );
    // Provider keys expire after 24h. Never blindly resend an uncertain attempt afterwards.
    if (old && Date.now() - old.createdAt.toMillis() >= 23 * 3600000)
      throw new AppError(
        "再送可能期間を過ぎました。Resendの配信履歴を管理者が確認してください。",
        409,
      );
    const now = Timestamp.now();
    if (old) {
      tx.update(ref, {
        leaseUntil: Timestamp.fromMillis(Date.now() + 90000),
        status: "processing",
      });
      return { done: false, data: old };
    }
    const event = decode<Event>(eventId, eventDoc.data()!),
      change = decode<ChangeLog>(changeLogId, changeDoc.data()!);
    if (!hasNotifiableChanges(change.changes))
      throw new AppError("通知する変更差分がありません。");
    const [responses, users] = await Promise.all([
      tx.get(
        db
          .collection("eventResponses")
          .where("eventId", "==", eventId)
          .where("status", "==", "attending"),
      ),
      tx.get(db.collection("users").where("isActive", "==", true)),
    ]);
    const targets = selectRecipients(
      eventId,
      responses.docs.map((d) => decode<EventResponse>(d.id, d.data())),
      users.docs.map((d) => decode<User>(d.id, d.data())),
    );
    const mail = eventChangeEmail(
      event,
      change,
      appUrl,
      Object.fromEntries(users.docs.map((d) => [d.id, d.data().name])),
    );
    const data = {
      eventId,
      changeLogIds: [changeLogId],
      type: "event_changed",
      sentBy: actor.id,
      recipientCount: targets.length,
      status: "processing",
      createdAt: now,
      completedAt: null,
      leaseUntil: Timestamp.fromMillis(Date.now() + 90000),
      targetIds: targets.map((u) => u.id),
      mail,
      from,
    };
    tx.create(ref, data);
    return { done: false, data };
  });
  if (claim.done) return decode<NotificationLog>(ref.id, claim.data);
  const data = claim.data;
  const previous = await ref.collection("recipients").get();
  const results = new Map(previous.docs.map((d) => [d.id, d.data()]));
  const pending = (data.targetIds as string[])
    .filter(
      (id) => results.get(id)?.status !== "sent" && !results.get(id)?.excluded,
    )
    .sort((a, b) => Number(results.has(a)) - Number(results.has(b)));
  const resend = new Resend(key);
  // Process at most 20 recipients per request; UI can resume using the same key.
  for (const userId of pending.slice(0, 20)) {
    const [u, r, e] = await Promise.all([
      db.doc(`users/${userId}`).get(),
      db.doc(`eventResponses/${eventId}_${userId}`).get(),
      db.doc(`events/${eventId}`).get(),
    ]);
    const eligible =
      u.exists &&
      u.data()!.isActive === true &&
      r.data()?.status === "attending" &&
      e.data()?.publicationStatus === "published" &&
      !e.data()?.deletedAt;
    const email = u.data()?.email || "";
    const recipient: Recipient & { excluded?: boolean } = {
      userId,
      email,
      status: "failed",
      providerMessageId: null,
      sentAt: null,
      error: null,
    };
    if (!eligible) {
      recipient.error =
        "送信時点で参加・有効ユーザー・公開イベントの条件を満たさないため送信しませんでした。";
      recipient.excluded = true;
    } else {
      // Freeze the provider payload before the first attempt, including email address.
      const recipientRef = ref.collection("recipients").doc(userId);
      const previousData = results.get(userId);
      const deliveryEmail = previousData?.email || email;
      recipient.email = deliveryEmail;
      await recipientRef.set({
        ...recipient,
        error: "送信処理中。結果未確定の場合は同じ要求で再開してください。",
      });
      try {
        const result = await resend.emails.send(
          { from: data.from, to: [deliveryEmail], ...data.mail },
          { idempotencyKey: `frontier/${changeLogId}/${userId}` },
        );
        if (result.error) throw new Error(result.error.message);
        recipient.status = "sent";
        recipient.providerMessageId = result.data!.id;
        recipient.sentAt = new Date().toISOString();
      } catch (error) {
        recipient.error =
          error instanceof Error
            ? error.message.slice(0, 500)
            : "メール送信に失敗しました。";
      }
    }
    await ref
      .collection("recipients")
      .doc(userId)
      .set({
        ...recipient,
        sentAt: recipient.sentAt
          ? Timestamp.fromDate(new Date(recipient.sentAt))
          : null,
      });
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  const all = await ref.collection("recipients").get();
  const sent = all.docs.filter((d) => d.data().status === "sent").length;
  const recordedIds = new Set(all.docs.map((d) => d.id));
  const remaining = (data.targetIds as string[]).some(
    (id) => !recordedIds.has(id),
  );
  const status = remaining
    ? "processing"
    : sent === data.recipientCount
      ? "completed"
      : sent > 0
        ? "partial_failed"
        : "failed";
  await db.runTransaction(async (tx) => {
    tx.update(ref, {
      status,
      leaseUntil: Timestamp.fromMillis(0),
      completedAt: remaining ? null : Timestamp.now(),
    });
    if (status === "completed")
      tx.update(db.doc(`eventChangeLogs/${changeLogId}`), {
        notificationStatus: "sent",
      });
  });
  const final = await ref.get();
  return decode<NotificationLog>(ref.id, final.data()!);
}
