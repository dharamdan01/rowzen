import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "@playwright/test";
import { Button, Card, Input, Select, Table } from "../../src/components/ui/primitives";

function contrast(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

// Render the real primitives against Next's compiled stylesheet without adding
// a production showcase route or requiring authentication/database fixtures.
const fixture = renderToStaticMarkup(h(Card, { "aria-label": "Design system" },
  h("h2", null, "Shared controls"),
  h("div", { style: { display: "flex", flexWrap: "wrap", gap: 12, marginBlock: 16 } },
    h(Button, { variant: "primary", type: "button" }, "Primary action"),
    h(Button, { type: "button" }, "Secondary action"),
    h(Button, { variant: "danger", type: "button" }, "Danger action"),
    h(Button, { variant: "primary", disabled: true }, "Unavailable action")),
  h(Input, { "aria-label": "Dataset name", defaultValue: "students" }),
  h(Select, { "aria-label": "Column type", defaultValue: "string", style: { marginBlock: 12 } },
    h("option", { value: "string" }, "String")),
  h(Input, { "aria-label": "Invalid value", "aria-invalid": true, "aria-describedby": "invalid-help" }),
  h("p", { id: "invalid-help" }, "Check this value."),
  h(Input, { "aria-label": "Unavailable field", disabled: true, defaultValue: "Unavailable" }),
  h(Table, { scrollLabel: "Sample records", style: { minWidth: 800 } },
    h("caption", null, "Synthetic records"),
    h("thead", null, h("tr", null, h("th", { scope: "col" }, "Dataset"), h("th", { scope: "col" }, "Records"))),
    h("tbody", null, h("tr", null, h("th", { scope: "row" }, "Students"), h("td", null, "120"))))));

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  const shell = await page.evaluate(() => ({
    styles: Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((node) => node.outerHTML).join(""),
    fontClass: document.documentElement.className,
  }));
  await page.setContent(`<!doctype html><html lang="en" class="${shell.fontClass}"><head>${shell.styles}</head><body style="padding:16px">${fixture}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
});

for (const width of [360, 768, 1280]) {
  test(`shared controls and table contain overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const card = page.getByRole("region", { name: "Design system" });
    await expect(card).toHaveCSS("padding-left", width < 640 ? "16px" : "24px");
    for (const control of [page.getByRole("button", { name: "Primary action", exact: true }), page.getByLabel("Dataset name"), page.getByLabel("Column type")]) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(control).toHaveCSS("border-radius", "8px");
    }
    const scroll = page.getByRole("region", { name: "Sample records" });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    await expect(scroll).toHaveCSS("overflow-x", "auto");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("primitives.png"), fullPage: true });
  });
}

test("compiled control colors retain contrast across hover, focus, invalid and disabled states", async ({ page }) => {
  const primary = page.getByRole("button", { name: "Primary action", exact: true });
  await page.keyboard.press("Tab");
  await expect(primary).toBeFocused();
  await expect(primary).toHaveCSS("outline-style", "solid");
  await expect(primary).toHaveCSS("outline-width", "2px");
  for (const name of ["Primary action", "Secondary action", "Danger action"]) {
    const button = page.getByRole("button", { name, exact: true });
    for (const hovered of [false, true]) {
      if (hovered) await button.hover();
      // Wait for the shared color transition before measuring.
      if (hovered && name === "Primary action") await expect(button).toHaveCSS("background-color", "rgb(68, 56, 176)");
      const colors = await button.evaluate((node) => {
        const style = getComputedStyle(node);
        return { foreground: style.color, background: style.backgroundColor };
      });
      expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    }
  }
  const field = page.getByLabel("Dataset name");
  const boundary = await field.evaluate((node) => {
    const style = getComputedStyle(node);
    return { border: style.borderTopColor, background: style.backgroundColor };
  });
  expect(contrast(boundary.border, boundary.background)).toBeGreaterThanOrEqual(3);
  const invalid = page.getByLabel("Invalid value");
  await invalid.hover();
  await expect(invalid).toHaveCSS("border-color", "rgb(180, 35, 24)");
  await expect(invalid).toHaveAttribute("aria-describedby", "invalid-help");
  const disabled = page.getByRole("button", { name: "Unavailable action" });
  await disabled.hover({ force: true });
  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveCSS("background-color", "rgb(81, 69, 205)");
  await expect(page.getByLabel("Unavailable field")).toHaveCSS("background-color", "rgb(243, 244, 246)");
  const font = await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily);
  expect(font.toLowerCase()).toContain("geist");
});
