import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { statutoryRoleChoices, validHolidayDates } from '../lib/statutorySetup';
import type { Assignment, Role, Unit, WithId } from '../lib/types';

describe('Tüzük makamı seçimi', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  const roles = [
    {id:'advisor-old',name:'Akademik Danışman',scope:'branch',active:true},
    {id:'advisor-new',name:'Akademik Danışman',scope:'branch',active:true},
    {id:'vice',name:'Başkan yardımcısı',scope:'unit',active:true},
    {id:'inactive',name:'Eski rol',scope:'branch',active:false},
  ] as WithId<Role>[];
  const units = [{id:'cs',name:'CS',active:true},{id:'ras',name:'RAS',active:true},{id:'closed',name:'Kapalı',active:false}] as WithId<Unit>[];
  const assignment = (changes: Partial<Assignment> = {}) => ({uid:'u',memberName:'Danışman',unitName:'Kol geneli',roleId:'advisor-old',unitId:'branch',status:'active',startsAt:Timestamp.fromMillis(now-1000),endsAt:Timestamp.fromMillis(now+1000),...changes}) as Assignment;

  it('Aynı adlı rolleri kimlikle ayırır ve görevliyi yalnız atanmış kayıtta gösterir', () => {
    const choices = statutoryRoleChoices(false, roles, units, [assignment()], now);
    expect(choices.find(c=>c.value==='branch__advisor-old')?.people).toEqual(['Danışman']);
    expect(choices.find(c=>c.value==='branch__advisor-new')?.people).toEqual([]);
    expect(choices.find(c=>c.value==='branch__advisor-old')?.label).toContain('branch__advisor-old');
  });

  it('Biten, gelecekte başlayan, süresi dolan veya başka birimdeki görevleri saymaz', () => {
    const choices = statutoryRoleChoices(false, roles, units, [
      assignment({status:'ended'}), assignment({startsAt:Timestamp.fromMillis(now+1000)}),
      assignment({endsAt:Timestamp.fromMillis(now)}), assignment({unitId:'cs'}),
    ], now);
    expect(choices.find(c=>c.value==='branch__advisor-old')?.people).toEqual([]);
  });

  it('Birim rolleri gerçek birimle seçilir; komite kalıbı yalnız birim rolleri sunar', () => {
    const choices = statutoryRoleChoices(false, roles, units, [], now);
    expect(choices.map(c=>c.value)).toEqual(['branch__advisor-old','branch__advisor-new','cs__vice','ras__vice']);
    const committees = statutoryRoleChoices(true, roles, units, [assignment({roleId:'vice',unitId:'cs',unitName:'CS'})], now);
    expect(committees.map(c=>c.value)).toEqual(['*__vice']);
    expect(committees[0].people).toEqual(['Danışman (CS)']);
  });

  it('Gerçek takvim tarihi ister; boş takvimi destekler', () => {
    expect(validHolidayDates([])).toBe(true);
    expect(validHolidayDates(['2028-02-29','2027-01-01'])).toBe(true);
    for (const value of ['2027-02-29','2027-02-30','2027-13-01','01.01.2027','2027-1-1']) expect(validHolidayDates([value])).toBe(false);
  });
});
