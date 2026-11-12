import { deleteDoc,doc,getDoc,serverTimestamp,setDoc } from 'firebase/firestore';
import { auth,db } from '../firebase';
export interface PushConfig { enabled:boolean;publicKey:string; }
export interface PushDevice { endpoint:string;p256dh:string;auth:string;publicKey:string;petitions:boolean;tasks:boolean; }
const STORAGE='ieee-hub-push-device';
export function pushBinding():{uid:string;id:string}|null {
  try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null');return typeof value?.uid==='string'&&/^[a-f0-9]{64}$/.test(value.id)?value:null;}catch{return null;}
}
export async function disablePush() {
  const binding=pushBinding();
  localStorage.removeItem(STORAGE);
  window.dispatchEvent(new Event('ieee-push-device-changed'));
  if('serviceWorker' in navigator) {
    const registration=await navigator.serviceWorker.getRegistration('/');
    await (await registration?.pushManager.getSubscription())?.unsubscribe();
  }
  if(binding && binding.uid===auth.currentUser?.uid)await deleteDoc(doc(db,'pushSubscriptions',binding.uid,'devices',binding.id));
}
export async function enablePush(config:PushConfig) {
  const uid=auth.currentUser?.uid;
  if(!uid||!config.enabled)throw new Error('Telefon bildirim servisi açık değil.');
  if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator))throw new Error('Bu tarayıcı telefon bildirimlerini desteklemiyor. iPhone’da uygulamayı Ana Ekran’a ekleyip oradan açın.');
  if(await Notification.requestPermission()!=='granted')throw new Error('Bildirim izni verilmedi. Tarayıcı/telefon ayarlarından değiştirebilirsiniz.');
  const registration=await navigator.serviceWorker.getRegistration('/');
  if(!registration?.active)throw new Error('Canlı uygulamayı yenileyip tekrar deneyin.');
  await disablePush();
  const padded=config.publicKey.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-config.publicKey.length%4)%4);
  const key=Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
  const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  const data=subscription.toJSON(),endpoint=data.endpoint!;
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));
  const id=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
  try {
    await setDoc(doc(db,'pushSubscriptions',uid,'devices',id),{endpoint,p256dh:data.keys!.p256dh,auth:data.keys!.auth,
      publicKey:config.publicKey,petitions:true,tasks:true,updatedAt:serverTimestamp()});
  }catch{await subscription.unsubscribe();throw new Error('Cihaz kaydı tamamlanamadı. Chrome, Firefox veya Ana Ekran’a eklenmiş Safari uygulamasından deneyin.');}
  localStorage.setItem(STORAGE,JSON.stringify({uid,id}));
  window.dispatchEvent(new Event('ieee-push-device-changed'));
}
export async function savePushPreference(key:'tasks'|'petitions',value:boolean) {
  const binding=pushBinding();if(!binding || binding.uid!==auth.currentUser?.uid)throw new Error('Bu cihaz kayıtlı değil.');
  const target=doc(db,'pushSubscriptions',binding.uid,'devices',binding.id);
  const current=await getDoc(target);if(!current.exists())throw new Error('Cihaz kaydı bulunamadı.');
  await setDoc(target,{...current.data(),[key]:value,updatedAt:serverTimestamp()});
}
