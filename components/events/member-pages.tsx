"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  Clock3,
  Check,
  ChevronLeft,
  Sparkles,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/layout/workspace";
import { repository } from "@/lib/repositories";
import {
  formatDate,
  formatDateTime,
  formatTime,
  responseLabels,
} from "@/lib/events/format";
import type { Event, ResponseStatus } from "@/types/domain";
export function EventCard({
  event,
  hero = false,
}: {
  event: Event;
  hero?: boolean;
}) {
  const { data } = useApp();
  const response = data.responses.find(
    (r) => r.eventId === event.id && r.userId === data.user.id,
  );
  const date = formatDate(event.startAt).split("/");
  return (
    <Link
      href={`/events/${event.id}`}
      className={`event-card ${hero ? "hero-card" : ""}`}
    >
      <div className="event-art" aria-hidden="true">
        <div className="art-ring" />
        <div className="art-hill" />
        <span>
          FRONTIER
          <br />
          FIELD NOTES
        </span>
        <ArrowUpRight />
      </div>
      <div className="event-body">
        <div className="card-meta">
          <span className={`badge ${response?.status || "unanswered"}`}>
            {response ? responseLabels[response.status] : "未回答"}
          </span>
          <span className="muted small">{date[0]}</span>
        </div>
        <div className="card-heading">
          <div className="date-tile">
            <span>{date[1]}月</span>
            <strong>{date[2]}</strong>
          </div>
          <div>
            <h3>{event.title}</h3>
            <p>{event.summary}</p>
          </div>
        </div>
        <div className="event-facts">
          <span>
            <Clock3 size={15} />
            {formatTime(event.startAt)}
            {event.endAt && ` – ${formatTime(event.endAt)}`}
          </span>
          <span>
            <MapPin size={15} />
            {event.location}
          </span>
        </div>
        <div className="card-link">
          詳細を見る <ArrowRight size={17} />
        </div>
      </div>
    </Link>
  );
}
export function EventGrid({ events }: { events: Event[] }) {
  return events.length ? (
    <div className="event-grid">
      {events.map((e) => (
        <EventCard key={e.id} event={e} />
      ))}
    </div>
  ) : (
    <div className="empty compact">
      <CalendarDays size={28} />
      <p>該当するイベントはありません。</p>
    </div>
  );
}
export function MemberPages({ path }: { path: string[] }) {
  const { data } = useApp();
  const [filter, setFilter] = useState("今後");
  const [tab, setTab] = useState("参加予定");
  const events = data.events
    .filter((e) => e.publicationStatus === "published" && !e.deletedAt)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const today = new Date().toISOString();
  const status = (id: string) =>
    data.responses.find((r) => r.eventId === id && r.userId === data.user.id)
      ?.status;
  const upcoming = events.filter((e) => (e.endAt || e.startAt) >= today);
  if (path[0] === "profile") return <Profile />;
  if (path[0] === "events" && path[1]) return <EventDetail id={path[1]} />;
  if (path[0] === "home") {
    const next = upcoming.find((e) => status(e.id) === "attending"),
      unanswered = upcoming.filter((e) => !status(e.id));
    const changed = events
      .filter((e) => e.version > 1)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3);
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR FRONTIER</p>
            <h1>
              こんにちは、{data.user.name.split(" ")[0]}さん
              <span className="greeting-dot">。</span>
            </h1>
            <p>次の楽しみを、ここから見つけよう。</p>
          </div>
          <span className="today">
            <CalendarDays size={16} />
            {formatDate(today)}
          </span>
        </div>
        <div className="home-lead">
          <section>
            <div className="section-heading">
              <h2>
                <span className="green-dot" />
                次の参加予定
              </h2>
              <span className="eyebrow">UP NEXT</span>
            </div>
            {next ? (
              <EventCard event={next} hero />
            ) : (
              <div className="empty hero-empty">
                <Sparkles />
                <h3>次の予定を見つけよう。</h3>
                <p>「参加」を選ぶと、ここに表示されます。</p>
                <Link className="btn primary" href="/events">
                  イベントを探す <ArrowRight size={17} />
                </Link>
              </div>
            )}
          </section>
          <aside className="home-note">
            <span className="eyebrow">A SMALL REMINDER</span>
            <div className="note-illustration">
              <CalendarDays size={56} strokeWidth={1.2} />
              <span>?</span>
            </div>
            <h2>予定を、教えてね。</h2>
            <p>
              あなたの回答が、
              <br />
              次の活動の準備につながります。
            </p>
            <div className="note-count">
              <strong>{unanswered.length}</strong>
              <span>件の未回答イベント</span>
            </div>
            <Link href="/events">
              イベント一覧へ <ArrowRight size={17} />
            </Link>
          </aside>
        </div>
        <section className="section-space">
          <div className="section-heading">
            <h2>
              未回答イベント <span className="count">{unanswered.length}</span>
            </h2>
            <Link href="/events">
              すべて見る <ArrowRight size={15} />
            </Link>
          </div>
          <EventGrid events={unanswered.slice(0, 3)} />
        </section>
        <section className="section-space">
          <div className="section-heading">
            <h2>最近変更されたイベント</h2>
            <span className="eyebrow">UPDATES</span>
          </div>
          {changed.length ? (
            <div className="updates">
              {changed.map((e) => (
                <Link href={`/events/${e.id}`} key={e.id}>
                  <span className="update-dot" />
                  <div>
                    <b>{e.title}</b>
                    <p>{formatDateTime(e.updatedAt)} 更新</p>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted small">
              最近の変更はありません。変更があるとここに表示されます。
            </p>
          )}
        </section>
      </>
    );
  }
  if (path[0] === "events") {
    const list = events.filter((e) =>
      filter === "終了済み"
        ? (e.endAt || e.startAt) < today
        : (e.endAt || e.startAt) >= today &&
          (filter === "今後" ||
            (filter === "自分が参加" && status(e.id) === "attending") ||
            (filter === "未定" && status(e.id) === "maybe") ||
            (filter === "未回答" && !status(e.id))),
    );
    return (
      <>
        <PageTitle
          eyebrow="EXPLORE EVENTS"
          title="イベント"
          description="気になる活動を見つけて、参加を伝えよう。"
        />
        <div className="tabs">
          {["今後", "自分が参加", "未定", "未回答", "終了済み"].map((f) => (
            <button
              key={f}
              className={f === filter ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <p className="list-count">{list.length} 件のイベント</p>
        <EventGrid events={list} />
      </>
    );
  }
  if (path[0] === "my-events") {
    const list = events.filter((e) =>
      tab === "過去参加イベント"
        ? status(e.id) === "attending" && (e.endAt || e.startAt) < today
        : (e.endAt || e.startAt) >= today &&
          status(e.id) === (tab === "参加予定" ? "attending" : "maybe"),
    );
    return (
      <>
        <PageTitle
          eyebrow="MY SCHEDULE"
          title="自分の予定"
          description="あなたが参加する、これからの活動。"
        />
        <div className="tabs">
          {["参加予定", "未定", "過去参加イベント"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <EventGrid events={list} />
      </>
    );
  }
  return (
    <div className="empty">
      <h1>ページが見つかりません</h1>
      <Link href="/home">ホームへ戻る</Link>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function EventDetail({ id }: { id: string }) {
  const { data, run, busy } = useApp();
  const event = data.events.find(
      (e) => e.id === id && e.publicationStatus === "published" && !e.deletedAt,
    ),
    response = data.responses.find(
      (r) => r.eventId === id && r.userId === data.user.id,
    );
  if (!event)
    return (
      <div className="empty">
        <h1>イベントが見つかりません</h1>
        <p>非公開・削除済みの可能性があります。</p>
        <Link href="/events">イベント一覧へ</Link>
      </div>
    );
  const fields = [
    ["開催日時", formatDateTime(event.startAt)],
    ["終了日時", formatDateTime(event.endAt)],
    ["開催場所", event.location],
    ["集合場所", event.meetingPlace || "未設定"],
    ["集合時刻", formatDateTime(event.meetingAt)],
    ["持ち物", event.belongings.join("、") || "なし"],
    [
      "担当者",
      event.managerUserId
        ? data.managerNames[event.managerUserId] || "未設定"
        : "未設定",
    ],
    ["備考", event.notes || "なし"],
  ];
  return (
    <>
      <Link className="back-link" href="/events">
        <ChevronLeft size={17} />
        イベント一覧
      </Link>
      <PageTitle
        eyebrow="EVENT DETAILS"
        title={event.title}
        description={event.summary}
      />
      <div className="detail-layout">
        <section className="panel">
          <h2>このイベントについて</h2>
          <p className="prewrap">
            {event.description || "詳細説明はありません。"}
          </p>
          <dl className="details">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="prewrap">{value}</dd>
              </div>
            ))}
            {event.relatedUrl && (
              <div>
                <dt>関連URL</dt>
                <dd>
                  <a
                    href={event.relatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    関連ページを開く <ArrowUpRight size={14} />
                  </a>
                </dd>
              </div>
            )}
          </dl>
          <p className="muted small">
            最終更新：{formatDateTime(event.updatedAt)} · v{event.version}
          </p>
        </section>
        <aside className="panel rsvp-panel">
          <span className="eyebrow">YOUR RESPONSE</span>
          <h2>参加しますか？</h2>
          <p className="muted small">回答はあとから変更できます。</p>
          <div className="rsvp-buttons">
            {(["attending", "maybe", "declined"] as ResponseStatus[]).map(
              (s) => (
                <button
                  aria-pressed={response?.status === s}
                  key={s}
                  className={`btn ${response?.status === s ? "primary" : "secondary"}`}
                  disabled={busy}
                  onClick={() =>
                    void run(
                      async () => (await repository()).respond(id, s),
                      `「${responseLabels[s]}」で回答しました。`,
                    )
                  }
                >
                  {response?.status === s && <Check size={18} />}
                  {responseLabels[s]}
                </button>
              ),
            )}
          </div>
          <p className="small muted">
            現在の回答：{response ? responseLabels[response.status] : "未回答"}
          </p>
        </aside>
      </div>
    </>
  );
}
function Profile() {
  const { data } = useApp();
  const router = useRouter();
  return (
    <>
      <PageTitle eyebrow="MY ACCOUNT" title="プロフィール" />
      <section className="panel profile-panel">
        <span className="avatar large-avatar">
          {data.user.name.slice(0, 1)}
        </span>
        <h2>{data.user.name}</h2>
        <p className="muted">{data.user.email}</p>
        <span className="badge attending">
          {data.user.role === "admin" ? "管理者" : "メンバー"}
        </span>
        <p className="small muted">
          登録情報の変更は管理者にお問い合わせください。
        </p>
        {data.user.role === "admin" && (
          <Link className="btn secondary" href="/admin">
            <ShieldCheck size={18} />
            管理者画面
          </Link>
        )}
        <button
          className="btn secondary"
          onClick={async () => {
            await (await repository()).logout();
            router.replace("/auth");
          }}
        >
          <LogOut size={18} />
          ログアウト
        </button>
      </section>
    </>
  );
}
