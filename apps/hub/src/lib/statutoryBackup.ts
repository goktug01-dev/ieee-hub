interface EncryptedBackup {
  format: 'ieee-hub-encrypted-backup-v1'; cipher: 'AES-256-GCM'; kdf: 'PBKDF2-SHA256';
  iterations: number; salt: string; iv: string; data: string;
}
function encode(bytes:Uint8Array) { let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s); }
function decode(value:string) { return Uint8Array.from(atob(value),c=>c.charCodeAt(0)); }
async function backupKey(password:string,salt:Uint8Array<ArrayBuffer>,usage:KeyUsage[]) {
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,usage);
}
export async function encryptedExport(value:unknown,password:string) {
  if(password.length<12)throw new Error('Yedek şifresi en az 12 karakter olmalı.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await backupKey(password,salt,['encrypt']);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value)));
  const envelope:EncryptedBackup={format:'ieee-hub-encrypted-backup-v1',cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:310000,salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(encrypted))};
  const payload=JSON.stringify(envelope);
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  return {payload,digest};
}
/** Yalnız yerel dosya çözümü; uzak veritabanına geri yükleme yapmaz. */
export async function decryptBackup(payload:string,password:string):Promise<unknown> {
  const e=JSON.parse(payload) as EncryptedBackup;
  if(e.format!=='ieee-hub-encrypted-backup-v1'||e.cipher!=='AES-256-GCM'||e.kdf!=='PBKDF2-SHA256'||e.iterations!==310000)throw new Error('Desteklenmeyen yedek biçimi.');
  const salt=decode(e.salt),iv=decode(e.iv);
  if(salt.length!==16||iv.length!==12)throw new Error('Yedek başlığı geçersiz.');
  const key=await backupKey(password,salt,['decrypt']);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,decode(e.data));
  return JSON.parse(new TextDecoder().decode(decrypted));
}
