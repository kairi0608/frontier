"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Compass,
  Home,
  UserRound,
  Bookmark,
  ShieldCheck,
  LogOut,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { repository } from "@/lib/repositories";
import { AppError, errorMessage } from "@/lib/errors";
import type { Snapshot } from "@/types/domain";
import { MemberPages } from "@/components/events/member-pages";
import { AdminPages } from "@/components/admin/admin-pages";
import { isPrototype } from "@/lib/config/app-mode";
type Context = {
  data: Snapshot;
  refresh: () => Promise<void>;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
  busy: boolean;
  message: string;
  error: string;
  setMessage: (value: string) => void;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("App context missing");
  return context;
}
const nav = [
  { url: "/home", label: "ホーム", icon: Home },
  { url: "/events", label: "イベント", icon: CalendarDays },
  { url: "/my-events", label: "自分の予定", icon: Bookmark },
  { url: "/profile", label: "プロフィール", icon: UserRound },
];
export function Workspace({ path }: { path: string[] }) {
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const isAdmin = path[0] === "admin";
  const refresh = useCallback(async () => {
    try {
      setData(await (await repository()).snapshot());
      setError("");
    } catch (e) {
      if (e instanceof AppError && e.status === 401) {
        setData(null);
        router.replace("/auth");
        return;
      }
      if (e instanceof AppError && e.status === 403) setData(null);
      setError(errorMessage(e));
      throw e;
    }
  }, [router]);
  useEffect(() => {
    let active = true;
    repository()
      .then((repo) => repo.snapshot())
      .then((snapshot) => {
        if (active) setData(snapshot);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof AppError && e.status === 401) router.replace("/auth");
        else setError(errorMessage(e));
      });
    const onFocus = () => {
      void refresh().catch(() => {});
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, router]);
  async function run(fn: () => Promise<unknown>, success = "保存しました。") {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
      setMessage(success);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof AppError && e.status === 401) router.replace("/auth");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <main className="loading">
        <Compass size={38} />
        <h2>{error || "予定を読み込んでいます…"}</h2>
        {error && (
          <>
            <button
              className="btn secondary"
              onClick={() => void refresh().catch(() => {})}
            >
              再試行
            </button>
            <Link href="/auth">ログインへ</Link>
          </>
        )}
      </main>
    );
  return (
    <AppContext.Provider
      value={{ data, refresh, run, busy, message, error, setMessage }}
    >
      <div className={`workspace ${isAdmin ? "admin-mode" : ""}`}>
        <aside className="sidebar">
          <Link className="brand" href="/home">
            <Compass size={29} /> FRONTIER
          </Link>
          <div className="side-caption">MEMBER&apos;S PLACE</div>
          <nav>
            {nav.map((n) => (
              <Link
                className={path[0] === n.url.slice(1) ? "active" : ""}
                key={n.url}
                href={n.url}
              >
                <n.icon size={20} />
                {n.label}
              </Link>
            ))}
          </nav>
          {data.user.role === "admin" && (
            <div className="admin-nav">
              <p className="side-caption">MANAGEMENT</p>
              <Link className={isAdmin ? "active" : ""} href="/admin">
                <ShieldCheck size={20} />
                管理者画面
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
          <div className="side-footer">
            <div className="avatar">{data.user.name.slice(0, 1)}</div>
            <div>
              <b>{data.user.name}</b>
              <small>
                {data.user.role === "admin" ? "管理者" : "メンバー"}
              </small>
            </div>
            <button
              aria-label="ログアウト"
              className="icon-button"
              onClick={async () => {
                await (await repository()).logout();
                router.replace("/auth");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <span>
              {isAdmin
                ? "管理者ワークスペース"
                : "フロンティアの活動を、もっと身近に。"}
            </span>
            <div>
              {isPrototype() && (
                <span className="badge prototype">試用モード</span>
              )}
              <button
                aria-label="最新情報を再取得"
                className="icon-button"
                onClick={() => void refresh().catch(() => {})}
              >
                <RefreshCw size={17} />
              </button>
              <span className="avatar small-avatar">
                {data.user.name.slice(0, 1)}
              </span>
            </div>
          </header>
          <main className="main-content">
            {error && (
              <div role="alert" className="error">
                {error}
                <button onClick={() => void refresh().catch(() => {})}>
                  最新情報を再取得
                </button>
              </div>
            )}
            {message && (
              <div role="status" className="success">
                {message}
                <button aria-label="閉じる" onClick={() => setMessage("")}>
                  ×
                </button>
              </div>
            )}
            {isAdmin ? (
              data.user.role === "admin" ? (
                <AdminPages path={path} />
              ) : (
                <div className="empty">
                  <ShieldCheck />
                  <h1>管理者権限が必要です</h1>
                  <p>このページにはアクセスできません。</p>
                  <Link href="/home">ホームへ戻る</Link>
                </div>
              )
            ) : (
              <MemberPages path={path} />
            )}
          </main>
          <footer className="page-footer">
            FRONTIER <span>いっしょに、次の一歩へ。</span>
          </footer>
        </div>
        <nav className="bottom-nav">
          {nav.map((n) => (
            <Link
              className={path[0] === n.url.slice(1) ? "active" : ""}
              key={n.url}
              href={n.url}
            >
              <n.icon size={21} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
}
