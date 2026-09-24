import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(async () => ({ id: "member" })),
  verifyIdentity: vi.fn(async () => ({
    uid: "new-user",
    email: "verified@frontier.example",
  })),
  registerSelf: vi.fn(async () => undefined),
  snapshot: vi.fn(async () => ({ events: [] })),
}));
vi.mock("@/lib/auth/server", () => ({
  authorize: mocks.authorize,
  verifyIdentity: mocks.verifyIdentity,
}));
vi.mock("@/lib/repositories/firestore/server", () => ({
  getSnapshot: mocks.snapshot,
  registerSelf: mocks.registerSelf,
}));
import { GET, POST } from "@/app/api/[...path]/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("API mode gate", () => {
  it.each([undefined, "wrong", ""])(
    "returns configuration error for mode %s before auth or database access",
    async (value) => {
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", value);
      const response = await GET(
        new Request("https://example.invalid/api/data"),
        { params: Promise.resolve({ path: ["data"] }) },
      );
      expect(response.status).toBe(503);
      expect((await response.json()).error).toContain("NEXT_PUBLIC_APP_MODE");
      expect(mocks.authorize).not.toHaveBeenCalled();
      expect(mocks.snapshot).not.toHaveBeenCalled();
    },
  );
  it("denies production API in explicit prototype", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "prototype");
    const response = await GET(
      new Request("https://example.invalid/api/data"),
      { params: Promise.resolve({ path: ["data"] }) },
    );
    expect(response.status).toBe(404);
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("continues normal authentication and data access in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
    const response = await GET(
      new Request("https://example.invalid/api/data"),
      { params: Promise.resolve({ path: ["data"] }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledOnce();
    expect(mocks.snapshot).toHaveBeenCalledOnce();
  });
  it("creates an active self-registration from verified identity", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
    const response = await POST(
      new Request("https://example.invalid/api/auth/register", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "新規メンバー" }),
      }),
      { params: Promise.resolve({ path: ["auth", "register"] }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "active" });
    expect(mocks.registerSelf).toHaveBeenCalledWith(
      "new-user",
      "verified@frontier.example",
      "新規メンバー",
    );
    expect(mocks.authorize).not.toHaveBeenCalled();
  });
  it("rejects role supplied by a registration client", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
    const response = await POST(
      new Request("https://example.invalid/api/auth/register", {
        method: "POST",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "攻撃者", role: "admin" }),
      }),
      { params: Promise.resolve({ path: ["auth", "register"] }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.registerSelf).not.toHaveBeenCalled();
  });
});
