import { expect, test } from '@playwright/test';
import { addAllSuggestions, addItem, openApp, setDue } from './helpers';

test.use({ locale: 'en-US' });

test.describe('Items & presets flow', () => {
  test('empty state leads to the add flow', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('heading', { name: 'Nothing tracked yet' })).toBeVisible();
    await page.getByRole('link', { name: 'Add something to track' }).click();
    await expect(page.locator('h1')).toHaveText('Add something to track');
  });

  test('car preset creates the selected tasks only', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Car', 'Camry', ['Car wash']);
    // 12 car tasks minus the unchecked one.
    await expect(page.locator('.task-card')).toHaveCount(11);
    await expect(page.getByRole('link', { name: 'Oil & filter change' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Car wash' })).toHaveCount(0);
  });

  test('suggestions are opt-in: nothing is added unless chosen', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Garden' }).check({ force: true });
    const main = page.locator('.suggest-row input[type=checkbox]');
    await expect(main.and(page.locator(':checked'))).toHaveCount(0);
    await expect(page.getByText('Tasks to add: 0')).toBeVisible();
    await page.locator('.suggest-row', { hasText: 'Watering' }).click();
    await expect(page.getByText('Tasks to add: 1')).toBeVisible();
    await page.getByRole('button', { name: 'Add all' }).click();
    await expect(main.and(page.locator(':not(:checked)'))).toHaveCount(0);
    await page.getByRole('button', { name: 'Remove all' }).click();
    await expect(main.and(page.locator(':checked'))).toHaveCount(0);
    // Creating with nothing chosen gives an empty item with suggestions offered.
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('No tasks yet')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Suggested tasks' })).toBeVisible();
  });

  test('add your own task in the add flow, and remove it again', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).check({ force: true });
    const own = page.locator('.own-task');
    await own.getByLabel('Task name').fill('Wiper blades');
    await own.getByLabel('Amount').fill('9');
    await own.getByRole('button', { name: 'Add this task' }).click();
    await own.getByLabel('Task name').fill('Tint check');
    await own.getByLabel('Task name').press('Enter');
    await expect(page.getByText('Tasks to add: 2')).toBeVisible();
    await page.getByRole('button', { name: 'Remove Tint check' }).click();
    await own.getByRole('button', { name: 'Add this task' }).click();
    await expect(own.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('.task-card')).toHaveCount(1);
    await expect(page.locator('.task-card', { hasText: 'Wiper blades' })).toContainText('Every 9 months');
  });

  test('suggestions on the item screen add a task with one tap', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna', ['Grooming', 'Vaccinations']);
    const section = page.locator('.suggestions');
    await expect(section.locator('.suggest-row')).toHaveCount(2);
    await section.getByRole('button', { name: /^Add\W+Grooming$/ }).click();
    await expect(page.getByRole('status')).toContainText('“Grooming” added');
    await expect(page.locator('.task-card', { hasText: 'Grooming' })).toContainText('Next due: Jul 15, 2026');
    await expect(section.locator('.suggest-row')).toHaveCount(1);
    await section.getByRole('button', { name: /^Add\W+Vaccinations$/ }).click();
    await expect(page.locator('.suggestions')).toHaveCount(0);
  });

  test('long suggestion lists show 4 first, then "Show all"', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).check({ force: true });
    await page.locator('.suggest-row', { hasText: 'Car wash' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    const rows = page.locator('.suggestions .suggest-row');
    await expect(rows).toHaveCount(4);
    await page.getByRole('button', { name: 'Show all suggestions (11)' }).click();
    await expect(rows).toHaveCount(11);
  });

  test('the field being typed in is scrolled into view', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 500 });
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).check({ force: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    const field = page.locator('.own-task').getByLabel('Task name');
    await field.focus();
    await expect(field).toBeInViewport({ ratio: 1 });
  });

  test('blank name falls back to the preset name', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Garden' }).check({ force: true });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('h1')).toHaveText('Garden');
  });

  test('custom preset requires a name', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: /Custom/ }).check({ force: true });
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('alert')).toHaveText('Required');
    await expect(page.getByRole('textbox').first()).toBeFocused();
    await page.getByRole('textbox').first().fill('Boat');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.locator('h1')).toHaveText('Boat');
    await expect(page.getByText('No tasks yet')).toBeVisible();
  });

  test('edit item name, icon and notes', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Home', 'My house');
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Name').fill('Villa');
    await page.getByRole('radio', { name: '🏡' }).check({ force: true });
    await page.getByLabel(/Notes/).fill('Gate code 1234');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('h1')).toHaveText('Villa');
    await expect(page.getByText('Gate code 1234')).toBeVisible();
    await expect(page.locator('.header-icon')).toHaveText('🏡');
  });

  test('delete item: cancel keeps it, confirm removes it, undo restores it', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('h1')).toHaveText('Luna');
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('h1')).toHaveText('My routines');
    await expect(page.getByRole('status')).toContainText('“Luna” deleted');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('link', { name: /Luna/ })).toBeVisible();
  });
});

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Car', 'Camry');
  });

  test('mark done records history, cost and moves the due date', async ({ page }) => {
    await setDue(page, 'Oil & filter change', '2026-06-01');
    const card = page.locator('.task-card', { hasText: 'Oil & filter change' });
    await expect(card.locator('.badge')).toHaveText('Overdue');
    await card.getByRole('button', { name: /^Mark done\W+Oil & filter change$/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Done on').fill('2026-06-10');
    await dialog.getByLabel(/Note/).fill('85,000 km');
    await dialog.getByLabel(/Cost/).fill('250.5');
    await dialog.getByRole('button', { name: 'Save' }).click();
    // 2026-06-10 + 6 months
    await expect(page.getByRole('status')).toContainText('Next due Dec 10, 2026');
    await expect(card.locator('.badge')).toHaveText('On track');
    await card.getByRole('link', { name: 'Oil & filter change' }).click();
    await expect(page.getByText('85,000 km')).toBeVisible();
    await expect(page.getByText('Total cost: 250.5')).toBeVisible();
    await expect(page.getByLabel('Next due date')).toHaveValue('2026-12-10');
  });

  test('mark done from the task page keeps the edit form in sync', async ({ page }) => {
    await page.getByRole('link', { name: 'Battery check' }).click();
    await page.locator('.task-summary').getByRole('button', { name: 'Mark done' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByLabel('Next due date')).toHaveValue('2026-12-15');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const card = page.locator('.task-card', { hasText: 'Battery check' });
    await expect(card).toContainText('Dec 15, 2026');
  });

  test('undo after mark done restores the previous state', async ({ page }) => {
    const card = page.locator('.task-card', { hasText: 'Car wash' });
    const before = await card.locator('.task-sub').textContent();
    await card.getByRole('button', { name: /^Mark done/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(card.locator('.task-sub')).toHaveText(before!);
  });

  test('done date cannot be in the future', async ({ page }) => {
    const card = page.locator('.task-card', { hasText: 'Car wash' });
    await card.getByRole('button', { name: /^Mark done/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Done on')).toHaveAttribute('max', '2026-06-15');
  });

  test('add a custom task with interval and due date', async ({ page }) => {
    await page.getByRole('link', { name: 'Add task' }).click();
    await page.getByLabel('Task name').fill('Wiper blades');
    await page.getByLabel('Amount').fill('9');
    await page.getByLabel('Unit').selectOption('month');
    // Preview follows the interval (start = today).
    await expect(page.getByText(/Will be due: .*March 15, 2027/)).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.task-card', { hasText: 'Wiper blades' })).toContainText('Every 9 months');
  });

  test('task form validates empty name and zero interval', async ({ page }) => {
    await page.getByRole('link', { name: 'Add task' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('New task');
    await page.getByLabel('Task name').fill('X');
    await page.getByLabel('Amount').fill('0');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('h1')).toHaveText('New task');
  });

  test('paused tasks are never due and hide the done button', async ({ page }) => {
    await setDue(page, 'Coolant check', '2026-01-01');
    await page.getByRole('link', { name: 'Coolant check' }).click();
    await page.getByLabel(/Pause this task/).check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const card = page.locator('.task-card', { hasText: 'Coolant check' });
    await expect(card.locator('.badge')).toHaveText('Paused');
    await expect(card.getByRole('button')).toHaveCount(0);
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.locator('#attention-heading')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Coolant check' })).toHaveCount(0);
  });

  test('delete a task and a history entry with undo', async ({ page }) => {
    await page.getByRole('link', { name: 'Tire rotation' }).click();
    await page.locator('.task-summary').getByRole('button', { name: 'Mark done' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: /Delete entry from/ }).click();
    await expect(page.getByText('No history yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('No history yet.')).toHaveCount(0);
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('h1')).toHaveText('Camry');
    await expect(page.getByRole('link', { name: 'Tire rotation' })).toHaveCount(0);
  });

  test('renamed built-in task keeps its custom name', async ({ page }) => {
    await page.getByRole('link', { name: 'Car wash' }).click();
    await page.getByLabel('Task name').fill('Hand wash');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByText('العربية').first().click();
    await page.goto(page.url().replace(/#.*/, '#/'));
    await page.getByRole('link', { name: /Camry/ }).click();
    await expect(page.getByRole('link', { name: 'Hand wash' })).toBeVisible();
    // Untouched built-in tasks follow the language.
    await expect(page.getByRole('link', { name: 'تغيير الزيت والفلتر' })).toBeVisible();
  });
});

test.describe('Home dashboard', () => {
  test('groups overdue, today and soon tasks, sorted by urgency', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Car', 'Camry');
    await setDue(page, 'Car wash', '2026-06-18'); // soon
    await setDue(page, 'Battery check', '2026-06-15'); // today
    await setDue(page, 'Coolant check', '2026-05-01'); // overdue
    await page.getByRole('link', { name: 'Home' }).click();
    const titles = page.locator('#attention-heading ~ ul .task-title');
    await expect(titles).toHaveText(['Coolant check', 'Battery check', 'Car wash']);
    await expect(page.locator('.count-pill')).toHaveText('3');
    await expect(page.locator('.item-card').first()).toContainText('Overdue: 1');
  });

  test('shows all-good message when nothing is due', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Health', 'Me');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByText(/All caught up/)).toBeVisible();
  });

  test('due-soon window setting changes classification', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Health', 'Me');
    await setDue(page, 'Dental checkup', '2026-06-25');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: 'Dental checkup' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByLabel(/due soon/).selectOption('14');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: 'Dental checkup' })).toBeVisible();
  });
});

test.describe('Presets', () => {
  test('edit a built-in preset and use it', async ({ page }) => {
    await openApp(page, '/presets');
    await page.getByRole('link', { name: /Garden/ }).click();
    await page.getByRole('button', { name: /^Delete\W+Watering$/ }).click();
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByLabel('Task name 9')).toBeFocused();
    await page.getByLabel('Task name 9').fill('Palm tree trimming');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: /Garden/ })).toContainText('9 tasks');
    await addItem(page, 'Garden', 'Backyard');
    await expect(page.getByRole('link', { name: 'Palm tree trimming' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Watering' })).toHaveCount(0);
  });

  test('create, then delete a custom preset; restore built-ins', async ({ page }) => {
    await openApp(page, '/presets');
    await page.getByRole('link', { name: 'New preset' }).click();
    await page.getByLabel('Name').fill('Farm');
    await page.getByRole('radio', { name: '🐑' }).check({ force: true });
    await page.getByRole('button', { name: 'Add task' }).click();
    await page.getByLabel('Task name 1').fill('Feed sheep');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: /Farm/ })).toContainText('1 tasks');
    await page.getByRole('link', { name: /Farm/ }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('link', { name: /Farm/ })).toHaveCount(0);

    await page.getByRole('link', { name: /Car/ }).click();
    await page.getByLabel('Name', { exact: true }).fill('Truck');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Restore built-in presets' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore built-in presets' }).click();
    await expect(page.getByRole('link', { name: /^Car\b/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Truck/ })).toHaveCount(0);
  });

  test('preset form rejects empty task names', async ({ page }) => {
    await openApp(page, '/presets/new');
    await page.getByLabel('Name').fill('Bad');
    await page.getByRole('button', { name: 'Add task' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('New preset');
  });
});

test.describe('Settings & data', () => {
  test('dark mode toggle in header and in settings, persisted', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(15, 17, 21)');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByText('Device default').nth(1).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'auto');
  });

  test('device dark preference is followed in auto mode', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark', locale: 'en-US' });
    const page = await ctx.newPage();
    await openApp(page);
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(15, 17, 21)');
    await ctx.close();
  });

  test('text size, contrast and motion settings apply to the page', async ({ page }) => {
    await openApp(page, '/settings');
    await page.getByText('Extra large').click();
    const size = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(parseFloat(size)).toBeCloseTo(16 * 1.3, 0);
    await page.getByLabel('High contrast').check();
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
    await page.getByLabel('Reduce motion').check();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  });

  test('export then import a backup round-trips data', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    await page.getByRole('link', { name: 'Settings' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export backup' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('inaya-backup-2026-06-15.json');
    const path = await download.path();

    await page.getByRole('button', { name: 'Erase all data' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Erase all data' }).click();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByText('Nothing tracked yet')).toBeVisible();

    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('input[type=file]').setInputFiles(path);
    await page.getByRole('dialog').getByRole('button', { name: 'Import backup' }).click();
    await expect(page.getByRole('status')).toContainText('Backup imported');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: /Luna/ })).toBeVisible();
  });

  test('invalid backup file shows an error and keeps data', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'bad.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"hello": 1}'),
    });
    await expect(page.getByRole('status')).toContainText('not a valid backup');
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: /Luna/ })).toBeVisible();
  });

  test('erase all can be undone', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Erase all data' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Erase all data' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('link', { name: /Luna/ })).toBeVisible();
  });

  test('reminder controls explain they are Android-only on the web', async ({ page }) => {
    await openApp(page, '/settings');
    await expect(page.getByText('Reminder notifications work in the Android app.')).toBeVisible();
    await expect(page.getByLabel('Send reminder notifications')).toBeDisabled();
    await expect(page.getByLabel('Send reminder notifications')).not.toBeChecked();
  });

  test('unknown routes and deleted items are handled', async ({ page }) => {
    await openApp(page, '/item/does-not-exist');
    await expect(page.getByText('This item no longer exists.')).toBeVisible();
    await page.goto('./#/nope/nope');
    await expect(page.locator('h1')).toHaveText('My routines');
  });
});

test.describe('Start dates & done before', () => {
  test('past start date makes never-done tasks overdue', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).check({ force: true });
    await addAllSuggestions(page);
    await page.getByLabel(/When does tracking start/).fill('2025-01-01');
    // Live preview per task: oil change every 6 months → July 1, 2025.
    await expect(page.locator('.task-pick', { hasText: 'Oil & filter change' })).toContainText('Will be due: Jul 1, 2025');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Tracking since Wed, January 1, 2025')).toBeVisible();
    const card = page.locator('.task-card', { hasText: 'Oil & filter change' });
    await expect(card.locator('.badge')).toHaveText('Overdue');
    await expect(card).toContainText('Next due: Jul 1, 2025');
  });

  test('future start date: nothing is due yet', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Garden' }).check({ force: true });
    await addAllSuggestions(page);
    await page.getByLabel(/When does tracking start/).fill('2026-09-01');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Starts on Tue, September 1, 2026')).toBeVisible();
    await expect(page.locator('.task-card.status-overdue, .task-card.status-today, .task-card.status-soon')).toHaveCount(0);
    await expect(page.locator('.task-card', { hasText: 'Watering' })).toContainText('Next due: Sep 3, 2026');
  });

  test('"done before" on a preset task sets last done and next due', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).check({ force: true });
    await addAllSuggestions(page);
    await page.getByRole('checkbox', { name: /^Done before\W+Oil & filter change$/ }).check();
    const lastDone = page.getByLabel(/^Last done on\W+Oil & filter change$/);
    await expect(lastDone).toHaveAttribute('max', '2026-06-15');
    await lastDone.fill('2026-05-01');
    await expect(page.locator('.task-pick', { hasText: 'Oil & filter change' })).toContainText('Will be due: Nov 1, 2026');
    await page.getByRole('button', { name: 'Create' }).click();
    const card = page.locator('.task-card', { hasText: 'Oil & filter change' });
    await expect(card).toContainText('Last done: May 1, 2026');
    await expect(card).toContainText('Next due: Nov 1, 2026');
    // Untouched tasks are still "not done yet".
    await expect(page.locator('.task-card', { hasText: 'Tire rotation' })).toContainText('Not done yet');
    await card.getByRole('link', { name: 'Oil & filter change' }).click();
    await expect(page.locator('.history-row')).toHaveCount(1);
    await expect(page.locator('.history-date')).toHaveText('Fri, May 1, 2026');
  });

  test('unticking a task hides its "done before" option', async ({ page }) => {
    await openApp(page, '/add');
    await page.getByRole('radio', { name: 'Car' }).check({ force: true });
    await addAllSuggestions(page);
    await expect(page.getByRole('checkbox', { name: /^Done before\W+Car wash$/ })).toBeVisible();
    await page.locator('.suggest-row', { hasText: 'Car wash' }).click();
    await expect(page.getByRole('checkbox', { name: /^Done before\W+Car wash$/ })).toHaveCount(0);
  });

  test('new task: "not yet" with a future start, or "done before" with a past date', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Home', 'House');
    await page.getByRole('link', { name: 'Add task' }).click();
    await page.getByLabel('Task name').fill('Paint fence');
    await page.getByLabel('Amount').fill('2');
    await page.getByLabel('Unit').selectOption('year');
    await expect(page.getByRole('radio', { name: /Not yet/ })).toBeChecked();
    await page.getByLabel('Start date').fill('2026-08-01');
    await expect(page.getByText(/Will be due: .*August 1, 2028/)).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.task-card', { hasText: 'Paint fence' })).toContainText('Next due: Aug 1, 2028');

    await page.getByRole('link', { name: 'Add task' }).click();
    await page.getByLabel('Task name').fill('Gutter cleaning');
    await page.getByLabel('Amount').fill('6');
    await page.getByRole('radio', { name: /Yes/ }).check();
    await expect(page.getByLabel('Last done on')).toHaveAttribute('max', '2026-06-15');
    await page.getByLabel('Last done on').fill('2025-10-20');
    await expect(page.getByText(/Will be due: .*April 20, 2026/)).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    const card = page.locator('.task-card', { hasText: 'Gutter cleaning' });
    await expect(card.locator('.badge')).toHaveText('Overdue');
    await expect(card).toContainText('Last done: Oct 20, 2025');
  });

  test('new task rejects a "last done" date in the future', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Home', 'House');
    await page.getByRole('link', { name: 'Add task' }).click();
    await page.getByLabel('Task name').fill('X');
    await page.getByRole('radio', { name: /Yes/ }).check();
    await page.getByLabel('Last done on').fill('2026-12-01');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('New task');
  });

  test('start date can be edited later', async ({ page }) => {
    await openApp(page);
    await addItem(page, 'Pet', 'Luna');
    await expect(page.getByText('Tracking since Mon, June 15, 2026')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Start date').fill('2024-03-10');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Tracking since Sun, March 10, 2024')).toBeVisible();
  });
});

test.describe('Start dates in Arabic', () => {
  test.use({ locale: 'ar-SA' });
  test('labels and preview are translated', async ({ page }) => {
    await openApp(page, '/add');
    await expect(page.getByText('3. متى تبدأ المتابعة؟')).toBeVisible();
    await addAllSuggestions(page);
    await page.getByRole('checkbox', { name: /^نُفّذت سابقًا\W+تغيير الزيت والفلتر$/ }).check();
    await expect(page.getByLabel(/^آخر تنفيذ في\W+تغيير الزيت والفلتر$/)).toBeVisible();
    await expect(page.locator('.task-pick', { hasText: 'تغيير الزيت والفلتر' })).toContainText('ستستحق في');
  });
});
