import { beforeEach, describe, expect, it } from "vitest";
import { MockRepository } from "@/lib/repositories/prototype";
import { conflictMessage } from "@/lib/errors";
import type { Event, EventInput } from "@/types/domain";
class StorageMock {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) || null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
const inputOf = (e: Event): EventInput => ({
  title: e.title,
  summary: e.summary,
  description: e.description,
  startAt: e.startAt,
  endAt: e.endAt,
  location: e.location,
  meetingPlace: e.meetingPlace,
  meetingAt: e.meetingAt,
  belongings: e.belongings,
  managerUserId: e.managerUserId,
  relatedUrl: e.relatedUrl,
  notes: e.notes,
  publicationStatus: e.publicationStatus,
});
describe("shared prototype workflow", () => {
  let repo: MockRepository;
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new StorageMock(),
      configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      value: new StorageMock(),
      configurable: true,
    });
    repo = new MockRepository();
  });
  it("rejects anonymous users", async () => {
    await expect(repo.snapshot()).rejects.toMatchObject({ status: 401 });
  });
  it("hides drafts and exposes only own responses", async () => {
    await repo.login("member@frontier.example", "");
    const data = await repo.snapshot();
    expect(data.events.some((e) => e.id === "draft")).toBe(false);
    expect(data.responses.every((r) => r.userId === "member")).toBe(true);
    await expect(repo.respond("draft", "attending")).rejects.toMatchObject({
      status: 404,
    });
  });
  it("upserts one answer and rejects member administration", async () => {
    await repo.login("member@frontier.example", "");
    await repo.respond("welcome", "attending");
    await repo.respond("welcome", "maybe");
    const data = await repo.snapshot();
    expect(data.responses.filter((r) => r.eventId === "welcome")).toHaveLength(
      1,
    );
    expect(data.responses.find((r) => r.eventId === "welcome")?.status).toBe(
      "maybe",
    );
    await expect(repo.save(inputOf(data.events[0]))).rejects.toMatchObject({
      status: 403,
    });
  });
  it("saves a single audit record, enforces version, then notifies once", async () => {
    await repo.login("admin@frontier.example", "");
    const before = (await repo.snapshot()).events.find(
      (e) => e.id === "welcome",
    )!;
    const input = { ...inputOf(before), meetingPlace: "福島駅東口" };
    const result = await repo.save(input, before.id, before.version);
    const saved = await repo.snapshot();
    expect(saved.changes).toHaveLength(1);
    expect(result.event.version).toBe(2);
    expect(saved.notifications).toHaveLength(0);
    await expect(repo.save(input, before.id, 1)).rejects.toThrow(
      conflictMessage,
    );
    const first = await repo.notify(before.id, result.changeLogId!);
    const second = await repo.notify(before.id, result.changeLogId!);
    expect(first.id).toBe(second.id);
    expect(first.recipients?.map((r) => r.userId)).toEqual(["member"]);
    expect((await repo.snapshot()).notifications).toHaveLength(1);
  });
  it("zero differences cause no save, soft delete preserves history", async () => {
    await repo.login("admin@frontier.example", "");
    const event = (await repo.snapshot()).events[0];
    expect(
      (await repo.save(inputOf(event), event.id, event.version)).changeLogId,
    ).toBeNull();
    await repo.remove(event.id, event.version);
    expect((await repo.snapshot()).events.some((e) => e.id === event.id)).toBe(
      false,
    );
    expect((await repo.snapshot()).changes).toHaveLength(1);
  });
  it("zero attendees produces a completed zero-recipient log", async () => {
    await repo.login("admin@frontier.example", "");
    const event = (await repo.snapshot()).events.find(
      (e) => e.id === "meeting",
    )!;
    const result = await repo.save(
      { ...inputOf(event), notes: "更新" },
      event.id,
      event.version,
    );
    expect(await repo.notify(event.id, result.changeLogId!)).toMatchObject({
      recipientCount: 0,
      status: "completed",
    });
  });
});
