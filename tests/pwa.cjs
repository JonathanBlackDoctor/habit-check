const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || "msedge",
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  const base = "http://127.0.0.1:4174/habit-check/";
  await page.goto(base + "?demo=1");
  await page.getByRole("heading", { name: "가볍게, 하나씩." }).waitFor();
  const scope = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return r.scope;
  });
  assert.equal(scope, base);
  const manifest = await (
    await page.request.get(base + "manifest.webmanifest")
  ).json();
  assert.equal(manifest.scope, "/habit-check/");
  assert.equal(manifest.start_url, "/habit-check/");
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (k) =>
          (await (await caches.open(k)).keys()).map((r) => r.url),
        ),
      )
    ).flat();
  });
  assert(cached.length > 0);
  assert(
    cached.every((url) => new URL(url).pathname.startsWith("/habit-check/")),
  );
  assert(
    !cached.some((url) => /googleapis|firebaseapp|identitytoolkit/.test(url)),
  );
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "가볍게, 하나씩." }).waitFor();
  await page.getByRole("button", { name: "기도", exact: true }).click();
  await page.getByRole("heading", { name: "마음을 모으는 시간." }).waitFor();
  await context.setOffline(false);
  console.log(
    "PASS: production build boots, scoped PWA manifest/service worker, static-only cache, offline app reload and tabs",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
