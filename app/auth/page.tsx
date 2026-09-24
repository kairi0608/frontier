"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowRight, Compass, LockKeyhole } from "lucide-react";
import { repository } from "@/lib/repositories";
import { errorMessage } from "@/lib/errors";
import { isPrototype } from "@/lib/config/app-mode";
export default function Auth() {
  const router = useRouter();
  const [registering, setRegistering] = useState(false),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const prototype = isPrototype();
  async function login(address = email) {
    setBusy(true);
    setError("");
    try {
      const repo = await repository();
      await repo.login(address, password);
      await repo.snapshot();
      router.replace("/home");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function register() {
    setBusy(true);
    setError("");
    try {
      const repo = await repository();
      await repo.register(name, email, password);
      await repo.snapshot();
      router.replace("/home");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <Compass size={32} /> FRONTIER<span>MEMBERS</span>
        </div>
        <div>
          <p className="eyebrow">A LITTLE STEP, TOGETHER.</p>
          <h1>
            次の一歩を、
            <br />
            いっしょに。
          </h1>
          <p>
            予定を見つける。参加を伝える。
            <br />
            フロンティアの活動は、ここから。
          </p>
        </div>
        <div className="story-bottom">
          フロンティア専用イベント管理 <ArrowUpRight />
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-box">
          <span className="icon-box">
            <LockKeyhole />
          </span>
          <p className="eyebrow">
            {registering && !prototype ? "CREATE ACCOUNT" : "WELCOME BACK"}
          </p>
          <h2>
            {registering && !prototype
              ? "アカウントを作成"
              : "おかえりなさい。"}
          </h2>
          <p className="muted">
            {registering && !prototype
              ? "登録後すぐにイベントへ参加できます。"
              : "メンバーアカウントでログインしてください。"}
          </p>
          {prototype ? (
            <div className="prototype-login">
              <p className="notice">
                試用モード · メールは実際には送信されません
              </p>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => login("member@frontier.example")}
              >
                メンバーとして試す <ArrowRight size={18} />
              </button>
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => login("admin@frontier.example")}
              >
                管理者として試す <ArrowRight size={18} />
              </button>
              <p className="muted small">
                操作内容はこのブラウザー内に保存されます。
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void (registering ? register() : login());
              }}
            >
              {registering && (
                <label>
                  名前
                  <input
                    autoComplete="name"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                メールアドレス
                <input
                  autoComplete="username"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                パスワード
                <input
                  autoComplete={registering ? "new-password" : "current-password"}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={registering ? 6 : undefined}
                />
              </label>
              <button className="btn primary full" disabled={busy}>
                {busy
                  ? registering
                    ? "作成中…"
                    : "ログイン中…"
                  : registering
                    ? "アカウントを作成"
                    : "ログイン"}
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                className="btn secondary full"
                disabled={busy}
                onClick={() => {
                  setRegistering(!registering);
                  setError("");
                }}
              >
                {registering ? "ログイン画面へ戻る" : "新しいアカウントを作成"}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {!prototype && !registering && (
            <p className="auth-help">
              パスワードを忘れた場合は
              <br />
              フロンティアの管理者にお問い合わせください。
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
