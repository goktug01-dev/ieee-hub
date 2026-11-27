import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Yalnız demo emülatörleriyle çalıştırılır.');
Object.assign(process.env, { VITE_FIREBASE_API_KEY: 'demo-key', VITE_FIREBASE_AUTH_DOMAIN: 'demo-ieee-hub.firebaseapp.com', VITE_FIREBASE_PROJECT_ID: 'demo-ieee-hub', VITE_FIREBASE_APP_ID: 'demo-app', VITE_USE_EMULATORS: '1', VITE_AUTH_EMULATOR_PORT: '9099', VITE_FIRESTORE_EMULATOR_PORT: '8085' });
const env = await initializeTestEnvironment({ projectId: 'demo-ieee-hub', firestore: { host: '127.0.0.1', port: 8085 } });
const admin = async fn => { let result; await env.withSecurityRulesDisabled(async ctx => { result = await fn(ctx.firestore()); }); return result; };
const out = fileURLToPath(new URL('../smoke-shots/statutory-navigation/', import.meta.url));
await mkdir(out, { recursive: true });
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), logLevel: 'warn', server: { host: '127.0.0.1', port: 5187, strictPort: true } });
const base = 'http://127.0.0.1:5187';
let browser, page;
try {
  const { DEFAULT_STATUTORY_POLICY } = await server.ssrLoadModule('/src/lib/statuteCatalog.ts');
  const creator = await admin(async db => {
    const member = (await getDocs(collection(db, 'members'))).docs.find(d => d.data().email === 'baskan@demo.ieee');
    assert.ok(member);
    const now = Timestamp.now();
    await setDoc(doc(db, 'statutoryPolicies', 'navigation-test'), { ...DEFAULT_STATUTORY_POLICY, publishedBy: member.id, publishedAt: now });
    await setDoc(doc(db, 'settings', 'statutory'), { policyId: 'navigation-test', updatedBy: member.id, updatedAt: now });
    await setDoc(doc(db, 'terms', 'navigation-term'), { name: 'Gezinme test dönemi', startsAt: Timestamp.fromMillis(Date.now() - 86400000), endsAt: Timestamp.fromMillis(Date.now() + 30 * 86400000) });
    await setDoc(doc(db, 'settings', 'org'), { activeTermId: 'navigation-term' }, { merge: true });
    for (const [id, title, kind] of [['navigation-a', 'Birinci itiraz dosyası', 'appeal'], ['navigation-b', 'İkinci itiraz dosyası', 'appeal'], ['navigation-annual', 'Yıllık plan taslağı', 'annual_plan']]) {
      await setDoc(doc(db, 'governanceCases', id), { kind, title, summary: 'Tarayıcı gezinme denemesi.', policyId: 'navigation-test', unitId: 'branch', subjectUid: null, confidential: false, step: 0, status: 'open', proposal: { termId: '', threshold: 0, inclusive: false, spendPercent: 0, affectedArticles: [] }, createdBy: member.id, createdAt: now, updatedAt: now, stageStartedAt: now });
    }
    return member.id;
  });
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  page = await browser.newPage({ viewport: { width: 1366, height: 950 }, locale: 'tr-TR' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base);
  await page.getByText('Ayşe Yılmaz', { exact: true }).click();
  await page.getByRole('button', { name: 'Kullanıcı menüsü' }).waitFor();
  await page.goto(base + '/surecler');
  const follow = page.getByRole('tab', { name: 'Süre ve yükümlülük takibi', exact: true });
  const files = page.getByRole('tab', { name: 'Süreç dosyaları', exact: true });
  for (const [title, kind] of [['Genel Kurul: 0/2', 'general_assembly'], ['Denetleme incelemesi: 0/2', 'audit_period'], ['ACTOR yillik raporu ve nihai yedek: 0/1', 'actor_annual']]) {
    await follow.click();
    const card = page.locator('.mantine-Card-root').filter({ has: page.getByText(title, { exact: true }) });
    await card.getByRole('link', { name: /İlgili kaydı aç|Süreç dosyalarını aç/ }).click();
    await page.waitForFunction(() => document.querySelector('[role="tab"][data-active][id$="-tab-dosyalar"]'), {}, { timeout: 10000 });
    assert.equal(await files.getAttribute('aria-selected'), 'true', `${title} süreç dosyalarını açmalı.`);
    assert.equal(new URL(page.url()).searchParams.get('surec'), kind);
    await page.getByRole('button', { name: 'Yeni süreç / başvuru', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByRole('combobox', { name: 'Süreç', exact: true }).waitFor();
    assert.match(await modal.getByRole('combobox', { name: 'Süreç', exact: true }).inputValue(), new RegExp(DEFAULT_STATUTORY_POLICY.flows[kind].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (kind === 'actor_annual') {
      await modal.getByLabel('Başlık', { exact: true }).fill('ACTOR raporu gezinme denemesi');
      await modal.getByLabel('Gerekçe / yazılı başvuru', { exact: true }).fill('Yıllık raporun teslim ve onay takibi.');
      await modal.getByRole('button', { name: 'Dosyayı oluştur', exact: true }).click();
      await page.getByRole('dialog').getByText('ACTOR raporu gezinme denemesi', { exact: true }).waitFor();
      const id = new URL(page.url()).searchParams.get('dosya');
      assert.ok(id);
      const saved = await admin(async db => (await getDoc(doc(db, 'governanceCases', id))).data());
      assert.equal(saved.kind, 'actor_annual'); assert.equal(saved.createdBy, creator); assert.equal(saved.subjectUid, null);
      await page.keyboard.press('Escape');
    } else await page.keyboard.press('Escape');
  }
  await follow.click();
  await page.locator('.mantine-Card-root').filter({ has: page.getByText('Yillik faaliyet plani: 0/1', { exact: true }) }).getByRole('link', { name: /İlgili kaydı aç|Süreç dosyalarını aç/ }).click();
  await page.getByText('Yıllık plan taslağı', { exact: true }).waitFor();
  assert.equal(await page.getByText('Birinci itiraz dosyası', { exact: true }).count(), 0, 'İlgisiz süreç türü görünmemeli.');
  await page.reload();
  await page.getByText('Yıllık plan taslağı', { exact: true }).waitFor();
  assert.equal(await files.getAttribute('aria-selected'), 'true');
  await page.goBack();
  await follow.waitFor();
  await page.waitForFunction(() => document.querySelector('[role="tab"][data-active][id$="-tab-takip"]'));
  // Aynı sayfada iki farklı dosya bağlantısı ve tarayıcı geri/ileri.
  await page.locator('.mantine-Card-root').filter({ hasText: 'Birinci itiraz dosyası:' }).getByRole('link', { name: /İlgili kaydı aç|Süreç dosyalarını aç/ }).click();
  await page.getByRole('dialog').getByText('Birinci itiraz dosyası', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(new URL(page.url()).searchParams.has('dosya'), false);
  await follow.click();
  await page.locator('.mantine-Card-root').filter({ hasText: 'İkinci itiraz dosyası:' }).getByRole('link', { name: /İlgili kaydı aç|Süreç dosyalarını aç/ }).click();
  await page.getByRole('dialog').getByText('İkinci itiraz dosyası', { exact: true }).waitFor();
  await page.reload();
  await page.getByRole('dialog').getByText('İkinci itiraz dosyası', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.screenshot({ path: out + 'files-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, {}, { timeout: 5000 });
  await follow.click();
  await page.locator('.mantine-Card-root').filter({ has: page.getByText('Denetleme incelemesi: 0/2', { exact: true }) }).getByRole('link', { name: /İlgili kaydı aç|Süreç dosyalarını aç/ }).click();
  await page.getByRole('button', { name: 'Yeni süreç / başvuru', exact: true }).click();
  await page.getByRole('dialog').getByRole('combobox', { name: 'Süreç', exact: true }).waitFor();
  await page.screenshot({ path: out + 'audit-mobile.png', fullPage: true, animations: 'disabled' });
  await page.goto(base + '/itirazlar?dosya=navigation-a');
  await page.getByRole('dialog').getByText('Birinci itiraz dosyası', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(new URL(page.url()).pathname, '/itirazlar', 'Kişisel başvuru sayfası Hub süreç sayfasına yönlenmemeli.');
  assert.equal(new URL(page.url()).searchParams.has('dosya'), false);
  assert.deepEqual(errors, []);
  console.log('Süreç gezinmesi: Genel Kurul/Denetleme/ACTOR kartları, doğru süreç türüyle yeni dosya, gerçek kurallarla kayıt, mevcut dosya filtresi, sekme/URL/yenileme/geri geçişi, dosya derin bağlantıları, kişisel itiraz sayfası ve mobil tıklama geçti.');
} catch (error) { await page?.screenshot({ path: out + 'failure.png', fullPage: true }).catch(() => {}); throw error; }
finally { await browser?.close(); await server.close(); await env.cleanup(); }
