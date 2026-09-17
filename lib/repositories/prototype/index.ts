import type { Repository } from "../contract";
import { requireAppMode } from "@/lib/config/app-mode";
import type {
  Event,
  EventInput,
  EventResponse,
  ChangeLog,
  NotificationLog,
  ResponseStatus,
  Snapshot,
  User,
  UserInput,
} from "@/types/domain";
import { AppError, conflictMessage } from "@/lib/errors";
import { diffEvents, hasNotifiableChanges } from "@/lib/events/diff";
import { selectRecipients } from "@/lib/notifications/targets";
import { eventSchema, userSchema } from "@/lib/events/validators";
interface Store {
  users: User[];
  events: Event[];
  responses: EventResponse[];
  changes: ChangeLog[];
  notifications: NotificationLog[];
}
const key = "frontier-prototype-v1",
  sessionKey = "frontier-user";
const now = () => new Date().toISOString();
export function seed(): Store {
  const createdAt = now();
  const users: User[] = [
    ["admin", "佐藤 海", "admin@frontier.example", "admin"],
    ["member", "高橋 はる", "member@frontier.example", "member"],
    ["member2", "鈴木 蓮", "ren@frontier.example", "member"],
    ["member3", "伊藤 葵", "aoi@frontier.example", "member"],
    ["member4", "田中 陽", "yo@frontier.example", "member"],
    ["inactive", "休止メンバー", "inactive@frontier.example", "member"],
  ].map(([id, name, email, role]) => ({
    id,
    name,
    email,
    role: role as User["role"],
    isActive: id !== "inactive",
    createdAt,
    updatedAt: createdAt,
  }));
  const day = (offset: number, hour: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    d.setUTCHours(hour - 9, 0, 0, 0);
    return d.toISOString();
  };
  const events: Event[] = [
    [
      "welcome",
      "秋のフィールドワーク",
      "まちを歩いて、新しい発見を。",
      "福島市 街なか広場",
      7,
    ],
    [
      "meeting",
      "フロンティア 定例ミーティング",
      "次の活動を、みんなで考える時間。",
      "市民活動サポートセンター",
      14,
    ],
    [
      "workshop",
      "チームワーク ワークショップ",
      "つくって、話して、お互いを知ろう。",
      "コラッセふくしま",
      21,
    ],
    ["draft", "冬の交流会（準備中）", "次の季節の企画です。", "会場調整中", 45],
    ["past", "夏の振り返り会", "夏の活動を振り返りました。", "市民会館", -14],
  ].map(([id, title, summary, location, days]) => ({
    id: String(id),
    title: String(title),
    summary: String(summary),
    location: String(location),
    description:
      "フロンティアのメンバーで集まる活動です。初めての方も気軽にご参加ください。\n当日は集合場所にお集まりください。",
    startAt: day(Number(days), 13),
    endAt: day(Number(days), 16),
    meetingAt: new Date(
      new Date(day(Number(days), 12)).getTime() + 1800000,
    ).toISOString(),
    meetingPlace: "福島駅西口",
    belongings: ["飲み物", "筆記用具"],
    managerUserId: "admin",
    relatedUrl: null,
    notes: "雨天の場合は屋内で実施します。",
    publicationStatus: id === "draft" ? "draft" : "published",
    version: 1,
    createdBy: "admin",
    updatedBy: "admin",
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    deletedBy: null,
  }));
  const responses: EventResponse[] = [
    ["welcome", "member", "attending"],
    ["welcome", "member2", "maybe"],
    ["welcome", "member3", "declined"],
    ["welcome", "inactive", "attending"],
    ["past", "member", "attending"],
  ].map(([eventId, userId, status]) => ({
    eventId,
    userId,
    status: status as ResponseStatus,
    createdAt,
    updatedAt: createdAt,
  }));
  return { users, events, responses, changes: [], notifications: [] };
}
export class MockRepository implements Repository {
  constructor() {
    requireAppMode("prototype");
  }
  private read(): Store {
    requireAppMode("prototype");
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    const data = seed();
    this.write(data);
    return data;
  }
  private write(data: Store) {
    requireAppMode("prototype");
    localStorage.setItem(key, JSON.stringify(data));
  }
  private actor(data: Store, admin = false) {
    const user = data.users.find(
      (u) => u.id === sessionStorage.getItem(sessionKey),
    );
    if (!user) throw new AppError("ログインしてください。", 401);
    if (!user.isActive || (admin && user.role !== "admin"))
      throw new AppError("アクセス権限がありません。", 403);
    return user;
  }
  async login(email: string, password: string) {
    void password;
    const user = this.read().users.find((u) => u.email === email && u.isActive);
    if (!user) throw new AppError("試用アカウントを選択してください。");
    sessionStorage.setItem(sessionKey, user.id);
  }
  async logout() {
    requireAppMode("prototype");
    sessionStorage.removeItem(sessionKey);
  }
  async snapshot(): Promise<Snapshot> {
    const data = this.read(),
      user = this.actor(data),
      admin = user.role === "admin";
    return {
      ...data,
      user,
      users: admin ? data.users : [user],
      events: data.events.filter(
        (e) => !e.deletedAt && (admin || e.publicationStatus === "published"),
      ),
      responses: data.responses.filter((r) => admin || r.userId === user.id),
      changes: admin ? data.changes : [],
      notifications: admin ? data.notifications : [],
      managerNames: Object.fromEntries(data.users.map((u) => [u.id, u.name])),
    };
  }
  async respond(eventId: string, status: ResponseStatus) {
    const data = this.read(),
      user = this.actor(data);
    if (
      !data.events.some(
        (e) =>
          e.id === eventId &&
          !e.deletedAt &&
          e.publicationStatus === "published",
      )
    )
      throw new AppError("このイベントには回答できません。", 404);
    const existing = data.responses.find(
      (r) => r.eventId === eventId && r.userId === user.id,
    );
    if (existing) {
      existing.status = status;
      existing.updatedAt = now();
    } else
      data.responses.push({
        eventId,
        userId: user.id,
        status,
        createdAt: now(),
        updatedAt: now(),
      });
    this.write(data);
  }
  async save(input: EventInput, id?: string, version?: number) {
    eventSchema.parse(input);
    const data = this.read(),
      user = this.actor(data, true);
    const before = data.events.find((e) => e.id === id);
    if (id && (!before || before.deletedAt))
      throw new AppError("イベントが見つかりません。", 404);
    if (before && before.version !== version)
      throw new AppError(conflictMessage, 409);
    const changes = before ? diffEvents(before, input) : [];
    if (before && changes.length === 0)
      return { event: before, changeLogId: null };
    const event: Event = {
      ...input,
      id: id || crypto.randomUUID(),
      version: (before?.version || 0) + 1,
      createdAt: before?.createdAt || now(),
      updatedAt: now(),
      createdBy: before?.createdBy || user.id,
      updatedBy: user.id,
      deletedAt: null,
      deletedBy: null,
    };
    const changeLogId = crypto.randomUUID();
    data.events = [...data.events.filter((e) => e.id !== event.id), event];
    data.changes.push({
      id: changeLogId,
      eventId: event.id,
      changedBy: user.id,
      changedAt: now(),
      fromVersion: before?.version || 0,
      toVersion: event.version,
      changes,
      notificationStatus: "not_sent",
    });
    this.write(data);
    return { event, changeLogId };
  }
  async remove(id: string, version: number) {
    const data = this.read(),
      user = this.actor(data, true),
      event = data.events.find((e) => e.id === id);
    if (!event || event.deletedAt)
      throw new AppError("イベントが見つかりません。", 404);
    if (event.version !== version) throw new AppError(conflictMessage, 409);
    event.deletedAt = now();
    event.deletedBy = user.id;
    event.updatedAt = now();
    event.updatedBy = user.id;
    event.version++;
    data.changes.push({
      id: crypto.randomUUID(),
      eventId: id,
      changedBy: user.id,
      changedAt: now(),
      fromVersion: version,
      toVersion: version + 1,
      changes: [
        { field: "deletedAt", oldValue: null, newValue: event.deletedAt },
      ],
      notificationStatus: "not_sent",
    });
    this.write(data);
  }
  async notify(id: string, changeLogId: string) {
    const data = this.read(),
      user = this.actor(data, true);
    const event = data.events.find(
      (e) => e.id === id && !e.deletedAt && e.publicationStatus === "published",
    );
    const change = data.changes.find(
      (c) => c.id === changeLogId && c.eventId === id,
    );
    if (!event || !change)
      throw new AppError("イベントまたは履歴が見つかりません。", 404);
    const old = data.notifications.find((n) => n.id === changeLogId);
    if (old) return old;
    if (!hasNotifiableChanges(change.changes))
      throw new AppError("通知する変更差分がありません。");
    const targets = selectRecipients(id, data.responses, data.users);
    const log: NotificationLog = {
      id: changeLogId,
      eventId: id,
      changeLogIds: [changeLogId],
      type: "event_changed",
      sentBy: user.id,
      recipientCount: targets.length,
      status: "completed",
      createdAt: now(),
      completedAt: now(),
      simulated: true,
      recipients: targets.map((u) => ({
        userId: u.id,
        email: u.email,
        status: "sent",
        providerMessageId: "prototype-no-email",
        sentAt: now(),
        error: null,
      })),
    };
    data.notifications.push(log);
    change.notificationStatus = "sent";
    this.write(data);
    return log;
  }
  async saveUser(input: UserInput, id?: string) {
    userSchema.parse(input);
    const data = this.read(),
      actor = this.actor(data, true);
    if (id === actor.id && (!input.isActive || input.role !== "admin"))
      throw new AppError("自分自身の権限は解除できません。");
    const existing = data.users.find((u) => u.id === id);
    if (data.users.some((u) => u.id !== id && u.email === input.email))
      throw new AppError("このメールアドレスは登録済みです。");
    const safe = {
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: input.isActive,
    };
    if (existing) Object.assign(existing, safe, { updatedAt: now() });
    else
      data.users.push({
        ...safe,
        id: crypto.randomUUID(),
        createdAt: now(),
        updatedAt: now(),
      });
    this.write(data);
  }
}
