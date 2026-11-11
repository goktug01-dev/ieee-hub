import { Accordion, Alert, Button, Card, Group, Modal, NumberInput, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { Link } from 'react-router';
import { db } from '../firebase';
import { initialStatutoryPolicy, publishStatutoryPolicy, reserveAllocation } from '../lib/statutory';
import type { StatutoryPolicy } from '../lib/statutoryTypes';
import type { Assignment, Role } from '../lib/types';
import { useCollection } from '../lib/hooks';
import { useOrg } from '../lib/org';
import { DEFAULT_ROLES } from '../lib/setup';
import { STATUTORY_LIMIT_LABELS, STATUTORY_ROLE_LABELS, statutoryRoleChoices, validHolidayDates } from '../lib/statutorySetup';
import { ErrorAlert, notifyError, notifySuccess } from './ui';

export const STATUTORY_ROLES: Record<string,Role> = {
  'dis-isler-yardimcisi':{name:'Dış İşlerden Sorumlu Başkan Yardımcısı',scope:'branch',permissions:['sponsors.read','sponsors.manage','finance.read','governance.read','reports.read'],active:true,order:3},
  'teknik-projeler-yardimcisi':{name:'Teknik Projelerden Sorumlu Başkan Yardımcısı',scope:'branch',permissions:['work.manageAll','events.manageAll','inventory.manage','governance.read','reports.read'],active:true,order:6},
  'denetleme-baskani':{name:'Denetleme Kurulu Başkanı',scope:'branch',permissions:['governance.read','audit.read','elections.manage','reports.read','finance.read'],active:true,order:12},
  'denetleme-uyesi':{name:'Denetleme Kurulu Asil Üyesi',scope:'branch',permissions:['governance.read','audit.read','reports.read','finance.read'],active:true,order:13},
  'denetleme-yedek':{name:'Denetleme Kurulu Yedek Üyesi',scope:'branch',permissions:[],active:true,order:14},
  'akademik-danisman':{name:'Akademik Danışman',scope:'branch',permissions:['governance.read','reports.read'],active:true,order:15},
  'techops-baskani':{name:'TechOps Başkanı',scope:'branch',permissions:['inventory.manage','external.firebase.manage','governance.read','audit.read'],active:true,order:16},
  'techops-stajyeri':{name:'TechOps Stajyeri',scope:'unit',permissions:[],active:true,order:17},
  'koordinasyon-uyesi':{name:'Komite Koordinasyon Üyesi',scope:'unit',permissions:[],active:true,order:18},
  'komite-danismani':{name:'Komite Danışman Öğretim Görevlisi',scope:'unit',permissions:[],active:true,order:19},
};

export function StatutorySetupPanel({policy}:{policy:StatutoryPolicy|null}) {
  const { roles, units, loading } = useOrg();
  const assignments = useCollection<Assignment>('assignments');
  const [draft,setDraft]=useState<Omit<StatutoryPolicy,'publishedBy'|'publishedAt'>>(()=>policy?{name:policy.name,roles:policy.roles,holidays:policy.holidays,flows:policy.flows,limits:policy.limits}:initialStatutoryPolicy());
  const [holidayText, setHolidayText] = useState(()=>draft.holidays.join('\n'));
  const [busy,setBusy]=useState(false),[carryover,setCarryover]=useState<number|string>(0);
  const [review, setReview] = useState(false);
  const now = Date.now();
  const branchChoices = statutoryRoleChoices(false, roles, units, assignments.data, now);
  const committeeChoices = statutoryRoleChoices(true, roles, units, assignments.data, now);
  const mappings = Object.entries(draft.roles).map(([authority, key]) => ({
    authority, key, label: STATUTORY_ROLE_LABELS[authority] || authority,
    choices: authority.startsWith('committee') ? committeeChoices : branchChoices,
    selected: (authority.startsWith('committee') ? committeeChoices : branchChoices).find(choice => choice.value === key),
  }));
  const invalid = mappings.filter(item => !item.selected);
  const vacant = mappings.filter(item => item.selected && !item.selected.people.length);
  const datesValid = validHolidayDates(draft.holidays);
  const blocked = loading || assignments.loading || !!assignments.error || invalid.length > 0 || !datesValid || !draft.name.trim();
  const save=async()=>{if(blocked)return;setBusy(true);try{await publishStatutoryPolicy({...draft,name:draft.name.trim(),holidays:[...new Set(draft.holidays)].sort()});setReview(false);notifySuccess('Yeni politika sürümü yayımlandı; açık dosyalar önceki sürümde kalır.');}catch(e){notifyError(e);}finally{setBusy(false);}};
  const provision=async()=>{setBusy(true);try{
    const batch=writeBatch(db);let added=0;
    for(const [id,data] of Object.entries({actor:DEFAULT_ROLES.actor,...STATUTORY_ROLES})) {
      // Aynı adlı özel rolü otomatik değiştirmeyin veya ikinci kez oluşturmayın.
      if(roles.some(role=>role.name.trim().toLocaleLowerCase('tr')===data.name.toLocaleLowerCase('tr')))continue;
      if(!(await getDoc(doc(db,'roles',id))).exists()){batch.set(doc(db,'roles',id),data);added++;}
    }
    if(added)await batch.commit();
    notifySuccess(`${added} eksik rol eklendi. Aynı adlı mevcut roller korundu; eşleştirme listesinden uygun kaydı seçin. Görev ataması yapılmadı.`);
  }catch(e){notifyError(e);}finally{setBusy(false);}};
  const allocations=reserveAllocation(Number(carryover)||0,draft.limits.reservePercent);
  return <Stack data-testid="statutory-setup">
    <Alert title="Bir defalık tüzük kurulumu">Önce onay verecek makamların mevcut rollerini seçin, sonra takvimi kontrol edin. Tüzükteki süreler başlangıç değerleri olarak hazırdır. Bu ekran kişi atamaz; onay verecek kişinin seçilen rolde aktif görevi olmalıdır.</Alert>
    <ErrorAlert error={assignments.error}/>
    <TextInput label="Tüzük sürümü adı" description="Tüzük metninin sürümüdür; içinde bulunulan eğitim yılıyla aynı olmak zorunda değildir." value={draft.name} onChange={e=>setDraft({...draft,name:e.currentTarget.value})}/>
    <Text fw={600}>1. Onay verecek makamlar</Text>
    <Text size="sm" c="dimmed">Aynı adlı roller ayrı kayıtlardır. Rol kimliğini ve altında görünen aktif görevlileri kontrol ederek seçin. Listede bulunmayan makam için önce rol tanımı ekleyebilirsiniz.</Text>
    <Group><Button variant="light" loading={busy} disabled={loading} onClick={()=>void provision()}>Eksik tüzük rollerini ekle</Button><Button variant="default" component={Link} target="_blank" rel="noopener" to="/yonetim/atamalar">Görev atamalarını aç</Button><Button variant="default" component={Link} target="_blank" rel="noopener" to="/kurullar?sekme=uyeler">Kurul ayarlarını aç</Button></Group>
    <SimpleGrid cols={{base:1,md:2}}>{mappings.map(({authority,key,label,choices,selected})=><Card withBorder key={authority} data-testid={`statutory-role-${authority}`}>
      <Select label={label} searchable allowDeselect={false} disabled={loading || assignments.loading || busy}
        data={selected?choices:[{value:key,label:`Mevcut eşleme bulunamadı: ${key}`},...choices]}
        value={key} onChange={value=>{if(value)setDraft({...draft,roles:{...draft.roles,[authority]:value}});}}
        error={!loading&&!selected?'Aktif bir rol ve uygun birim seçin.':undefined}/>
      <Text size="xs" c="dimmed" mt="xs" style={{overflowWrap:'anywhere'}}>Rol anahtarı: {key}</Text>
      {selected&&<Text size="sm" mt="xs" c={selected.people.length?undefined:'orange'}>Aktif görevliler: {selected.people.join(', ')||'Yok. Bu makamın onay verebilmesi için görev ataması gerekir.'}</Text>}
    </Card>)}</SimpleGrid>
    <Text fw={600}>2. İş günü takvimi</Text>
    <Textarea label="Resmî tatiller (YYYY-MM-DD; her satıra bir tarih)" description="Hafta sonları zaten hariç tutulur. Yalnız tam gün tarihleri desteklenir; yarım gün tatilleri bu alan hesaplayamaz. Takvimi gelecek yıllar için güncelleyin." minRows={4} value={holidayText} error={!datesValid?'Her satıra geçerli bir YYYY-MM-DD tarihi girin.':undefined} onChange={e=>{setHolidayText(e.currentTarget.value);setDraft({...draft,holidays:e.currentTarget.value.split(/\s+/).filter(Boolean)});}}/>
    <Accordion variant="separated" multiple>
      <Accordion.Item value="limits"><Accordion.Control>Süre ve oranları incele</Accordion.Control><Accordion.Panel><SimpleGrid cols={{base:1,md:2}}>{Object.entries(draft.limits).map(([key,value])=><NumberInput key={key} label={STATUTORY_LIMIT_LABELS[key]||key} min={0} max={key==='reservePercent'?100:365} value={value} onChange={v=>setDraft({...draft,limits:{...draft.limits,[key]:Number(v)}})}/>)}</SimpleGrid></Accordion.Panel></Accordion.Item>
      <Accordion.Item value="stages"><Accordion.Control>Süreçlerin aşama sürelerini incele</Accordion.Control><Accordion.Panel><Stack><Alert>0, bu aşamada otomatik süre sınırı hesaplanmadığı anlamına gelir; onay zorunluluğunu kaldırmaz. Açık dosyalar yayımlandıkları sürümde kalır.</Alert>{Object.entries(draft.flows).map(([kind,f])=><Card key={kind} withBorder><Text fw={600}>{f.label} · Md. {f.articles}</Text><Text size="sm">{f.description}</Text>{f.stages.map((s,index)=><NumberInput key={index} label={`${s.label} (${s.businessDays?'iş günü':'takvim günü'})`} min={0} max={365} value={s.days} onChange={v=>setDraft({...draft,flows:{...draft.flows,[kind]:{...f,stages:f.stages.map((stage,i)=>i===index?{...stage,days:Number(v)}:stage)}}})}/>)}</Card>)}</Stack></Accordion.Panel></Accordion.Item>
      <Accordion.Item value="reserve"><Accordion.Control>Acil Durum Fonu hesaplayıcısı</Accordion.Control><Accordion.Panel><NumberInput label="Yeni döneme devreden kasa (TL)" min={0} value={carryover} onChange={setCarryover}/><Text>Acil Durum Fonu: {allocations.reserve.toLocaleString('tr-TR')} TL · Kullanılabilir: {allocations.operating.toLocaleString('tr-TR')} TL</Text><Text size="xs">Madde 61: yalnız hesaplama özeti. Bu tutar kaydedilmez; gerçek kasa hareketi finansal belgeyle kaydedilir.</Text></Accordion.Panel></Accordion.Item>
    </Accordion>
    <Text fw={600}>3. Kontrol edip yayımla</Text>
    {invalid.length>0&&!loading&&<Alert color="red">{invalid.length} makam için geçerli rol eşlemesi eksik. Yukarıdaki kırmızı alanları tamamlayın.</Alert>}
    {vacant.length>0&&!assignments.loading&&<Alert color="yellow">Aktif görevlisi bulunmayan makamlar: {vacant.map(item=>item.label).join(', ')}. Yayımlamak kimseyi bu görevlere atamaz; bu makamlarda bekleyen onaylar görevli atanana kadar ilerlemez.</Alert>}
    <Alert color="yellow">Yayımlanınca bütçe ve bazı seçim/görev işlemlerinde tüzük onay kontrolleri devreye girer. Makamları ve Kurullar ekranındaki koltukları kontrol edin. Tüzük metni bu işlemle değişmez.</Alert>
    <Button loading={busy} disabled={blocked} onClick={()=>setReview(true)}>Eşlemeleri gözden geçir ve yayımla</Button>
    <Modal opened={review} onClose={()=>{if(!busy)setReview(false);}} title="Tüzük kurulumunu son kez kontrol et" size="lg">
      <Stack><Text fw={600}>{draft.name}</Text>{mappings.map(item=><div key={item.authority}><Text size="sm" fw={600}>{item.label}</Text><Text size="sm" style={{overflowWrap:'anywhere'}}>{item.selected?.label||item.key}</Text><Text size="xs">{item.selected?.people.join(', ')||'Aktif görevli yok'}</Text></div>)}<Text size="sm">Takvim: {draft.holidays.length} tarih. Açık süreç dosyaları önceki sürümde kalır. Görev atamaları ve kurul koltukları bu işlemle değişmez.</Text><Button loading={busy} disabled={blocked} onClick={()=>void save()}>Tüzük süreç politikasını yayımla</Button></Stack>
    </Modal>
  </Stack>;
}
