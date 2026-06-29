import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Rect = { x: number; y: number; width: number; height: number };

const webDir = path.resolve(__dirname, "..");
const publicLocales = readPublicLocales();
const mobileViewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 680, height: 844 },
  { width: 920, height: 844 },
] as const;

let server: http.Server;
let baseUrl: string;

test.beforeAll(async () => {
  ({ server, baseUrl } = await startLandingServer());
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

for (const viewport of mobileViewports) {
  test(`mobile mascot is visible and clear of the title at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const locale of publicLocales) {
      await test.step(locale, async () => {
        await page.goto(landingPath(locale));
        await expect(page.locator(".hero-mascot")).toBeVisible();
        await expect(page.locator("#page-title")).toBeVisible();

        const [mascotBox, titleFigureBox, heroBox, accentRects, titleTextRects] = await Promise.all([
          requiredBox(page, ".hero-mascot"),
          requiredBox(page, ".title-figure"),
          requiredBox(page, ".hero"),
          clientRects(page, ".title-accent"),
          clientRects(page, ".title-accent, .title-w-the:not(:empty), .title-line2:not(:empty)"),
        ]);

        expect(mascotBox.width, `${locale} mascot width`).toBeGreaterThan(0);
        expect(mascotBox.height, `${locale} mascot height`).toBeGreaterThan(0);
        expect(accentRects.length, `${locale} title accent rects`).toBeGreaterThan(0);
        expect(
          maxIntersectionHeight(mascotBox, accentRects),
          `${locale} mascot should share the accent line plane`,
        ).toBeGreaterThan(Math.min(10, mascotBox.height * 0.2));
        for (const rect of titleTextRects) {
          expect(intersectionArea(mascotBox, rect), `${locale} mascot/title text overlap`).toBeLessThanOrEqual(1);
        }
        expect(
          mascotBox.y,
          `${locale} mascot should stay in the upper half of the hero`,
        ).toBeLessThan(heroBox.y + heroBox.height / 2);

        const direction = await page.locator("html").evaluate((html) => getComputedStyle(html).direction);
        const titleFigureMidpoint = titleFigureBox.x + titleFigureBox.width / 2;
        const mascotMidpoint = mascotBox.x + mascotBox.width / 2;

        if (direction === "rtl") {
          expect(mascotMidpoint, `${locale} mascot logical-end alignment`).toBeLessThan(titleFigureMidpoint);
          expect(Math.abs(mascotBox.x - titleFigureBox.x), `${locale} mascot inline-end gap`).toBeLessThanOrEqual(1.5);
        } else {
          expect(mascotMidpoint, `${locale} mascot logical-end alignment`).toBeGreaterThan(titleFigureMidpoint);
          expect(
            Math.abs(titleFigureBox.x + titleFigureBox.width - (mascotBox.x + mascotBox.width)),
            `${locale} mascot inline-end gap`,
          ).toBeLessThanOrEqual(1.5);
        }

        await expect(page.locator(".hero-mascot")).toHaveJSProperty("complete", true);
      });
    }
  });
}

test("desktop mascot keeps the existing production-sized layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  for (const locale of publicLocales) {
    await test.step(locale, async () => {
      await page.goto(landingPath(locale));
      await expect(page.locator(".hero-mascot")).toBeVisible();

      const mascotBox = await requiredBox(page, ".hero-mascot");
      expect(mascotBox.width, `${locale} desktop mascot width`).toBeGreaterThanOrEqual(300);
      expect(mascotBox.height, `${locale} desktop mascot height`).toBeGreaterThanOrEqual(300);

      const frameStyle = await page.locator(".hero-mascot-frame").evaluate((frame) => {
        const style = getComputedStyle(frame);
        return {
          transform: style.transform,
        };
      });

      expect(frameStyle.transform, `${locale} desktop frame transform`).not.toBe("none");
    });
  }
});

function readPublicLocales(): string[] {
  const source = fs.readFileSync(path.join(webDir, "modules", "i18n", "index.ts"), "utf8");
  const match = source.match(/export const PUBLIC_LOCALES = \[([^\]]+)\] as const;/);
  if (!match) {
    throw new Error("Cannot locate PUBLIC_LOCALES in modules/i18n/index.ts");
  }
  return [...match[1].matchAll(/"([^"]+)"/g)].map((locale) => locale[1]);
}

function landingPath(locale: string): string {
  return locale === "en" ? `${baseUrl}/` : `${baseUrl}/${locale}/`;
}

async function requiredBox(page: Page, selector: string): Promise<Rect> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`Expected ${selector} to have a layout box`);
  }
  return box;
}

async function clientRects(page: Page, selector: string): Promise<Rect[]> {
  return page.locator(selector).evaluateAll((elements) => elements.flatMap((element) =>
    Array.from(element.getClientRects()).map((rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })),
  ).filter((rect) => rect.width > 0 && rect.height > 0));
}

function intersectionArea(a: Rect, b: Rect): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function maxIntersectionHeight(a: Rect, rects: Rect[]): number {
  return Math.max(0, ...rects.map((rect) => {
    const top = Math.max(a.y, rect.y);
    const bottom = Math.min(a.y + a.height, rect.y + rect.height);
    return Math.max(0, bottom - top);
  }));
}

async function startLandingServer(): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const filePath = resolveRequestPath(requestUrl.pathname);

    if (!filePath) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "content-type": contentType(filePath),
        "cache-control": "no-store",
      });
      response.end(content);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected local landing test server to bind to a TCP port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

function resolveRequestPath(pathname: string): string | null {
  const normalizedPath = decodeURIComponent(pathname);
  if (normalizedPath === "/" || normalizedPath === "/index.html") {
    return path.join(webDir, "landing.html");
  }

  const localeMatch = normalizedPath.match(/^\/([a-z]{2})\/?$/);
  if (localeMatch && publicLocales.includes(localeMatch[1]) && localeMatch[1] !== "en") {
    return path.join(webDir, "landing.locales", `${localeMatch[1]}.html`);
  }

  const relativePath = normalizedPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(webDir, relativePath);
  const relativeToWeb = path.relative(webDir, resolvedPath);
  if (relativeToWeb.startsWith("..") || path.isAbsolute(relativeToWeb)) {
    return null;
  }
  return resolvedPath;
}

function contentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    case ".ttf":
      return "font/ttf";
    default:
      return "application/octet-stream";
  }
}
