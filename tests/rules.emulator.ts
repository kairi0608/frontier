import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-frontier",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    for (const [id, role, isActive] of [
      ["member", "member", true],
      ["other", "member", true],
      ["inactive", "member", false],
      ["admin", "admin", true],
    ])
      await setDoc(doc(db, `users/${id}`), { role, isActive });
    for (const [id, publicationStatus, deletedAt] of [
      ["public", "published", null],
      ["draft", "draft", null],
      ["deleted", "published", Timestamp.now()],
    ])
      await setDoc(doc(db, `events/${id}`), { publicationStatus, deletedAt });
    await setDoc(doc(db, "eventResponses/public_other"), {
      eventId: "public",
      userId: "other",
      status: "attending",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
});
afterAll(async () => {
  await env.cleanup();
});
describe("Firestore rules", () => {
  it("denies unauthenticated and inactive reads", async () => {
    await assertFails(
      getDoc(doc(env.unauthenticatedContext().firestore(), "events/public")),
    );
    await assertFails(
      getDoc(
        doc(env.authenticatedContext("inactive").firestore(), "events/public"),
      ),
    );
  });
  it("allows published query, rejects private and deleted events", async () => {
    const db = env.authenticatedContext("member").firestore();
    await assertSucceeds(getDoc(doc(db, "events/public")));
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "events"),
          where("publicationStatus", "==", "published"),
          where("deletedAt", "==", null),
        ),
      ),
    );
    await assertFails(getDoc(doc(db, "events/draft")));
    await assertFails(getDoc(doc(db, "events/deleted")));
    await assertFails(getDocs(collection(db, "events")));
  });
  it("prevents role escalation and reading another profile", async () => {
    const db = env.authenticatedContext("member").firestore();
    await assertSucceeds(getDoc(doc(db, "users/member")));
    await assertFails(getDoc(doc(db, "users/other")));
    await assertFails(updateDoc(doc(db, "users/member"), { role: "admin" }));
  });
  it("allows only canonical own response with immutable owner and timestamps", async () => {
    const db = env.authenticatedContext("member").firestore();
    const payload = {
      eventId: "public",
      userId: "member",
      status: "attending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(db, "eventResponses/public_member"), payload),
    );
    await assertSucceeds(
      updateDoc(doc(db, "eventResponses/public_member"), {
        status: "maybe",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(setDoc(doc(db, "eventResponses/random"), payload));
    await assertFails(
      updateDoc(doc(db, "eventResponses/public_other"), {
        status: "declined",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "eventResponses/public_member"), {
        userId: "other",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "eventResponses/public_member"), {
        status: "invented",
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("rejects response to draft and unauthorized admin record writes", async () => {
    const db = env.authenticatedContext("member").firestore();
    await assertFails(
      setDoc(doc(db, "eventResponses/draft_member"), {
        eventId: "draft",
        userId: "member",
        status: "attending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    for (const path of [
      "events/public",
      "eventChangeLogs/log",
      "notificationLogs/log",
      "notificationLogs/log/recipients/member",
    ])
      await assertFails(setDoc(doc(db, path), { changed: true }));
  });
  it("allows admin inspection but requires server-side writes", async () => {
    const db = env.authenticatedContext("admin").firestore();
    await assertSucceeds(getDoc(doc(db, "events/draft")));
    await assertSucceeds(getDoc(doc(db, "users/other")));
    await assertSucceeds(getDoc(doc(db, "eventResponses/public_other")));
    await assertFails(updateDoc(doc(db, "events/public"), { version: 999 }));
  });
});
