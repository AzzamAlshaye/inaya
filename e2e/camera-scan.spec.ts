import { expect, test } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { encodeTransfer } from '../src/lib/transfer';
import { openApp } from './helpers';
import { bigData, writeQrVideo } from './qr-fixtures';

// Chrome's fake camera plays a generated video of the QR codes. The browser is
// launched lazily, after beforeAll has written the video file.
test.use({ locale: 'en-US' });

const video = path.join(os.tmpdir(), `inaya-qr-${process.pid}.y4m`);
let expectedItems = 0;

test.beforeAll(async () => {
  const data = bigData();
  expectedItems = data.items.length;
  const parts = await encodeTransfer(data);
  expect(parts.length).toBeGreaterThan(1);
  await writeQrVideo(parts, video);
});

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  },
});

test('scans every part of a multi-QR export and imports it', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one camera run is enough');
  await openApp(page, '/transfer');
  await page.getByRole('button', { name: 'Scan QR code' }).click();
  await expect(page.locator('.scanner video')).toBeVisible();
  await expect(page.locator('.scan-progress')).toHaveText(/Scanned 1 of \d+ codes/, { timeout: 15000 });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`(${expectedItems} things, 36 tasks)`, { timeout: 30000 });
  await dialog.getByRole('button', { name: 'Import' }).click();
  await expect(page.locator('.item-card:not(.item-card-add)')).toHaveCount(expectedItems);
});
