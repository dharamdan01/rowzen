import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import HomePage, { metadata } from "../../src/app/page";
import screenshots from "../../public/landing/screenshots.json";

describe("product-led landing page",()=>{
 it("provides complete content, valid section targets and real existing destinations",()=>{
  const html=renderToStaticMarkup(createElement(HomePage));
  expect((html.match(/<h1[ >]/g)||[])).toHaveLength(1);
  expect(html).toContain('Catch data issues before import.');
  for(const target of ['landing-main','features','how-it-works','privacy','product-preview'])expect(html).toContain(`id="${target}"`);
  for(const href of ['/dashboard','/login','/rehearsal'])expect(html).toContain(`href="${href}"`);
  expect(html).not.toContain('href="/privacy"');expect(html).not.toContain('href="/docs"');
  expect(html).toContain('Saved summaries are not CSV backups');expect(html).toContain('Preflight validation, not a database import');
 });
 it("states AI, consent and database-execution boundaries without invented proof",()=>{
  const html=renderToStaticMarkup(createElement(HomePage));
  for(const text of ["Demo capture · sample CSV data","AI advice never replaces validation","Database record exports require your explicit consent","does not connect to your target database or execute imports","Passing configured checks does not guarantee"])expect(html).toContain(text);
  expect(metadata.description).toContain("preflight");
  expect(metadata.openGraph).toMatchObject({type:"website"});
  expect(html).not.toMatch(/trusted by|100%|href="https?:/i);
 });
 it("keeps preview controls and panels associated without fake live editing",()=>{
  const html=renderToStaticMarkup(createElement(HomePage));
  for(const id of ['results','dependencies','corrections']){
   expect(html).toContain(`aria-controls="preview-panel-${id}"`);expect(html).toContain(`id="preview-panel-${id}"`);expect(html).toContain(`aria-labelledby="preview-tab-${id}"`);
  }
  expect(html).toContain('Actual interface screenshots with sample data.');expect(html).toContain('use the app to edit your own files.');
 });
 it("ships lossless real screenshot assets for both themes and device layouts",()=>{
  for(const variants of Object.values(screenshots))for(const image of Object.values(variants)){
   expect(image.width).toBeGreaterThan(250);expect(image.height).toBeGreaterThan(200);expect(existsSync(`public${image.src}`)).toBe(true);
   const bytes=readFileSync(`public${image.src}`);expect(bytes.subarray(0,4).toString()).toBe('RIFF');expect(bytes.subarray(8,12).toString()).toBe('WEBP');
  }
 });
});
