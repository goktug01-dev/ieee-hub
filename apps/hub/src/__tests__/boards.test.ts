import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOARDS,
  absoluteMajority,
  buildRoster,
  decisionNumber,
  findChair,
  tallyVote,
  twoThirds,
  type BallotChoice,
  type BoardId,
  type Roster,
  type VoteRule,
  type VoteScope,
} from '../lib/boards';
import type { Assignment, WithId } from '../lib/types';

const person = (boards: BoardId[], roleKey = 'branch__yk-uyesi') => ({ name: 'x', roleKey, roleName: 'x', unitName: 'x', boards });

// 6 kişilik YK: yk1 başkan. 5 kişilik İK.
const YK = ['yk1', 'yk2', 'yk3', 'yk4', 'yk5', 'yk6'];
const IK = ['ik1', 'ik2', 'ik3', 'ik4', 'ik5'];
const roster: Roster = Object.fromEntries([
  ...YK.map((uid) => [uid, person(['yk'], uid === 'yk1' ? 'branch__baskan' : 'branch__yk-uyesi')]),
  ...IK.map((uid) => [uid, person(['ik'], 'cs__birim-baskani')]),
]);

function vote(scope: VoteScope, rule: VoteRule, choices: Record<string, BallotChoice>, extra: { recusedUids?: string[]; roster?: Roster; fullSizes?: Record<BoardId, number> } = {}) {
  const ballots = Object.fromEntries(Object.entries(choices).map(([uid, choice]) => [uid, { choice }]));
  return tallyVote(
    {
      scope,
      rule,
      roster: extra.roster ?? roster,
      recusedUids: extra.recusedUids ?? [],
      fullSizes: extra.fullSizes ?? { yk: 6, ik: 5 },
      chairUid: 'yk1',
    },
    ballots,
  );
}

const many = (uids: string[], choice: BallotChoice) => Object.fromEntries(uids.map((uid) => [uid, choice]));

describe('eşik hesapları', () => {
  it('salt çoğunluk ve üçte iki tüzükteki sayılarla uyuşur', () => {
    expect(absoluteMajority(6)).toBe(4); // Md. 40-EK.c: 6 kişilik YK'da salt çoğunluk 4
    expect(absoluteMajority(5)).toBe(3);
    expect(twoThirds(6)).toBe(4); // Md. 40-EK.a: YKK için 4 üye
    expect(twoThirds(9)).toBe(6);
    expect(twoThirds(10)).toBe(7);
  });
});

describe('Yönetim Kurulu oylaması', () => {
  it('nisap: 6 kişilik kurulda 4 üye oy kullanmadıkça karar çıkmaz (Md. 40)', () => {
    expect(vote('yk', 'majority', many(['yk1', 'yk2', 'yk3'], 'yes')).outcome).toBe('no_quorum');
    expect(vote('yk', 'majority', { ...many(['yk1', 'yk2', 'yk3'], 'yes'), yk4: 'abstain' }).outcome).toBe('accepted');
  });

  it('oy çokluğu: çekimser nisaba sayılır, karşılaştırmaya sayılmaz', () => {
    const t = vote('yk', 'majority', { yk1: 'yes', yk2: 'yes', yk3: 'no', yk4: 'abstain', yk5: 'abstain' });
    expect(t.outcome).toBe('accepted');
    expect(t.bodies[0]).toMatchObject({ yes: 2, no: 1, abstain: 2, notVoted: 1, quorum: 4 });
  });

  it('eşitlikte başkanın oyu iki sayılır (altın oy, Md. 40)', () => {
    expect(vote('yk', 'majority', { yk1: 'yes', yk2: 'yes', yk3: 'no', yk4: 'no' }).outcome).toBe('accepted');
    expect(vote('yk', 'majority', { yk1: 'no', yk2: 'no', yk3: 'yes', yk4: 'yes' }).outcome).toBe('rejected');
  });

  it('başkan çekimserse eşitlik çözülemez ve karar alınamaz', () => {
    const t = vote('yk', 'majority', { yk1: 'abstain', yk2: 'yes', yk3: 'no', yk4: 'abstain' });
    expect(t.outcome).toBe('rejected');
    expect(t.bodies[0].notes.join(' ')).toContain('altın oy işletilemedi');
  });

  it('YKK için tam sayının 2/3’ü (4) kabul gerekir; basit çoğunluk yetmez (Md. 40-EK.a)', () => {
    expect(vote('yk', 'twoThirds', { ...many(['yk1', 'yk2', 'yk3'], 'yes'), yk4: 'no', yk5: 'no' }).outcome).toBe('rejected');
    expect(vote('yk', 'twoThirds', many(['yk1', 'yk2', 'yk3', 'yk4'], 'yes')).outcome).toBe('accepted');
  });

  it('boş koltuk kabul sayılmaz: 5 görevli varken de 2/3 eşiği tam sayı 6 üzerinden 4’tür', () => {
    const five: Roster = Object.fromEntries(YK.slice(0, 5).map((uid) => [uid, roster[uid]]));
    const t = vote('yk', 'twoThirds', { ...many(['yk1', 'yk2', 'yk3'], 'yes'), yk4: 'no' }, { roster: five });
    expect(t.bodies[0]).toMatchObject({ fullSize: 6, required: 4 });
    expect(t.outcome).toBe('rejected');
  });

  it('oy birliği tam sayının tamamını ister', () => {
    expect(vote('yk', 'unanimous', { ...many(YK.slice(0, 5), 'yes'), yk6: 'abstain' }).outcome).toBe('rejected');
    expect(vote('yk', 'unanimous', many(YK, 'yes')).outcome).toBe('accepted');
  });

  it('hakkında karar verilen üye oy kullanamaz; eşikler kalan tam sayı üzerinden hesaplanır (Md. 16-EK.a)', () => {
    // yk6 hakkında ihraç oylaması: tam sayı 5 → oy birliği 5 kabul.
    const t = vote('yk', 'unanimous', { ...many(YK.slice(0, 5), 'yes'), yk6: 'no' }, { recusedUids: ['yk6'] });
    expect(t.bodies[0]).toMatchObject({ fullSize: 5, required: 5, no: 0 });
    expect(t.outcome).toBe('accepted');
  });

  it('listede olmayan kişinin oyu sayılmaz', () => {
    const t = vote('yk', 'majority', { ...many(['yk1', 'yk2'], 'no'), yk3: 'yes', yk4: 'yes', stranger: 'yes' });
    expect(t.bodies[0].yes).toBe(2);
    expect(t.outcome).toBe('rejected'); // eşitlik, başkan ret → altın oy ret
  });
});

describe('İdari Kurul ve ortak oylamalar', () => {
  it('İK eşitliğinde son söz YK Başkanındadır (Md. 46)', () => {
    expect(vote('ik', 'majority', { ik1: 'yes', ik2: 'no', ik3: 'abstain' }).outcome).toBe('tie_chair');
  });

  it('ortak oylamada altın oy işlemez; eşitlik Denetleme Kurulu’na gider (Md. 46-EK.a)', () => {
    const t = vote('joint', 'majority', { ...many(['yk1', 'yk2', 'yk3', 'ik1', 'ik2'], 'yes'), ...many(['yk4', 'yk5', 'ik3', 'ik4', 'ik5'], 'no') });
    expect(t.bodies).toHaveLength(1);
    expect(t.bodies[0]).toMatchObject({ fullSize: 11, quorum: 6, yes: 5, no: 5 });
    expect(t.outcome).toBe('tie_referred');
  });

  it('ortak oylamada iki kurulda birden bulunan kişi tek oy sayılır', () => {
    // İK'nın 5 koltuğundan biri YK üyesi yk2'de: 6 + 5 koltuk, 10 kişi.
    const dual: Roster = { ...roster, yk2: person(['yk', 'ik']) };
    delete dual.ik5;
    const t = vote('joint', 'majority', many([...YK, ...IK], 'yes'), { roster: dual });
    expect(t.bodies[0].fullSize).toBe(10);
    expect(t.bodies[0].yes).toBe(10);
  });

  it('"hem YK hem İK" oylamasında iki kurul ayrı ayrı kabul etmelidir (Md. 31)', () => {
    const ykYes = many(YK.slice(0, 4), 'yes');
    expect(vote('both', 'majority', { ...ykYes, ...many(IK.slice(0, 3), 'yes') }).outcome).toBe('accepted');
    expect(vote('both', 'majority', { ...ykYes, ...many(IK.slice(0, 3), 'no') }).outcome).toBe('rejected');
    expect(vote('both', 'majority', { ...ykYes, ik1: 'yes' }).outcome).toBe('no_quorum');
    const t = vote('both', 'majority', { ...ykYes, ik1: 'yes', ik2: 'no', ik3: 'abstain' });
    expect(t.outcome).toBe('pending'); // İK eşit: YK Başkanının son sözü beklenir
    expect(t.bodies.map((body) => body.outcome)).toEqual(['accepted', 'tie_chair']);
  });
});

describe('kurul üyeleri ve karar numarası', () => {
  const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
  const a = (uid: string, unitId: string, roleId: string, extra: Partial<Assignment> = {}): WithId<Assignment> => ({
    id: `${uid}-${roleId}`, uid, memberName: uid, roleId, roleName: roleId, unitId, unitName: unitId, termId: null,
    startsAt: ts('2026-01-01'), endsAt: null, status: 'active', source: 'manual', createdBy: 'x', createdAt: ts('2026-01-01'), ...extra,
  });

  it('YK kol geneli rollerden, İK komite rollerinden oluşur; bitmiş görev sayılmaz', () => {
    const assignments = [
      a('ayse', 'branch', 'baskan'),
      a('mehmet', 'branch', 'genel-sekreter'),
      a('zeynep', 'cs', 'birim-baskani'),
      a('ali', 'ras', 'birim-baskan-yardimcisi'),
      a('eski', 'wie', 'birim-baskani', { status: 'ended' }),
      a('bitti', 'pes', 'birim-baskani', { endsAt: ts('2026-02-01') }),
      a('gonullu', 'cs', 'gonullu'),
    ];
    const r = buildRoster(DEFAULT_BOARDS, assignments, ['yk', 'ik'], new Date('2026-09-29').getTime());
    expect(Object.keys(r).sort()).toEqual(['ali', 'ayse', 'mehmet', 'zeynep']);
    expect(r.ayse.boards).toEqual(['yk']);
    expect(r.zeynep).toMatchObject({ boards: ['ik'], roleKey: 'cs__birim-baskani' });
    expect(findChair(DEFAULT_BOARDS, r)).toBe('ayse');
  });

  it('karar numarası kurul, yıl ve sıra içerir', () => {
    expect(decisionNumber('YK', 2026, 7)).toBe('YK-2026/007');
  });
});
