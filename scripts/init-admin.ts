import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("INITIAL_ADMIN_EMAILを設定してください。");
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  // The owner first creates the account in Firebase Console. No public bootstrap API.
  const user = await getAuth().getUserByEmail(email);
  if (user.disabled) throw new Error("Authenticationのアカウントが無効です。");
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`users/${user.uid}`),
      existing = await tx.get(ref);
    tx.set(ref, {
      name: user.displayName || "管理者",
      email: user.email,
      role: "admin",
      isActive: true,
      createdAt: existing.data()?.createdAt || Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
  console.log("初期管理者を設定しました。");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
