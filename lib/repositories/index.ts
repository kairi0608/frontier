import type { Repository } from "./contract";
let instance: Promise<Repository> | undefined;
export function repository(): Promise<Repository> {
  return (instance ||=
    process.env.NEXT_PUBLIC_APP_MODE === "production"
      ? import("./firestore/client").then((m) => new m.FirestoreRepository())
      : import("./prototype").then((m) => new m.MockRepository()));
}
