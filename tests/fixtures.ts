import { emptyData, type Habit, type Prayer } from "../src/model";
export const habit: Habit = {
  id: "habit-a",
  title: "예시 습관",
  weight: 5,
  timeOfDay: "morning",
  order: 0,
  scoreMode: "binary",
  achieveThreshold: 1,
  active: true,
};
export const prayer: Prayer = {
  id: "prayer-a",
  title: "예시 기도",
  body: "본문",
  target: "나 자신",
  group: "개인",
  priority: "mid",
  pinned: true,
  status: "active",
};
export const data = () => ({
  ...emptyData(),
  habits: [habit],
  prayers: [prayer],
  ready: true,
  serverReady: true,
});
