"use client";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useApp } from "@/components/layout/workspace";
import { PageTitle } from "@/components/events/member-pages";
import { Modal } from "./admin-pages";
import { repository } from "@/lib/repositories";
import type { User, UserInput } from "@/types/domain";
export function UserManager() {
  const { data, run, busy } = useApp();
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [input, setInput] = useState<UserInput>({
    name: "",
    email: "",
    role: "member",
    isActive: true,
    password: "",
  });
  function open(user: User | "new") {
    setEditing(user);
    setInput(
      user === "new"
        ? { name: "", email: "", role: "member", isActive: true, password: "" }
        : {
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          },
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="MEMBER MANAGEMENT"
        title="ユーザー管理"
        description="フロンティアのメンバーと利用権限を管理します。"
        action={
          <button className="btn primary" onClick={() => open("new")}>
            <Plus size={18} />
            ユーザーを追加
          </button>
        }
      />
      <div className="panel">
        {data.users.map((u) => (
          <div className="user-row" key={u.id}>
            <div className="person-row">
              <span className="avatar">{u.name.slice(0, 1)}</span>
              <div>
                <b>{u.name}</b>
                <p className="small muted">{u.email}</p>
              </div>
            </div>
            <div className="row-actions">
              <span
                className={`badge ${u.isActive ? "attending" : "declined"}`}
              >
                {u.isActive ? "有効" : "無効"}
              </span>
              <span className="small">
                {u.role === "admin" ? "管理者" : "メンバー"}
              </span>
              <button className="btn secondary" onClick={() => open(u)}>
                <Pencil size={15} />
                編集
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing === "new" ? "ユーザーを追加" : "ユーザーを編集"}
          onClose={() => !busy && setEditing(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const body = { ...input };
              if (!body.password) delete body.password;
              if (
                await run(
                  async () =>
                    (await repository()).saveUser(
                      body,
                      editing === "new" ? undefined : editing.id,
                    ),
                  "ユーザー情報を保存しました。",
                )
              )
                setEditing(null);
            }}
          >
            <label>
              名前
              <input
                required
                maxLength={100}
                value={input.name}
                onChange={(e) => setInput({ ...input, name: e.target.value })}
              />
            </label>
            <label>
              メールアドレス
              <input
                required
                type="email"
                disabled={editing !== "new"}
                value={input.email}
                onChange={(e) => setInput({ ...input, email: e.target.value })}
              />
            </label>
            <label>
              {editing === "new"
                ? "初期パスワード（12文字以上）"
                : "新しいパスワード（変更時のみ・12文字以上）"}
              <input
                autoComplete="new-password"
                type="password"
                minLength={12}
                required={editing === "new"}
                value={input.password || ""}
                onChange={(e) =>
                  setInput({ ...input, password: e.target.value })
                }
              />
            </label>
            <label>
              権限
              <select
                value={input.role}
                onChange={(e) =>
                  setInput({ ...input, role: e.target.value as User["role"] })
                }
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={input.isActive}
                onChange={(e) =>
                  setInput({ ...input, isActive: e.target.checked })
                }
              />
              アカウントを有効にする
            </label>
            <p className="muted small">
              初期パスワードは本人へ安全な方法で伝えてください。アプリから招待メールは送信しません。
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                キャンセル
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "保存中…" : "保存"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
