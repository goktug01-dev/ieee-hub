/** Üretim worker'ını yalnız demo emülatörlerine bağlı ayrı derlemede sınar. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { build, preview } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = fileURLToPath(new URL('../../../.tools/pwa-smoke-dist', import.meta.url));
const shots = fileURLToPath(new URL('../smoke-shots/pwa', import.meta.url));
Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-ieee-hub.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-ieee-hub',
  VITE_FIREBASE_APP_ID: 'demo-app',
  VITE_USE_EMULATORS: '1',
  VITE_AUTH_EMULATOR_PORT: '9099',
  VITE_FIRESTORE_EMULATOR_PORT: '8085',
});
await mkdir(shots, { recursive: true });
await build({ root, mode: 'development', logLevel: 'warn', build: { outDir, emptyOutDir: true } });
const server = await preview({ root, build: { outDir }, preview: { host: '127.0.0.1', port: 5182, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'tr-TR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5182');
  await page.getByRole('button', { name: 'Uygulamayı yükle', exact: true }).waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const manifest = await (await context.request.get('http://127.0.0.1:5182/manifest.webmanifest')).json();
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) {
    const response = await context.request.get(`http://127.0.0.1:5182${icon.src}`);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /image\/png/);
  }
  const cdp = await context.newCDPSession(page);
  const appManifest = await cdp.send('Page.getAppManifest');
  assert.deepEqual(appManifest.errors, []);

  await page.getByRole('button', { name: 'Uygulamayı yükle', exact: true }).click();
  await page.getByRole('dialog').getByText('iPhone / iPad', { exact: true }).waitFor();
  await page.screenshot({ path: `${shots}/install-mobile.png`, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);

  // Tarayıcı olayının tek kullanımlık ve iptal edilebilir akışını sınar; OS kurulumu yapmaz.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await page.getByRole('button', { name: 'Bu cihaza yükle' }).click();
  await page.getByRole('button', { name: 'Bu cihaza yükle' }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();

  await context.setOffline(true);
  await page.getByRole('status').filter({ hasText: 'İnternet bağlantısı yok' }).waitFor();
  await page.goto('http://127.0.0.1:5182/dilekceler/ornek');
  await page.getByRole('heading', { name: 'İnternet bağlantısı yok' }).waitFor();
  await page.screenshot({ path: `${shots}/offline-mobile.png`, animations: 'disabled' });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = [];
    for (const key of keys) {
      const requests = await (await caches.open(key)).keys();
      urls.push(...requests.map((request) => new URL(request.url).pathname));
    }
    return urls;
  });
  assert.deepEqual(cached, ['/offline.html']);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Yeniden dene' }).click();
  await page.getByRole('button', { name: 'Uygulamayı yükle', exact: true }).waitFor();

  await page.getByText('Ayşe Yılmaz', { exact: true }).click();
  await page.getByRole('button', { name: 'Kullanıcı menüsü' }).waitFor();
  await page.getByRole('button', { name: 'Kullanıcı menüsü' }).click();
  await page.getByRole('menuitem', { name: 'Uygulamayı yükle' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Kapat', exact: true }).click();
  await page.goto('http://127.0.0.1:5182/yardim');
  await page.getByRole('button', { name: 'Uygulamayı yükle', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.deepEqual(errors, []);
  console.log('PWA: manifest, simgeler, mobil kurulum yardımı, iptal, worker, offline, yeniden deneme ve menü/Yardım geçti.');
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
