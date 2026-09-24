import type { ContentStatus, EventStatus, ProjectStatus, SponsorStage, TaskPriority, TaskStatus } from './opsTypes';

type Meta = { label: string; color: string };

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  todo: { label: 'Yapılacak', color: 'gray' },
  in_progress: { label: 'Devam ediyor', color: 'blue' },
  blocked: { label: 'Engellendi', color: 'orange' },
  done: { label: 'Tamamlandı', color: 'green' },
  cancelled: { label: 'İptal', color: 'dark' },
};

export const TASK_PRIORITY: Record<TaskPriority, Meta> = {
  low: { label: 'Düşük', color: 'gray' },
  normal: { label: 'Normal', color: 'blue' },
  high: { label: 'Yüksek', color: 'orange' },
  urgent: { label: 'Acil', color: 'red' },
};

export const PROJECT_STATUS: Record<ProjectStatus, Meta> = {
  planning: { label: 'Planlanıyor', color: 'gray' },
  active: { label: 'Sürüyor', color: 'blue' },
  completed: { label: 'Tamamlandı', color: 'green' },
  cancelled: { label: 'İptal', color: 'dark' },
};

export const EVENT_STATUS: Record<EventStatus, Meta & { step: number }> = {
  proposed: { label: 'Öneri (onay bekliyor)', color: 'yellow', step: 0 },
  approved: { label: 'Onaylandı', color: 'teal', step: 1 },
  rejected: { label: 'Reddedildi', color: 'red', step: -1 },
  planning: { label: 'Planlama', color: 'blue', step: 2 },
  registration_open: { label: 'Kayıt açık', color: 'indigo', step: 3 },
  held: { label: 'Gerçekleşti', color: 'grape', step: 4 },
  closing: { label: 'Kapanış', color: 'orange', step: 5 },
  reported: { label: 'Raporlandı', color: 'green', step: 6 },
  archived: { label: 'Arşivlendi', color: 'dark', step: 7 },
  cancelled: { label: 'İptal edildi', color: 'dark', step: -1 },
};

export const EVENT_FLOW: EventStatus[] = ['approved', 'planning', 'registration_open', 'held', 'closing', 'reported', 'archived'];

export const EVENT_TYPES = ['Seminer / konferans', 'Atölye', 'Yarışma / hackathon', 'Teknik gezi', 'Sosyal etkinlik', 'Kariyer', 'Diğer'];

export const CONTENT_STATUS: Record<ContentStatus, Meta> = {
  requested: { label: 'Talep edildi', color: 'gray' },
  accepted: { label: 'Kabul edildi', color: 'cyan' },
  in_production: { label: 'Hazırlanıyor', color: 'blue' },
  awaiting_approval: { label: 'Birim onayı bekliyor', color: 'yellow' },
  scheduled: { label: 'Yayına hazır', color: 'indigo' },
  published: { label: 'Yayımlandı', color: 'green' },
  rejected: { label: 'Reddedildi', color: 'red' },
  cancelled: { label: 'İptal', color: 'dark' },
};

export const CONTENT_TYPES: Record<string, string> = {
  announcement: 'Duyuru',
  event_promo: 'Etkinlik tanıtımı',
  event_recap: 'Etkinlik sonrası paylaşım',
  sponsor_thanks: 'Sponsor teşekkürü',
  other: 'Diğer',
};

export const CHANNELS = ['Instagram', 'LinkedIn', 'X', 'Web sitesi', 'E-posta', 'Discord', 'WhatsApp duyuru'];

export const SPONSOR_STAGE: Record<SponsorStage, Meta> = {
  prospect: { label: 'Aday', color: 'gray' },
  contacted: { label: 'İletişime geçildi', color: 'cyan' },
  proposal_sent: { label: 'Teklif gönderildi', color: 'blue' },
  negotiating: { label: 'Görüşülüyor', color: 'indigo' },
  agreed: { label: 'Anlaşıldı', color: 'green' },
  declined: { label: 'Olumsuz', color: 'red' },
  dormant: { label: 'Beklemede', color: 'dark' },
};

export const ACTIVE_SPONSOR_STAGES: SponsorStage[] = ['contacted', 'proposal_sent', 'negotiating'];
