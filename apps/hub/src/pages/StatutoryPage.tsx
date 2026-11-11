import { Alert, Badge, Button, Card, Group, Stack, Tabs, Text } from '@mantine/core';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useDoc } from '../lib/hooks';
import { useOrg } from '../lib/org';
import { hasPermission, hasRoleKey } from '../lib/access';
import { StatutoryCasePanel } from '../components/StatutoryCasePanel';
import { StatutorySetupPanel } from '../components/StatutorySetupPanel';
import { StatutoryActivityPanel } from '../components/StatutoryActivityPanel';
import { StatutoryAssemblyPanel } from '../components/StatutoryAssemblyPanel';
import { StatutoryBackupPanel } from '../components/StatutoryBackupPanel';
import { ErrorAlert, PageHeader, SectionLoader } from '../components/ui';
import { statutoryObligations, absenceAlerts } from '../lib/statutoryObligations';
import type { StatutoryCase, StatutoryPolicy } from '../lib/statutoryTypes';
import type { Asset, HubEvent, Handover, Meeting, Project, ReportSnapshot, InventoryItem } from '../lib/opsTypes';
import type { Assignment, Member } from '../lib/types';
import { where } from 'firebase/firestore';

export function StatutoryPage() {
  const {terms}=useOrg();
  const {access,orgSettings}=useAuth();const [params]=useSearchParams();
  const pointer=useDoc<{policyId:string}>('settings/statutory');
  const source=useDoc<StatutoryPolicy>(pointer.data?`statutoryPolicies/${pointer.data.policyId}`:null);
  const p=source.data,configure=hasPermission(access,'org.manage');
  const privilege=hasPermission(access,'governance.read')||hasPermission(access,'members.manage')||hasPermission(access,'secretary.ledger.manage');
  const roleReview=!!p&&['president','internal','secretary','finance','external','technical','audit','advisor','actor','techops'].some(r=>hasRoleKey(access,p.roles[r]));
  const oversight=privilege||roleReview;
  const privateReview=!!p&&(hasRoleKey(access,p.roles.audit)||hasRoleKey(access,p.roles.advisor));
  return <Stack><PageHeader title="Tüzük süreçleri" description="Makam onayları, yazılı savunma ve itiraz, aktif üyelik, süreler ve devir yükümlülükleri."/><ErrorAlert error={pointer.error||source.error}/>
    {pointer.loading||source.loading?<SectionLoader/>:!p?<><Alert>Tüzük süreç politikası henüz yayımlanmadı. Yetkili makam rol anahtarları ve takvim, ilk kurulumda tanımlanır.</Alert>{configure&&<StatutorySetupPanel policy={null}/>}</>:<Tabs defaultValue={params.get('sekme')||'dosyalar'} keepMounted={false}><Tabs.List><Tabs.Tab value="dosyalar">Süreç dosyaları</Tabs.Tab>{oversight&&<Tabs.Tab value="takip">Süre ve yükümlülük takibi</Tabs.Tab>}<Tabs.Tab value="aktiflik">Aktif üyelik ve yıl</Tabs.Tab>{oversight&&<Tabs.Tab value="genelkurul">Genel Kurul</Tabs.Tab>}{oversight&&<Tabs.Tab value="yedek">Yedek ve yıllık arşiv</Tabs.Tab>}{configure&&<Tabs.Tab value="ayarlar">Yapılandırma</Tabs.Tab>}</Tabs.List>
      <Tabs.Panel value="dosyalar" pt="md"><StatutoryCasePanel policy={p} policyId={pointer.data!.policyId} oversight={oversight} privateReview={privateReview} initialId={params.get('dosya')} terms={terms}/></Tabs.Panel>
      <Tabs.Panel value="takip" pt="md">{oversight&&<ObligationPanel policy={p} termId={orgSettings.activeTermId}/>}</Tabs.Panel>
      <Tabs.Panel value="aktiflik" pt="md"><StatutoryActivityPanel policy={p}/></Tabs.Panel>
      <Tabs.Panel value="genelkurul" pt="md">{oversight&&<StatutoryAssemblyPanel/>}</Tabs.Panel>
      <Tabs.Panel value="yedek" pt="md">{oversight&&<StatutoryBackupPanel policy={p}/>}</Tabs.Panel>
      <Tabs.Panel value="ayarlar" pt="md">{configure&&<StatutorySetupPanel policy={p}/>}</Tabs.Panel>
    </Tabs>}
  </Stack>;
}

function ObligationPanel({policy,termId}:{policy:StatutoryPolicy;termId:string|null}) {
  const {units,terms}=useOrg();
  const events=useCollection<HubEvent>('events'),assignments=useCollection<Assignment>('assignments'),meetings=useCollection<Meeting>('meetings'),projects=useCollection<Project>('projects'),reports=useCollection<ReportSnapshot>('reports'),handovers=useCollection<Handover>('handovers'),assets=useCollection<Asset>('assets'),members=useCollection<Member>('members'),inventory=useCollection<InventoryItem>('inventory');
  const cases=useCollection<StatutoryCase>('governanceCases',[where('confidential','==',false)],'obligation-cases');
  const errors=[events,assignments,meetings,projects,reports,handovers,assets,members,inventory,cases].map(s=>s.error).filter(Boolean);
  const items=statutoryObligations({events:events.data,units,assignments:assignments.data,meetings:meetings.data,projects:projects.data,reports:reports.data,handovers:handovers.data,assets:assets.data,members:members.data,inventory:inventory.data,cases:cases.data,term:terms.find(t=>t.id===termId)||null},policy);
  const attendance=absenceAlerts(meetings.data.filter(m=>m.status==='final'&&m.boardId).map(m=>({date:m.date,board:m.boardId!,rosterUids:Object.keys(m.boardRoster||{}),attendeeUids:m.attendeeUids,excusedUids:m.excusedUids||[]})),policy.limits.boardAbsences,policy.limits.consecutiveAbsences);
  return <Stack><Alert>Takip canlı kaynaklardan hesaplanır. Uyarı, yaptırım veya ihraç kararı değildir. Metindeki Madde 18 (üç ardışık) ve 40/42 (YK için iki) eşikleri birlikte gösterilir.</Alert>{errors.map((error,i)=><ErrorAlert key={i} error={error}/>)}{errors.length>0&&<Alert color="yellow">Bazı veri kaynaklarına erişilemiyor; bu kaynakların kontrolleri tamamlanmış sayılmaz.</Alert>}{attendance.map(a=><Card key={a.uid} withBorder><Text fw={600}>Devamsızlık incelemesi · {a.uid}</Text><Text>YK mazeretsiz: {a.yk} · Ardışık: {a.consecutive}</Text><Button component={Link} to="/surecler" variant="light">Usul incelemesi / süreç aç</Button></Card>)}{items.map(item=><Card key={item.id} withBorder><Group justify="space-between"><div><Text fw={600}>{item.title}</Text><Text size="sm">Md. {item.article} · {item.owner}</Text></div><Badge color={item.severity==='overdue'?'red':item.severity==='review'?'yellow':'blue'}>{item.severity==='overdue'?'Süre aşıldı':item.severity==='review'?'İnceleme gerekli':new Date(item.dueAt).toLocaleDateString('tr-TR')}</Badge></Group><Text size="sm" mt="xs">{item.detail}</Text><Button mt="sm" size="xs" variant="light" component={Link} to={item.link}>İlgili kaydı aç</Button></Card>)}</Stack>;
}
