/**
 * CSS & visual regression tests — layout, responsive, theming
 */
import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/", name: "Home" },
  { path: "/projects/", name: "Projects" },
  { path: "/services/", name: "Services" },
  { path: "/contact/", name: "Contact" },
];

/* ─── Theme & Visual Identity ─── */
test.describe("CSS — Theme Variables", () => {
  test("dark background is applied", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    // Should be very dark — r,g,b all < 30
    const match = bg.match(/rgb[a]?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    expect(match).toBeTruthy();
    expect(parseInt(match![1])).toBeLessThan(30);
    expect(parseInt(match![2])).toBeLessThan(30);
    expect(parseInt(match![3])).toBeLessThan(30);
  });

  test("primary text is light", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const h1 = page.locator("h1");
    const color = await h1.evaluate((el) => getComputedStyle(el).color);
    const match = color.match(/rgb[a]?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    expect(match).toBeTruthy();
    const max = Math.max(
      parseInt(match![1]),
      parseInt(match![2]),
      parseInt(match![3])
    );
    expect(max).toBeGreaterThan(150);
  });

  test("monospace font is applied to nav brand", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const brand = page.locator("nav").locator("span", { hasText: "AJ//DRONE" });
    const fontFamily = await brand.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toMatch(/mono|JetBrains|Courier|monospace/i);
  });
});

/* ─── Navbar ─── */
test.describe("CSS — Navbar", () => {
  test("navbar is fixed/sticky to top", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const nav = page.locator("nav").first();
    const position = await nav.evaluate((el) => getComputedStyle(el).position);
    expect(["fixed", "sticky"]).toContain(position);
  });

  test("navbar has backdrop-filter", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const nav = page.locator("nav").first();
    const filter = await nav.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.backdropFilter || (s as any).webkitBackdropFilter || "";
    });
    expect(filter).toContain("blur");
  });
});

/* ─── Responsive Layout ─── */
test.describe("CSS — Responsive: Desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const pg of PAGES) {
    test(`${pg.name} — no horizontal overflow`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
    });
  }

  test("desktop nav links are visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const desktopNav = page.locator("nav").locator("a", { hasText: "HOME" });
    await expect(desktopNav).toBeVisible();
  });

  test("mobile hamburger is hidden on desktop", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hamburger = page.locator('button[aria-label="Toggle navigation"]');
    const visible = await hamburger.isVisible();
    expect(visible).toBe(false);
  });
});

test.describe("CSS — Responsive: Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const pg of PAGES) {
    test(`${pg.name} — no horizontal overflow on mobile`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow).toBe(false);
    });
  }

  test("hamburger menu is visible on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hamburger = page.locator('button[aria-label="Toggle navigation"]');
    await expect(hamburger).toBeVisible();
  });

  test("mobile menu opens on tap", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const hamburger = page.locator('button[aria-label="Toggle navigation"]');
    await hamburger.click();
    const mobileLink = page.locator("nav a", { hasText: "HANGAR" }).last();
    await expect(mobileLink).toBeVisible({ timeout: 3000 });
  });

  test("hero headline fits within viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const h1 = page.locator("h1");
    const box = await h1.boundingBox();
    expect(box).toBeTruthy();
    // The bounding box right edge should not exceed viewport + small tolerance
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 5
    );
  });

  test("project cards are full-width on mobile", async ({ page }) => {
    await page.goto("/projects/");
    await page.waitForLoadState("networkidle");
    const cards = page.locator("article").first();
    const box = await cards.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(300);
  });
});

/* ─── Tablet ─── */
test.describe("CSS — Responsive: Tablet", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("no horizontal overflow on tablet", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(overflow).toBe(false);
  });
});

/* ─── Animation & Effects ─── */
test.describe("CSS — Animations", () => {
  test("scanline overlay exists", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const overlay = page.locator(".scanline-overlay");
    await expect(overlay).toBeAttached();
  });

  test("scanline overlay does not block interaction", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const overlay = page.locator(".scanline-overlay");
    const pe = await overlay.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).toBe("none");
  });
});

/* ─── Contact Form Styling ─── */
test.describe("CSS — Contact Form", () => {
  test("form inputs have dark background", async ({ page }) => {
    await page.goto("/contact/");
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[name="name"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    const bg = await input.evaluate((el) => getComputedStyle(el).backgroundColor);
    const match = bg.match(/rgb[a]?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    expect(match).toBeTruthy();
    expect(parseInt(match![1])).toBeLessThan(40);
  });

  test("form has select dropdowns", async ({ page }) => {
    await page.goto("/contact/");
    await page.waitForLoadState("networkidle");
    const select = page.locator("select").first();
    await expect(select).toBeVisible({ timeout: 10000 });
    const selects = page.locator("select");
    expect(await selects.count()).toBeGreaterThanOrEqual(2);
  });
});
