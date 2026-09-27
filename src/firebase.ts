import { initializeApp } from "firebase/app";
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  connectAuthEmulator,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";
const env = import.meta.env;
export const emulator =
  env.VITE_USE_EMULATORS === "true" &&
  ["localhost", "127.0.0.1"].includes(location.hostname);
export const configured =
  emulator ||
  !!(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_APP_ID
  );
const config = emulator
  ? {
      apiKey: "demo-key",
      authDomain: "localhost",
      projectId: "demo-habit-check",
      appId: "demo-habit-check",
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
// A separate app name isolates this app's local cache from Habit Garden on the same origin.
const app = configured ? initializeApp(config, "habit-check") : null;
export const auth = app ? getAuth(app) : null;
export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : null;
if (auth) {
  if (emulator)
    connectAuthEmulator(auth, "http://127.0.0.1:9199", {
      disableWarnings: true,
    });
  void setPersistence(auth, browserLocalPersistence).catch(() => {});
}
if (db && emulator) connectFirestoreEmulator(db, "127.0.0.1", 8188);
export function login() {
  if (!auth) throw Error("연결 설정이 필요해요.");
  return signInWithPopup(auth, new GoogleAuthProvider());
}
