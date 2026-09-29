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
  const previousWidth = (await page.locator(".price-chart").boundingBox())!
    .width;
  const previousCanvasWidth = (await page
    .locator(".price-chart canvas")
    .first()
    .boundingBox())!.width;
  await page.setViewportSize({
    width: Math.min(viewport.width - 40, 1100),
    height: viewport.height,
  });
  await expect
    .poll(async () => (await page.locator(".price-chart").boundingBox())!.width)
    .toBeLessThan(previousWidth);
  await expect
    .poll(
      async () =>
        (await page.locator(".price-chart canvas").first().boundingBox())!
          .width,
    )
    .toBeLessThan(previousCanvasWidth);
  await page.setViewportSize(viewport);
  await page.screenshot({
    path: testInfo.outputPath("stock-detail.png"),
    fullPage: true,
  });
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
  const search = page.getByRole("combobox", { name: "종목 검색" });
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

test("five quote streams share time, 4x/reset are coherent across symbols, and URL selection has an empty state", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-01-05T01:00:00Z") });
  const external: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("/");
  const rows = page.locator('[data-testid^="home-quote-"]');
  await expect(rows).toHaveCount(5);
  await page
    .getByRole("combobox", { name: "합성 시세 배속" })
    .selectOption("4");
  await page.clock.runFor(1000);
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:04");
  const times = await rows.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-time")),
  );
  expect(new Set(times).size).toBe(1);
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  const homePrices = await rows.evaluateAll((nodes) =>
    Object.fromEntries(
      nodes.map((node) => [
        node.getAttribute("data-testid")!.replace("home-quote-", ""),
        node.querySelector("td")!.textContent!.replace("원", "").trim(),
      ]),
    ),
  );
  await page.getByRole("link", { name: /SK하이닉스.*000660/ }).click();
  await expect(page.getByRole("heading", { name: "SK하이닉스" })).toBeVisible();
  await expect(page.getByTestId("last-price")).toHaveText(
    `${homePrices["000660"]}원`,
  );
  await expect(
    page.getByTestId("trades").locator("tbody tr").first().locator("td").nth(1),
  ).toHaveText(homePrices["000660"]!);
  await expect(
    page.getByTestId("candle-summary").locator("tbody td").nth(3),
  ).toHaveText(homePrices["000660"]!);
  await page.getByRole("link", { name: "← 종목 탐색" }).click();
  await page.getByRole("link", { name: /NAVER.*035420/ }).click();
  await expect(page.getByTestId("last-price")).toHaveText(
    `${homePrices["035420"]}원`,
  );
  const session = await page.getByTestId("quote").getAttribute("data-session");
  await page.getByRole("button", { name: /초기화/ }).click();
  await expect(page.getByTestId("quote")).not.toHaveAttribute(
    "data-session",
    session!,
  );
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:00");
  await expect(
    page.getByRole("combobox", { name: "합성 시세 배속" }),
  ).toHaveValue("4");
  await page.getByRole("link", { name: "← 종목 탐색" }).click();
  await expect(rows).toHaveCount(5);
  const resetTimes = await rows.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-time")),
  );
  expect(new Set(resetTimes).size).toBe(1);
  expect(resetTimes[0]).not.toBe(times[0]);
  await page.screenshot({
    path: testInfo.outputPath("multi-symbol-home.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "삼성전자 선택 종목 해제" }).click();
  await page.getByRole("button", { name: "SK하이닉스 선택 종목 해제" }).click();
  await page.getByRole("button", { name: "NAVER 선택 종목 해제" }).click();
  await page.getByRole("link", { name: "선택 종목 (0)", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "선택한 종목이 없습니다" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "선택한 종목이 없습니다" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "전체 종목 보기 →" }).click();
  await expect(rows).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("period and detail tabs survive reload/back and invalid URLs normalize safely", async ({
  page,
}, testInfo) => {
  await page.goto("/stocks/005380?period=15m&tab=overview");
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  await expect(page.getByRole("heading", { name: "현대자동차" })).toBeVisible();
  await expect(page.locator(".chart-legend")).toContainText("최근 15분 · 15개");
  await page
    .getByRole("navigation", { name: "상세 화면 보기" })
    .getByRole("link", { name: "호가", exact: true })
    .click();
  await expect(page).toHaveURL(/period=15m&tab=orderbook$/);
  await expect(page.getByTestId("orderbook")).toBeVisible();
  await expect(page.locator(".price-chart")).toHaveCount(0);
  await page.reload();
  await expect(
    page
      .getByRole("navigation", { name: "상세 화면 보기" })
      .getByRole("link", { name: "호가", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("navigation", { name: "상세 화면 보기" })
    .getByRole("link", { name: "체결", exact: true })
    .click();
  await expect(page.getByTestId("trades")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("orderbook")).toBeVisible();
  await page
    .getByRole("navigation", { name: "상세 화면 보기" })
    .getByRole("link", { name: "개요", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "캔들 표시 기간" })
    .getByRole("link", { name: "최근 30분", exact: true })
    .click();
  await expect(page.locator(".chart-legend")).toContainText("최근 30분 · 30개");
  await page.reload();
  await expect(page.locator(".chart-legend")).toContainText("최근 30분 · 30개");
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  await page.screenshot({
    path: testInfo.outputPath("detail-period.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/stocks/066570?period=bad&tab=bad");
  await expect(page).toHaveURL(
    /\/stocks\/066570\?period=session&tab=overview$/,
  );
  await expect(page.getByRole("heading", { name: "LG전자" })).toBeVisible();
  await expect(page.locator(".price-chart canvas").first()).toBeVisible();
});

test("visibility listener freezes all panels, resumes without catchup, and respects manual pause", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-01-05T01:00:00Z") });
  await page.goto("/stocks/000660");
  await page
    .getByRole("combobox", { name: "합성 시세 배속" })
    .selectOption("2");
  await page.clock.runFor(1000);
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:02");
  const panels = page.locator(
    '[data-testid="quote"], [data-testid="candle-summary"], [data-testid="orderbook"], [data-testid="trades"]',
  );
  const before = await panels.allTextContents();
  const visibility = async (hidden: boolean) =>
    page.evaluate((hidden) => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => (hidden ? "hidden" : "visible"),
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  // Controlled platform event: verifies the browser listener, not OS background scheduling.
  await visibility(true);
  await page.clock.runFor(60000);
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:02");
  expect(await panels.allTextContents()).toEqual(before);
  await visibility(false);
  await page.clock.runFor(1000);
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:04");
  await page.getByRole("button", { name: "합성 시세 일시정지" }).click();
  await visibility(true);
  await visibility(false);
  await page.clock.runFor(10000);
  await expect(page.getByTestId("virtual-time")).toHaveText("09:40:04");
  await expect(
    page.getByRole("button", { name: "합성 시세 재생" }),
  ).toBeVisible();
});
