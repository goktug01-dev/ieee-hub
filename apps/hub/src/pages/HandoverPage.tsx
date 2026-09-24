import { Accordion, Alert, Badge, Button, Card, Group, Select, Stack, Tabs, Text, Textarea } from '@mantine/core';
import { IconCheck, IconPrinter, IconSend } from '@tabler/icons-react';
import { addDoc, collection, doc, orderBy, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../components/ui';
import { db } from '../firebase';
import { hasPermission } from '../lib/access';
import { fmtDateTime } from '../lib/format';
import { useCollection } from '../lib/hooks';
import type { Handover } from '../lib/opsTypes';
import type { Assignment, WithId } from '../lib/types';

/** Bildirge §18 devir paketi başlıkları. */
export const HANDOVER_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'ongoing', label: 'Süren işler ve projeler', hint: 'Durumu, sorumlusu ve bir sonraki adımıyla' },
  { key: 'calendar', label: 'Takvim ve yaklaşan tarihler', hint: 'Etkinlikler, başvuru ve rapor tarihleri' },
  { key: 'contacts', label: 'Paydaşlar ve iletişim', hint: 'Kurum içi/dışı kişiler (kişisel telefon yazmayın)' },
  { key: 'accounts', label: 'Hesaplar ve erişimler', hint: 'Hangi sistemde hangi yetki var; devredilecek sahiplikler. Şifre yazmayın.' },
  { key: 'files', label: 'Dosyalar ve arşiv', hint: 'Drive klasörleri, önemli belgeler' },
  { key: 'finance', label: 'Bütçe ve açık finansal konular', hint: 'Bekleyen ödemeler, sponsor taahhütleri' },
  { key: 'lessons', label: 'Öğrenilenler ve öneriler', hint: 'Bir sonraki döneme tavsiyeler' },
];

export function HandoverPage() {
  const { user, access, orgSettings } = useAuth();
  const isManager = hasPermission(access, 'handover.manage');
  const myAssignments = useCollection<Assignment>('assignments', [where('uid', '==', user!.uid), where('status', '==', 'active')], `ha-${user!.uid}`);
  const mine = useCollection<Handover>('handovers', [where('authorUid', '==', user!.uid)], `hm-${user!.uid}`);
  const tokens = (access?.tokens ?? []).filter((t) => t.startsWith('role:')).slice(0, 30);
  const received = useCollection<Handover>(tokens.length ? 'handovers' : null, [where('visibleTo', 'array-contains-any', tokens)], tokens.join('|'));
  const all = useCollection<Handover>(isManager ? 'handovers' : null, [orderBy('updatedAt', 'desc')], 'h-all');
  const [tab, setTab] = useState<string | null>('benim');
  const [roleSel, setRoleSel] = useState<string | null>(null);

  const roleOptions = myAssignments.data.map((a) => ({ value: a.id, label: `${a.roleName} · ${a.unitName}` }));

  const start = async () => {
    const a = myAssignments.data.find((x) => x.id === roleSel);
    if (!a) return;
    try {
      await addDoc(collection(db, 'handovers'), {
        authorUid: user!.uid,
        authorName: user!.displayName ?? '',
        roleId: a.roleId,
        roleName: a.roleName,
        unitId: a.unitId,
        unitName: a.unitName,
        termId: orgSettings.activeTermId,
        sections: {},
        status: 'draft',
        visibleTo: [`uid:${user!.uid}`, `role:${a.unitId}__${a.roleId}`],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRoleSel(null);
    } catch (e) {
      notifyError(e);
    }
  };

  const receivedOthers = received.data.filter((h) => h.authorUid !== user!.uid && h.status !== 'draft');

  return (
    <Stack>
      <PageHeader
        title="Devir paketleri"
        description="Görev süreniz biterken bir sonraki kişiye bırakacağınız bilgiler. Paket, aynı rolü devralan kişiye otomatik olarak görünür."
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="benim">Hazırladıklarım</Tabs.Tab>
          <Tabs.Tab value="gelen">Bana devredilenler ({receivedOthers.length})</Tabs.Tab>
          {isManager && <Tabs.Tab value="tum">Tüm paketler</Tabs.Tab>}
        </Tabs.List>
        <Tabs.Panel value="benim">
          <Stack>
            {roleOptions.length > 0 && (
              <Card>
                <Group align="flex-end">
                  <Select label="Hangi görevim için devir paketi hazırlayacağım?" data={roleOptions} value={roleSel} onChange={setRoleSel} w={360} />
                  <Button onClick={() => void start()} disabled={!roleSel}>
                    Paket oluştur
                  </Button>
                </Group>
              </Card>
            )}
            {mine.loading ? <SectionLoader /> : mine.data.length === 0 ? <EmptyState title="Henüz devir paketiniz yok" /> : mine.data.map((h) => <HandoverCard key={h.id} h={h} editable />)}
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="gelen">
          <Stack>{receivedOthers.length === 0 ? <EmptyState title="Size devredilmiş paket yok" /> : receivedOthers.map((h) => <HandoverCard key={h.id} h={h} />)}</Stack>
        </Tabs.Panel>
        <Tabs.Panel value="tum">
          <Stack>{all.data.map((h) => <HandoverCard key={h.id} h={h} reviewable />)}</Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

const STATUS = { draft: { label: 'Taslak', color: 'gray' }, submitted: { label: 'Teslim edildi', color: 'blue' }, accepted: { label: 'Kabul edildi', color: 'green' } } as const;

function HandoverCard({ h, editable, reviewable }: { h: WithId<Handover>; editable?: boolean; reviewable?: boolean }) {
  const { user } = useAuth();
  const [sections, setSections] = useState(h.sections);
  const [note, setNote] = useState('');
  useEffect(() => setSections(h.sections), [h.sections]);
  const canEdit = editable && h.status !== 'accepted';
  const filled = useMemo(() => HANDOVER_SECTIONS.filter((s) => (sections[s.key] ?? '').trim()).length, [sections]);

  const save = (status?: Handover['status']) =>
    updateDoc(doc(db, 'handovers', h.id), { sections, ...(status ? { status } : {}), updatedAt: serverTimestamp() })
      .then(() => notifySuccess(status === 'submitted' ? 'Devir paketi teslim edildi.' : 'Kaydedildi.'))
      .catch(notifyError);

  return (
    <Card className={reviewable ? undefined : 'print-area'}>
      <Group justify="space-between" mb="sm" wrap="wrap">
        <div>
          <Text fw={700}>
            {h.roleName} · {h.unitName}
          </Text>
          <Text size="xs" c="dimmed">
            {h.authorName} · {fmtDateTime(h.updatedAt)} · {filled}/{HANDOVER_SECTIONS.length} bölüm dolu
          </Text>
        </div>
        <Group gap="xs">
          <Badge color={STATUS[h.status].color}>{STATUS[h.status].label}</Badge>
          <Button size="xs" variant="default" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
            Yazdır
          </Button>
        </Group>
      </Group>
      {h.reviewNote && <Alert color="blue" mb="sm">İnceleme notu ({h.reviewedByName}): {h.reviewNote}</Alert>}
      <Accordion multiple defaultValue={canEdit ? ['ongoing'] : HANDOVER_SECTIONS.map((s) => s.key)} variant="separated">
        {HANDOVER_SECTIONS.map((s) => (
          <Accordion.Item key={s.key} value={s.key}>
            <Accordion.Control>
              <Group gap="xs">
                {s.label}
                {(sections[s.key] ?? '').trim() && <IconCheck size={14} color="var(--mantine-color-green-6)" />}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              {canEdit ? (
                <Textarea description={s.hint} autosize minRows={3} value={sections[s.key] ?? ''} onChange={(e) => setSections({ ...sections, [s.key]: e.currentTarget.value })} />
              ) : (
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {sections[s.key] || '—'}
                </Text>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
      {canEdit && (
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => void save()}>
            Kaydet
          </Button>
          <Button leftSection={<IconSend size={16} />} onClick={() => void save('submitted')}>
            Teslim et
          </Button>
        </Group>
      )}
      {reviewable && h.status === 'submitted' && (
        <Group align="flex-end" mt="sm">
          <Textarea label="İnceleme notu" style={{ flex: 1 }} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Button
            variant="light"
            color="orange"
            onClick={() =>
              updateDoc(doc(db, 'handovers', h.id), { status: 'draft', reviewNote: note, reviewedBy: user!.uid, reviewedByName: user!.displayName ?? '', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() }).catch(notifyError)
            }
          >
            Eksik, geri gönder
          </Button>
          <Button
            color="green"
            onClick={() =>
              updateDoc(doc(db, 'handovers', h.id), { status: 'accepted', reviewNote: note, reviewedBy: user!.uid, reviewedByName: user!.displayName ?? '', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() })
                .then(() => notifySuccess('Devir paketi kabul edildi.'))
                .catch(notifyError)
            }
          >
            Kabul et
          </Button>
        </Group>
      )}
    </Card>
  );
}
