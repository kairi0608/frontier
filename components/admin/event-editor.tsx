"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, History, Save, Send, Users } from "lucide-react";
import { useApp } from "@/components/layout/workspace";
import { PageTitle } from "@/components/events/member-pages";
import {
  Changes,
  inputOf,
  Modal,
  notificationMessage,
  notifyUntilDone,
} from "./admin-pages";
import { repository } from "@/lib/repositories";
import { eventSchema } from "@/lib/events/validators";
import { diffEvents, hasNotifiableChanges } from "@/lib/events/diff";
import { fromJstInput, toJstInput } from "@/lib/events/format";
import { errorMessage } from "@/lib/errors";
import { isPrototype } from "@/lib/config/app-mode";
import type { Event, EventInput } from "@/types/domain";
const empty: EventInput = {
  title: "",
  summary: "",
  description: "",
  startAt: "",
  endAt: null,
  location: "",
  meetingPlace: "",
  meetingAt: null,
  belongings: [],
  managerUserId: null,
  relatedUrl: null,
  notes: "",
  publicationStatus: "draft",
};
export function EventEditor({ event }: { event?: Event }) {
  const { data, run, busy, setMessage } = useApp();
  const router = useRouter();
  const [baseline, setBaseline] = useState(event),
    [input, setInput] = useState<EventInput>(event ? inputOf(event) : empty),
    [confirm, setConfirm] = useState(false),
    [validation, setValidation] = useState(""),
    [pendingLog, setPendingLog] = useState<string | null>(null);
  const changes = baseline ? diffEvents(baseline, input) : [];
  const users = data.users.filter((u) => u.isActive);
  const count = (status: string) =>
    users.filter(
      (u) =>
        (data.responses.find(
          (r) => r.eventId === baseline?.id && r.userId === u.id,
        )?.status || "unanswered") === status,
    ).length;
  function update<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setInput((old) => ({ ...old, [key]: value }));
  }
  function validate() {
    const result = eventSchema.safeParse(input);
    setValidation(
      result.success
        ? ""
        : result.error.issues.map((i) => i.message).join(" / "),
    );
    return result.success;
  }
  async function save(notify: boolean) {
    if (!validate()) {
      setConfirm(false);
      return;
    }
    let resultMessage = "保存しました。";
    const ok = await run(async () => {
      const repo = await repository();
      const result = await repo.save(input, baseline?.id, baseline?.version);
      setBaseline(result.event);
      setPendingLog(result.changeLogId);
      if (notify && result.changeLogId) {
        try {
          resultMessage = notificationMessage(
            await notifyUntilDone(result.event.id, result.changeLogId),
          );
          setPendingLog(null);
        } catch (e) {
          throw new Error(
            `イベントの保存は完了しましたが、通知が完了していません。履歴から再開してください。${errorMessage(e)}`,
          );
        }
      } else if (!result.changeLogId)
        resultMessage = "変更差分がないため、保存・通知は行いませんでした。";
      if (!event) router.replace(`/admin/events/${result.event.id}`);
    }, "");
    setConfirm(false);
    if (ok) setMessage(resultMessage);
  }
  const textFields: {
    key:
      | "title"
      | "summary"
      | "description"
      | "location"
      | "meetingPlace"
      | "notes";
    label: string;
    multiline?: boolean;
    required?: boolean;
  }[] = [
    { key: "title", label: "イベント名", required: true },
    { key: "summary", label: "概要" },
    { key: "description", label: "詳細説明", multiline: true },
    { key: "location", label: "開催場所", required: true },
    { key: "meetingPlace", label: "集合場所" },
    { key: "notes", label: "備考", multiline: true },
  ];
  return (
    <>
      <Link className="back-link" href="/admin/events">
        <ChevronLeft size={17} />
        イベント管理
      </Link>
      <PageTitle
        eyebrow={baseline ? "EDIT EVENT" : "CREATE EVENT"}
        title={baseline ? "イベントを編集" : "イベントを作成"}
        description="日時はすべて日本時間です。保存だけではメールは送られません。"
        action={
          baseline && (
            <div className="row-actions">
              <Link
                className="btn secondary"
                href={`/admin/events/${baseline.id}/participants`}
              >
                <Users size={17} />
                参加者
              </Link>
              <Link
                className="btn secondary"
                href={`/admin/events/${baseline.id}/history`}
              >
                <History size={17} />
                履歴
              </Link>
            </div>
          )
        }
      />
      {baseline && event && event.version !== baseline.version && (
        <p className="error">
          他の管理者によってイベントが更新されています。最新情報を再取得してください。
          <button
            onClick={() => {
              setBaseline(event);
              setInput(inputOf(event));
            }}
          >
            最新の内容をフォームに読み込む
          </button>
        </p>
      )}
      {pendingLog && baseline && (
        <p className="notice">
          保存した変更の通知状況は
          <Link href={`/admin/events/${baseline.id}/history`}>
            変更・通知履歴
          </Link>
          で確認できます。
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <div className="editor-grid">
          <section className="panel">
            <h2>基本情報</h2>
            {textFields.slice(0, 3).map((f) => (
              <label key={f.key}>
                {f.label}
                {f.required && <span className="required">必須</span>}
                {f.multiline ? (
                  <textarea
                    rows={5}
                    value={input[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    required={f.required}
                    value={input[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                )}
              </label>
            ))}
            <h2 className="form-section">日時・集合</h2>
            <div className="form-two">
              {(
                [
                  { key: "startAt", label: "開催日時" },
                  { key: "endAt", label: "終了日時" },
                  { key: "meetingAt", label: "集合時刻" },
                ] as const
              ).map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.key === "startAt" && (
                    <span className="required">必須</span>
                  )}
                  <input
                    type="datetime-local"
                    required={f.key === "startAt"}
                    value={toJstInput(input[f.key])}
                    onChange={(e) =>
                      update(
                        f.key,
                        fromJstInput(e.target.value) ||
                          (f.key === "startAt" ? "" : null),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            {textFields.slice(3, 5).map((f) => (
              <label key={f.key}>
                {f.label}
                {f.required && <span className="required">必須</span>}
                <input
                  required={f.required}
                  value={input[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              </label>
            ))}
            <h2 className="form-section">その他</h2>
            <label>
              持ち物（1行に1つ）
              <textarea
                rows={3}
                value={input.belongings.join("\n")}
                onChange={(e) =>
                  update("belongings", e.target.value.split("\n"))
                }
              />
            </label>
            <label>
              担当者
              <select
                value={input.managerUserId || ""}
                onChange={(e) =>
                  update("managerUserId", e.target.value || null)
                }
              >
                <option value="">未設定</option>
                {users.map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              関連URL
              <input
                type="url"
                placeholder="https://"
                value={input.relatedUrl || ""}
                onChange={(e) => update("relatedUrl", e.target.value || null)}
              />
            </label>
            <label>
              備考
              <textarea
                rows={4}
                value={input.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </label>
          </section>
          <aside>
            <section className="panel">
              <h2>公開設定</h2>
              <label>
                公開状態
                <select
                  value={input.publicationStatus}
                  onChange={(e) =>
                    update(
                      "publicationStatus",
                      e.target.value as EventInput["publicationStatus"],
                    )
                  }
                >
                  <option value="draft">下書き（非公開）</option>
                  <option value="published">公開</option>
                </select>
              </label>
              <p className="muted small">
                公開するとメンバーが閲覧・回答できます。
              </p>
            </section>
            {baseline && (
              <section className="panel section-space">
                <h2>
                  今回の変更 <span className="count">{changes.length}</span>
                </h2>
                <Changes changes={changes} />
              </section>
            )}
          </aside>
        </div>
        {validation && (
          <p role="alert" className="error">
            {validation}
          </p>
        )}
        <div className="save-bar">
          <p className="muted small">
            {baseline
              ? `編集中のバージョン：${baseline.version}`
              : "まずは下書きでも保存できます"}
          </p>
          <button className="btn secondary" disabled={busy} type="submit">
            <Save size={18} />
            {busy ? "処理中…" : "保存のみ"}
          </button>
          {baseline && (
            <button
              type="button"
              className="btn primary"
              disabled={
                busy ||
                !hasNotifiableChanges(changes) ||
                input.publicationStatus !== "published"
              }
              onClick={() => {
                if (validate()) setConfirm(true);
              }}
            >
              <Send size={18} />
              保存して参加者へ通知
            </button>
          )}
        </div>
      </form>
      {confirm && (
        <Modal
          title="変更を保存して通知しますか？"
          onClose={() => !busy && setConfirm(false)}
        >
          <Changes changes={changes} />
          <h3>通知対象</h3>
          <div className="target-count">
            <b>参加 {count("attending")}名</b>
            <span>送信する</span>
          </div>
          {[
            ["maybe", "未定"],
            ["declined", "不参加"],
            ["unanswered", "未回答"],
          ].map(([key, label]) => (
            <div className="target-count muted" key={key}>
              <span>
                {label} {count(key)}名
              </span>
              <span>送信しない</span>
            </div>
          ))}
          <p className="muted small">
            無効ユーザーは除外済みです。送信対象はサーバーで再計算されるため、回答変更により人数が変わる場合があります。
          </p>
          {isPrototype() && (
            <p className="notice">
              試用モードのため、実際のメールは送信されません。
            </p>
          )}
          <div className="modal-actions">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              キャンセル
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void save(true)}
            >
              {busy ? "送信処理中…" : `${count("attending")}名へ通知`}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
