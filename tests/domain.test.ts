import { describe, expect, it } from "vitest";
import { seed } from "@/lib/repositories/prototype";
import {
  changeValues,
  diffEvents,
  hasNotifiableChanges,
} from "@/lib/events/diff";
import { fromJstInput, toJstInput, formatTime } from "@/lib/events/format";
import { eventSchema } from "@/lib/events/validators";
import { selectRecipients } from "@/lib/notifications/targets";
import { eventChangeEmail } from "@/lib/email/event-change-email";
import type { ChangeLog } from "@/types/domain";
describe("event domain", () => {
  const before = { ...seed().events[0], meetingAt: "2026-10-01T03:30:00.000Z" };
  const after = {
    ...before,
    meetingAt: "2026-10-01T03:00:00.000Z",
    version: 9,
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
  const changes = diffEvents(before, after);
  it("metadata and unchanged fields are excluded", () => {
    const metadataOnly = { ...before, version: 2 };
    expect(diffEvents(before, metadataOnly)).toEqual([]);
    expect(changes.map((c) => c.field)).toEqual(["meetingAt"]);
  });
  it("12:30 to 12:00 is represented in Japan time", () => {
    expect(changeValues(changes[0])).toEqual(["12:30", "12:00"]);
  });
  it("meeting date changes retain the date", () => {
    expect(
      changeValues({
        field: "meetingAt",
        oldValue: before.meetingAt,
        newValue: "2026-10-02T03:00:00.000Z",
      })[1],
    ).toContain("2026/10/02");
  });
  it("dates are independent of the machine timezone", () => {
    expect(toJstInput(before.meetingAt)).toBe("2026-10-01T12:30");
    expect(fromJstInput("2026-10-01T12:30")).toBe(before.meetingAt);
    expect(formatTime(before.meetingAt)).toBe("12:30");
  });
  it("only active attendees qualify, without duplicate users", () => {
    const data = seed();
    expect(
      selectRecipients(
        "welcome",
        [...data.responses, data.responses[0]],
        data.users,
      ).map((u) => u.id),
    ).toEqual(["member"]);
  });
  it("publication-only changes do not cause email", () => {
    expect(
      hasNotifiableChanges(
        diffEvents(before, { ...before, publicationStatus: "draft" }),
      ),
    ).toBe(false);
  });
  it("email uses the stored changes, correct link and escaped HTML", () => {
    const log: ChangeLog = {
      id: "log",
      eventId: before.id,
      changedBy: "admin",
      changedAt: before.updatedAt,
      fromVersion: 1,
      toVersion: 2,
      changes,
      notificationStatus: "not_sent",
    };
    const mail = eventChangeEmail(
      { ...after, title: "<script>test</script>" },
      log,
      "https://frontier.example",
    );
    expect(mail.text).toContain("12:30 → 12:00");
    expect(mail.text).toContain("変更前：12:30");
    expect(mail.text).toContain("https://frontier.example/events/welcome");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
  it("invalid end dates and executable URLs are rejected", () => {
    const input = Object.fromEntries(
      Object.entries(before).filter(([k]) =>
        [
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
          "publicationStatus",
        ].includes(k),
      ),
    );
    expect(
      eventSchema.safeParse({ ...input, endAt: "2000-01-01T00:00:00Z" })
        .success,
    ).toBe(false);
    expect(
      eventSchema.safeParse({ ...input, relatedUrl: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
});
