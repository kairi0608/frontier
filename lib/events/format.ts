const date = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const time = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export const formatDate = (v: string | null) =>
  v ? date.format(new Date(v)) : "未設定";
export const formatTime = (v: string | null) =>
  v ? time.format(new Date(v)) : "未設定";
export const formatDateTime = (v: string | null) =>
  v ? `${formatDate(v)} ${formatTime(v)}` : "未設定";
export function toJstInput(v: string | null) {
  if (!v) return "";
  return new Date(new Date(v).getTime() + 9 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function fromJstInput(v: string) {
  return v ? new Date(`${v}:00+09:00`).toISOString() : null;
}
export const responseLabels = {
  attending: "参加",
  maybe: "未定",
  declined: "不参加",
};
