import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebasePublicConfig } from "@/lib/config/firebase-public";
export function clientAuth() {
  const config = firebasePublicConfig();
  return getAuth(getApps()[0] || initializeApp(config));
}
