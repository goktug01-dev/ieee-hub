import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processMail, fingerprint, eligible, deliveryId, roleKeys, mailMessage } from './core.mjs';

const now = 1800000000000;
const settings = { enabled: true, senderEmail: 'club@gmail.com', hubUrl: 'https://example.web.app', maxPerRun: 20, maxPerDay: 200 };
const task = { status: 'todo', assigneeUid: 'alice', mailAssignmentKey: 'first', createdAt: now };
const petition = { status: 'pending', ownerUid: 'owner', revision: 1, currentStep: 0, unitId: 'cs',
  steps: [{ unitMode: 'petition', roleIds: ['chair','vice'] }], stepApprovalRoleIds: [], visibleTo: ['role:cs__chair','role:cs__vice'] };
const access = { roleKeys: { cs__chair: now + 10000 }, tokens: ['role:cs__chair'] };
const target = { email: 'alice@example.com', petitions: true, tasks: true };
function fixture(kind = 'task') {
  const state = { source: structuredClone(kind === 'task' ? task : petition), deliveries: new Map(), sends: [], signals: [], counter: 0, health: null, sourceReads: 0 };
  const signal = { id: `${kind}_source`, kind, sourceId: 'source', state: 'pending' };
  const store = {
    settings: async () => settings,
    signals: async () => signal.state === 'pending' ? [signal] : [],
    source: async () => { state.sourceReads++; return state.source; },
    candidates: async () => [{ uid: 'alice' }],
    recipient: async () => ({ access, recipient: target }),
    delivery: async id => state.deliveries.get(id),
    claim: async (id, identity) => {
      if (state.counter >= settings.maxPerDay || ['sending','sent','uncertain'].includes(state.deliveries.get(id)?.state)) return null;
      state.counter++;
      const value = { ...identity, attempts: (state.deliveries.get(id)?.attempts ?? 0) + 1, state: 'sending', nextAttemptAt: 0 };
      state.deliveries.set(id, value); return value;
    },
    record: async (id, data) => { state.deliveries.set(id, data); },
    finishSignal: async (_signal, status, readyAt) => { signal.state = status; state.signals.push({ status, readyAt }); },
    health: async value => { state.health = value; },
  };
  const transport = { verify: async () => {}, sendMail: async message => { state.sends.push(message); return { accepted: [message.to.address] }; } };
  const run = (dryRun = false) => processMail({ store, transport, sender: settings.senderEmail, dryRun, now: () => now });
  return { state, signal, store, transport, run };
}

test('Görev bir kez gönderilir; tekrar kuyruklama veya başlık değişimi tekrar mail üretmez', async () => {
  const f = fixture(); assert.equal((await f.run()).sent, 1);
  f.signal.state = 'pending'; f.state.source.title = 'Değişti';
  assert.equal((await f.run()).sent, 0); assert.equal(f.state.sends.length, 1);
});
test('Yeni sorumluya atama ve aynı kişiye daha sonraki yeni atama farklı kimlik üretir', () => {
  assert.notEqual(fingerprint('task','t',task), fingerprint('task','t',{ ...task, assigneeUid: 'bob' }));
  assert.notEqual(fingerprint('task','t',task), fingerprint('task','t',{ ...task, mailAssignmentKey: 'second' }));
});
test('Dilekçe güncel birim/rol, süre, görünürlük, makam onayı ve başvuran ayrımını korur', () => {
  assert.equal(eligible('petition',petition,'alice',access,target,now), true);
  assert.equal(eligible('petition',petition,'owner',access,target,now), false);
  assert.equal(eligible('petition',petition,'alice',{ ...access, roleKeys: { cs__chair: now - 1 } },target,now), false);
  assert.equal(eligible('petition',{ ...petition, stepApprovalRoleIds: ['chair'] },'alice',access,target,now), false);
  assert.equal(eligible('petition',petition,'alice',{ ...access, tokens: [] },target,now), false);
  assert.deepEqual(roleKeys({ ...petition, steps: [{ unitMode: 'branch', roleIds: ['secretary'] }] }), ['branch__secretary']);
  assert.deepEqual(roleKeys({ ...petition, steps: [{ unitMode: 'fixed', unitId: 'audit', roleIds: ['member'] }] }), ['audit__member']);
});
test('Aynı adımın diğer makam onayı aynı kişiye mükerrer mail üretmez; yeni adım/revizyon üretir', () => {
  const a = fingerprint('petition','p',petition);
  assert.equal(a, fingerprint('petition','p',{ ...petition, stepApprovalRoleIds: ['vice'] }));
  assert.notEqual(a, fingerprint('petition','p',{ ...petition, currentStep: 1 }));
  assert.notEqual(a, fingerprint('petition','p',{ ...petition, revision: 2 }));
});
test('Kuru kontrol SMTP bağlantısını doğrular; gönderim, kota ve teslim kaydını değiştirmez', async () => {
  const f=fixture(); let verified=0; f.transport.verify=async()=>{verified++;};
  const result=await f.run(true); assert.equal(result.result,'ok'); assert.equal(verified,1);
  assert.equal(f.state.sends.length,0); assert.equal(f.state.deliveries.size,0); assert.equal(f.state.counter,0); assert.equal(f.signal.state,'pending');
});
test('Kapatılan kaynak, kapatılmış tercih veya erişim engeli nedeniyle bulunamayan alıcıya göndermez', async () => {
  const closed=fixture(); closed.state.source.status='done'; await closed.run(); assert.equal(closed.state.sends.length,0);
  const disabled=fixture(); disabled.store.recipient=async()=>({recipient:{...target,tasks:false}}); await disabled.run(); assert.equal(disabled.state.sends.length,0);
  const inactive=fixture(); inactive.store.recipient=async()=>({recipient:null}); await inactive.run(); assert.equal(inactive.state.sends.length,0);
});
test('İşlem sırasında tamamlanan görev veya geri çekilen dilekçe gönderimden önce yeniden kontrol edilir', async () => {
  const f=fixture(); f.store.candidates=async()=>{f.state.source.status='done';return[{uid:'alice'}];};
  await f.run(); assert.equal(f.state.sends.length,0);
});
test('İşlem sırasında değişen rol ve alıcı adresi tekrar doğrulanır; kötü biçimli adrese gönderilmez', async () => {
  const f=fixture('petition'); f.store.recipient=async()=>({access:{...access,roleKeys:{}},recipient:target});
  await f.run(); assert.equal(f.state.sends.length,0);
  assert.equal(eligible('task',task,'alice',null,{...target,email:'a@example.com\r\nBcc: other@example.com'},now),false);
});
test('Günlük kota rezervasyonu başarısızsa göndermez ve kaydı işlenmiş saymaz', async () => {
  const f=fixture(); f.store.claim=async()=>null; await f.run(); assert.equal(f.state.sends.length,0); assert.equal(f.signal.state,'pending');
});
test('SMTP açıkça geçici reddederse gecikmeli tekrar dener; farklı işler beklemek zorunda kalmaz', async () => {
  const f=fixture(); f.transport.sendMail=async()=>{throw{responseCode:451};}; await f.run();
  assert.equal([...f.state.deliveries.values()][0].state,'failed'); assert.equal(f.state.signals[0].readyAt,now+600000);
});
test('SMTP kalıcı ret veya DATA sırasında belirsiz ağ hatasında otomatik tekrar yapılmaz', async () => {
  const f=fixture(); f.transport.sendMail=async()=>{throw{code:'ETIMEDOUT',command:'DATA'};};
  assert.equal((await f.run()).uncertain,1); assert.equal(f.signal.state,'blocked');
  assert.equal([...f.state.deliveries.values()][0].state,'uncertain');
  const permanent=fixture(); permanent.transport.sendMail=async()=>{throw{responseCode:550};}; await permanent.run(); assert.equal(permanent.signal.state,'blocked');
});
test('SMTP kabulünden sonra kayıt yazılamazsa belirsiz sayar; ikinci kez mail atmaz', async () => {
  const f=fixture(); const record=f.store.record; f.store.record=async(id,data)=>{if(data.state==='sent')throw new Error('network');await record(id,data);};
  await f.run(); assert.equal(f.state.sends.length,1); assert.equal([...f.state.deliveries.values()][0].state,'uncertain');
  f.signal.state='pending'; await f.run(); assert.equal(f.state.sends.length,1);
});
test('Kesilen önceki yürütmenin rezervasyonu korunur; SMTP bağlantı hatası gönderim kotasını tüketmez', async () => {
  const f=fixture(); const id=deliveryId(fingerprint('task','source',task),'alice');
  f.state.deliveries.set(id,{state:'sending',attempts:1}); await f.run(); assert.equal(f.state.sends.length,0); assert.equal(f.signal.state,'blocked');
  const fail=fixture(); fail.transport.verify=async()=>{throw new Error('Gizli bilgi');};
  const result=await fail.run(); assert.equal(result.errorCode,'worker-failed'); assert.equal(fail.state.counter,0); assert.equal(JSON.stringify(result).includes('Gizli bilgi'),false);
});
test('İçerik kullanıcı metni içermez; yanlış gönderici ve güvenli olmayan adresler çalışmayı durdurur', async () => {
  const message=mailMessage(settings,'petition','a/b'); assert.match(message.text,/a%2Fb/);
  assert.throws(()=>mailMessage({...settings,hubUrl:'http://example.com'},'task','x'));
  assert.throws(()=>mailMessage({...settings,hubUrl:'https://evil@example.com'},'task','x'));
  const f=fixture(); f.store.settings=async()=>({...settings,senderEmail:'other@gmail.com'});
  assert.equal((await f.run()).errorCode,'sender-mismatch'); assert.equal(f.state.sends.length,0);
});
