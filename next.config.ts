import type { NextConfig } from "next";
import { getAppMode } from "./lib/config/app-mode";
import { firebasePublicConfig } from "./lib/config/firebase-public";
// Fail the build/start rather than publishing a silently enabled demonstration.
if (getAppMode() === "production") firebasePublicConfig();
const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
