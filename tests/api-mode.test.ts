import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(async () => ({ id: "member" })),
  snapshot: vi.fn(async () => ({ events: [] })),
}));
vi.mock("@/lib/auth/server", () => ({ authorize: mocks.authorize }));
vi.mock("@/lib/repositories/firestore/server", () => ({
  getSnapshot: mocks.snapshot,
}));
import { GET } from "@/app/api/[...path]/route";
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
});
