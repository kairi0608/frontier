import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppMode, isPrototype, isProduction } from "@/lib/config/app-mode";
import { firebasePublicConfig } from "@/lib/config/firebase-public";
import { firebaseAdminConfig, resendConfig } from "@/lib/config/server";
import { repository } from "@/lib/repositories";
import { MockRepository } from "@/lib/repositories/prototype";
import { FirestoreRepository } from "@/lib/repositories/firestore/client";
import { clientAuth } from "@/lib/firebase/client";
const publicEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "frontier-test.example",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-frontier",
  NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
};
const serverEnv = {
  FIREBASE_PROJECT_ID: "demo-frontier",
  FIREBASE_CLIENT_EMAIL: "service@example.invalid",
  FIREBASE_PRIVATE_KEY: "test\\nkey",
  RESEND_API_KEY: "test-secret",
  RESEND_FROM_EMAIL: "test@example.invalid",
  NEXT_PUBLIC_APP_URL: "https://example.invalid",
};
function production() {
  vi.stubEnv("NEXT_PUBLIC_APP_MODE", "production");
  for (const [key, value] of Object.entries(publicEnv)) vi.stubEnv(key, value);
}
afterEach(() => vi.unstubAllEnvs());
describe("explicit application configuration", () => {
  it("selects MockRepository only for explicit prototype", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "prototype");
    expect(isPrototype()).toBe(true);
    expect(isProduction()).toBe(false);
    expect(await repository()).toBeInstanceOf(MockRepository);
    expect(() => new FirestoreRepository()).toThrow("production");
  });
  it("selects FirestoreRepository only for production, even after using prototype", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "prototype");
    await repository();
    production();
    expect(await repository()).toBeInstanceOf(FirestoreRepository);
    expect(isPrototype()).toBe(false);
    expect(() => new MockRepository()).toThrow("prototype");
  });
  it.each([undefined, "", "Production", "prod", "production ", " prototype"])(
    "rejects missing or invalid mode %s without fallback",
    async (mode) => {
      vi.stubEnv("NEXT_PUBLIC_APP_MODE", mode);
      expect(() => getAppMode()).toThrow(
        'NEXT_PUBLIC_APP_MODE must be "prototype" or "production"',
      );
      await expect(repository()).rejects.toThrow("NEXT_PUBLIC_APP_MODE");
    },
  );
  it.each(Object.keys(publicEnv))(
    "fails before Firebase initialization when %s is missing",
    async (key) => {
      production();
      vi.stubEnv(key, "  ");
      expect(() => firebasePublicConfig()).toThrow(key);
      expect(() => clientAuth()).toThrow(key);
      await expect(repository()).rejects.toThrow(key);
    },
  );
  it.each([
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ])(
    "reports missing server configuration %s without exposing secrets",
    (key) => {
      production();
      for (const [k, v] of Object.entries(serverEnv)) vi.stubEnv(k, v);
      vi.stubEnv(key, "");
      expect(() => firebaseAdminConfig()).toThrow(key);
    },
  );
  it.each(["RESEND_API_KEY", "RESEND_FROM_EMAIL", "NEXT_PUBLIC_APP_URL"])(
    "reports missing mail configuration %s",
    (key) => {
      production();
      for (const [k, v] of Object.entries(serverEnv)) vi.stubEnv(k, v);
      vi.stubEnv(key, undefined);
      expect(() => resendConfig()).toThrow(key);
    },
  );
  it("converts private key newlines and validates email links", () => {
    production();
    for (const [k, v] of Object.entries(serverEnv)) vi.stubEnv(k, v);
    expect(firebaseAdminConfig().privateKey).toBe("test\nkey");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "javascript:alert(1)");
    expect(() => resendConfig()).toThrow("NEXT_PUBLIC_APP_URL");
  });
  it("refuses production SDK configuration in prototype", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_MODE", "prototype");
    expect(() => firebasePublicConfig()).toThrow("production");
    expect(() => firebaseAdminConfig()).toThrow("production");
    expect(() => resendConfig()).toThrow("production");
  });
});
