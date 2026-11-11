import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import nodemailer from 'nodemailer';
import { processMail } from './core.mjs';
import { mailStore } from './store.mjs';

let app, transport;
setLogLevel('silent');
try {
  const credentials = JSON.parse(process.env.MAIL_FIREBASE_CREDENTIALS ?? '{}');
  if (!credentials.apiKey || !credentials.projectId || !credentials.email || !credentials.password
    || !process.env.MAIL_SENDER_EMAIL || !process.env.MAIL_GMAIL_APP_PASSWORD) throw new Error('missing-setup');
  app = initializeApp({ apiKey: credentials.apiKey, projectId: credentials.projectId });
  await signInWithEmailAndPassword(getAuth(app), credentials.email, credentials.password);
  transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.MAIL_SENDER_EMAIL, pass: process.env.MAIL_GMAIL_APP_PASSWORD },
    connectionTimeout: 20000, greetingTimeout: 20000, socketTimeout: 45000, logger: false, debug: false });
  const summary = await processMail({ store: mailStore(getFirestore(app)), transport, sender: process.env.MAIL_SENDER_EMAIL,
    dryRun: process.env.MAIL_DRY_RUN !== 'false' });
  // Adres, UID, belge başlığı, SMTP hata metni ve kimlik bilgisi günlüğe yazılmaz.
  console.log(JSON.stringify(summary));
  if (summary.result === 'error') process.exitCode = 1;
} catch {
  console.error('Mail yürütücüsü tamamlanamadı. Kurulum, hesap bağlantısı ve Hub servis durumunu kontrol edin.');
  process.exitCode = 1;
} finally {
  transport?.close();
  if (app) { await signOut(getAuth(app)).catch(() => {}); await deleteApp(app); }
}
