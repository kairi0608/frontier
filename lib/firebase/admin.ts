import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseAdminConfig } from "@/lib/config/server";
export function adminServices() {
  const { projectId, clientEmail, privateKey } = firebaseAdminConfig();
  const app =
    getApps()[0] ||
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return { auth: getAuth(app), db: getFirestore(app) };
}
