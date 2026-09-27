import { describe, it, expect } from "vitest";
import {
  plannerDate,
  previousDate,
  timeOfDay,
  visibleHabits,
  checkPatch,
  hasPlan,
  todayPrayers,
  prayerFields,
  checkLabel,
} from "../src/model";
import { selectTodayPrayers } from "../src/rotation";
import { habit, prayer } from "./fixtures";
describe("기존 앱 날짜·기록 계약", () => {
  it.each([
    ["2026-09-28T03:59:59+09:00", "2026-09-27"],
    ["2026-09-28T04:00:00+09:00", "2026-09-28"],
    ["2026-01-01T00:30:00+09:00", "2025-12-31"],
  ])("한국 시간 새벽 4시: %s", (input, expected) =>
    expect(plannerDate(new Date(input))).toBe(expected),
  );
  it("윤년과 연도 경계의 어제", () => {
    expect(previousDate("2024-03-01")).toBe("2024-02-29");
    expect(previousDate("2026-01-01")).toBe("2025-12-31");
  });
  it.each([
    [4, "morning"],
    [10, "morning"],
    [11, "afternoon"],
    [17, "evening"],
    [22, "night"],
    [2, "night"],
  ])("시간대 경계 %s시", (h, expected) =>
    expect(
      timeOfDay(
        new Date(`2026-09-28T${String(h).padStart(2, "0")}:00:00+09:00`),
      ),
    ).toBe(expected),
  );
  it("비활성·보관·휴면을 제외하고 기존 순서를 유지", () => {
    const list = [
      { ...habit, id: "later", order: 3 },
      { ...habit, id: "sleep", hibernatedSince: "2026-01-01" },
      { ...habit, id: "inactive", active: false },
      { ...habit, id: "archive", archivedAt: 123 },
      {
        ...habit,
        id: "wake",
        order: 1,
        hibernatedSince: "2026-01-01",
        hibernatedUntil: "2026-09-01",
      },
    ];
    expect(visibleHabits(list).map((h) => h.id)).toEqual(["wake", "later"]);
  });
  it("0은 미달성 기록, null은 건너뜀, 없음은 미기록", () => {
    expect(checkPatch(habit, 0).achieved).toBe(false);
    expect(checkLabel(checkPatch(habit, 0))).toBe("안 했음");
    expect(checkLabel(checkPatch(habit, null))).toBe("건너뜀");
    expect(checkLabel()).toBe("미기록");
    expect(checkPatch(habit, 1).achieved).toBe(true);
  });
  it("점수형은 저장된 낡은 기준과 무관하게 3점부터 달성", () => {
    const h = { ...habit, scoreMode: "scaled" as const, achieveThreshold: 5 };
    expect(checkPatch(h, 2).achieved).toBe(false);
    expect(checkPatch(h, 3).achieved).toBe(true);
    expect(checkPatch(h, 5).habitSnapshot).toMatchObject({
      title: h.title,
      weight: 5,
      scoreMode: "scaled",
    });
  });
  it("잘못된 점수 거부", () => {
    expect(() => checkPatch(habit, 5)).toThrow();
    expect(() => checkPatch({ ...habit, scoreMode: "scaled" }, 0)).toThrow();
    expect(() => checkPatch(habit, NaN)).toThrow();
  });
});
describe("기도 계획 보존과 관리", () => {
  it("빈 배열도 확정 계획", () => {
    expect(hasPlan({ prayerPlan: { pinnedIds: [], rotationIds: [] } })).toBe(
      true,
    );
    expect(hasPlan({})).toBe(false);
  });
  it("고정·순환·추가를 중복 제거하고 응답·삭제 항목 제외", () => {
    const p = [
      prayer,
      { ...prayer, id: "extra", pinned: false },
      { ...prayer, id: "answer", status: "answered" as const },
      { ...prayer, id: "new-pin" },
    ];
    expect(
      todayPrayers(p, {
        pinnedIds: ["prayer-a"],
        rotationIds: ["prayer-a", "missing", "answer"],
        extraIds: ["extra", "extra"],
      }).map((p) => p.id),
    ).toEqual(["prayer-a", "new-pin", "extra"]);
  });
  it("기도 체크 변화는 표시 순서를 바꾸지 않음", () => {
    const p = [prayer, { ...prayer, id: "b", pinned: false }];
    const plan = { pinnedIds: ["prayer-a"], rotationIds: ["b"] };
    expect(todayPrayers(p, plan).map((p) => p.id)).toEqual(
      todayPrayers(
        p.map((p) => ({ ...p, lastPrayedAt: { toMillis: () => Date.now() } })),
        plan,
      ).map((p) => p.id),
    );
  });
  it("제목 필수·기존 기본값·명시적 빈 본문", () => {
    expect(() =>
      prayerFields({ title: " ", body: "", group: "", target: "" }),
    ).toThrow();
    expect(
      prayerFields({ title: " 기도 ", body: "", group: "", target: "" }),
    ).toEqual({ title: "기도", body: "", group: "개인", target: "나 자신" });
  });
  it("원본 순환 규칙의 고정 유지·신규 하루 3개", () => {
    const result = selectTodayPrayers(
      Array.from({ length: 8 }, (_, i) => ({
        id: String(i),
        priority: "mid",
        pinned: i === 0,
        receivedAtMs: 100 + i,
      })),
      1000,
    );
    expect(result.pinnedIds).toEqual(["0"]);
    expect(result.rotationIds).toEqual(["7", "6", "5"]);
  });
});
