import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const base = 'http://localhost:5189';
const viteCli = fileURLToPath(new URL('../../../node_modules/vite/bin/vite.js', import.meta.url));
const vite = spawn(process.execPath, [viteCli, '--port', '5189', '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), shell: false, stdio: 'pipe' });
for (let attempt = 0; attempt < 120; attempt++) {
  try { if ((await fetch(base)).ok) break; } catch { /* wait */ }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'tr-TR' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.getByText('Demo hesapları').waitFor({ timeout: 30000 });
  await page.getByText(/^Ayşe/).first().click();
  await page.waitForTimeout(1800);

  await page.goto(`${base}/yonetim/etkinlik-kisitlamalari`);
  await page.getByRole('button', { name: 'Kısıtlama ekle' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Kişi adı').fill('Test Engelli');
  await dialog.getByLabel('E-posta').fill('engelli@example.org');
  await dialog.getByLabel('Somut olay ve gerekçe').fill('Etkinlik güvenliğini tehlikeye atan doğrulanmış olay kaydı.');
  await dialog.getByRole('button', { name: 'Kaydı oluştur' }).click();
  await page.getByText('engelli@example.org').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${process.env.SHOTS}/kisitlama-listesi.png`, fullPage: true });

  await page.goto(`${base}/etkinlikler`);
  await page.locator('a[href^="/etkinlikler/"]').first().click();
  await page.getByText('Katılımcılar (HeptaCert)', { exact: true }).click();
  const csv = 'Ad Soyad;E-posta;Katıldı;Sertifika\nTest Engelli;engelli@example.org;Evet;';
  await page.locator('input[type="file"]').setInputFiles({ name: 'katilimcilar.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByText('Aktarım engellendi').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${process.env.SHOTS}/engelli-katilimci.png`, fullPage: true });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('KISITLAMA_AKISI_OK');
} finally {
  await browser.close();
  vite.kill();
}
