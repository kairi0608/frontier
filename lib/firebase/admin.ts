import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
export function adminServices() {
  if (process.env.NEXT_PUBLIC_APP_MODE !== "production")
    throw new Error("本番サービスはproductionモードでのみ利用できます。");
  const projectId = process.env.FIREBASE_PROJECT_ID,
    clientEmail = process.env.FIREBASE_CLIENT_EMAIL,
    privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey)
    throw new Error("Firebaseのサーバー環境変数を設定してください。");
  const app =
    getApps()[0] ||
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return { auth: getAuth(app), db: getFirestore(app) };
}
