const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.APP_URL || "http://127.0.0.1:5174/habit-check/";
(async () => {
  fs.mkdirSync("test-results", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "?demo=1");
  await page.getByRole("heading", { name: "가볍게, 하나씩." }).waitFor();
  await page.screenshot({
    path: "test-results/habits-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  assert.equal(await page.locator(".habit-row").count(), 22);
  const first = page
    .locator(".habit-row")
    .filter({ hasText: "물 한 잔 마시기" });
  const before = await first.evaluate(
    (el) => el.getBoundingClientRect().top + scrollY,
  );
  await first.locator(".check-button").click();
  await first.getByText("저장 완료", { exact: true }).waitFor();
  assert.equal(
    await first.locator(".check-button").getAttribute("aria-pressed"),
    "true",
  );
  const after = await first.evaluate(
    (el) => el.getBoundingClientRect().top + scrollY,
  );
  assert.equal(before, after);
  await first.locator(".check-button").click();
  assert.equal(
    await first.locator(".check-button").getAttribute("aria-pressed"),
    "false",
  );
  await first.getByRole("button", { name: /기록 옵션/ }).click();
  await first.getByRole("button", { name: "안 했음", exact: true }).click();
  await first.getByText("안 했음", { exact: true }).first().waitFor();
  const scaled = page
    .locator(".habit-row")
    .filter({ hasText: "집중해서 공부" });
  await scaled.getByRole("button", { name: "집중해서 공부 점수 선택" }).click();
  await scaled.getByRole("button", { name: "2점", exact: true }).click();
  assert.equal(
    await scaled.locator(".check-button").getAttribute("aria-pressed"),
    "false",
  );
  await scaled.getByRole("button", { name: "4점", exact: true }).click();
  assert.equal(
    await scaled.locator(".check-button").getAttribute("aria-pressed"),
    "true",
  );
  await page.getByRole("button", { name: /하루 마감/ }).click();
  assert.equal(await page.locator(".habit-row").count(), 20);
  const reviewFirst = page.locator(".habit-row").first();
  await reviewFirst.locator(".check-button").click();
  assert.equal(await page.locator(".habit-row").count(), 20);
  await page.getByRole("button", { name: "목록으로", exact: true }).click();
  await page.getByRole("button", { name: "어제", exact: true }).click();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  assert.equal(
    await page.locator(".check-button[aria-pressed=true]").count(),
    0,
  );
  await page.getByRole("button", { name: "오늘", exact: true }).click();
  await page.getByRole("button", { name: "기도", exact: true }).click();
  await page.getByRole("heading", { name: "마음을 모으는 시간." }).waitFor();
  assert.equal(await page.locator(".prayer-card").count(), 2);
  await page
    .getByRole("button", { name: "기도하기", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "기도했어요", exact: true }).waitFor();
  assert.equal(await page.locator(".prayer-card").count(), 2);
  await page.screenshot({
    path: "test-results/prayers-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "기도제목 추가" }).click();
  await page
    .getByLabel("기도제목", { exact: true })
    .fill("브라우저 테스트 기도");
  await page.getByLabel("내용 선택").fill("가상 데이터입니다.");
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await page.getByRole("heading", { name: "브라우저 테스트 기도" }).waitFor();
  const card = page
    .locator(".prayer-card")
    .filter({ hasText: "브라우저 테스트 기도" });
  await card.getByRole("button", { name: /자세히 보기/ }).click();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("기도제목", { exact: true }).fill("수정한 테스트 기도");
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  await page.getByRole("heading", { name: "수정한 테스트 기도" }).waitFor();
  await page
    .locator(".prayer-card")
    .filter({ hasText: "수정한 테스트 기도" })
    .getByRole("button", { name: /자세히 보기/ })
    .click();
  await page.getByRole("button", { name: "응답 기록", exact: true }).click();
  await page.getByLabel("응답 메모 선택").fill("테스트 응답");
  await page.getByRole("button", { name: "응답 기록하기" }).click();
  await page.getByRole("button", { name: "응답됨", exact: true }).click();
  await page.getByRole("heading", { name: "수정한 테스트 기도" }).waitFor();
  await page
    .locator(".prayer-card")
    .filter({ hasText: "수정한 테스트 기도" })
    .getByRole("button", { name: /자세히 보기/ })
    .click();
  await page.getByRole("button", { name: "기도제목 삭제" }).click();
  await page.getByRole("button", { name: "돌아가기" }).click();
  assert.equal(
    await page.getByRole("heading", { name: "수정한 테스트 기도" }).count(),
    2,
  );
  await page.getByRole("button", { name: "기도제목 삭제" }).click();
  await page.getByRole("button", { name: "영구 삭제", exact: true }).click();
  await page
    .getByRole("heading", { name: "수정한 테스트 기도" })
    .waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "잠든 기도", exact: true }).click();
  await page
    .locator(".prayer-card")
    .getByRole("button", { name: /자세히 보기/ })
    .click();
  await page.getByRole("button", { name: "다시 기도하기" }).click();
  await page.getByRole("button", { name: "진행 중", exact: true }).click();
  await page
    .getByRole("heading", { name: "오래된 기도제목 돌아보기" })
    .waitFor();
  await page.getByRole("button", { name: "기도제목 추가" }).click();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => !!document.activeElement.closest("dialog")),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "overflow at " + width,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "습관", exact: true }).click();
  await page.screenshot({
    path: "test-results/habits-desktop.png",
    fullPage: true,
  });
  await page.goto(base);
  await page.getByRole("button", { name: "Google로 계속하기" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile/desktop, 22 habits, check/undo/0/scaled, stable rows, review, dates, prayer CRUD/answer/wake/delete, modal keyboard, no overflow, no page errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
