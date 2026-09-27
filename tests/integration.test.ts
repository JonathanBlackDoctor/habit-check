import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  disableNetwork,
  enableNetwork,
  type Firestore,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { firestoreRepository, type Repository } from "../src/repository";
import { emptyData, type Data } from "../src/model";
import { habit, prayer, data } from "./fixtures";
let env: RulesTestEnvironment;
const date = "2026-09-28";
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-habit-check",
    firestore: {
      host: "127.0.0.1",
      port: 8188,
      rules: readFileSync("tests/firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  await env.cleanup();
});
function database(uid: string) {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}
function watch(repo: Repository) {
  let state = emptyData();
  const stop = repo.subscribe(date, (d) => {
    state = d;
  });
  return {
    stop,
    get: () => state,
    wait: async (fn: (d: Data) => boolean) => {
      await expect
        .poll(() => fn(state), { timeout: 12000, interval: 40 })
        .toBe(true);
      return state;
    },
  };
}
describe("실제 Firebase SDK ↔ 로컬 Firestore 에뮬레이터", () => {
  it("두 클라이언트 양방향 반영·메모 보존·취소·계정 격리", async () => {
    const a = database("alice"),
      b = database("alice"),
      other = database("bob");
    const ra = firestoreRepository(a, "alice"),
      rb = firestoreRepository(b, "alice");
    await setDoc(doc(a, "users/alice/habits/habit-a"), habit);
    await setDoc(doc(a, `users/alice/days/${date}/habitChecks/habit-a`), {
      note: "기존 메모",
      mood: 4,
      tags: ["기존"],
      habitId: habit.id,
      score: 0,
      achieved: false,
    });
    const wa = watch(ra),
      wb = watch(rb);
    try {
      await wa.wait((d) => d.serverReady);
      await wb.wait((d) => d.serverReady);
      await ra.saveHabit(date, habit, 1);
      await wb.wait((d) => d.checks[habit.id]?.score === 1);
      expect(wb.get().checks[habit.id]).toMatchObject({
        note: "기존 메모",
        mood: 4,
        tags: ["기존"],
        habitSnapshot: { title: habit.title },
      });
      await rb.saveHabit(
        date,
        { ...habit, scoreMode: "scaled", achieveThreshold: 5 },
        2,
      );
      await wa.wait((d) => d.checks[habit.id]?.score === 2);
      expect(wa.get().checks[habit.id].achieved).toBe(false);
      await rb.saveHabit(date, habit, null);
      await wa.wait((d) => d.checks[habit.id]?.score === null);
      await ra.clearHabit(date, habit.id);
      await wb.wait((d) => !d.checks[habit.id]);
      await assertFails(getDoc(doc(other, "users/alice/habits/habit-a")));
      await assertFails(
        firestoreRepository(other, "alice").saveHabit(date, habit, 1),
      );
    } finally {
      wa.stop();
      wb.stop();
    }
  });
  it("오프라인 로컬 반영·대기 상태·재연결 후 다른 클라이언트 반영", async () => {
    const a = database("offline"),
      b = database("offline"),
      ra = firestoreRepository(a, "offline"),
      rb = firestoreRepository(b, "offline");
    await setDoc(doc(a, "users/offline/habits/habit-a"), habit);
    const wa = watch(ra),
      wb = watch(rb);
    let pending: Promise<void> | undefined;
    try {
      await wa.wait((d) => d.serverReady);
      await wb.wait((d) => d.serverReady);
      await disableNetwork(a);
      pending = ra.saveHabit(date, habit, 1);
      await wa.wait((d) => d.pending && d.checks[habit.id]?.score === 1);
      expect(wb.get().checks[habit.id]).toBeUndefined();
      await enableNetwork(a);
      await pending;
      await wb.wait((d) => d.checks[habit.id]?.score === 1);
      await wa.wait((d) => !d.pending);
    } finally {
      await enableNetwork(a);
      await pending;
      wa.stop();
      wb.stop();
    }
  });
  it("동시 기도 계획 생성 보존·추가 항목 머지·빈 계획 보존", async () => {
    const a = database("plans"),
      b = database("plans"),
      ra = firestoreRepository(a, "plans"),
      rb = firestoreRepository(b, "plans"),
      ref = doc(a, `users/plans/days/${date}`);
    await setDoc(ref, {
      prayerPlan: { extraIds: ["extra"] },
      unrelated: "preserve",
    });
    await Promise.all([
      ra.ensurePlan(date, data()),
      rb.ensurePlan(date, data()),
    ]);
    let saved = (await getDoc(ref)).data()!;
    expect(saved.prayerPlan).toMatchObject({
      pinnedIds: [prayer.id],
      extraIds: ["extra"],
    });
    expect(saved.unrelated).toBe("preserve");
    await ra.ensurePlan(date, {
      ...data(),
      prayers: [{ ...prayer, id: "different" }],
    });
    saved = (await getDoc(ref)).data()!;
    expect(saved.prayerPlan.pinnedIds).toEqual([prayer.id]);
    await setDoc(ref, {
      prayerPlan: { pinnedIds: [], rotationIds: [], extraIds: ["extra"] },
    });
    await rb.ensurePlan(date, data());
    expect((await getDoc(ref)).data()!.prayerPlan).toEqual({
      pinnedIds: [],
      rotationIds: [],
      extraIds: ["extra"],
    });
  });
  it("로딩·오프라인 캐시·오류·미전송 기록으로 계획 생성하지 않음", async () => {
    const db = database("guard"),
      repo = firestoreRepository(db, "guard");
    for (const patch of [
      { ready: false },
      { serverReady: false },
      { pending: true },
      { error: "denied" },
    ])
      await repo.ensurePlan(date, { ...data(), ...patch });
    expect((await getDoc(doc(db, `users/guard/days/${date}`))).exists()).toBe(
      false,
    );
  });
  it("기도 CRUD·체크·응답·깨우기, 기존 메타데이터 보존", async () => {
    const db = database("prayer"),
      repo = firestoreRepository(db, "prayer");
    const id = await repo.savePrayer({
        title: "테스트 기도",
        body: "본문",
        target: "",
        group: "",
      }),
      ref = doc(db, `users/prayer/prayers/${id}`);
    await setDoc(
      ref,
      { verse: { text: "보존할 값" }, prayCount: 7, streak: 2 },
      { merge: true },
    );
    await repo.savePrayer(
      { title: "수정", body: "", target: "대상", group: "모임" },
      id,
    );
    expect((await getDoc(ref)).data()).toMatchObject({
      title: "수정",
      body: "",
      prayCount: 7,
      streak: 2,
      verse: { text: "보존할 값" },
    });
    await repo.checkPrayer(date, id, true);
    expect(
      (
        await getDoc(doc(db, `users/prayer/days/${date}/prayerChecks/${id}`))
      ).exists(),
    ).toBe(true);
    await repo.checkPrayer(date, id, false);
    expect(
      (
        await getDoc(doc(db, `users/prayer/days/${date}/prayerChecks/${id}`))
      ).exists(),
    ).toBe(false);
    await repo.answer(id, "감사");
    expect((await getDoc(ref)).data()).toMatchObject({
      status: "answered",
      answerNote: "감사",
      prayCount: 7,
    });
    await repo.updatePrayer(id, { status: "dormant", dormantSince: "test" });
    await repo.awaken(id);
    expect((await getDoc(ref)).data()).toMatchObject({ status: "active" });
    expect((await getDoc(ref)).data()!.dormantSince).toBeUndefined();
    await repo.removePrayer(id);
    expect((await getDoc(ref)).exists()).toBe(false);
  });
  it("권한 오류를 빈 목록 성공으로 숨기지 않음·구독 해제 후 콜백 차단", async () => {
    const unauth = env
        .unauthenticatedContext()
        .firestore() as unknown as Firestore,
      repo = firestoreRepository(unauth, "alice");
    let calls = 0,
      last = emptyData();
    const stop = repo.subscribe(date, (d) => {
      calls++;
      last = d;
    });
    await expect.poll(() => last.error).not.toBeNull();
    expect(last.ready).toBe(false);
    stop();
    const count = calls;
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toBe(count);
  });
});
