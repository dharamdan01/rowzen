import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { TestInfo } from "@playwright/test";

/** Keep explicit before/after captures across separate Playwright runs. */
export function refinementScreenshot(info: TestInfo, filename: string) {
  const stage = process.env.PHASE9_SCREENSHOT_STAGE;
  if (!stage) return info.outputPath(filename);
  const folder = resolve("playwright/.cache/phase9-refinement", stage, info.title.replace(/[^a-zA-Z0-9-]/g, "_"));
  mkdirSync(folder, { recursive: true });
  return resolve(folder, filename);
}
