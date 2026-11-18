import { expect, type Page } from '@playwright/test';

export const TODAY = '2026-06-15';

/** Freeze the clock so due-date maths is deterministic, then open the app. */
export async function openApp(page: Page, path = '/') {
  await page.clock.setFixedTime(new Date(`${TODAY}T10:00:00`));
  await page.goto(`./#${path}`);
  await expect(page.locator('h1')).toBeVisible();
}

/** Create an item from a preset through the UI. */
export async function addItem(page: Page, presetName: RegExp | string, name: string, uncheck: string[] = []) {
  await page.goto('./#/add');
  await page.getByRole('radio', { name: presetName }).check({ force: true });
  await page.getByRole('textbox').first().fill(name);
  // Suggestions are opt-in: add them all, then remove the ones not wanted.
  await addAllSuggestions(page);
  for (const task of uncheck) await page.getByRole('checkbox', { name: task, exact: true }).uncheck({ force: true });
  await page.getByRole('button', { name: /^(Create|إنشاء)$/ }).click();
  await expect(page.locator('h1')).toHaveText(name);
}

/** Set a task's next due date from its edit page. */
export async function setDue(page: Page, taskName: string, iso: string) {
  await page.getByRole('link', { name: taskName, exact: true }).click();
  await page.getByLabel(/Next due date|الموعد القادم/).fill(iso);
  await page.getByRole('button', { name: /^(Save|حفظ)$/ }).click();
}

/** Tap "Add all" in the suggestions list of the add flow (if the preset has any). */
export async function addAllSuggestions(page: Page) {
  const addAll = page.getByRole('button', { name: /^(Add all|إضافة الكل)$/ });
  if (await addAll.count()) await addAll.click();
}
