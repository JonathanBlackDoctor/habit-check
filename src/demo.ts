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
import { rotationPlan, type Repository } from "./repository";
const titles = [
  "물 한 잔 마시기",
  "가벼운 스트레칭",
  "창문 열고 환기",
  "아침 읽기",
  "오늘 할 일 떠올리기",
  "산책하기",
  "책상 정리",
  "집중해서 공부",
  "하루 돌아보기",
  "내일 준비",
  "책 읽기",
  "충분히 쉬기",
  "가벼운 정리",
  "저녁 간식 줄이기",
  "식사 후 걷기",
  "자세 바로잡기",
  "눈 쉬어 주기",
  "화면 사용 돌아보기",
  "짧은 영상 줄이기",
  "기분 기록",
  "안부 전하기",
  "고마움 표현",
];
const habits: Habit[] = titles.map((title, i) => ({
  id: "sample-" + i,
  title,
  weight: 5,
  timeOfDay:
    i < 5
      ? "morning"
      : i < 6
        ? "afternoon"
        : i < 8
          ? "evening"
          : i < 14
            ? "night"
            : "anytime",
  order: i,
  scoreMode: [7, 8, 10, 11, 17, 19].includes(i) ? "scaled" : "binary",
  achieveThreshold: [7, 8, 10, 11, 17, 19].includes(i) ? 3 : 1,
  active: true,
  description: "1 아주 어려웠어요 · 3 어느 정도 했어요 · 5 충분히 했어요",
}));
const prayers: Prayer[] = [
  {
    id: "p1",
    title: "평안한 마음으로 하루를 시작하도록",
    body: "바쁜 순간에도 잠시 멈추고 감사하기.",
    target: "나 자신",
    group: "개인",
    status: "active",
    pinned: true,
    priority: "mid",
  },
  {
    id: "p2",
    title: "서로의 이야기를 잘 들어주는 공동체",
    body: "함께하는 사람들을 기억하며 기도해요.",
    target: "공동체",
    group: "교회",
    status: "active",
    pinned: false,
    priority: "mid",
  },
  {
    id: "p3",
    title: "작은 감사의 순간을 기억하기",
    target: "나 자신",
    group: "개인",
    status: "answered",
    answerNote: "마음을 나누는 시간을 가졌어요.",
    pinned: false,
    priority: "mid",
  },
  {
    id: "p4",
    title: "오래된 기도제목 돌아보기",
    target: "나 자신",
    group: "개인",
    status: "dormant",
    pinned: false,
    priority: "low",
  },
];
export function demoRepository(): Repository {
  let allPrayers = structuredClone(prayers),
    days = new Map<string, Data>();
  const listeners = new Set<() => void>();
  const day = (date: string) => {
    if (!days.has(date))
      days.set(date, {
        ...emptyData(),
        habits,
        prayers: allPrayers,
        day: { prayerPlan: { pinnedIds: ["p1"], rotationIds: ["p2"] } },
        ready: true,
        serverReady: true,
      });
    const d = days.get(date)!;
    return { ...d, prayers: allPrayers };
  };
  const emit = () => listeners.forEach((f) => f());
  const update = (id: string, patch: Record<string, unknown>) => {
    allPrayers = allPrayers.map((p) => (p.id === id ? { ...p, ...patch } : p));
    emit();
  };
  return {
    subscribe(date, next) {
      const fn = () => next(day(date));
      listeners.add(fn);
      fn();
      return () => {
        listeners.delete(fn);
      };
    },
    async saveHabit(date, h, score) {
      const d = day(date);
      days.set(date, {
        ...d,
        checks: {
          ...d.checks,
          [h.id]: { ...d.checks[h.id], ...checkPatch(h, score) },
        },
      });
      emit();
    },
    async clearHabit(date, id) {
      const d = day(date),
        checks = { ...d.checks };
      delete checks[id];
      days.set(date, { ...d, checks });
      emit();
    },
    async checkPrayer(date, id, checked) {
      const d = day(date),
        checks = { ...d.prayerChecks };
      if (checked) checks[id] = { prayerId: id };
      else delete checks[id];
      days.set(date, { ...d, prayerChecks: checks });
      emit();
    },
    async savePrayer(input: PrayerInput, id) {
      const fields = prayerFields(input);
      if (id) {
        update(id, fields);
        return id;
      }
      const newId = crypto.randomUUID();
      allPrayers = [
        {
          ...fields,
          id: newId,
          status: "active",
          pinned: false,
          priority: "mid",
        },
        ...allPrayers,
      ];
      emit();
      return newId;
    },
    async updatePrayer(id, patch) {
      update(id, patch);
    },
    async awaken(id) {
      update(id, { status: "active" });
    },
    async answer(id, note) {
      update(id, { status: "answered", answerNote: note });
    },
    async removePrayer(id) {
      allPrayers = allPrayers.filter((p) => p.id !== id);
      emit();
    },
    async ensurePlan(date, data) {
      if (!hasPlan(data.day)) {
        days.set(date, {
          ...day(date),
          day: { prayerPlan: rotationPlan(data) },
        });
        emit();
      }
    },
  };
}
