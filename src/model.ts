export type Period = "morning" | "afternoon" | "evening" | "night" | "anytime";
export const periods: Period[] = [
  "morning",
  "afternoon",
  "evening",
  "night",
  "anytime",
];
export const periodLabels: Record<Period, string> = {
  morning: "아침",
  afternoon: "점심",
  evening: "저녁",
  night: "밤",
  anytime: "언제든",
};
export interface Habit {
  id: string;
  title: string;
  weight: number;
  timeOfDay: Period;
  order: number;
  scoreMode: "binary" | "scaled";
  achieveThreshold: number;
  description?: string;
  active: boolean;
  archivedAt?: unknown;
  hibernatedSince?: string | null;
  hibernatedUntil?: string | null;
}
export interface HabitCheck {
  habitId: string;
  score: number | null;
  achieved: boolean;
  habitSnapshot?: Partial<Habit>;
  [key: string]: unknown;
}
export type PrayerPriority = "high" | "mid" | "low";
export type PrayerStatus = "active" | "answered" | "dormant";
export interface TimeValue {
  toMillis: () => number;
}
export interface Prayer {
  id: string;
  title: string;
  body?: string;
  target: string;
  group: string;
  status: PrayerStatus;
  pinned: boolean;
  priority: PrayerPriority;
  rotationDays?: number;
  receivedAt?: TimeValue;
  lastPrayedAt?: TimeValue;
  answerNote?: string;
  [key: string]: unknown;
}
export interface Plan {
  pinnedIds: string[];
  rotationIds: string[];
  extraIds?: string[];
}
export interface Data {
  habits: Habit[];
  checks: Record<string, HabitCheck>;
  prayers: Prayer[];
  prayerChecks: Record<string, unknown>;
  day: { prayerPlan?: Plan };
  settings: { dailyPrayerLimit?: number };
  ready: boolean;
  serverReady: boolean;
  pending: boolean;
  error: string | null;
}
export const emptyData = (): Data => ({
  habits: [],
  checks: {},
  prayers: [],
  prayerChecks: {},
  day: {},
  settings: {},
  ready: false,
  serverReady: false,
  pending: false,
  error: null,
});
export const PRAYER_ROTATION_LIMIT = 9;
export const PRAYER_NEW_PER_DAY = 3;
export const PRAYER_ROTATION_DEFAULTS: Record<
  PrayerPriority,
  { baseInterval: number; dormantThreshold: number; weight: number }
> = {
  high: { baseInterval: 2, dormantThreshold: 120, weight: 3 },
  mid: { baseInterval: 5, dormantThreshold: 75, weight: 2 },
  low: { baseInterval: 10, dormantThreshold: 45, weight: 1 },
};
export function plannerDate(now: Date = new Date()) {
  return new Date(now.getTime() + 5 * 3600000).toISOString().slice(0, 10);
}
export function previousDate(date: string) {
  return new Date(Date.parse(date + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function timeOfDay(now: Date = new Date()): Period {
  const h = new Date(now.getTime() + 9 * 3600000).getUTCHours();
  return h >= 4 && h < 11
    ? "morning"
    : h < 17 && h >= 11
      ? "afternoon"
      : h >= 17 && h < 22
        ? "evening"
        : "night";
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(date + "T12:00:00+09:00"));
}
export function visibleHabits(h: Habit[]) {
  return h
    .filter(
      (x) =>
        x.active && !x.archivedAt && !(x.hibernatedSince && !x.hibernatedUntil),
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function checkPatch(h: Habit, score: number | null): HabitCheck {
  if (
    score !== null &&
    (!Number.isInteger(score) ||
      (h.scoreMode === "binary"
        ? ![0, 1].includes(score)
        : score < 1 || score > 5))
  )
    throw Error("올바른 기록을 선택해 주세요.");
  return {
    habitId: h.id,
    score,
    achieved:
      score !== null &&
      score >= (h.scoreMode === "scaled" ? 3 : h.achieveThreshold),
    habitSnapshot: {
      title: h.title,
      weight: h.weight,
      timeOfDay: h.timeOfDay,
      scoreMode: h.scoreMode,
      achieveThreshold: h.achieveThreshold,
    },
  };
}
export function hasPlan(day: Data["day"]): boolean {
  return (
    !!day.prayerPlan &&
    Array.isArray(day.prayerPlan.pinnedIds) &&
    Array.isArray(day.prayerPlan.rotationIds)
  );
}
export function todayPrayers(prayers: Prayer[], plan?: Plan): Prayer[] {
  if (!plan) return [];
  const active = new Map(
    prayers.filter((p) => p.status === "active").map((p) => [p.id, p]),
  );
  const ids = [
    ...plan.pinnedIds,
    ...prayers
      .filter((p) => p.status === "active" && p.pinned)
      .map((p) => p.id),
    ...plan.rotationIds,
    ...(plan.extraIds ?? []),
  ];
  return [...new Set(ids)].flatMap((id) =>
    active.has(id) ? [active.get(id)!] : [],
  );
}
export function checkLabel(check?: HabitCheck) {
  return !check
    ? "미기록"
    : check.score === null
      ? "건너뜀"
      : check.score === 0
        ? "안 했음"
        : check.achieved
          ? "완료"
          : "기록됨";
}
export interface PrayerInput {
  title: string;
  body: string;
  target: string;
  group: string;
}
export function prayerFields(input: PrayerInput) {
  if (!input.title.trim()) throw Error("기도제목을 입력해 주세요.");
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    target: input.target.trim() || "나 자신",
    group: input.group.trim() || "개인",
  };
}
