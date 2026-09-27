const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const base = "http://127.0.0.1:5175/habit-check/";
const helper = "/habit-check/tests/browser-fixture.ts";
const call = (page, name, value) =>
  page.evaluate(
    async ({ helper, name, value }) => (await import(helper))[name](value),
    { helper, name, value },
  );
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  const a = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Seoul",
      reducedMotion: "reduce",
    }),
    b = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Seoul",
      reducedMotion: "reduce",
    });
  const p = await a.newPage(),
    q = await b.newPage();
  p.on("console", (m) => {
    if (m.type() === "error") console.log("P ERROR", m.text());
  });
  q.on("console", (m) => {
    if (m.type() === "error") console.log("Q ERROR", m.text());
  });
  const email = `fixture-${Date.now()}@example.test`;
  await p.goto(base);
  await call(p, "createFixture", email);
  await p.getByText("에뮬레이터 습관", { exact: true }).waitFor();
  await q.goto(base);
  await call(q, "loginFixture", email);
  await q.getByText("에뮬레이터 습관", { exact: true }).waitFor();
  await p
    .getByRole("button", { name: "에뮬레이터 습관 완료", exact: true })
    .click();
  await q
    .getByRole("button", { name: "에뮬레이터 습관 기록 취소", exact: true })
    .waitFor();
  await p.locator(".save-state.saved").waitFor();
  await q
    .getByRole("button", { name: "에뮬레이터 습관 기록 취소", exact: true })
    .click();
  await p
    .getByRole("button", { name: "에뮬레이터 습관 완료", exact: true })
    .waitFor();
  await q.locator(".save-state.saved").waitFor();
  await call(p, "offline");
  await p
    .getByRole("button", { name: "에뮬레이터 습관 완료", exact: true })
    .click();
  await p
    .getByRole("button", { name: "에뮬레이터 습관 기록 취소", exact: true })
    .waitFor();
  assert.equal(
    await q
      .getByRole("button", { name: "에뮬레이터 습관 완료", exact: true })
      .count(),
    1,
  );
  await call(p, "online");
  await q
    .getByRole("button", { name: "에뮬레이터 습관 기록 취소", exact: true })
    .waitFor()
    .catch(async (e) => {
      console.log("P", await p.locator("body").innerText());
      console.log("Q", await q.locator("body").innerText());
      throw e;
    });
  await p.getByRole("button", { name: "기도", exact: true }).click();
  await q.getByRole("button", { name: "기도", exact: true }).click();
  await p.getByRole("heading", { name: "예시 기도", exact: true }).waitFor();
  await q.getByRole("heading", { name: "예시 기도", exact: true }).waitFor();
  await p.getByRole("button", { name: "기도하기", exact: true }).click();
  await q.getByRole("button", { name: "기도했어요", exact: true }).waitFor();
  await call(p, "logoutFixture");
  await p.getByRole("button", { name: "Google로 계속하기" }).waitFor();
  assert.equal(await p.getByText("예시 기도", { exact: true }).count(), 0);
  await call(p, "createFixture", `other-${Date.now()}@example.test`);
  await p.getByText("에뮬레이터 습관", { exact: true }).waitFor();
  assert.equal(await p.locator(".check-button[aria-pressed=true]").count(), 0);
  await p.getByRole("button", { name: "기도", exact: true }).click();
  await p.getByRole("button", { name: "기도하기", exact: true }).waitFor();
  assert.equal(
    await p.getByRole("button", { name: "기도했어요", exact: true }).count(),
    0,
  );
  console.log(
    "PASS: browser Auth emulator login, two independent sessions sync/undo/offline reconnect, same prayer plan/check, signout and account isolation",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
