import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { envVars } from "./env";

let initialized = false;

export const initFirebase = () => {
  if (initialized) return;
  if (admin.apps.length) {
    initialized = true;
    return;
  }

  const p = envVars.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!p) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_PATH");

  const resolved = path.resolve(process.cwd(), p);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Firebase service account not found: ${resolved}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));

  console.log(
    "✅ Firebase Admin initialized with project_id:",
    serviceAccount.project_id,
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
};

export const fcmMessaging = () => {
  initFirebase();
  return admin.messaging();
};
