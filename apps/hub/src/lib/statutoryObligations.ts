import type { WithId, Assignment, Unit, Term, Member } from './types';
import type { Asset, HubEvent, Handover, Meeting, Project, ReportSnapshot, InventoryItem } from './opsTypes';
import type { StatutoryCase, StatutoryObligation, StatutoryPolicy } from './statutoryTypes';
import { caseDeadline, DAY } from './statutory';

export interface ObligationSources {
  events: WithId<HubEvent>[]; units: WithId<Unit>[]; assignments: WithId<Assignment>[];
  meetings: WithId<Meeting>[]; projects: WithId<Project>[]; reports: WithId<ReportSnapshot>[];
  handovers: WithId<Handover>[]; assets: WithId<Asset>[]; members: WithId<Member>[];
  inventory: WithId<InventoryItem>[]; cases: WithId<StatutoryCase>[]; term: WithId<Term> | null;
}
/** Kaynaklardan her seferinde hesaplanır; eski alarmı kapatmak kaynak yükümlülüğünü gizlemez. */
export function statutoryObligations(s: ObligationSources, p: StatutoryPolicy, now = Date.now()): StatutoryObligation[] {
  const out:StatutoryObligation[]=[];
  const add=(id:string,title:string,article:string,owner:string,dueAt:number,link:string,detail:string,review=false)=>out.push({id,title,article,owner,dueAt,link,detail,severity:review?'review':dueAt<now?'overdue':'upcoming'});
  for(const e of s.events) {
    const end=Date.parse(e.endsAt||e.startsAt||'');
    if(Number.isFinite(end) && end<now && e.status!=='cancelled' && e.status!=='rejected' && (!e.checklist.filesArchived || !e.driveLink || !e.report.summary)) add(`archive-${e.id}`,`${e.name}: etkinlik arşivi`, '56','Genel Sekreter / etkinlik sorumlusu',end+p.limits.archiveDays*DAY,`/etkinlikler/${e.id}`,'Fotoğraflar, rapor ve belgeler en geç bir hafta içinde dijital arşive işlenmeli.');
  }
  const boardMeetings=s.meetings.filter(m=>m.status==='final' && !!m.boardId);
  const yk=boardMeetings.filter(m=>['yk','joint'].includes(m.boardId!)).sort((a,b)=>b.date.localeCompare(a.date));
  const lastMeeting=yk[0]?Date.parse(yk[0].date):s.term?.startsAt.toMillis();
  if(lastMeeting) add('yk-meeting','YK toplantı aralığı','42','Genel Sekreter',lastMeeting+p.limits.boardMeetingDays*DAY,'/kurullar?sekme=toplantilar','YK yirmi günde en az bir kez toplanmalı.');
  for(const u of s.units.filter(u=>u.active && u.type==='committee')) {
    const held=s.assignments.filter(a=>a.unitId===u.id && a.status==='active' && a.startsAt.toMillis()<=now && (!a.endsAt || a.endsAt.toMillis()>now));
    const vice=held.filter(a=>a.roleId===p.roles.committeeVice?.split('__')[1]).length, coordination=held.filter(a=>a.roleId===p.roles.committeeCoordination?.split('__')[1]).length, advisor=held.filter(a=>a.roleId===p.roles.committeeAdvisor?.split('__')[1]).length;
    if(vice<1 || coordination<2 || advisor<1) add(`team-${u.id}`,`${u.name}: asgari ekip eksik`,'78.a','Komite başkanı',now,`/birimler/${u.id}`,`Başkan yardımcısı ${vice}/1, koordinasyon ${coordination}/2, danışman ${advisor}/1.`,true);
    const report=s.reports.filter(r=>r.type==='weekly' && (r.data as {unitId?:string}).unitId===u.id).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd))[0];
    const filed=s.cases.filter(c=>c.kind==='weekly_report'&&c.status==='approved'&&c.unitId===u.id).sort((a,b)=>b.updatedAt.toMillis()-a.updatedAt.toMillis())[0];
    const reportBase=Math.max(report?Date.parse(report.periodEnd):0,filed?.updatedAt.toMillis()||0)||s.term?.startsAt.toMillis();
    if(reportBase) add(`weekly-${u.id}`,`${u.name}: haftalık rapor`,'78.d','Komite başkanı',reportBase+p.limits.weeklyReportDays*DAY,'/raporlar','Haftalık İK–YK toplantısına rapor sunulmalı.');
    if(s.term && s.term.endsAt.toMillis()<=now && !s.events.some(e=>e.unitId===u.id && ['held','closing','reported','archived'].includes(e.status) && Date.parse(e.startsAt||'')>=s.term!.startsAt.toMillis() && Date.parse(e.startsAt||'')<=s.term!.endsAt.toMillis()) && !s.projects.some(v=>v.unitId===u.id && v.status==='completed' && Date.parse(v.endDate||'')>=s.term!.startsAt.toMillis())) add(`passive-${u.id}`,`${u.name}: faaliyet değerlendirmesi`,'79.a','YK / Denetleme',s.term.endsAt.toMillis(),'/surecler','Dönemde etkinlik/proje görülmedi. Pasif statü için YK kararı gerekir; otomatik görevden alma yapılmaz.',true);
  }
  if(s.term) {
    const start=s.term.startsAt.toMillis(),end=s.term.endsAt.toMillis();
    const count=(kind:string)=>s.cases.filter(c=>c.kind===kind&&c.status==='approved'&&c.updatedAt.toMillis()>=start&&c.updatedAt.toMillis()<=end).length;
    for(const [kind,target,title,article,owner] of [['general_assembly',2,'Genel Kurul', '103','Genel Sekreter'],['audit_period',2,'Denetleme incelemesi','91','Denetleme'],['actor_annual',1,'ACTOR yillik raporu ve nihai yedek','36, 37','ACTOR'],['advisory_annual',1,'Yuksek Istisare Kurulu toplantisi','94','Genel Sekreter'],['annual_plan',1,'Yillik faaliyet plani','54','YK / Genel Sekreter']] as const) {
      const completed=count(kind);if(completed<target)add(`annual-${kind}`,`${title}: ${completed}/${target}`,article,owner,end,'/surecler','Donem icindeki onayli surec dosyalari sayilir; teslim kaniti ve makam onayi gerekir.');
    }
    const lastYk=yk[0]?Date.parse(yk[0].date):0;
    const cash=s.cases.some(c=>c.kind==='finance_balance'&&c.status==='approved'&&c.updatedAt.toMillis()>=lastYk);
    if(lastYk&&!cash)add('cash-meeting','YK toplantisi kasa raporu','58','Finansal Direktor',lastYk,'/surecler','Her YK toplantisinda bakiye raporu ve tutanak kaydi gerekir.',true);
  }
  for(const a of s.assignments.filter(a=>a.status==='ended' && a.endedAt)) {
    const end=a.endedAt!.toMillis();
    if(!s.handovers.some(h=>h.authorUid===a.uid && h.roleId===a.roleId && h.unitId===a.unitId && h.status==='accepted' && h.updatedAt?.toMillis()>=end)) {
      add(`digital-${a.id}`,`${a.memberName}: dijital erişim devri`,'71','Eski görevli / TechOps',end+p.limits.digitalHandoverHours*3600000,'/devir','Dijital sahiplik, şifre ve kurtarma bilgisi devri; şifreleri Hub kaydına yazmayın.');
      const days=a.roleId==='actor'?p.limits.actorHandoverDays:a.roleId.includes('techops')?p.limits.technicalHandoverDays:p.limits.electionHandoverDays;
      add(`handover-${a.id}`,`${a.memberName}: devir tutanağı`,a.roleId==='actor'?'37':a.roleId.includes('techops')?'75':'82','Görevli / Denetleme',end+days*DAY,'/devir','Yedek, yıllık rapor, kasa ve zimmet teslim belgeleri tamamlanmalı.');
    }
    const unreturned=s.assets.filter(v=>v.custodianUid===a.uid && v.status==='assigned');
    if(unreturned.length) add(`assets-${a.id}`,`${a.memberName}: ${unreturned.length} teslim edilmemiş zimmet`,'60-EK','Genel Sekreter / Finansal Direktör',end,'/demirbas','İade hareketi ve tutanak kaydı gerekir; disiplin dosyası ayrı kararla yürür.',true);
  }
  for(const c of s.cases) {
    const due=caseDeadline(c,p);
    if(due) add(`case-${c.id}`,`${c.title}: ${p.flows[c.kind]?.stages[c.step]?.label}` ,p.flows[c.kind]?.articles||'',p.flows[c.kind]?.stages[c.step]?.authority||'',due,`/surecler?dosya=${c.id}`,'Süre aşımı otomatik onay veya ihraç değildir; ilgili merciye sevk kaydı gerekir.');
    if(c.kind==='emergency_access' && c.status==='approved') add(`ratify-${c.id}`,`${c.title}: ilk YK toplantısında resmileştirme`,'20-EK','Başkan / Genel Sekreter',c.updatedAt.toMillis(),'/kurullar','Acil tedbirin ilk YK toplantısında karar defterine bağlanması gerekir.',true);
  }
  for(const m of s.members.filter(m=>m.status==='left')) {
    const start=m.updatedAt?.toMillis();
    if(start) { const d=new Date(start);d.setUTCFullYear(d.getUTCFullYear()+p.limits.retentionYears);add(`retention-${m.uid}`,`${m.displayName}: saklama süresi`,'70-EK','TechOps',d.getTime(),'/surecler','Beş yıl sonunda anonimleştirme/silme için onaylı veri işlemi süreci açılmalı.'); }
  }
  for(const item of s.inventory.filter(i=>i.kind==='system' || i.kind==='access')) {
    const email=Object.entries(item.fields).find(([k])=>/email|e-posta|eposta/i.test(k))?.[1];
    if(email && !email.toLowerCase().endsWith('@ikc.edu.tr') && email.toLowerCase()!=='ieeeikcu@gmail.com') add(`ownership-${item.id}`,`${item.title}: kurumsal sahiplik kontrolü`,'71-EK.a','TechOps / YK Başkanı',now,'/yonetim/envanter','Kök hesap, kurtarma e-postası ve kulübün resmî hattı kontrol edilmeli.',true);
  }
  return out.sort((a,b)=>a.dueAt-b.dueAt);
}

export function absenceAlerts(meetings: {date:string;board:string;rosterUids:string[];attendeeUids:string[];excusedUids:string[]}[], boardLimit=2, consecutiveLimit=3) {
  const histories=new Map<string,{yk:number;consecutive:number}>();
  for(const m of [...meetings].sort((a,b)=>a.date.localeCompare(b.date))) for(const uid of m.rosterUids) {
    const previous=histories.get(uid)||{yk:0,consecutive:0};
    if(m.attendeeUids.includes(uid) || m.excusedUids.includes(uid)) previous.consecutive=0;
    else { previous.consecutive++;if(m.board==='yk') previous.yk++; }
    histories.set(uid,previous);
  }
  return [...histories].filter(([,h])=>h.yk>=boardLimit || h.consecutive>=consecutiveLimit).map(([uid,h])=>({uid,...h}));
}
