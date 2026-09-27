import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  deleteField,
  type Firestore,
  type DocumentData,
} from "firebase/firestore";
import {
  checkPatch,
  emptyData,
  hasPlan,
  prayerFields,
  type Data,
  type Habit,
  type Prayer,
  type PrayerInput,
} from "./model";
import { selectTodayPrayers } from "./rotation";
export interface Repository {
  subscribe(date: string, next: (data: Data) => void): () => void;
  saveHabit(date: string, habit: Habit, score: number | null): Promise<void>;
  clearHabit(date: string, id: string): Promise<void>;
  checkPrayer(date: string, id: string, checked: boolean): Promise<void>;
  savePrayer(input: PrayerInput, id?: string): Promise<string>;
  updatePrayer(id: string, patch: Record<string, unknown>): Promise<void>;
  awaken(id: string): Promise<void>;
  answer(id: string, note: string): Promise<void>;
  removePrayer(id: string): Promise<void>;
  ensurePlan(date: string, data: Data): Promise<void>;
}
export function rotationPlan(data: Data, now = Date.now()) {
  return selectTodayPrayers(
    data.prayers
      .filter((p) => p.status === "active")
      .map((p) => ({
        id: p.id,
        priority: p.priority,
        pinned: p.pinned,
        rotationDays: p.rotationDays,
        target: p.target,
        receivedAtMs: p.receivedAt?.toMillis?.() ?? now,
        lastPrayedAtMs: p.lastPrayedAt?.toMillis?.(),
      })),
    now,
    { override: data.settings.dailyPrayerLimit },
  );
}
export function firestoreRepository(db: Firestore, uid: string): Repository {
  const ref = (...parts: string[]) => doc(db, "users", uid, ...parts);
  return {
    subscribe(date, next) {
      let state = emptyData(),
        alive = true;
      const loaded = new Set<string>(),
        fresh = new Set<string>(),
        pending = new Set<string>();
      const emit = () => {
        if (alive)
          next({
            ...state,
            ready: loaded.size === 6,
            serverReady: fresh.size === 6,
            pending: pending.size > 0,
          });
      };
      const error = (e: Error) => {
        state = {
          ...state,
          error:
            "데이터를 불러오지 못했어요. 연결과 로그인 계정을 확인해 주세요.",
        };
        console.warn("Firestore read failed", e.name);
        emit();
      };
      const accept = (
        key: string,
        value: unknown,
        meta: { fromCache: boolean; hasPendingWrites: boolean },
      ) => {
        state = { ...state, [key]: value };
        loaded.add(key);
        meta.fromCache ? fresh.delete(key) : fresh.add(key);
        meta.hasPendingWrites ? pending.add(key) : pending.delete(key);
        emit();
      };
      const list = (
        key: string,
        path: string[],
        map: (docs: { id: string; data: () => DocumentData }[]) => unknown,
      ) =>
        onSnapshot(
          collection(db, "users", uid, ...path),
          { includeMetadataChanges: true },
          (snap) => accept(key, map(snap.docs), snap.metadata),
          error,
        );
      const keyed = (docs: { id: string; data: () => DocumentData }[]) =>
        Object.fromEntries(docs.map((d) => [d.id, { ...d.data(), id: d.id }]));
      const array = (docs: { id: string; data: () => DocumentData }[]) =>
        docs.map((d) => ({ ...d.data(), id: d.id }));
      const subs = [
        list("habits", ["habits"], array),
        list("checks", ["days", date, "habitChecks"], keyed),
        list("prayers", ["prayers"], (docs) =>
          (array(docs) as Prayer[]).sort(
            (a, b) =>
              (b.receivedAt?.toMillis?.() ?? 0) -
                (a.receivedAt?.toMillis?.() ?? 0) || a.id.localeCompare(b.id),
          ),
        ),
        list("prayerChecks", ["days", date, "prayerChecks"], keyed),
        onSnapshot(
          ref("days", date),
          { includeMetadataChanges: true },
          (s) => accept("day", s.data() ?? {}, s.metadata),
          error,
        ),
        onSnapshot(
          ref("settings", "main"),
          { includeMetadataChanges: true },
          (s) => accept("settings", s.data() ?? {}, s.metadata),
          error,
        ),
      ];
      return () => {
        alive = false;
        subs.forEach((f) => f());
      };
    },
    async saveHabit(date, h, score) {
      await setDoc(
        ref("days", date, "habitChecks", h.id),
        { ...checkPatch(h, score), checkedAt: serverTimestamp() },
        { merge: true },
      );
    },
    async clearHabit(date, id) {
      await deleteDoc(ref("days", date, "habitChecks", id));
    },
    async checkPrayer(date, id, checked) {
      const target = ref("days", date, "prayerChecks", id);
      if (checked)
        await setDoc(
          target,
          { prayerId: id, prayedAt: serverTimestamp() },
          { merge: true },
        );
      else await deleteDoc(target);
    },
    async savePrayer(input, id) {
      const fields = prayerFields(input);
      if (id) {
        await updateDoc(ref("prayers", id), {
          ...fields,
          updatedAt: serverTimestamp(),
        });
        return id;
      }
      const target = doc(collection(db, "users", uid, "prayers"));
      await setDoc(target, {
        ...fields,
        id: target.id,
        status: "active",
        priority: "mid",
        pinned: false,
        prayCount: 0,
        streak: 0,
        source: "quick",
        receivedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return target.id;
    },
    async updatePrayer(id, patch) {
      await updateDoc(ref("prayers", id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    async awaken(id) {
      await updateDoc(ref("prayers", id), {
        status: "active",
        dormantSince: deleteField(),
        lastPrayedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    async answer(id, note) {
      await updateDoc(ref("prayers", id), {
        status: "answered",
        answerNote: note.trim(),
        answeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    async removePrayer(id) {
      await deleteDoc(ref("prayers", id));
    },
    async ensurePlan(date, data) {
      if (
        !data.ready ||
        !data.serverReady ||
        data.pending ||
        data.error ||
        hasPlan(data.day)
      )
        return;
      const plan = rotationPlan(data);
      await runTransaction(db, async (tx) => {
        const target = ref("days", date),
          snap = await tx.get(target);
        if (hasPlan(snap.data() ?? {})) return;
        tx.set(
          target,
          {
            prayerPlan: { ...plan, generatedAt: serverTimestamp() },
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
    },
  };
}
