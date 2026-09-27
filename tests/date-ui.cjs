const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  const page = await browser.newPage({
    viewport: { width: 320, height: 844 },
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
  });
  await page.clock.install({ time: new Date("2026-09-28T03:59:50+09:00") });
  await page.goto("http://127.0.0.1:5174/habit-check/?demo=1");
  await page.getByText("9월 27일 일요일", { exact: true }).waitFor();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  const item = page
    .locator(".habit-row")
    .filter({ hasText: "물 한 잔 마시기" });
  await item.locator(".check-button").click();
  await item.getByText("저장 완료", { exact: true }).waitFor();
  const score = page.locator(".habit-row").filter({ hasText: "집중해서 공부" });
  await score.getByRole("button", { name: "집중해서 공부 점수 선택" }).click();
  const targets = await score
    .locator(".scores button")
    .evaluateAll((xs) =>
      xs.map((x) => ({
        width: x.getBoundingClientRect().width,
        height: x.getBoundingClientRect().height,
      })),
    );
  assert(targets.every((t) => t.width >= 44 && t.height >= 44));
  await page.clock.fastForward(20000);
  await page.getByText("9월 28일 월요일", { exact: true }).waitFor();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  assert.equal(
    await page.locator(".check-button[aria-pressed=true]").count(),
    0,
  );
  await page.getByRole("button", { name: "어제", exact: true }).click();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  assert.equal(
    await page.locator(".check-button[aria-pressed=true]").count(),
    1,
  );
  console.log(
    "PASS: 04:00 rollover resets today subscription, yesterday keeps prior record, 320px score targets >=44px",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
