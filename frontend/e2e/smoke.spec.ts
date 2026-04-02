import { test, expect } from '@playwright/test';

test.describe('IsoVis smoke', () => {
  test('loads shell, skip link, and opens keyboard help', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Model tree' })).toBeVisible();
    await expect(page.getByRole('region', { name: '3D Viewer' })).toBeVisible();

    const skip = page.getByRole('link', { name: 'Skip to 3D Viewer' });
    await expect(skip).toBeAttached();

    await page.keyboard.press('Control+/');
    await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
    await expect(page.getByText('Play / pause time-history')).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
