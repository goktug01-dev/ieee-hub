import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

Object.assign(process.env, { VITE_FIREBASE_API_KEY:'demo-key', VITE_FIREBASE_AUTH_DOMAIN:'demo-ieee-hub.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID:'demo-ieee-hub', VITE_FIREBASE_APP_ID:'demo-app', VITE_USE_EMULATORS:'1', VITE_AUTH_EMULATOR_PORT:'9099', VITE_FIRESTORE_EMULATOR_PORT:'8085' });
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Bu kontrol yalnız demo emülatörleriyle çalıştırılır.');
const base='http://127.0.0.1:5184';
const out=fileURLToPath(new URL('../smoke-shots/mail/',import.meta.url));
await mkdir(out,{recursive:true});
const server=await createServer({root:fileURLToPath(new URL('..',import.meta.url)),logLevel:'warn',server:{host:'127.0.0.1',port:5184,strictPort:true}});
await server.listen();
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH??'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:950},locale:'tr-TR'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(base);
  await page.getByText('Ayşe Yılmaz',{exact:true}).click();
  await page.getByRole('button',{name:'Kullanıcı menüsü'}).waitFor();
  await page.goto(base+'/profil');
  await page.getByRole('button',{name:'Doğrulama maili gönder',exact:true}).click();
  await page.getByText('Doğrulama bağlantısı gönderildi.',{exact:true}).waitFor();
  const oobResponse=await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-ieee-hub/oobCodes');
  const code=(await oobResponse.json()).oobCodes.findLast(item=>item.email==='baskan@demo.ieee'&&item.requestType==='VERIFY_EMAIL');
  assert.ok(code,'Emülatör doğrulama maili üretilmedi.');
  const apply=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:update?key=demo-key',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({oobCode:code.oobCode}),
  });
  assert.equal(apply.status,200);
  await page.getByRole('button',{name:'Doğrulamayı kontrol et',exact:true}).click();
  const tasks=page.getByLabel('Bana yeni görev atandığında mail gönder',{exact:true});
  await tasks.waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-testid="mail-preferences"] input[type="checkbox"]')?.disabled);
  await tasks.uncheck();
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="mail-preferences"] input[type="checkbox"]')].some(input=>!input.checked&&!input.disabled));
  await page.reload(); await tasks.waitFor();
  await page.waitForFunction(()=>!document.querySelector('[data-testid="mail-preferences"] input[type="checkbox"]')?.disabled);
  assert.equal(await tasks.isChecked(),false);
  await page.setViewportSize({width:390,height:844});
  await page.getByTestId('mail-preferences').screenshot({path:out+'profile-mobile.png',animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1366,height:950});
  await page.goto(base+'/yonetim/ayarlar');
  await page.getByLabel('Bildirim hesabı kimliği',{exact:true}).fill('qa-worker');
  await page.getByRole('button',{name:'Bildirim ayarlarını kaydet',exact:true}).click();
  await page.getByText('Bildirim ayarları kaydedildi.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Mevcut bekleyenleri kuyruğa al',exact:true}).click();
  await page.getByText(/\d+ bekleyen kayıt kuyruğa alındı/).waitFor();
  await page.locator('.mantine-Notification-root').last().waitFor({state:'hidden'});
  await page.getByTestId('mail-settings').screenshot({path:out+'settings-desktop.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.getByTestId('mail-settings').screenshot({path:out+'settings-mobile.png',animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('Mail arayüzü: doğrulama, kayıt, tercih kalıcılığı, servis ayarı, eski bekleyenleri kuyruklama ve mobil görünüm geçti. Gerçek mail gönderilmedi.');
} finally { await browser?.close(); await server.close(); }
