// Test runner only. Never use these deliberately fictitious Firebase values to deploy.
import { spawnSync } from "node:child_process";
const mode = process.argv[2];
if (mode !== "prototype" && mode !== "production")
  throw new Error("Specify prototype or production explicitly.");
const env = { ...process.env, NEXT_PUBLIC_APP_MODE: mode };
if (mode === "production")
  Object.assign(env, {
    NEXT_PUBLIC_FIREBASE_API_KEY: "test-only-not-a-real-api-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-frontier.invalid",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-frontier",
    NEXT_PUBLIC_FIREBASE_APP_ID: "test-only-app-id",
  });
const npmCli = process.env.npm_execpath;
if (!npmCli)
  throw new Error(
    "Run this test through npm run test:e2e or npm run test:e2e:production.",
  );
for (const args of [
  [npmCli, "run", "build"],
  ["node_modules/@playwright/test/cli.js", "test"],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
