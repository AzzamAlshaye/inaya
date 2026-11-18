import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addItem, openApp, setDue } from './helpers';

/** Seed one item with an overdue, a due-soon and a done task so every UI state renders. */
async function seed(page: Page, lang: 'en' | 'ar') {
  const car = lang === 'ar' ? 'سيارة' : 'Car';
  await addItem(page, car, lang === 'ar' ? 'كامري' : 'Camry');
  await setDue(page, lang === 'ar' ? 'غسيل السيارة' : 'Car wash', '2026-06-01');
  await setDue(page, lang === 'ar' ? 'فحص البطارية' : 'Battery check', '2026-06-18');
}

const pages = ['/', '/add', '/presets', '/presets/garden', '/settings', '/transfer'];

for (const [locale, lang] of [['en-US', 'en'], ['ar-SA', 'ar']] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${lang} / ${scheme}`, () => {
      test.use({ locale, colorScheme: scheme });

      test('axe: no accessibility violations on any screen', async ({ page }) => {
        await openApp(page);
        await seed(page, lang);
        const itemUrl = page.url().split('#')[1];
        const taskLink = page.locator('.task-card .stretched-link').first();
        await taskLink.click();
        const taskUrl = page.url().split('#')[1];
        for (const path of [...pages, itemUrl, taskUrl]) {
          await page.goto(`./#${path}`);
          await expect(page.locator('h1')).toBeVisible();
          const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          const summary = results.violations.map(
            (v) => `${path} ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`,
          );
          expect(summary, summary.join('\n')).toEqual([]);
        }
        // Dialogs too.
        await page.goto(`./#${itemUrl}`);
        await page.locator('.btn-done').first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        const dlg = await new AxeBuilder({ page }).include('dialog[open]').analyze();
        expect(dlg.violations.map((v) => v.id)).toEqual([]);
      });

      test('no horizontal scrolling at 320px wide', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 700 });
        await openApp(page);
        await seed(page, lang);
        for (const path of [...pages, page.url().split('#')[1]]) {
          await page.goto(`./#${path}`);
          await expect(page.locator('h1')).toBeVisible();
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow, `overflow on ${path}`).toBeLessThanOrEqual(0);
        }
      });
    });
  }
}

test.describe('Arabic & RTL', () => {
  test.use({ locale: 'ar-SA' });

  test('device Arabic → RTL layout with Arabic text', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('h1')).toHaveText('مهامي الدورية');
    await expect(page.getByRole('navigation')).toContainText('الرئيسية');
  });

  test('back arrow is mirrored in RTL', async ({ page }) => {
    await openApp(page, '/add');
    const transform = await page.locator('.back-btn svg').evaluate((el) => getComputedStyle(el).transform);
    expect(transform).toBe('matrix(-1, 0, 0, 1, 0, 0)');
  });

  test('Arabic interval and relative dates read naturally', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'سيارة', 'كامري');
    const card = page.locator('.task-card', { hasText: 'تغيير الزيت والفلتر' });
    await expect(card).toContainText('كل 6 أشهر');
    await expect(page.locator('.task-card', { hasText: 'فحص ضغط الإطارات' })).toContainText('كل شهر');
  });

  test('switching to English in settings overrides the device language', async ({ page }) => {
    await openApp(page, '/settings');
    await page.getByText('English', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1')).toHaveText('Settings');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Settings');
    await page.getByText('Device default').first().click();
    await expect(page.locator('h1')).toHaveText('الإعدادات');
  });
});

test.describe('Keyboard & screen reader behaviour', () => {
  test.use({ locale: 'en-US' });

  test('skip link moves focus to main content', async ({ page }) => {
    await openApp(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('page heading receives focus after navigation', async ({ page }) => {
    await openApp(page);
    await page.getByRole('link', { name: 'Presets' }).click();
    await expect(page.locator('h1')).toBeFocused();
  });

  test('dialog traps focus, closes with Escape and returns focus', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    const doneBtn = page.locator('.btn-done').first();
    await doneBtn.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(doneBtn).toBeFocused();
  });

  test('preset, icon and option pickers are keyboard operable', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Garden' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Watering/ })).toBeVisible();
  });

  test('toast messages are announced via a live region', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    const region = page.locator('.toast-region');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toContainText('“Luna” added');
  });

  test('interactive targets are at least 44×44 px', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Car', 'Camry');
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main button, main a, nav a, main select, main input:not(.visually-hidden)')]
        .filter((el) => el.offsetParent !== null && !el.classList.contains('stretched-link'))
        .map((el) => ({ el: el.outerHTML.slice(0, 80), ...el.getBoundingClientRect().toJSON() }))
        .filter((r) => r.width < 44 || r.height < 44),
    );
    expect(small).toEqual([]);
  });

  test('status is conveyed by text, not colour alone', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Car', 'Camry');
    await setDue(page, 'Car wash', '2026-06-01');
    await expect(page.locator('.task-card', { hasText: 'Car wash' }).locator('.badge')).toHaveText('Overdue');
  });
});
