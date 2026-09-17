import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { seed } from "@/lib/repositories/prototype";
import type { User, EventInput } from "@/types/domain";
const mocks = vi.hoisted(() => ({
  services: {} as {
    db: ReturnType<typeof getFirestore>;
    auth: {
      verifyIdToken: ReturnType<typeof vi.fn>;
      updateUser: ReturnType<typeof vi.fn>;
      revokeRefreshTokens: ReturnType<typeof vi.fn>;
      createUser: ReturnType<typeof vi.fn>;
      deleteUser: ReturnType<typeof vi.fn>;
    };
  },
  send: vi.fn(),
}));
vi.mock("@/lib/firebase/admin", () => ({
  adminServices: () => mocks.services,
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
import { GET, POST, PUT, DELETE } from "@/app/api/[...path]/route";
import { encodeEvent } from "@/lib/repositories/firestore/server";
let admin: User;
const call = async (
  path: string,
  method: string,
  token?: string,
  body?: unknown,
) => {
  const handler = { GET, POST, PUT, DELETE }[method as "GET"];
  return handler(
    new Request(`http://localhost/api/${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve({ path: path.split("/") }) },
  );
};
const input = (): EventInput => ({
  title: "通知検証",
  summary: "概要",
  description: "本文",
  startAt: "2027-10-01T04:00:00.000Z",
  endAt: null,
  location: "福島",
  meetingPlace: "福島駅西口",
  meetingAt: "2027-10-01T03:30:00.000Z",
  belongings: [],
  managerUserId: "admin",
  relatedUrl: null,
  notes: "",
  publicationStatus: "published",
});
beforeAll(() => {
  const app =
    getApps()[0] || initializeApp({ projectId: "demo-frontier-server" });
  mocks.services.db = getFirestore(app);
  mocks.services.auth = {
    verifyIdToken: vi.fn(async (token: string) => {
      if (["admin", "member", "member2", "inactive"].includes(token))
        return { uid: token };
      throw new Error("invalid");
    }),
    updateUser: vi.fn(async () => ({})),
    revokeRefreshTokens: vi.fn(async () => undefined),
    createUser: vi.fn(async () => ({ uid: "created-member" })),
    deleteUser: vi.fn(async () => undefined),
  };
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://frontier.example");
  vi.stubEnv("RESEND_API_KEY", "test_fake_key");
  vi.stubEnv("RESEND_FROM_EMAIL", "test@frontier.example");
});
beforeEach(async () => {
  const db = mocks.services.db;
  for (const name of [
    "events",
    "users",
    "eventResponses",
    "eventChangeLogs",
    "notificationLogs",
  ])
    await db.recursiveDelete(db.collection(name));
  const data = seed();
  admin = data.users[0];
  const now = Timestamp.now();
  for (const u of data.users)
    await db.doc(`users/${u.id}`).set({ ...u, createdAt: now, updatedAt: now });
  await db.doc("events/welcome").set({
    ...encodeEvent(input()),
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: "admin",
    updatedBy: "admin",
    deletedAt: null,
    deletedBy: null,
  });
  for (const r of data.responses.filter((r) => r.eventId === "welcome"))
    await db
      .doc(`eventResponses/${r.eventId}_${r.userId}`)
      .set({ ...r, createdAt: now, updatedAt: now });
  mocks.send.mockReset();
  mocks.send.mockImplementation(async () => ({
    data: { id: "email-test" },
    error: null,
  }));
});
describe("production API with real Firestore transactions", () => {
  it("creates and disables a member through the administrator API", async () => {
    const member = {
      name: "追加ユーザー",
      email: "new@frontier.example",
      role: "member",
      isActive: true,
      password: "test-password-123",
    };
    expect((await call("admin/users", "POST", "admin", member)).status).toBe(
      200,
    );
    const saved = (
      await mocks.services.db.doc("users/created-member").get()
    ).data()!;
    expect(saved.role).toBe("member");
    expect(saved.password).toBeUndefined();
    const { password, ...edit } = member;
    void password;
    expect(
      (
        await call("admin/users/created-member", "PUT", "admin", {
          ...edit,
          isActive: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (await mocks.services.db.doc("users/created-member").get()).data()
        ?.isActive,
    ).toBe(false);
    expect(mocks.services.auth.revokeRefreshTokens).toHaveBeenCalledWith(
      "created-member",
    );
  });
  it("rejects self-demotion and concurrent reciprocal administrator demotion", async () => {
    const adminInput = {
      name: "管理者",
      email: "admin@frontier.example",
      role: "member",
      isActive: true,
    };
    expect(
      (await call("admin/users/admin", "PUT", "admin", adminInput)).status,
    ).toBe(400);
    await mocks.services.db.doc("users/member2").update({ role: "admin" });
    const results = await Promise.all([
      call("admin/users/member2", "PUT", "admin", {
        ...adminInput,
        email: "ren@frontier.example",
      }),
      call("admin/users/admin", "PUT", "member2", adminInput),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
    expect(
      (
        await mocks.services.db
          .collection("users")
          .where("role", "==", "admin")
          .get()
      ).size,
    ).toBe(1);
  });
  it("401 anonymous, 403 member on admin API, and 403 inactive", async () => {
    expect((await call("data", "GET")).status).toBe(401);
    expect(
      (await call("admin/events", "POST", "member", { input: input() })).status,
    ).toBe(403);
    expect((await call("data", "GET", "inactive")).status).toBe(403);
    expect((await call("data", "GET", "bad-token")).status).toBe(401);
  });
  it("lists published only and atomically upserts own response", async () => {
    await mocks.services.db.doc("events/draft").set({
      ...encodeEvent({ ...input(), publicationStatus: "draft" }),
      deletedAt: null,
    });
    const response = await call("data", "GET", "member");
    expect(response.status).toBe(200);
    expect(
      (await response.json()).events.map((e: { id: string }) => e.id),
    ).toEqual(["welcome"]);
    expect(
      (
        await call("events/welcome/response", "PUT", "member", {
          status: "attending",
          userId: "member2",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("events/draft/response", "PUT", "member", {
          status: "attending",
        })
      ).status,
    ).toBe(404);
    await call("events/welcome/response", "PUT", "member", {
      status: "attending",
    });
    await call("events/welcome/response", "PUT", "member", { status: "maybe" });
    const docs = await mocks.services.db
      .collection("eventResponses")
      .where("userId", "==", "member")
      .get();
    expect(docs.size).toBe(1);
    expect(docs.docs[0].data().status).toBe("maybe");
  });
  it("creates event then single-log save, version conflict, and no automatic mail", async () => {
    expect(
      (await call("admin/events", "POST", "admin", { input: input() })).status,
    ).toBe(200);
    const saved = await call("admin/events/welcome", "PUT", "admin", {
      input: { ...input(), meetingAt: "2027-10-01T03:00:00.000Z" },
      version: 1,
    });
    expect(saved.status).toBe(200);
    const result = await saved.json();
    expect(result.event.version).toBe(2);
    expect(result.event.meetingAt).toBe("2027-10-01T03:00:00.000Z");
    const log = await mocks.services.db
      .doc(`eventChangeLogs/${result.changeLogId}`)
      .get();
    expect(log.data()?.changes).toHaveLength(1);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(
      (
        await call("admin/events/welcome", "PUT", "admin", {
          input: input(),
          version: 1,
        })
      ).status,
    ).toBe(409);
  });
  it("two concurrent editors cannot overwrite each other", async () => {
    const results = await Promise.all([
      call("admin/events/welcome", "PUT", "admin", {
        input: { ...input(), title: "A" },
        version: 1,
      }),
      call("admin/events/welcome", "PUT", "admin", {
        input: { ...input(), title: "B" },
        version: 1,
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await mocks.services.db.collection("eventChangeLogs").get()).size,
    ).toBe(1);
  });
  it("attending only, shared email diff, recipient persistence and idempotent replay", async () => {
    const saved = await (
      await call("admin/events/welcome", "PUT", "admin", {
        input: { ...input(), meetingAt: "2027-10-01T03:00:00.000Z" },
        version: 1,
      })
    ).json();
    const payload = {
      changeLogId: saved.changeLogId,
      notificationRequestId: saved.changeLogId,
    };
    const result = await call(
      "admin/events/welcome/notify",
      "POST",
      "admin",
      payload,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      recipientCount: 1,
      status: "completed",
      sentBy: admin.id,
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      to: ["member@frontier.example"],
    });
    expect(mocks.send.mock.calls[0][0].text).toContain("12:30 → 12:00");
    expect(mocks.send.mock.calls[0][0].text).toContain(
      "https://frontier.example/events/welcome",
    );
    expect(mocks.send.mock.calls[0][1].idempotencyKey).toContain(
      saved.changeLogId,
    );
    const recipient = await mocks.services.db
      .doc(`notificationLogs/${saved.changeLogId}/recipients/member`)
      .get();
    expect(recipient.data()?.status).toBe("sent");
    await call("admin/events/welcome/notify", "POST", "admin", payload);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(
      (await call("admin/events/welcome/notify", "POST", "member", payload))
        .status,
    ).toBe(403);
  });
  it("persists a partial failure and retries only failed recipients", async () => {
    await mocks.services.db
      .doc("eventResponses/welcome_member2")
      .update({ status: "attending" });
    mocks.send.mockImplementation(async (mail: { to: string[] }) =>
      mail.to[0] === "ren@frontier.example"
        ? { error: { message: "test delivery failure" }, data: null }
        : { data: { id: "success" }, error: null },
    );
    const saved = await (
      await call("admin/events/welcome", "PUT", "admin", {
        input: { ...input(), notes: "変更" },
        version: 1,
      })
    ).json();
    const payload = {
      changeLogId: saved.changeLogId,
      notificationRequestId: saved.changeLogId,
    };
    expect(
      await (
        await call("admin/events/welcome/notify", "POST", "admin", payload)
      ).json(),
    ).toMatchObject({ recipientCount: 2, status: "partial_failed" });
    expect(
      (
        await mocks.services.db
          .doc(`notificationLogs/${saved.changeLogId}/recipients/member2`)
          .get()
      ).data()?.status,
    ).toBe("failed");
    mocks.send.mockResolvedValue({ data: { id: "retry" }, error: null });
    expect(
      await (
        await call("admin/events/welcome/notify", "POST", "admin", payload)
      ).json(),
    ).toMatchObject({ status: "completed" });
    expect(mocks.send).toHaveBeenCalledTimes(3);
  });
  it("zero differences are not saved and zero attendees are logged", async () => {
    expect(
      await (
        await call("admin/events/welcome", "PUT", "admin", {
          input: input(),
          version: 1,
        })
      ).json(),
    ).toMatchObject({ changeLogId: null });
    await mocks.services.db
      .doc("eventResponses/welcome_member")
      .update({ status: "maybe" });
    const saved = await (
      await call("admin/events/welcome", "PUT", "admin", {
        input: { ...input(), notes: "更新" },
        version: 1,
      })
    ).json();
    expect(
      await (
        await call("admin/events/welcome/notify", "POST", "admin", {
          changeLogId: saved.changeLogId,
          notificationRequestId: saved.changeLogId,
        })
      ).json(),
    ).toMatchObject({ recipientCount: 0, status: "completed" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("soft deletion hides event and preserves audit log", async () => {
    expect(
      (await call("admin/events/welcome", "DELETE", "admin", { version: 1 }))
        .status,
    ).toBe(200);
    expect((await mocks.services.db.doc("events/welcome").get()).exists).toBe(
      true,
    );
    expect((await (await call("data", "GET", "member")).json()).events).toEqual(
      [],
    );
    expect(
      (await mocks.services.db.collection("eventChangeLogs").get()).size,
    ).toBe(1);
  });
});
