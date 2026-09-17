import type { Repository } from "./contract";
import { getAppMode } from "@/lib/config/app-mode";
export async function repository(): Promise<Repository> {
  const mode = getAppMode();
  if (mode === "prototype")
    return import("./prototype").then((m) => new m.MockRepository());
  if (mode === "production")
    return import("./firestore/client").then(
      (m) => new m.FirestoreRepository(),
    );
  throw new Error("Unsupported application mode");
}
