import { expect, test } from "@playwright/test";
test("keyless search → detail → atomic market → pause/resume/reset, including offline replay", async ({
  page,
  context,
}, testInfo) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByText("시세 시뮬레이션 — 현재 주가가 아닙니다"),
  ).toBeVisible();
  const search = page.getByRole("combobox", { name: "종목 검색" });
  await search.fill("삼성");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/stocks\/005930$/);
  await expect(page.getByRole("heading", { name: "삼성전자" })).toBeVisible();
  await expect(page.locator(".price-chart canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  const quote = page.getByTestId("quote");
  const initialSequence = await quote.getAttribute("data-sequence");
  const before = await page
    .locator(
      '[data-testid="quote"], [data-testid="virtual-time"], [data-testid="candle-summary"], [data-testid="orderbook"], [data-testid="trades"]',
    )
    .allTextContents();
  await page.waitForTimeout(1300); // Intentionally verify that time does NOT progress while paused.
  expect(
    await page
      .locator(
        '[data-testid="quote"], [data-testid="virtual-time"], [data-testid="candle-summary"], [data-testid="orderbook"], [data-testid="trades"]',
      )
      .allTextContents(),
  ).toEqual(before);
  await expect(quote).toHaveAttribute("data-sequence", initialSequence!);
  const price = (await page.getByTestId("last-price").textContent())!
    .replace("원", "")
    .trim();
  await expect(
    page.getByTestId("trades").locator("tbody tr").first().locator("td").nth(1),
  ).toHaveText(price);
  await expect(
    page.getByTestId("candle-summary").locator("tbody td").nth(3),
  ).toHaveText(price);
  await expect(
    page.getByTestId("orderbook").locator(".spread-row strong"),
  ).toHaveText(price);
  await expect(page.getByTestId("orderbook").locator("tbody tr")).toHaveCount(
    21,
  );
  const session = await quote.getAttribute("data-session");
  await page.getByRole("button", { name: /초기화/ }).click();
  await expect(quote).not.toHaveAttribute("data-session", session!);
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:00");
  await expect(
    page.getByRole("button", { name: "합성 시세 재생" }),
  ).toBeVisible();
  const viewport = page.viewportSize()!;
  const previousWidth = (await page.locator(".price-chart").boundingBox())!.width;
  const previousCanvasWidth = (await page.locator(".price-chart canvas").first().boundingBox())!.width;
  await page.setViewportSize({ width: Math.min(viewport.width - 40, 1100), height: viewport.height });
  await expect.poll(async () => (await page.locator(".price-chart").boundingBox())!.width).toBeLessThan(previousWidth);
  await expect.poll(async () => (await page.locator(".price-chart canvas").first().boundingBox())!.width).toBeLessThan(previousCanvasWidth);
  await page.setViewportSize(viewport);
  await page.screenshot({ path: testInfo.outputPath("stock-detail.png"), fullPage: true });
  const resetPrice = await page.getByTestId("last-price").textContent();
  await context.setOffline(true);
  await page.getByRole("button", { name: "합성 시세 재생" }).click();
  await expect(page.getByTestId("virtual-time")).not.toHaveText("09:40:00");
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  await page.getByRole("button", { name: /초기화/ }).click();
  await expect(page.getByTestId("last-price")).toHaveText(resetPrice!);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("empty search, unsupported symbol, route continuity and source disclosure", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox");
  await search.fill("없는회사");
  await expect(
    page.getByRole("status").filter({ hasText: "지원하지 않는 종목" }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.fill("005930");
  await search.press("ArrowDown");
  await search.press("Enter");
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  const time = await page.getByTestId("virtual-time").textContent();
  await page.getByRole("link", { name: "← 종목 탐색" }).click();
  await page.getByRole("link", { name: /삼성전자.*005930/ }).click();
  await expect(page.getByTestId("virtual-time")).toHaveText(time!);
  await expect(
    page.getByRole("button", { name: "합성 시세 재생" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /출처와 생성 규칙/ }).click();
  await expect(page.getByText("synthetic / SIM")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "TradingView (새 창) ↗", exact: true }),
  ).toBeVisible();
  await page.goto("/stocks/000000");
  await expect(
    page.getByRole("heading", {
      name: "현재 데모에서 지원하지 않는 종목입니다",
    }),
  ).toBeVisible();
});
