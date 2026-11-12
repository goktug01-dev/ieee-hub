import { execFileSync } from 'node:child_process';
import * as webpush from 'web-push';
const gh=(args,input)=>execFileSync('gh',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,DEBUG:''}}).trim();
try {
  const repo=JSON.parse(gh(['repo','view','--json','nameWithOwner'])).nameWithOwner;
  const variables=JSON.parse(gh(['api',`repos/${repo}/actions/variables`])).variables;
  const existing=variables.find(v=>v.name==='PUSH_PUBLIC_KEY')?.value;
  if(existing){console.log(`Mevcut açık anahtar korunuyor:\n${existing}`);}
  else {
    const keys=webpush.generateVAPIDKeys();
    gh(['secret','set','PUSH_VAPID_KEYS','--repo',repo],JSON.stringify(keys));
    gh(['variable','set','PUSH_PUBLIC_KEY','--repo',repo,'--body',keys.publicKey]);
    console.log(`Gizli anahtar yalnız GitHub Secrets'a kaydedildi. Açık anahtar:\n${keys.publicKey}`);
  }
  console.log('Hub → Kurum ayarları → Telefon bildirimleri: açık anahtarı girip servisi açın. Üyeler telefonlarında Profilim → Bu cihazda bildirimleri aç düğmesine basmalı. Mail yürütücüsü erişimi ve MAIL_ENABLED açık olmalı. Push kuru kontrolünü GitHub Actions üzerinden başlatın.');
}catch{console.error('Push kurulumu tamamlanamadı. GitHub Secrets/Variables yetkisini kontrol edin.');process.exitCode=1;}
