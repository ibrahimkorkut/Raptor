import { test, expect } from '@playwright/test';

test.describe('Raptor Dashboard Arayüz ve Navigasyon Testleri', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Sidebar navigasyon ve başlıklar doğru yüklenmeli', async ({ page }) => {
    // Sol kenar çubuğunda Raptor markası ve bölümler olmalı
    await expect(page.locator('aside').getByText('Raptor').first()).toBeVisible();
    await expect(page.locator('aside').getByText('All downloads')).toBeVisible();
    await expect(page.locator('aside').getByText('Downloading')).toBeVisible();
    await expect(page.locator('aside').getByText('Completed')).toBeVisible();
    await expect(page.locator('aside').getByText('Settings')).toBeVisible();
  });

  test('Kategori filtre butonları arasında geçiş yapılabilmeli', async ({ page }) => {
    const tabs = ['All files', 'Archives', 'Video', 'Documents', 'Other'];
    for (const tab of tabs) {
      const tabBtn = page.locator(`button:has-text("${tab}")`);
      await expect(tabBtn).toBeVisible();
      await tabBtn.click();
    }
  });

  test('Arama çubuğuna metin girilebilmeli', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('nvidia');
    await expect(searchInput).toHaveValue('nvidia');
  });

  test('Hız limiti modalı açılıp kapatılabilmeli', async ({ page }) => {
    // Hız limiti göstergesini bul (alt footer veya toolbar)
    const speedLimitIndicator = page.locator('text=Speed limit:').first();
    await expect(speedLimitIndicator).toBeVisible();
    await speedLimitIndicator.click();
    await expect(page.locator('text=İndirme Hız Sınırı (Speed Limiter)')).toBeVisible();
    
    // Kapat butonu (İptal)
    const closeBtn = page.locator('button:has-text("İptal")');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.locator('text=İndirme Hız Sınırı (Speed Limiter)')).toBeHidden();
  });
});
