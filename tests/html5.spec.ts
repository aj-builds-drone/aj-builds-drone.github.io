/**
 * HTML5 validation, semantic structure, and content tests
 */
import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/", title: "AJ Builds Drone" },
  { path: "/projects/", title: "Hangar" },
  { path: "/services/", title: "Service" },
  { path: "/contact/", title: "AJ Builds Drone" },
];

/* ─── HTML5 Document Structure ─── */
test.describe("HTML5 — Document Structure", () => {
  for (const page of PAGES) {
    test(`${page.path} has <html lang>`, async ({ page: p }) => {
      await p.goto(page.path);
      const lang = await p.locator("html").getAttribute("lang");
      expect(lang).toBeTruthy();
    });

    test(`${page.path} has valid <title>`, async ({ page: p }) => {
      await p.goto(page.path);
      const title = await p.title();
      expect(title.length).toBeGreaterThan(5);
      expect(title).toContain(page.title);
    });

    test(`${page.path} has <meta charset>`, async ({ page: p }) => {
      await p.goto(page.path);
      const charset = await p.locator('meta[charset]').count();
      const charsetHttp = await p.locator('meta[http-equiv="Content-Type"]').count();
      expect(charset + charsetHttp).toBeGreaterThanOrEqual(1);
    });

    test(`${page.path} has <meta viewport>`, async ({ page: p }) => {
      await p.goto(page.path);
      const viewport = await p.locator('meta[name="viewport"]').getAttribute("content");
      expect(viewport).toContain("width=device-width");
    });

    test(`${page.path} has <meta description>`, async ({ page: p }) => {
      await p.goto(page.path);
      const desc = await p.locator('meta[name="description"]').getAttribute("content");
      expect(desc).toBeTruthy();
      expect(desc!.length).toBeGreaterThan(20);
    });
  }
});

/* ─── HTML5 — Semantic Landmarks ─── */
test.describe("HTML5 — Semantic Landmarks", () => {
  for (const page of PAGES) {
    test(`${page.path} has <nav>`, async ({ page: p }) => {
      await p.goto(page.path);
      await expect(p.locator("nav")).toBeVisible();
    });

    test(`${page.path} has <main>`, async ({ page: p }) => {
      await p.goto(page.path);
      const main = p.locator("main");
      await expect(main).toHaveCount(1);
    });

    test(`${page.path} has <footer>`, async ({ page: p }) => {
      await p.goto(page.path);
      await expect(p.locator("footer")).toBeVisible();
    });

    test(`${page.path} has exactly one <h1>`, async ({ page: p }) => {
      await p.goto(page.path);
      const h1Count = await p.locator("h1").count();
      expect(h1Count).toBe(1);
    });
  }
});

/* ─── HTML5 — Heading Hierarchy ─── */
test.describe("HTML5 — Heading Hierarchy", () => {
  for (const page of PAGES) {
    test(`${page.path} headings follow hierarchy (no skipping levels)`, async ({ page: p }) => {
      await p.goto(page.path);
      const headings = await p.locator("h1, h2, h3, h4, h5, h6").all();
      let lastLevel = 0;
      for (const heading of headings) {
        const tag = await heading.evaluate((el) => el.tagName.toLowerCase());
        const level = parseInt(tag.replace("h", ""));
        // Can go deeper by 1 or go back up to any level
        if (lastLevel > 0) {
          expect(level).toBeLessThanOrEqual(lastLevel + 1);
        }
        lastLevel = level;
      }
    });
  }
});

/* ─── HTML5 — Images ─── */
test.describe("HTML5 — Image Alt Text", () => {
  for (const page of PAGES) {
    test(`${page.path} all <img> have alt attribute`, async ({ page: p }) => {
      await p.goto(page.path);
      const images = await p.locator("img").all();
      for (const img of images) {
        const alt = await img.getAttribute("alt");
        expect(alt, `Image missing alt: ${await img.getAttribute("src")}`).not.toBeNull();
      }
    });
  }
});

/* ─── HTML5 — Links ─── */
test.describe("HTML5 — Links", () => {
  test("external links have rel=noopener", async ({ page }) => {
    await page.goto("/");
    const extLinks = await page.locator('a[target="_blank"]').all();
    for (const link of extLinks) {
      const rel = await link.getAttribute("rel");
      expect(rel).toContain("noopener");
    }
  });

  test("skip-to-content link exists", async ({ page }) => {
    await page.goto("/");
    const skip = page.locator('a[href="#main"]');
    await expect(skip).toHaveCount(1);
  });
});

/* ─── HTML5 — JSON-LD ─── */
test.describe("HTML5 — Structured Data", () => {
  test("homepage has valid JSON-LD", async ({ page }) => {
    await page.goto("/");
    const jsonld = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonld).toBeTruthy();
    const parsed = JSON.parse(jsonld!);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@graph"]).toBeDefined();
  });
});
