"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ArrowRight, Compass, LockKeyhole } from "lucide-react";
import { repository } from "@/lib/repositories";
import { errorMessage } from "@/lib/errors";
export default function Auth() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const prototype = process.env.NEXT_PUBLIC_APP_MODE !== "production";
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
          <p className="eyebrow">WELCOME BACK</p>
          <h2>おかえりなさい。</h2>
          <p className="muted">メンバーアカウントでログインしてください。</p>
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
                void login();
              }}
            >
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
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button className="btn primary full" disabled={busy}>
                {busy ? "ログイン中…" : "ログイン"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <p className="auth-help">
            アカウント・パスワードについては
            <br />
            フロンティアの管理者にお問い合わせください。
          </p>
        </div>
      </section>
    </main>
  );
}
