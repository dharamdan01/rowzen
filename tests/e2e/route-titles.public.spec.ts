import { expect, test } from "@playwright/test";
for(const width of [320,1280]) test(`public and redirected client navigation have meaningful titles at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.route('**/api/auth/get-session*',route=>route.fulfill({contentType:'application/json',body:'null'}));
  await page.goto('/');await expect(page).toHaveTitle('CSV validation | Rowzen');
  await page.getByRole('link',{name:'Get Started',exact:true}).first().click();await expect(page).toHaveURL(/\/login$/);await expect(page).toHaveTitle('Sign in | Rowzen');
  await page.goto('/rehearsal');await expect(page).toHaveTitle('CSV demo | Rowzen');
  await page.getByRole('navigation',{name:'Demo navigation'}).getByRole('link',{name:'Rowzen',exact:true}).click();await expect(page).toHaveTitle('CSV validation | Rowzen');
  await page.goBack();await expect(page).toHaveTitle('CSV demo | Rowzen');
});
