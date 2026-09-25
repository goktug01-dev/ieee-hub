/**
 * Arayüz duman testi: demo hesaplarıyla tüm sayfaları gezer, JavaScript hatalarını toplar,
 * ekran görüntüsü alır. Kurulu Microsoft Edge (veya Chrome) kullanılır; tarayıcı indirilmez.
 *
 * Çalıştırma (kök dizin): npm run smoke
 * Ekran görüntüleri: apps/hub/smoke-shots/ (depoya girmez)
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const PORT = 5180;
const BASE = `http://localhost:${PORT}`;
const OUT = fileURLToPath(new URL('../smoke-shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const ROUTES = {
  baskan: [
    '/', '/onaylar', '/gorevler', '/gorevler?sekme=pano', '/gorevler?sekme=projeler', '/dilekceler', '/dilekceler/yeni',
    '/etkinlikler', '/iletisim', '/sponsorluk', '/butceler', '/raporlar', '/organizasyon', '/gonulluluk', '/devir', '/yardim', '/profil',
    '/birimler/cs', '/sekreterlik-defteri',
    '/yonetim/uyeler', '/yonetim/atamalar', '/yonetim/secimler', '/yonetim/birimler', '/yonetim/roller', '/yonetim/donemler',
    '/yonetim/sablonlar', '/yonetim/sablonlar/etkinlik-izin', '/yonetim/envanter', '/yonetim/ayarlar', '/yonetim/denetim',
  ],
  cs: ['/', '/birimler/cs', '/onaylar', '/gorevler?sekme=pano&birim=cs', '/gonulluluk', '/etkinlikler?birim=cs', '/iletisim?birim=cs', '/devir', '/butceler?birim=cs'],
  uye: ['/', '/gorevler', '/dilekceler', '/dilekceler/yeni', '/etkinlikler', '/sponsorluk', '/iletisim'],
  gonullu: ['/', '/gorevler', '/gonulluluk', '/sponsorluk'],
  yeni: ['/'],
};

async function startVite() {
  const p = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: new URL('..', import.meta.url), shell: true, stdio: 'pipe' });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (p.exitCode !== null) throw new Error(`Vite erken kapandı (kod ${p.exitCode})`);
    try {
      const response = await fetch(BASE);
      if (response.ok) return p;
    } catch {
      // Sunucu henüz dinlemiyor.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  p.kill();
  throw new Error('Vite başlamadı');
}

const vite = await startVite();
const executablePath = process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({ executablePath, headless: true });
const problems = [];
let pages = 0;

try {
  for (const [account, routes] of Object.entries(ROUTES)) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'tr-TR' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|DevTools|Download the React/.test(m.text())) errors.push(`console: ${m.text().slice(0, 300)}`);
    });

    await page.goto(BASE);
    await page.getByText('Demo hesapları').waitFor({ timeout: 30000 });
    await page.getByText(new RegExp(`^${account === 'baskan' ? 'Ayşe' : account === 'cs' ? 'Zeynep' : account === 'uye' ? 'Can' : account === 'gonullu' ? 'Deniz' : 'Ali'}`)).first().click();
    await page.waitForTimeout(2500);

    for (const r of routes) {
      errors.length = 0;
      await page.goto(BASE + r);
      await page.waitForTimeout(1500);
      const crashed = await page.getByText(/Something went wrong|Unexpected Application Error/).count();
      const file = `${account}${r.replace(/[/?=]/g, '_') || '_'}.png`;
      await page.screenshot({ path: OUT + file, fullPage: false });
      pages++;
      const real = errors.filter((e) => !/Missing or insufficient permissions/.test(e) || account !== 'yeni');
      if (crashed || real.length) problems.push({ account, route: r, crashed: !!crashed, errors: [...real] });
    }

    if (account === 'baskan') {
      errors.length = 0;
      await page.goto(BASE + '/etkinlikler');
      await page.waitForTimeout(1500);
      const detailHref = await page.locator('a[href^="/etkinlikler/"]').first().getAttribute('href');
      if (detailHref) {
        await page.goto(BASE + detailHref);
        await page.waitForTimeout(1500);
        for (const tab of ['vTools hazırlık', 'Katılımcılar (HeptaCert)']) {
          await page.getByRole('tab', { name: tab }).click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: OUT + `baskan_event_${tab.startsWith('vTools') ? 'vtools' : 'heptacert'}.png`, fullPage: false });
          pages++;
        }
        if (errors.length) problems.push({ account, route: `${detailHref} (entegrasyon sekmeleri)`, crashed: false, errors: [...errors] });
      } else {
        problems.push({ account, route: '/etkinlikler', crashed: false, errors: ['Demo verisinde etkinlik detayı bulunamadı.'] });
      }
    }
    await ctx.close();
  }

  // Mobil görünüm
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: 'tr-TR' });
  const mp = await m.newPage();
  await mp.goto(BASE);
  await mp.getByText('Demo hesapları').waitFor({ timeout: 30000 });
  await mp.screenshot({ path: OUT + 'mobile_login.png' });
  await mp.getByText(/^Can/).first().click();
  await mp.waitForTimeout(2500);
  for (const r of ['/', '/gorevler', '/dilekceler/yeni']) {
    await mp.goto(BASE + r);
    await mp.waitForTimeout(2000);
    await mp.screenshot({ path: OUT + `mobile${r.replace(/\//g, '_')}.png` });
    pages++;
  }
  await m.close();
} finally {
  await browser.close();
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { shell: false, stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  } else {
    vite.kill();
  }
}

console.log(`\n${pages} sayfa gezildi.`);
if (problems.length) {
  console.log(`${problems.length} sayfada sorun:`);
  for (const p of problems) console.log(`- [${p.account}] ${p.route}${p.crashed ? ' (ÇÖKTÜ)' : ''}\n    ${p.errors.slice(0, 3).join('\n    ')}`);
  process.exit(1);
} else {
  console.log('Hiçbir sayfada JavaScript hatası yok.');
}
