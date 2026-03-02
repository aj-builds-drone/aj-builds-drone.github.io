/**
 * Accessibility tests using axe-core
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PAGES = [
  { path: "/", name: "Home" },
  { path: "/projects/", name: "Projects" },
  { path: "/services/", name: "Services" },
  { path: "/contact/", name: "Contact" },
];

test.describe("Accessibility — axe-core", () => {
  // axe-core only supports Chromium reliably
  test.skip(({ browserName }) => browserName === "webkit", "axe-core not supported on webkit");

  for (const pg of PAGES) {
    test(`${pg.name} page has no critical a11y violations`, async ({ page }) => {
      await page.goto(pg.path);
      // Wait for hydration + framer-motion animations (longest delay: 1s + 0.5s duration)
      await page.waitForTimeout(2500);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // Exclude known decorative elements that may produce false positives
        .exclude(".scanline-overlay")
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      if (critical.length > 0) {
        const summary = critical
          .map(
            (v) =>
              `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)\n` +
              v.nodes.map((n) => `  → ${n.html.slice(0, 120)}`).join("\n")
          )
          .join("\n\n");
        console.log(`\n⚠️  ${pg.name} a11y violations:\n${summary}\n`);
      }

      expect(
        critical,
        `${pg.name} has ${critical.length} critical/serious a11y violations`
      ).toHaveLength(0);
    });

    test(`${pg.name} page has no color-contrast violations`, async ({ page }) => {
      await page.goto(pg.path);
      await page.waitForTimeout(2500);

      const results = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .exclude(".scanline-overlay")
        .analyze();

      if (results.violations.length > 0) {
        const summary = results.violations
          .map(
            (v) =>
              `${v.id}: ${v.nodes.length} instances\n` +
              v.nodes
                .map(
                  (n) =>
                    `  → fg=${(n.any?.[0]?.data as any)?.fgColor} bg=${(n.any?.[0]?.data as any)?.bgColor} ratio=${(n.any?.[0]?.data as any)?.contrastRatio} — ${n.html.slice(0, 100)}`
                )
                .join("\n")
          )
          .join("\n\n");
        console.log(`\n🎨 ${pg.name} contrast issues:\n${summary}\n`);
      }

      expect(
        results.violations,
        `${pg.name} has color-contrast violations`
      ).toHaveLength(0);
    });
  }
});

/* ─── Focus Management ─── */
test.describe("Accessibility — Focus", () => {
  test("skip-to-content link is keyboard accessible", async ({ page }) => {
    await page.goto("/");
    // Press Tab — skip link should get focus
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, href: el.getAttribute("href") } : null;
    });
    expect(focused).toBeTruthy();
    expect(focused!.href).toBe("#main");
  });

  test("interactive elements are focusable via Tab", async ({ page }) => {
    await page.goto("/");
    // Tab multiple times and verify we can reach nav links
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });
    expect(focused).toBeTruthy();
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focused);
  });
});

/* ─── ARIA ─── */
test.describe("Accessibility — ARIA", () => {
  test("nav has aria-current on active link", async ({ page }) => {
    await page.goto("/");
    const active = page.locator('nav a[aria-current="page"]');
    await expect(active).toHaveCount(1);
  });

  test("form inputs have accessible labels", async ({ page }) => {
    await page.goto("/contact/");
    const inputs = await page.locator("input, select, textarea").all();
    for (const input of inputs) {
      const type = await input.getAttribute("type");
      if (type === "hidden" || type === "submit") continue;

      const id = await input.getAttribute("id");
      const ariaLabel = await input.getAttribute("aria-label");
      const ariaLabelledBy = await input.getAttribute("aria-labelledby");
      const placeholder = await input.getAttribute("placeholder");

      // Should have at least one labeling mechanism
      const hasLabel = id
        ? (await page.locator(`label[for="${id}"]`).count()) > 0
        : false;

      expect(
        hasLabel || !!ariaLabel || !!ariaLabelledBy || !!placeholder,
        `Input ${id || type} has no accessible label`
      ).toBe(true);
    }
  });
});
