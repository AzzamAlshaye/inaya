import { expect, test } from '@playwright/test';
import { encodeTransfer } from '../src/lib/transfer';
import { addItem, openApp } from './helpers';
import { bigData } from './qr-fixtures';

test.use({ locale: 'en-US' });

test.describe('Move to another phone', () => {
  test('send screen shows QR code(s), text code and copy works', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page);
    await addItem(page, 'Car', 'Camry');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: /Move to another phone/ }).click();
    await expect(page.locator('h1')).toHaveText('Move to another phone');
    // One car with its full preset fits in a single QR code.
    await expect(page.getByRole('img', { name: 'QR code 1 of 1 containing your data' })).toBeVisible();
    await expect(page.locator('.qr-caption')).toHaveCount(0);
    await expect(page.locator('.qr-image svg')).toBeVisible();
    const code = await page.getByLabel('Text code').first().inputValue();
    expect(code).toMatch(/^INAYA1\.1\.1\./);
    await page.getByRole('button', { name: 'Copy code' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Code copied' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  });

  test('multi-part QR cycles automatically and can be paused / stepped', async ({ page }) => {
    await openApp(page);
    const [code] = await encodeTransfer(bigData(), Infinity);
    // Load the big dataset through the paste flow, then open the send screen.
    await page.goto('./#/transfer');
    await page.getByRole('textbox', { name: 'Text code' }).nth(1).fill(code);
    await page.getByRole('button', { name: 'Import' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.goto('./#/transfer');
    const caption = page.locator('.qr-caption');
    await expect(caption).toHaveText(/Code 1 of [2-9]/);
    await expect(caption).toHaveText(/Code 2 of/, { timeout: 4000 });
    await page.getByRole('button', { name: 'Pause' }).click();
    const paused = await caption.textContent();
    await page.waitForTimeout(2000);
    await expect(caption).toHaveText(paused!);
    await page.getByRole('button', { name: 'Next code' }).click();
    await expect(caption).not.toHaveText(paused!);
  });

  test('paste a text code: confirm, import, keep own settings, undo', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Garden', 'Backyard');
    await page.goto('./#/transfer');
    const code = await page.getByRole('textbox', { name: 'Text code' }).first().inputValue();
    // Simulate a different phone: erase, set dark mode, then paste.
    await page.goto('./#/settings');
    await page.getByRole('button', { name: 'Erase all data' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Erase all data' }).click();
    await page.getByText('Dark', { exact: true }).click();
    await page.goto('./#/transfer');
    await page.getByRole('textbox', { name: 'Text code' }).nth(1).fill(code);
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByRole('dialog')).toContainText('(1 things, 9 tasks)');
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await expect(page.locator('h1')).toHaveText('My routines');
    await expect(page.getByRole('link', { name: /Backyard/ })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Nothing tracked yet')).toBeVisible();
  });

  test('invalid or incomplete code shows an error', async ({ page }) => {
    await openApp(page, '/transfer');
    const paste = page.getByRole('textbox', { name: 'Text code' }).nth(1);
    await paste.fill('INAYA1.1.3.abcde.AAAA');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByRole('alert')).toHaveText('This code is not complete or not valid.');
    await paste.fill('hello world');
    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('camera denied shows a helpful message', async ({ page }) => {
    await openApp(page, '/transfer');
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await page.getByRole('button', { name: 'Scan QR code' }).click();
    await expect(page.getByRole('alert')).toContainText('camera could not be opened');
  });
});
