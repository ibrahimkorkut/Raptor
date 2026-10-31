import { test, expect } from '@playwright/test';

test.describe('Raptor IDM Dosya İndirme Bilgisi & Akıllı Modal Testleri', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Dashboard sayfasının yüklendiğini bekle
    await expect(page.locator('body')).toBeVisible();
  });

  test('Yeni İndirme Başlat tıklandığında Dosya İndirme Bilgisi modalı açılmalı', async ({ page }) => {
    // "Add download" butonunu bul ve tıkla
    const addBtn = page.locator('button:has-text("Add download")');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // IDM modal başlığı doğrulanmalı
    await expect(page.locator('text=Dosya İndirme Bilgisi')).toBeVisible();
    await expect(page.locator('text=RAPTOR TURBO')).toBeVisible();

    // Temel alanlar görünür olmalı
    await expect(page.getByText('URL', { exact: true })).toBeVisible();
    await expect(page.getByText('Kategori', { exact: true })).toBeVisible();
    await expect(page.getByText('Kaydet', { exact: true })).toBeVisible();
    await expect(page.locator('button:has-text("İndirmeyi Başlat")')).toBeVisible();
    await expect(page.locator('button:has-text("Daha Sonra İndir")')).toBeVisible();
    await expect(page.locator('button:has-text("İptal")')).toBeVisible();
  });

  test('EXE dosyası girildiğinde Format ve Kalite Seçimi kutusu KESİNLİKLE görünmemeli', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add download")');
    await addBtn.click();

    const urlInput = page.getByTestId('download-url-input');
    await urlInput.fill('https://tr.download.nvidia.com/Windows/621.01/621.01-notebook-win10-win11-64bit-international-dch-whql.exe');
    await urlInput.blur();

    // 1. Kategori "Programlar" olarak otomatik seçilmeli
    const categorySelect = page.getByTestId('category-select');
    await expect(categorySelect).toHaveValue('Programlar');

    // 2. Format ve Kalite Paneli (MP4, MKV, MP3, 1080p vb.) GÖRÜNMEMELİ
    await expect(page.locator('text=Format ve Kalite Seçimi (Video / Ses)')).toBeHidden();
    await expect(page.locator('button:has-text("MP4")')).toBeHidden();
    await expect(page.locator('button:has-text("MKV")')).toBeHidden();

    // 3. Dosya türü etiketi "Uygulama / Kurulum Dosyası" olmalı
    await expect(page.locator('text=Uygulama / Kurulum Dosyası')).toBeVisible();
  });

  test('Video / YouTube URL girildiğinde Format ve Kalite Seçimi kutusu görünmeli', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add download")');
    await addBtn.click();

    const urlInput = page.getByTestId('download-url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await urlInput.blur();

    // 1. Format ve Kalite Paneli otomatik açılmalı
    await expect(page.locator('text=Format ve Kalite Seçimi (Video / Ses)')).toBeVisible();

    // 2. Format butonları görünmeli
    await expect(page.locator('button:has-text("MP4")')).toBeVisible();
    await expect(page.locator('button:has-text("MKV")')).toBeVisible();
    await expect(page.locator('button:has-text("MP3 (Ses)")')).toBeVisible();
    await expect(page.locator('button:has-text("WebM")')).toBeVisible();

    // 3. Çözünürlük seçimi görünmeli
    await expect(page.locator('text=Video Çözünürlüğü / Kalite')).toBeVisible();
  });

  test('İptal butonuna basıldığında modal kapanmalı', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add download")');
    await addBtn.click();

    await expect(page.locator('text=Dosya İndirme Bilgisi')).toBeVisible();

    const cancelBtn = page.locator('button:has-text("İptal")');
    await cancelBtn.click();

    await expect(page.locator('text=Dosya İndirme Bilgisi')).toBeHidden();
  });
});
