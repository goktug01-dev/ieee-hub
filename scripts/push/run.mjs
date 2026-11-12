import { initializeApp,deleteApp } from 'firebase/app';
import { getAuth,signInWithEmailAndPassword,signOut } from 'firebase/auth';
import { getFirestore,setLogLevel } from 'firebase/firestore';
import * as webpush from 'web-push';
import { mailStore } from '../mail/store.mjs';
import { processPush } from './core.mjs';
let app;setLogLevel('silent');
try {
  const credentials=JSON.parse(process.env.MAIL_FIREBASE_CREDENTIALS??'{}');
  const keys=JSON.parse(process.env.PUSH_VAPID_KEYS??'{}');
  if(!keys.publicKey||!keys.privateKey||!credentials.password)throw new Error('setup-missing');
  app=initializeApp({apiKey:credentials.apiKey,projectId:credentials.projectId});
  await signInWithEmailAndPassword(getAuth(app),credentials.email,credentials.password);
  const summary=await processPush({store:mailStore(getFirestore(app),'push'),publicKey:keys.publicKey,
    dryRun:process.env.MAIL_DRY_RUN!=='false',send:(device,payload)=>webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},payload,
      {vapidDetails:{subject:`mailto:${process.env.MAIL_SENDER_EMAIL}`,publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:3600,timeout:20000})});
  console.log(JSON.stringify(summary));if(summary.result==='error')process.exitCode=1;
}catch{console.error('Telefon bildirim yürütücüsü tamamlanamadı. Anahtar ve servis ayarlarını kontrol edin.');process.exitCode=1;}
finally{if(app){await signOut(getAuth(app));await deleteApp(app);}}
