import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { emitKeypressEvents } from 'node:readline';
import nodemailer from 'nodemailer';

function gh(args, input) {
  return execFileSync('gh', args, { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'], env: { ...process.env, DEBUG: '' } }).trim();
}
async function hiddenPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('terminal-required');
  process.stdout.write('Gmail uygulama şifresi (gizli giriş; normal hesap şifresi değil): ');
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = () => { process.stdin.removeListener('keypress', onKey); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    const onKey = (text, key) => {
      if (key?.ctrl && key.name === 'c') { done(); reject(new Error('cancelled')); }
      else if (key?.name === 'return' || key?.name === 'enter') { done(); resolve(value.replace(/\s/g, '')); }
      else if (key?.name === 'backspace') value = value.slice(0,-1);
      else if (text && !key?.ctrl && !key?.meta) value += text;
    };
    process.stdin.on('keypress', onKey);
  });
}

let smtp, newAccount, apiKey;
try {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('terminal-required');
  const repo = gh(['repo','view','--json','nameWithOwner']);
  const fullName = JSON.parse(repo).nameWithOwner;
  const args = process.argv.slice(2);
  const sender = args.includes('--sender') ? args[args.indexOf('--sender') + 1] : 'techopsieee@gmail.com';
  if (!/^[^\s@]+@gmail\.com$/.test(sender)) throw new Error('invalid-sender');
  const variables = JSON.parse(gh(['api',`repos/${fullName}/actions/variables`])).variables;
  apiKey = variables.find(v => v.name === 'VITE_FIREBASE_API_KEY')?.value;
  const projectId = variables.find(v => v.name === 'FIREBASE_PROJECT_ID')?.value;
  if (!apiKey || !projectId) throw new Error('firebase-config-missing');
  console.log(`Gönderici: ${sender}\nDepo: ${fullName}\nFirebase projesi: ${projectId}`);
  console.log('Bu betik SMTP bağlantısını doğrular; hiç mail göndermez. GitHub zamanlaması kapalı kalır.');
  const appPassword = await hiddenPassword();
  if (!/^[a-zA-Z0-9]{16}$/.test(appPassword)) throw new Error('invalid-app-password');
  smtp = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: sender, pass: appPassword }, connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 30000,
    logger: false, debug: false });
  await smtp.verify();
  gh(['variable','set','MAIL_ENABLED','--repo',fullName,'--body','false']);
  const credentials = { apiKey, projectId, email: `${randomUUID()}@mail-worker.invalid`, password: randomBytes(32).toString('base64url') };
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error('worker-account-failed');
  newAccount = await response.json();
  gh(['secret','set','MAIL_FIREBASE_CREDENTIALS','--repo',fullName], JSON.stringify(credentials));
  gh(['secret','set','MAIL_GMAIL_APP_PASSWORD','--repo',fullName], appPassword);
  gh(['variable','set','MAIL_SENDER_EMAIL','--repo',fullName,'--body',sender]);
  console.log('\nGizli bilgiler GitHub Secrets içine kaydedildi; dosyaya veya çıktıya yazılmadı.');
  console.log(`Bildirim hesabı kimliği (gizli değildir): ${newAccount.localId}`);
  console.log('1. Hub > Kurum ayarları > E-posta bildirim servisi: bu kimliği girin, doğru göndericiyi seçin, erişimi açıp kaydedin.');
  console.log('2. GitHub Actions > E-posta bildirimleri > Run workflow: dry_run açık kalsın. Mail gönderilmez.');
  console.log('3. Kuru kontrol başarılıysa zamanlamayı açın:');
  console.log(`   gh variable set MAIL_ENABLED --repo ${fullName} --body true`);
  console.log('Kendi doğrulanmış hesabınıza bir test görevi atayıp ilk gerçek bildirimi kontrol edin.');
  newAccount = null; // Başarılı kurulumda otomasyon kimliği korunur.
} catch (error) {
  if (newAccount?.idToken && apiKey) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: newAccount.idToken }),
    }).catch(() => {});
  }
  const messages = {
    'terminal-required': 'Bu komutu kendi etkileşimli terminalinizde çalıştırın.',
    cancelled: 'Kurulum iptal edildi.',
    'invalid-app-password': '16 karakterlik Google uygulama şifresi gerekli; normal hesap şifresini kullanmayın.',
    'firebase-config-missing': 'Depodaki Firebase web yapılandırması değişkenleri bulunamadı.',
    'worker-account-failed': 'Ayrı Firebase Auth hesabı oluşturulamadı. E-posta/şifre sağlayıcısını kontrol edin.',
  };
  console.error(messages[error?.message] ?? 'Kurulum tamamlanamadı. Gmail uygulama şifresini, bağlantıyı ve GitHub Secrets yönetim yetkinizi kontrol edin. Gizli bilgileri sohbete göndermeyin.');
  process.exitCode = 1;
} finally { smtp?.close(); }
