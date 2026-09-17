import type { Change, EventInput } from "@/types/domain";
import { formatDate, formatDateTime, formatTime } from "./format";
export const fieldLabels: Record<string, string> = {
  title: "イベント名",
  summary: "概要",
  description: "詳細説明",
  startAt: "開催日時",
  endAt: "終了日時",
  location: "開催場所",
  meetingPlace: "集合場所",
  meetingAt: "集合時刻",
  belongings: "持ち物",
  managerUserId: "担当者",
  relatedUrl: "関連URL",
  notes: "備考",
  publicationStatus: "公開状態",
  deletedAt: "削除日時",
};
export const notificationFields = [
  "title",
  "summary",
  "description",
  "startAt",
  "endAt",
  "location",
  "meetingPlace",
  "meetingAt",
  "belongings",
  "managerUserId",
  "relatedUrl",
  "notes",
] as const;
export function diffEvents(before: EventInput, after: EventInput): Change[] {
  return [...notificationFields, "publicationStatus" as const]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((field) => ({
      field,
      oldValue: before[field],
      newValue: after[field],
    }));
}
export function displayChange(
  field: string,
  value: unknown,
  names: Record<string, string> = {},
): string {
  if (value === null || value === "" || value === undefined) return "未設定";
  if (Array.isArray(value)) return value.join("、") || "なし";
  if (["startAt", "endAt", "meetingAt", "deletedAt"].includes(field))
    return formatDateTime(String(value));
  if (field === "publicationStatus")
    return value === "published" ? "公開" : "下書き";
  if (field === "managerUserId") return names[String(value)] || String(value);
  return String(value);
}
export function hasNotifiableChanges(changes: Change[]) {
  return changes.some((c) =>
    (notificationFields as readonly string[]).includes(c.field),
  );
}
export function changeValues(
  change: Change,
  names: Record<string, string> = {},
) {
  if (
    change.field === "meetingAt" &&
    typeof change.oldValue === "string" &&
    typeof change.newValue === "string" &&
    formatDate(change.oldValue) === formatDate(change.newValue)
  )
    return [formatTime(change.oldValue), formatTime(change.newValue)];
  return [
    displayChange(change.field, change.oldValue, names),
    displayChange(change.field, change.newValue, names),
  ];
}
