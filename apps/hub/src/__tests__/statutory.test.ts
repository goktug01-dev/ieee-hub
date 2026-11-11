import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { activityEligible, addStatutoryDays, reserveAllocation } from '../lib/statutory';
import { absenceAlerts, statutoryObligations, type ObligationSources } from '../lib/statutoryObligations';
import { DEFAULT_STATUTORY_POLICY } from '../lib/statuteCatalog';
import { decryptBackup, encryptedExport } from '../lib/statutoryBackup';
import type { AnnualActivity, ActivityYear, StatutoryPolicy } from '../lib/statutoryTypes';

describe('Tüzük hesapları ve dosya güvenliği',()=>{
  it('İş günü Türkiye takviminde hafta sonunu ve ilan edilmiş tatili atlar',()=>{
    const start=Date.parse('2026-10-02T10:00:00+03:00');
    expect(new Date(addStatutoryDays(start,1,true,['2026-10-05'])).toISOString()).toBe('2026-10-06T07:00:00.000Z');
    expect(addStatutoryDays(start,7,false)-start).toBe(7*86400000);
  });
  it('Aktiflik yıllık XP ile belirlenir; sıfır bakiye ve harcama oy hakkını düşürmez',()=>{
    const year={threshold:10,inclusive:false} as ActivityYear;
    const member={status:'final',annualXp:11,balance:0,registered:true,reachable:true} as AnnualActivity;
    expect(activityEligible(member,year)).toBe(true);
    expect(activityEligible({...member,annualXp:10},year)).toBe(false);
    expect(activityEligible({...member,status:'actor_verified'},year)).toBe(false);
    expect(activityEligible({...member,reachable:false},year)).toBe(false);
  });
  it('Mazeret ve katılım ardışık devamsızlığı keser; YK iki toplantı eşiği ayrıca izlenir',()=>{
    const make=(date:string,attendeeUids:string[],excusedUids:string[]=[])=>({date,board:'yk',rosterUids:['u'],attendeeUids,excusedUids});
    expect(absenceAlerts([make('2026-10-01',[]),make('2026-10-02',[],['u']),make('2026-10-03',[])])).toEqual([{uid:'u',yk:2,consecutive:1}]);
    expect(absenceAlerts([make('2026-10-01',[],['u']),make('2026-10-02',['u'])])).toEqual([]);
  });
  it('Acil fon kuruş hassasiyetinde ayrılır',()=>{expect(reserveAllocation(100.15,10)).toEqual({reserve:10.02,operating:90.13});});
  it('Tamamlanmamış etkinlik arşivi süreyi geçince uyarır; tamamlanınca uyarı kalkar',()=>{
    const p={...DEFAULT_STATUTORY_POLICY,publishedBy:'u',publishedAt:Timestamp.now()} as StatutoryPolicy;
    const sources={events:[{id:'e',name:'Test',status:'held',endsAt:'2026-09-01T12:00:00Z',startsAt:'2026-09-01T10:00:00Z',checklist:{filesArchived:false},driveLink:'',report:{summary:''}}],units:[],assignments:[],meetings:[],projects:[],reports:[],handovers:[],assets:[],members:[],inventory:[],cases:[],term:null} as unknown as ObligationSources;
    expect(statutoryObligations(sources,p,Date.parse('2026-09-10'))[0].severity).toBe('overdue');
    sources.events[0].checklist.filesArchived=true;sources.events[0].driveLink='https://example.org/archive';sources.events[0].report.summary='Rapor';
    expect(statutoryObligations(sources,p,Date.parse('2026-09-10'))).toEqual([]);
  });
  it('Şifreli yedek açılabilir; yanlış şifre ve değiştirilmiş içerik reddedilir',async()=>{
    const value={users:{u:{annualXp:7}},text:'Türkçe veri'},pw='Bir guvenli sifre 2026';
    const first=await encryptedExport(value,pw),second=await encryptedExport(value,pw);
    expect(first.payload).not.toContain('Türkçe veri');expect(first.digest).toMatch(/^[a-f0-9]{64}$/);expect(first.payload).not.toBe(second.payload);
    expect(await decryptBackup(first.payload,pw)).toEqual(value);
    await expect(decryptBackup(first.payload,'Yanlis sifre 2026')).rejects.toThrow();
    const changed=JSON.parse(first.payload);changed.data=(changed.data[0]==='A'?'B':'A')+changed.data.slice(1);
    await expect(decryptBackup(JSON.stringify(changed),pw)).rejects.toThrow();
  });
});
