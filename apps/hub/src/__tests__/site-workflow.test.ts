import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Timestamp } from 'firebase/firestore';
const mock = vi.hoisted(() => ({ sources: new Map<string, unknown>(), remote: new Map<string, unknown>(), writes: vi.fn(), receipts: vi.fn() }));
vi.mock('../firebase', () => ({ auth: { currentUser: { uid:'hub-actor' } }, db:{} }));
vi.mock('../lib/externalFirebase', () => ({ externalServices: () => ({ auth:{currentUser:{uid:'site-actor'}},realtime:{} }) }));
vi.mock('firebase/firestore', async original => ({ ...await original<typeof import('firebase/firestore')>(), doc: (_db:unknown,c:string,id:string) => `${c}/${id}`, getDocFromServer: async (path:string) => ({ exists:()=>mock.sources.has(path), data:()=>mock.sources.get(path) }), setDoc:mock.receipts, serverTimestamp:()=> 'SERVER_TIME' }));
vi.mock('firebase/database', () => ({ ref:(_db:unknown,path='')=>path, get:async(path:string)=>({val:()=>mock.remote.get(path),exists:()=>mock.remote.has(path)}), update:mock.writes, serverTimestamp:()=> 'REMOTE_TIME' }));
import { publishSiteSource, siteQrController } from '../lib/siteWorkflow';
import type { ExternalFirebaseConfig } from '../lib/opsTypes';
import type { Access } from '../lib/types';
const config: ExternalFirebaseConfig = { projectId:'site',siteUnitMap:{cs:'site-cs'},apiKey:'web',authDomain:'site.test',appId:'app',databaseURL:'https://site.test',resources:[],updatedBy:'admin',updatedAt:Timestamp.fromMillis(1) };
const event = { name:'Etkinlik',description:'Açıklama',startsAt:'2026-10-10T12:00:00Z',endsAt:null,location:'İzmir',status:'approved',unitId:'cs',unitName:'CS',createdAt:Timestamp.fromMillis(1),updatedAt:Timestamp.fromMillis(2) };
beforeEach(()=>{mock.sources.clear();mock.remote.clear();mock.writes.mockReset().mockResolvedValue(undefined);mock.receipts.mockReset().mockResolvedValue(undefined);});
describe('Hub → site iş akışı',()=>{
  it('onaylı etkinliği yayımlar ve taslak etkinliği yayımlamaz',async()=>{
    mock.sources.set('events/e',event);await publishSiteSource(config,'event','e');
    expect(mock.writes.mock.calls[0][1]['events/hub-e']).toMatchObject({title:'Etkinlik',status:'published',source:'hub',visibility:'public'});
    mock.writes.mockClear();mock.sources.set('events/e',{...event,status:'proposed'});await publishSiteSource(config,'event','e');expect(mock.writes).not.toHaveBeenCalled();
  });
  it('iptal edilen etkinliği kaldırır; sitedeki başka kaynakları silmez',async()=>{
    mock.sources.set('events/e',{...event,status:'cancelled'});mock.remote.set('events/hub-e',{source:'hub'});await publishSiteSource(config,'event','e');expect(mock.writes).toHaveBeenCalledWith('',{'events/hub-e':null});
    mock.writes.mockClear();mock.remote.set('events/hub-e',{source:'site'});await publishSiteSource(config,'event','e');expect(mock.writes).not.toHaveBeenCalled();
  });
  it('duyuruyu aynı kimlikle günceller, ilk site yazarını korur',async()=>{
    mock.sources.set('siteAnnouncements/a',{title:'Yeni',content:'Metin',link:'',pinned:false,status:'published',createdAt:Timestamp.fromMillis(1),updatedAt:Timestamp.fromMillis(2)});
    mock.remote.set('public_announcements/hub-a',{title:'Eski',content:'Metin',createdAt:1,createdByUid:'first'});await publishSiteSource(config,'announcement','a');expect(mock.writes.mock.calls[0][1]['public_announcements/hub-a'].createdByUid).toBe('first');
  });
  it('ACTOR doğrulamasından önce QR oluşturmaz; sonrasında iki dizine atomik yazar',async()=>{
    const p={points:20,status:'requested',expiresAt:Timestamp.fromMillis(Date.now()+86400000),createdAt:Timestamp.fromMillis(1),updatedAt:Timestamp.fromMillis(2)};
    mock.sources.set('events/e',event);mock.sources.set('eventPointRequests/e',p);await publishSiteSource(config,'qr','e');expect(mock.writes).not.toHaveBeenCalled();
    mock.sources.set('eventPointRequests/e',{...p,status:'approved'});await publishSiteSource(config,'qr','e');const changes=mock.writes.mock.calls[0][1];expect(changes['committee_qrs/site-cs/hub-event-e'].puan).toBe(20);expect(changes['valid_qrs/hub-event-e']).toMatchObject({puan:20,active:true,committeeId:'site-cs'});
  });
  it('başarısız aktarımı görünür kaydeder, sonraki denemede gönderir',async()=>{
    mock.sources.set('events/e',event);mock.writes.mockRejectedValueOnce(new Error('permission-denied'));await expect(publishSiteSource(config,'event','e')).rejects.toThrow('permission-denied');expect(mock.receipts.mock.calls[0][1].status).toBe('failed');await publishSiteSource(config,'event','e');expect(mock.receipts.mock.lastCall?.[1].status).toBe('synced');
  });
  it('biten veya iptal edilen etkinliğin QR’ını iki dizinde kapatır',async()=>{
    mock.sources.set('eventPointRequests/e',{points:20,status:'approved',expiresAt:Timestamp.fromMillis(Date.now()+86400000),createdAt:Timestamp.fromMillis(1),updatedAt:Timestamp.fromMillis(2)});
    for (const e of [{...event,status:'cancelled'}, {...event,status:'held'}, {...event,endsAt:new Date(Date.now()-1000).toISOString()}]) {
      mock.writes.mockClear();mock.sources.set('events/e',e);await publishSiteSource(config,'qr','e');const writes=mock.writes.mock.lastCall?.[1];expect(writes['committee_qrs/site-cs/hub-event-e'].active).toBe(false);expect(writes['valid_qrs/hub-event-e'].active).toBe(false);expect(writes['valid_qrs/hub-event-e'].puan).toBe(20);
    }
  });
  it('genel yöneticilik ACTOR görevinin yerine geçmez',()=>{expect(siteQrController({superAdmin:true,perms:{},roleKeys:{},tokens:[]} as Access)).toBe(false);expect(siteQrController({superAdmin:false,perms:{},roleKeys:{branch__actor:Timestamp.fromMillis(Date.now()+10000)},tokens:[]} as Access)).toBe(true);});
});
