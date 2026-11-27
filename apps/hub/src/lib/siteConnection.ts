import type { ExternalFirebaseConfig } from './opsTypes';

export type SiteCapability = 'qr' | 'calendar' | 'announcements' | 'members';
export interface SiteAccessInfo { grants: Record<string, number>; admin: boolean }
export const SITE_CAPABILITIES: Record<SiteCapability, string> = { qr: 'Puan QR aktarımı', calendar: 'Etkinlik aktarımı', announcements: 'Duyuru aktarımı', members: 'Site üyelik işlemleri' };

export function siteCapabilityState(info: SiteAccessInfo | null, capability: SiteCapability, now = Date.now()): 'allowed' | 'missing' | 'expired' | 'unknown' {
  if (!info) return 'unknown';
  // Site yöneticiliği Hub kaynaklı QR yazma hakkının yerine geçmez.
  if (capability !== 'qr' && info.admin) return 'allowed';
  const until = info.grants[capability];
  return typeof until !== 'number' ? 'missing' : until > now ? 'allowed' : 'expired';
}

export function externalConfigIssues(config: Partial<ExternalFirebaseConfig> | null): string[] {
  if (!config) return ['Site bağlantısı henüz kurulmadı.'];
  const missing = [['apiKey', 'API key'], ['authDomain', 'Auth domain'], ['projectId', 'Project ID'], ['appId', 'App ID']] as const;
  return missing.filter(([key]) => !config[key]?.trim()).map(([, label]) => `${label} eksik.`);
}

export function siteConnectionError(error: unknown): string {
  const { code = '', message = '' } = (error ?? {}) as { code?: string; message?: string };
  switch (code) {
    case 'auth/unauthorized-domain': return `Bu Hub adresi site projesinde izinli değil. TechOps, sitenin Firebase Authentication → Settings → Authorized domains listesine ${typeof window !== 'undefined' ? window.location.hostname : 'Hub alan adını'} adresini eklemeli.`;
    case 'auth/operation-not-allowed': return 'Site projesinde bu giriş yöntemi kapalı. Site hesabınızın e-posta/şifresini deneyin veya TechOps’tan Google girişini açmasını isteyin.';
    case 'auth/popup-blocked': return 'Tarayıcı Google giriş penceresini engelledi. Bu site için açılır pencereye izin verin veya e-posta ile giriş yapın.';
    case 'auth/popup-closed-by-user': case 'auth/cancelled-popup-request': return 'Google giriş penceresi kapatıldı. Bağlan düğmesiyle yeniden deneyebilirsiniz.';
    case 'auth/account-exists-with-different-credential': return 'Bu e-posta sitede başka bir giriş yöntemiyle kayıtlı. Studentbranches profil/puan sayfasında kullandığınız e-posta ve şifreyle bağlanın.';
    case 'auth/invalid-credential': case 'auth/wrong-password': case 'auth/user-not-found': return 'Site e-postası veya şifresi doğrulanamadı. Hub şifrenizi değil, studentbranches profil/puan hesabınızın şifresini kullanın.';
    case 'auth/user-disabled': return 'Bu site hesabı devre dışı. Site yöneticisi hesabın durumunu kontrol etmeli.';
    case 'auth/network-request-failed': case 'unavailable': return 'Siteye ulaşılamadı. İnternet bağlantısını kontrol edip yeniden deneyin.';
    case 'auth/too-many-requests': return 'Çok fazla giriş denemesi yapıldı. Bir süre bekleyip yeniden deneyin.';
    case 'PERMISSION_DENIED': case 'permission-denied': case 'database/permission-denied': return 'Site hesabında bu işlem için yetki yok veya sitenin veri kuralları isteği reddediyor. TechOps site hesabınızın yetkisini ve yayımlanmış site kurallarını kontrol etmeli.';
    default: return message || 'Site bağlantısı tamamlanamadı. Bağlantıyı yeniden kontrol edin.';
  }
}
