import { get, ref, serverTimestamp, update } from 'firebase/database';
import { externalServices } from './externalFirebase';
import type { ExternalFirebaseConfig } from './opsTypes';
import type { ActivityYear } from './statutoryTypes';

export function annualSiteXp(user:Record<string,unknown>,yearId:string) {
  if(user.activityYear!==yearId || !Number.isInteger(user.annual_start_earned) || !Number.isInteger(user.lifetime_earned) || Number(user.lifetime_earned)<Number(user.annual_start_earned))throw new Error('Site kaydında bu yılın başlangıç XP kaydı bulunmuyor; ACTOR yıllık kayıtları incelemeli.');
  return Number(user.lifetime_earned)-Number(user.annual_start_earned);
}
/** Yıl sınırı bir kez uygulanır; önceki kayıt ve işlem makbuzu aynı atomik güncellemeye dahildir. */
export async function startSiteActivityYear(config:ExternalFirebaseConfig,yearId:string,year:ActivityYear) {
  if(year.startsAt.toMillis()>Date.now()||year.endsAt.toMillis()<=Date.now())throw new Error('Yalnız başlamış ve bitmemiş eğitim yılı açılabilir.');
  const services=externalServices(config),db=services.realtime,uid=services.auth.currentUser?.uid;
  if(!db||!uid)throw new Error('Yetkili site hesabıyla bağlanın.');
  const current=(await get(ref(db,'activity_current'))).val();
  if(current?.id===yearId)throw new Error('Bu yıl zaten açılmış. Tekrar sıfırlama yapılmaz.');
  const users=(await get(ref(db,'users'))).val() as Record<string,Record<string,unknown>>|null;
  if(!users||!Object.keys(users).length)throw new Error('Arşivlenecek site üye kaydı bulunamadı.');
  const changes:Record<string,unknown>={
    [`activity_rollovers/${yearId}`]:{yearId,previousYearId:current?.id||'legacy',sourceCaseId:year.caseId,byUid:uid,at:serverTimestamp(),memberCount:Object.keys(users).length},
    [`activity_year_archives/${yearId}`]:{previousYearId:current?.id||'legacy',sourceCaseId:year.caseId,byUid:uid,at:serverTimestamp(),users},
    activity_current:{id:yearId,startsAt:year.startsAt.toMillis(),endsAt:year.endsAt.toMillis(),sourceCaseId:year.caseId,byUid:uid,at:serverTimestamp()},
  };
  for(const [key,value] of Object.entries(users)) {
    const earned=value.lifetime_earned??0;
    if(!Number.isInteger(earned)||Number(earned)<0)throw new Error(`${key}: yaşam boyu XP geçersiz. Sıfırlamadan önce kayıt düzeltilmeli.`);
    changes[`users/${key}/activityYear`]=yearId;
    changes[`users/${key}/annual_start_earned`]=earned;
    changes[`users/${key}/sadakat`]=0;
    if(value.lifetime_earned==null)changes[`users/${key}/lifetime_earned`]=0;
  }
  await update(ref(db),changes);
  return Object.keys(users).length;
}
