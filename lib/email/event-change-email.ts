import type { ChangeLog, Event } from "@/types/domain";
import { changeValues, fieldLabels } from "@/lib/events/diff";
import { formatDate } from "@/lib/events/format";
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function eventChangeEmail(
  event: Event,
  log: ChangeLog,
  appUrl: string,
  names: Record<string, string> = {},
) {
  const base = new URL(appUrl);
  if (!["https:", "http:"].includes(base.protocol))
    throw new Error("アプリURLを確認してください。");
  const url = new URL(`/events/${encodeURIComponent(event.id)}`, base).href;
  const changes = log.changes
    .map((c) => {
      const [before, after] = changeValues(c, names);
      return `${fieldLabels[c.field] || c.field}\n変更前：${before}\n変更後：${after}\n${before} → ${after}`;
    })
    .join("\n\n");
  const text = `${formatDate(event.startAt)}開催予定の\n「${event.title}」\nの内容が変更されました。\n\n変更内容\n\n${changes}\n\n最新情報は以下から確認してください。\n${url}\n\nこのメールは、このイベントに参加予定として登録している方へ送信されています。`;
  return {
    subject: `【フロンティア】${event.title}の内容が変更されました`,
    text,
    html: `<div style="font-family:sans-serif;line-height:1.8;max-width:600px;margin:auto"><h2>FRONTIER / イベント変更のお知らせ</h2><div style="white-space:pre-wrap">${escape(text)}</div><p><a href="${escape(url)}" style="background:#17654e;color:white;padding:14px 20px;border-radius:8px;display:inline-block">イベント詳細を見る</a></p></div>`,
  };
}
