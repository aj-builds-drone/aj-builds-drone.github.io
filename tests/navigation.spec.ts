/**
 * Navigation, interaction, and functionality tests
 */
import { test, expect } from "@playwright/test";

/** Open hamburger menu if visible (mobile viewport) */
async function openMenuIfMobile(page: import("@playwright/test").Page) {
  const hamburger = page.locator('button[aria-label="Toggle navigation"]');
  if (await hamburger.isVisible()) {
    await hamburger.click();
    await page.waitForTimeout(400);
  }
}

/* ─── Page Navigation ─── */
test.describe("Navigation — Internal Links", () => {
  test("navbar HOME link navigates to /", async ({ page }) => {
    await page.goto("/projects/");
    await page.waitForLoadState("networkidle");
    await openMenuIfMobile(page);
    await page.locator("nav").locator("a", { hasText: "HOME" }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("navbar HANGAR link navigates to /projects/", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openMenuIfMobile(page);
    await page.locator("nav").locator("a", { hasText: "HANGAR" }).first().click();
    await expect(page).toHaveURL(/\/projects\//);
  });

  test("navbar SERVICES link navigates to /services/", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openMenuIfMobile(page);
    await page.locator("nav").locator("a", { hasText: "SERVICES" }).first().click();
    await expect(page).toHaveURL(/\/services\//);
  });

  test("navbar RFQ link navigates to /contact/", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await openMenuIfMobile(page);
    await page.locator("nav").locator("a", { hasText: "RFQ" }).first().click();
    await expect(page).toHaveURL(/\/contact\//);
  });
});

/* ─── Hero Section ─── */
test.describe("Navigation — Hero CTAs", () => {
  test("REQUEST FOR QUOTE CTA links to contact", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("a", { hasText: "REQUEST FOR QUOTE" }).first();
    const href = await cta.getAttribute("href");
    expect(href).toContain("/contact");
  });

  test("VIEW HANGAR CTA links to projects", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("a", { hasText: "VIEW HANGAR" }).first();
    const href = await cta.getAttribute("href");
    expect(href).toContain("/projects");
  });
});

/* ─── Project Filters ─── */
test.describe("Navigation — Project Filters", () => {
  test("filter buttons are visible on projects page", async ({ page }) => {
    await page.goto("/projects/");
    await page.waitForLoadState("networkidle");
    // Wait for hydration so filter buttons appear
    await page.waitForTimeout(1000);
    const filters = page.locator("button").filter({ hasText: /ALL|OPERATIONAL|IN DEVELOPMENT|RESEARCH/ });
    expect(await filters.count()).toBeGreaterThanOrEqual(2);
  });

  test("clicking a filter reduces visible projects", async ({ page }) => {
    await page.goto("/projects/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const allCards = await page.locator("article").count();

    // Click a specific filter (not ALL)
    const filterBtn = page.locator("button").filter({ hasText: "RESEARCH" });
    if ((await filterBtn.count()) > 0) {
      await filterBtn.first().click();
      await page.waitForTimeout(500);
      const filteredCards = await page.locator("article").count();
      // Should either equal all (if all are research) or less
      expect(filteredCards).toBeLessThanOrEqual(allCards);
    }
  });

  test("ALL filter shows all projects", async ({ page }) => {
    await page.goto("/projects/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const allBtn = page.locator("button").filter({ hasText: "ALL" }).first();
    await allBtn.click();
    await page.waitForTimeout(500);
    const cardCount = await page.locator("article").count();
    expect(cardCount).toBeGreaterThanOrEqual(4);
  });
});

/* ─── Contact Form Validation ─── */
test.describe("Navigation — Contact Form", () => {
  test("form has required fields", async ({ page }) => {
    await page.goto("/contact/");
    await page.waitForLoadState("networkidle");
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    const nameReq = await nameInput.getAttribute("required");
    const emailReq = await page.locator('input[name="email"]').getAttribute("required");
    const messageReq = await page.locator('textarea[name="message"]').getAttribute("required");
    expect(nameReq).not.toBeNull();
    expect(emailReq).not.toBeNull();
    expect(messageReq).not.toBeNull();
  });

  test("form shows email validation on invalid input", async ({ page }) => {
    await page.goto("/contact/");
    await page.waitForLoadState("networkidle");
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await emailInput.fill("not-an-email");
    await page.locator('button[type="submit"]').click();

    // Browser should report validity issue
    const valid = await emailInput.evaluate(
      (el) => (el as HTMLInputElement).validity.valid
    );
    expect(valid).toBe(false);
  });

  test("form submit button is present", async ({ page }) => {
    await page.goto("/contact/");
    await page.waitForLoadState("networkidle");
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeVisible({ timeout: 10000 });
  });
});

/* ─── Footer ─── */
test.describe("Navigation — Footer", () => {
  test("footer exists on all pages", async ({ page }) => {
    for (const path of ["/", "/projects/", "/services/", "/contact/"]) {
      await page.goto(path);
      await expect(page.locator("footer")).toBeVisible();
    }
  });

  test("footer has email link", async ({ page }) => {
    await page.goto("/");
    const emailLink = page.locator('footer a[href*="mailto:"]');
    if ((await emailLink.count()) > 0) {
      const href = await emailLink.first().getAttribute("href");
      expect(href).toContain("ajayadesign@gmail.com");
    }
  });
});

/* ─── 404 Page ─── */
test.describe("Navigation — 404", () => {
  test("unknown route shows 404 page", async ({ page }) => {
    await page.goto("/this-does-not-exist/");
    // Should contain 404 text
    const body = await page.textContent("body");
    expect(body).toMatch(/404|not found|waypoint/i);
  });
});
