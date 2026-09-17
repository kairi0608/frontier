import "server-only";
import { Timestamp, type DocumentData } from "firebase-admin/firestore";
import { adminServices } from "@/lib/firebase/admin";
import { AppError, conflictMessage } from "@/lib/errors";
import { diffEvents } from "@/lib/events/diff";
import type {
  Event,
  EventInput,
  EventResponse,
  ChangeLog,
  NotificationLog,
  SaveResult,
  Snapshot,
  User,
  UserInput,
  ResponseStatus,
} from "@/types/domain";
export function decode<T>(id: string, data: DocumentData): T {
  return JSON.parse(
    JSON.stringify({ ...data, id }, (_k, v) =>
      v && typeof v === "object" && "_seconds" in v
        ? new Date(
            v._seconds * 1000 + (v._nanoseconds || 0) / 1000000,
          ).toISOString()
        : v,
    ),
  ) as T;
}
export function encodeEvent(input: EventInput) {
  return {
    ...input,
    startAt: Timestamp.fromDate(new Date(input.startAt)),
    endAt: input.endAt ? Timestamp.fromDate(new Date(input.endAt)) : null,
    meetingAt: input.meetingAt
      ? Timestamp.fromDate(new Date(input.meetingAt))
      : null,
  };
}
export async function getSnapshot(user: User): Promise<Snapshot> {
  const { db } = adminServices();
  const admin = user.role === "admin";
  const [events, responses, users, changes, notifications] = await Promise.all([
    (admin
      ? db.collection("events").where("deletedAt", "==", null)
      : db
          .collection("events")
          .where("publicationStatus", "==", "published")
          .where("deletedAt", "==", null)
    ).get(),
    (admin
      ? db.collection("eventResponses")
      : db.collection("eventResponses").where("userId", "==", user.id)
    ).get(),
    admin ? db.collection("users").get() : null,
    admin ? db.collection("eventChangeLogs").get() : null,
    admin ? db.collection("notificationLogs").get() : null,
  ]);
  const eventList = events.docs.map((d) => decode<Event>(d.id, d.data()));
  const managerIds = [
    ...new Set(
      eventList.flatMap((e) => (e.managerUserId ? [e.managerUserId] : [])),
    ),
  ];
  const managerDocs = managerIds.length
    ? await db.getAll(...managerIds.map((id) => db.doc(`users/${id}`)))
    : [];
  const logs = await Promise.all(
    (notifications?.docs || []).map(async (d) => {
      const recipients = await d.ref.collection("recipients").get();
      const raw = decode<NotificationLog>(d.id, d.data());
      return {
        id: raw.id,
        eventId: raw.eventId,
        changeLogIds: raw.changeLogIds,
        type: raw.type,
        sentBy: raw.sentBy,
        recipientCount: raw.recipientCount,
        status: raw.status,
        createdAt: raw.createdAt,
        completedAt: raw.completedAt,
        recipients: recipients.docs.map((r) =>
          decode<NonNullable<NotificationLog["recipients"]>[number]>(
            r.id,
            r.data(),
          ),
        ),
      };
    }),
  );
  return {
    user,
    events: eventList,
    responses: responses.docs.map((d) => decode<EventResponse>(d.id, d.data())),
    users: users ? users.docs.map((d) => decode<User>(d.id, d.data())) : [user],
    changes: changes?.docs.map((d) => decode<ChangeLog>(d.id, d.data())) || [],
    notifications: logs,
    managerNames: Object.fromEntries(
      managerDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!.name]),
    ),
  };
}
export async function saveEvent(
  user: User,
  input: EventInput,
  id?: string,
  version?: number,
): Promise<SaveResult> {
  const { db } = adminServices();
  const ref = id ? db.doc(`events/${id}`) : db.collection("events").doc();
  const logRef = db.collection("eventChangeLogs").doc();
  return db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const now = Timestamp.now();
    if (input.managerUserId) {
      const manager = await tx.get(db.doc(`users/${input.managerUserId}`));
      if (!manager.exists || !manager.data()?.isActive)
        throw new AppError("有効な担当者を選択してください。");
    }
    if (id && (!current.exists || current.data()!.deletedAt))
      throw new AppError("イベントが見つかりません。", 404);
    if (id && current.data()!.version !== version)
      throw new AppError(conflictMessage, 409);
    const before = current.exists
      ? decode<Event>(ref.id, current.data()!)
      : null;
    const changes = before ? diffEvents(before, input) : [];
    if (before && changes.length === 0)
      return { event: before, changeLogId: null };
    const data = {
      ...encodeEvent(input),
      version: (before?.version || 0) + 1,
      createdBy: before?.createdBy || user.id,
      updatedBy: user.id,
      createdAt: current.data()?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
    };
    tx.set(ref, data);
    tx.set(logRef, {
      eventId: ref.id,
      changedBy: user.id,
      changedAt: now,
      fromVersion: before?.version || 0,
      toVersion: data.version,
      changes,
      notificationStatus: "not_sent",
    });
    return { event: decode<Event>(ref.id, data), changeLogId: logRef.id };
  });
}
export async function removeEvent(user: User, id: string, version: number) {
  const { db } = adminServices();
  const ref = db.doc(`events/${id}`);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists || doc.data()!.deletedAt)
      throw new AppError("イベントが見つかりません。", 404);
    if (doc.data()!.version !== version)
      throw new AppError(conflictMessage, 409);
    const now = Timestamp.now();
    tx.update(ref, {
      deletedAt: now,
      deletedBy: user.id,
      updatedAt: now,
      updatedBy: user.id,
      version: version + 1,
    });
    tx.create(db.collection("eventChangeLogs").doc(), {
      eventId: id,
      changedBy: user.id,
      changedAt: now,
      fromVersion: version,
      toVersion: version + 1,
      changes: [
        {
          field: "deletedAt",
          oldValue: null,
          newValue: now.toDate().toISOString(),
        },
      ],
      notificationStatus: "not_sent",
    });
  });
}
export async function respond(user: User, id: string, status: ResponseStatus) {
  const { db } = adminServices();
  const ref = db.doc(`eventResponses/${id}_${user.id}`);
  await db.runTransaction(async (tx) => {
    const event = await tx.get(db.doc(`events/${id}`));
    const previous = await tx.get(ref);
    if (
      !event.exists ||
      event.data()!.publicationStatus !== "published" ||
      event.data()!.deletedAt
    )
      throw new AppError("このイベントには回答できません。", 404);
    const now = Timestamp.now();
    tx.set(ref, {
      eventId: id,
      userId: user.id,
      status,
      createdAt: previous.data()?.createdAt || now,
      updatedAt: now,
    });
  });
}
export async function saveUser(actor: User, input: UserInput, id?: string) {
  const { db, auth } = adminServices();
  if (id === actor.id && (input.role !== "admin" || !input.isActive))
    throw new AppError("自分自身の管理者権限の解除・無効化はできません。");
  const { password, ...data } = input;
  const now = Timestamp.now();
  if (id) {
    // Reading both accounts in one transaction also prevents two administrators
    // from simultaneously demoting one another and leaving no active admin.
    await db.runTransaction(async (tx) => {
      const [current, currentActor] = await Promise.all([
        tx.get(db.doc(`users/${id}`)),
        tx.get(db.doc(`users/${actor.id}`)),
      ]);
      if (!current.exists)
        throw new AppError("ユーザーが見つかりません。", 404);
      if (
        currentActor.data()?.role !== "admin" ||
        !currentActor.data()?.isActive
      )
        throw new AppError(
          "管理者権限が変更されています。再ログインしてください。",
          403,
        );
      if (input.email !== current.data()!.email)
        throw new AppError("既存ユーザーのメールアドレスは変更できません。");
      // Firestore is the authorization source. Disable there before Authentication.
      tx.update(db.doc(`users/${id}`), { ...data, updatedAt: now });
    });
    await auth.updateUser(id, {
      displayName: input.name,
      disabled: !input.isActive,
      ...(password ? { password } : {}),
    });
    if (!input.isActive) await auth.revokeRefreshTokens(id);
  } else {
    if (!password)
      throw new AppError("12文字以上の初期パスワードを入力してください。");
    const record = await auth.createUser({
      email: input.email,
      password,
      displayName: input.name,
      disabled: !input.isActive,
    });
    try {
      await db
        .doc(`users/${record.uid}`)
        .create({ ...data, createdAt: now, updatedAt: now });
    } catch (error) {
      await auth.deleteUser(record.uid);
      throw error;
    }
  }
}
