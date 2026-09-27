// Dev-server-only test helper. Never imported by the app or included in dist.
import { auth, db, emulator } from "../src/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, disableNetwork, enableNetwork } from "firebase/firestore";
import { habit, prayer } from "./fixtures";

function guard() {
  if (
    !emulator ||
    !db ||
    !auth ||
    db.app.options.projectId !== "demo-habit-check"
  )
    throw Error("Fixtures require demo emulators");
  return { db, auth };
}
const password = "only-local-fixture-12345";
export async function createFixture(email: string) {
  const { db, auth } = guard();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const uid = result.user.uid;
  await Promise.all([
    setDoc(doc(db, `users/${uid}/habits/${habit.id}`), {
      ...habit,
      title: "에뮬레이터 습관",
      timeOfDay: "night",
    }),
    setDoc(doc(db, `users/${uid}/prayers/${prayer.id}`), {
      ...prayer,
      prayCount: 0,
      streak: 0,
    }),
    setDoc(doc(db, `users/${uid}/settings/main`), {}),
  ]);
  return uid;
}
export async function loginFixture(email: string) {
  const { auth } = guard();
  await signInWithEmailAndPassword(auth, email, password);
}
export async function logoutFixture() {
  await signOut(guard().auth);
}
export async function offline() {
  await disableNetwork(guard().db);
}
export async function online() {
  await enableNetwork(guard().db);
}
