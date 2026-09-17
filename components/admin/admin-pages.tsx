"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowRight,
  CalendarDays,
  Users,
  History,
  Copy,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  ChevronLeft,
  Send,
  X,
} from "lucide-react";
import { useApp } from "@/components/layout/workspace";
import { PageTitle } from "@/components/events/member-pages";
import { EventEditor } from "./event-editor";
import { UserManager } from "./user-manager";
import { repository } from "@/lib/repositories";
import {
  changeValues,
  fieldLabels,
  hasNotifiableChanges,
} from "@/lib/events/diff";
import { formatDateTime, responseLabels } from "@/lib/events/format";
import type {
  Change,
  Event,
  EventInput,
  NotificationLog,
  ResponseStatus,
} from "@/types/domain";
export function inputOf(event: Event): EventInput {
  return {
    title: event.title,
    summary: event.summary,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    location: event.location,
    meetingPlace: event.meetingPlace,
    meetingAt: event.meetingAt,
    belongings: event.belongings,
    managerUserId: event.managerUserId,
    relatedUrl: event.relatedUrl,
    notes: event.notes,
    publicationStatus: event.publicationStatus,
  };
}
export function Changes({ changes }: { changes: Change[] }) {
  const { data } = useApp();
  return changes.length ? (
    <div className="change-list">
      {changes.map((c) => {
        const [before, after] = changeValues(c, data.managerNames);
        return (
          <div className="change-row" key={c.field}>
            <b>{fieldLabels[c.field] || c.field}</b>
            <div>
              <span className="old-value">{before}</span>
              <ArrowRight size={16} />
              <span className="new-value">{after}</span>
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    <p className="muted small">変更差分はありません。</p>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const { error, busy } = useApp();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key !== "Tab") return;
          const focusable = panel.current?.querySelectorAll<HTMLElement>(
            "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
          );
          if (!focusable?.length) {
            e.preventDefault();
            return;
          }
          const first = focusable[0],
            last = focusable[focusable.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            last.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last ||
              document.activeElement === panel.current)
          ) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            aria-label="閉じる"
            className="icon-button"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {children}
      </section>
    </div>
  );
}
export async function notifyUntilDone(
  eventId: string,
  logId: string,
): Promise<NotificationLog> {
  const repo = await repository();
  let result = await repo.notify(eventId, logId);
  for (let i = 0; result.status === "processing" && i < 100; i++)
    result = await repo.notify(eventId, logId);
  return result;
}
export function notificationMessage(result: NotificationLog) {
  return result.status === "completed"
    ? result.recipientCount === 0
      ? "通知対象は0名でした。通知履歴を保存しました。"
      : `${result.recipientCount}名への${result.simulated ? "試用通知" : "通知"}が完了しました。`
    : result.status === "processing"
      ? "通知処理を保存しました。履歴から続きを実行できます。"
      : "一部または全員への送信に失敗しました。通知履歴で結果を確認し、再送できます。";
}
export function AdminPages({ path }: { path: string[] }) {
  const { data } = useApp();
  const event = data.events.find((e) => e.id === path[2]);
  return (
    <>
      <nav className="admin-tabs">
        <Link href="/admin" className={path.length === 1 ? "active" : ""}>
          概要
        </Link>
        <Link
          href="/admin/events"
          className={path[1] === "events" ? "active" : ""}
        >
          イベント管理
        </Link>
        <Link
          href="/admin/users"
          className={path[1] === "users" ? "active" : ""}
        >
          ユーザー管理
        </Link>
      </nav>
      {path[1] === "users" ? (
        <UserManager />
      ) : path[1] === "events" && path[2] === "new" ? (
        <EventEditor key="new" />
      ) : path[1] === "events" && path[2] ? (
        !event ? (
          <div className="empty">
            <h2>イベントが見つかりません</h2>
            <Link href="/admin/events">管理一覧へ</Link>
          </div>
        ) : path[3] === "participants" ? (
          <Participants event={event} />
        ) : path[3] === "history" ? (
          <EventHistory event={event} />
        ) : (
          <EventEditor key={event.id} event={event} />
        )
      ) : path[1] === "events" ? (
        <AdminEvents />
      ) : (
        <AdminHome />
      )}
    </>
  );
}
function AdminHome() {
  const { data } = useApp();
  const upcoming = data.events.filter(
    (e) => (e.endAt || e.startAt) >= new Date().toISOString(),
  );
  const active = data.users.filter((u) => u.isActive);
  const waiting = upcoming.filter(
    (e) =>
      e.publicationStatus === "published" &&
      active.some(
        (u) =>
          !data.responses.some((r) => r.eventId === e.id && r.userId === u.id),
      ),
  );
  const changes = [...data.events]
    .filter((e) => e.version > 1)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  return (
    <>
      <PageTitle
        eyebrow="ADMINISTRATION"
        title="管理ダッシュボード"
        description="活動の準備と、メンバーの参加状況を確認。"
        action={
          <Link className="btn primary" href="/admin/events/new">
            <Plus size={18} />
            イベントを作成
          </Link>
        }
      />
      <div className="stats">
        <div>
          <CalendarDays />
          <span>今後のイベント</span>
          <strong>
            {upcoming.length}
            <small>件</small>
          </strong>
        </div>
        <div>
          <Users />
          <span>未回答者がいるイベント</span>
          <strong>
            {waiting.length}
            <small>件</small>
          </strong>
        </div>
        <div>
          <Users />
          <span>有効なメンバー</span>
          <strong>
            {active.length}
            <small>名</small>
          </strong>
        </div>
      </div>
      <section className="panel">
        <h2>回答状況を確認</h2>
        {waiting.length ? (
          waiting.map((e) => (
            <Link
              className="list-row"
              href={`/admin/events/${e.id}/participants`}
              key={e.id}
            >
              <div>
                <b>{e.title}</b>
                <p className="muted small">{formatDateTime(e.startAt)}</p>
              </div>
              <span>
                未回答{" "}
                {
                  active.filter(
                    (u) =>
                      !data.responses.some(
                        (r) => r.eventId === e.id && r.userId === u.id,
                      ),
                  ).length
                }
                名
              </span>
              <ArrowRight size={18} />
            </Link>
          ))
        ) : (
          <p className="muted">未回答者がいるイベントはありません。</p>
        )}
      </section>
      <section className="panel section-space">
        <h2>最近変更したイベント</h2>
        {changes.length ? (
          changes.map((e) => (
            <Link
              className="list-row"
              key={e.id}
              href={`/admin/events/${e.id}/history`}
            >
              <b>{e.title}</b>
              <span className="muted small">{formatDateTime(e.updatedAt)}</span>
              <History size={18} />
            </Link>
          ))
        ) : (
          <p className="muted">最近の変更はありません。</p>
        )}
      </section>
    </>
  );
}
function AdminEvents() {
  const { data, run, busy } = useApp();
  const router = useRouter();
  const [deleting, setDeleting] = useState<Event | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="MANAGE EVENTS"
        title="イベント管理"
        description="公開状態・参加状況・変更履歴をまとめて管理。"
        action={
          <Link className="btn primary" href="/admin/events/new">
            <Plus size={18} />
            イベントを作成
          </Link>
        }
      />
      <div className="admin-event-list">
        {[...data.events]
          .sort((a, b) => b.startAt.localeCompare(a.startAt))
          .map((e) => (
            <article className="panel" key={e.id}>
              <div className="section-heading">
                <span
                  className={`badge ${e.publicationStatus === "published" ? "attending" : "unanswered"}`}
                >
                  {e.publicationStatus === "published" ? "公開中" : "下書き"}
                </span>
                <span className="muted small">v{e.version}</span>
              </div>
              <h2>{e.title}</h2>
              <p className="muted small">
                {formatDateTime(e.startAt)} · {e.location}
              </p>
              <div className="row-actions">
                <Link className="btn secondary" href={`/admin/events/${e.id}`}>
                  <Pencil size={16} />
                  編集
                </Link>
                <Link
                  className="btn secondary"
                  href={`/admin/events/${e.id}/participants`}
                >
                  <Users size={16} />
                  参加者
                </Link>
                <Link
                  className="btn secondary"
                  href={`/admin/events/${e.id}/history`}
                >
                  <History size={16} />
                  履歴
                </Link>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await (
                        await repository()
                      ).save(
                        {
                          ...inputOf(e),
                          publicationStatus:
                            e.publicationStatus === "published"
                              ? "draft"
                              : "published",
                        },
                        e.id,
                        e.version,
                      );
                    })
                  }
                >
                  {e.publicationStatus === "published" ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                  {e.publicationStatus === "published"
                    ? "非公開にする"
                    : "公開する"}
                </button>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await (
                        await repository()
                      ).save({
                        ...inputOf(e),
                        title: `${e.title}（コピー）`,
                        publicationStatus: "draft",
                      });
                      router.push(`/admin/events/${result.event.id}`);
                    }, "下書きとして複製しました。")
                  }
                >
                  <Copy size={16} />
                  複製
                </button>
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => setDeleting(e)}
                >
                  <Trash2 size={16} />
                  削除
                </button>
              </div>
            </article>
          ))}
      </div>
      {!data.events.length && (
        <div className="empty">イベントを作成してください。</div>
      )}
      {deleting && (
        <Modal
          title="イベントを削除しますか？"
          onClose={() => !busy && setDeleting(null)}
        >
          <p>
            「{deleting.title}
            」を一覧から削除します。変更・通知履歴は保持されます。
          </p>
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              キャンセル
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await run(
                    async () =>
                      (await repository()).remove(
                        deleting.id,
                        deleting.version,
                      ),
                    "イベントを削除しました。",
                  )
                )
                  setDeleting(null);
              }}
            >
              削除する
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Participants({ event }: { event: Event }) {
  const { data } = useApp();
  const users = data.users.filter((u) => u.isActive);
  return (
    <>
      <Link className="back-link" href={`/admin/events/${event.id}`}>
        <ChevronLeft size={17} />
        イベント編集
      </Link>
      <PageTitle
        eyebrow="PARTICIPANTS"
        title="参加者一覧"
        description={event.title}
      />
      <p className="notice">
        有効なユーザーを集計しています。メール通知は「参加」のメンバーだけに送信されます。
      </p>
      <div className="participant-grid">
        {(["attending", "maybe", "declined", "unanswered"] as const).map(
          (s) => {
            const members = users.filter(
              (u) =>
                (data.responses.find(
                  (r) => r.eventId === event.id && r.userId === u.id,
                )?.status || "unanswered") === s,
            );
            return (
              <section className="panel" key={s}>
                <div className="section-heading">
                  <h2>
                    {s === "unanswered"
                      ? "未回答"
                      : responseLabels[s as ResponseStatus]}
                  </h2>
                  <span className="count">{members.length}名</span>
                </div>
                {members.length ? (
                  members.map((u) => (
                    <div className="person-row" key={u.id}>
                      <span className="avatar">{u.name.slice(0, 1)}</span>
                      <div>
                        <b>{u.name}</b>
                        <p className="small muted">{u.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted small">該当者はいません。</p>
                )}
              </section>
            );
          },
        )}
      </div>
    </>
  );
}
function EventHistory({ event }: { event: Event }) {
  const { data, run, busy, setMessage } = useApp();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const changes = data.changes
    .filter((c) => c.eventId === event.id)
    .sort((a, b) => b.toVersion - a.toVersion);
  const labels = {
    processing: "処理中",
    completed: "完了",
    partial_failed: "一部失敗",
    failed: "失敗",
  };
  return (
    <>
      <Link className="back-link" href={`/admin/events/${event.id}`}>
        <ChevronLeft size={17} />
        イベント編集
      </Link>
      <PageTitle
        eyebrow="CHANGE & DELIVERY LOG"
        title="変更・通知履歴"
        description={event.title}
      />
      {changes.map((c) => {
        const n = data.notifications.find((n) => n.changeLogIds.includes(c.id));
        return (
          <section className="panel history-panel" key={c.id}>
            <div className="section-heading">
              <h2>
                {c.fromVersion === 0
                  ? "イベント作成"
                  : `v${c.fromVersion} → v${c.toVersion}`}
              </h2>
              <span className="muted small">{formatDateTime(c.changedAt)}</span>
            </div>
            <p className="muted small">
              変更者：
              {data.users.find((u) => u.id === c.changedBy)?.name ||
                c.changedBy}
            </p>
            <Changes changes={c.changes} />
            <div className="notification-summary">
              <Send size={17} />
              <b>
                {n
                  ? `通知：${labels[n.status]} · ${n.recipientCount}名`
                  : "未通知"}
              </b>
              {n?.simulated && (
                <span className="badge prototype">試用・実送信なし</span>
              )}
              {(!n || n.status !== "completed") &&
                hasNotifiableChanges(c.changes) &&
                event.publicationStatus === "published" && (
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => setConfirmId(c.id)}
                  >
                    {n ? "再送・処理を再開" : "この変更を参加者へ通知"}
                  </button>
                )}
            </div>
            {n?.recipients && (
              <details>
                <summary>ユーザーごとの送信結果</summary>
                {n.recipients.map((r) => (
                  <div className="recipient-row" key={r.userId}>
                    <span>
                      {data.users.find((u) => u.id === r.userId)?.name ||
                        r.userId}
                      <small>{r.email}</small>
                    </span>
                    <span
                      className={
                        r.status === "failed" ? "text-danger" : "text-green"
                      }
                    >
                      {r.status === "sent" ? "送信済み" : "送信失敗"}
                      <small>
                        {r.error || (r.sentAt ? formatDateTime(r.sentAt) : "")}
                      </small>
                    </span>
                  </div>
                ))}
              </details>
            )}
          </section>
        );
      })}
      {!changes.length && (
        <div className="empty">変更履歴はまだありません。</div>
      )}
      {confirmId && (
        <Modal
          title="この変更を参加者へ通知"
          onClose={() => !busy && setConfirmId(null)}
        >
          <Changes
            changes={changes.find((c) => c.id === confirmId)?.changes || []}
          />
          <p className="notice">
            送信時点で有効な「参加」ユーザーのみ対象です。同じ通知で送信済みの相手には再送しません。
          </p>
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setConfirmId(null)}
            >
              キャンセル
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                let message = "";
                const ok = await run(async () => {
                  message = notificationMessage(
                    await notifyUntilDone(event.id, confirmId),
                  );
                }, "");
                if (ok) {
                  setMessage(message);
                  setConfirmId(null);
                }
              }}
            >
              {busy ? "処理中…" : "通知を実行"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
