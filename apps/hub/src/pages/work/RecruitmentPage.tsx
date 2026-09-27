import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconExternalLink, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { Timestamp, where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { hasPermission, unitsWithPermission } from '../../lib/access';
import { fmtRelative } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import type { RecruitmentApplication, RecruitmentApplicationStatus, RecruitmentCall, RecruitmentQuestion, RecruitmentQuestionType } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import {
  createRecruitmentCall,
  decideRecruitmentApplication,
  emptyRecruitmentQuestion,
  setRecruitmentCallStatus,
} from '../../lib/recruitment';
import { BRANCH, type WithId } from '../../lib/types';

const CALL_STATUS = {
  draft: { label: 'Taslak', color: 'gray' },
  open: { label: 'Yayında', color: 'green' },
  closed: { label: 'Kapalı', color: 'orange' },
  archived: { label: 'Arşivde', color: 'dark' },
} as const;

const APP_STATUS = {
  pending: { label: 'Yeni', color: 'blue' },
  reviewing: { label: 'İnceleniyor', color: 'yellow' },
  waitlisted: { label: 'Yedek', color: 'orange' },
  accepted: { label: 'Kabul', color: 'green' },
  rejected: { label: 'Olumsuz', color: 'red' },
  withdrawn: { label: 'Geri çekildi', color: 'gray' },
} as const;

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function RecruitmentPage() {
  const { access } = useAuth();
  const { units, unitName } = useOrg();
  const managedIds = useMemo(() => {
    if (hasPermission(access, 'assignments.manage')) return [BRANCH, ...units.filter((unit) => unit.active).map((unit) => unit.id)];
    return unitsWithPermission(access, 'unit.manage');
  }, [access, units]);
  const [unitId, setUnitId] = useState(managedIds[0] ?? '');
  const calls = useCollection<RecruitmentCall>(unitId ? 'recruitmentCalls' : null, unitId ? [where('unitId', '==', unitId)] : [], `recruitment-calls-${unitId}`);
  const applications = useCollection<RecruitmentApplication>(unitId ? 'recruitmentApplications' : null, unitId ? [where('unitId', '==', unitId)] : [], `recruitment-applications-${unitId}`);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>('ilanlar');
  const [creatorOpen, creator] = useDisclosure(false);
  const selectedCall = calls.data.find((call) => call.id === selectedCallId) ?? null;
  const selectedApplications = applications.data
    .filter((application) => application.callId === selectedCallId)
    .sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis());

  if (!managedIds.length) {
    return <EmptyState title="Başvuru yönetim yetkiniz yok" description="Komite/YK yöneticisi görevi atandığında kendi biriminizin ilanlarını burada yönetebilirsiniz." />;
  }

  return (
    <Stack>
      <PageHeader
        title="Komite ve ekip başvuruları"
        description="Tarihli ilan açın, özel sorular belirleyin, adayları değerlendirin ve kabul edilenleri gönüllü rolüne dönüştürün."
        actions={<Button component="a" href="/kariyer" target="_blank" variant="default" leftSection={<IconExternalLink size={16} />}>Aday vitrini</Button>}
      />
      <Alert color="blue" variant="light">
        Bu ekran IEEE üyelik sisteminin yerine geçmez. Komite/YK gönüllü alımını yönetir; adayın standart IEEE üyelik doğrulaması ayrı sistemde kalır.
      </Alert>
      <Group justify="space-between" align="end">
        <Select
          label="Yönettiğiniz birim"
          data={managedIds.map((id) => ({ value: id, label: unitName(id) }))}
          value={unitId}
          onChange={(value) => { if (value) { setUnitId(value); setSelectedCallId(null); } }}
          allowDeselect={false}
          searchable
          w={{ base: '100%', sm: 360 }}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={creator.open}>Yeni ilan aç</Button>
      </Group>

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="ilanlar">İlanlar ({calls.data.length})</Tabs.Tab>
          <Tabs.Tab value="adaylar">Adaylar ({applications.data.length})</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="ilanlar" pt="md">
          {calls.loading ? <SectionLoader /> : calls.data.length === 0 ? (
            <EmptyState title="Henüz ilan yok" description="Bu birim için ilk tarihli başvuru ilanını oluşturun." />
          ) : (
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              {calls.data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map((call) => {
                const count = applications.data.filter((application) => application.callId === call.id).length;
                return (
                  <Card key={call.id} withBorder>
                    <Stack>
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={700}>{call.title}</Text>
                          <Text size="sm" c="dimmed">{call.roleTitle}</Text>
                        </div>
                        <Badge color={CALL_STATUS[call.status].color}>{CALL_STATUS[call.status].label}</Badge>
                      </Group>
                      <Text size="sm">{call.summary}</Text>
                      <Text size="xs" c="dimmed">
                        {call.opensAt.toDate().toLocaleString('tr-TR')} – {call.closesAt.toDate().toLocaleString('tr-TR')} · {count} başvuru
                      </Text>
                      <Group gap="xs">
                        {call.status === 'draft' && <Button size="xs" color="green" onClick={() => changeStatus(call, 'open')}>Yayımla</Button>}
                        {call.status === 'open' && <Button size="xs" color="orange" variant="light" onClick={() => changeStatus(call, 'closed')}>Başvuruyu kapat</Button>}
                        {call.status === 'closed' && call.closesAt.toMillis() > Date.now() && <Button size="xs" color="green" variant="light" onClick={() => changeStatus(call, 'open')}>Yeniden aç</Button>}
                        {call.status !== 'archived' && <Button size="xs" color="gray" variant="subtle" onClick={() => changeStatus(call, 'archived')}>Arşivle</Button>}
                        <Button size="xs" variant="default" leftSection={<IconSettings size={14} />} onClick={() => { setSelectedCallId(call.id); setTab('adaylar'); }}>Adayları yönet</Button>
                      </Group>
                    </Stack>
                  </Card>
                );
              })}
            </SimpleGrid>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="adaylar" pt="md">
          <Select
            label="İlan"
            placeholder="Adaylarını görmek için ilan seçin"
            data={calls.data.map((call) => ({ value: call.id, label: `${call.title} · ${CALL_STATUS[call.status].label}` }))}
            value={selectedCallId}
            onChange={setSelectedCallId}
            searchable
            mb="md"
          />
          {!selectedCall ? <EmptyState title="Bir ilan seçin" /> : applications.loading ? <SectionLoader /> : selectedApplications.length === 0 ? (
            <EmptyState title="Bu ilana henüz başvuru yok" />
          ) : (
            <Stack>
              {selectedApplications.map((application) => <ApplicantCard key={application.id} application={application} call={selectedCall} />)}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>

      <CallCreator opened={creatorOpen} onClose={creator.close} unitId={unitId} unitName={unitName(unitId)} />
    </Stack>
  );
}

async function changeStatus(call: WithId<RecruitmentCall>, status: RecruitmentCall['status']) {
  try {
    await setRecruitmentCallStatus(call, status);
    notifySuccess(status === 'open' ? 'İlan aday vitrininde yayımlandı.' : 'İlan durumu güncellendi.');
  } catch (error) {
    notifyError(error);
  }
}

function CallCreator({ opened, onClose, unitId, unitName }: { opened: boolean; onClose: () => void; unitId: string; unitName: string }) {
  const [title, setTitle] = useState('');
  const [roleTitle, setRoleTitle] = useState('Gönüllü ekip üyesi');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [expectations, setExpectations] = useState('');
  const [capacity, setCapacity] = useState<string | number>('');
  const [opensAt, setOpensAt] = useState(localDateTime(new Date()));
  const [closesAt, setClosesAt] = useState(localDateTime(new Date(Date.now() + 7 * 864e5)));
  const [questions, setQuestions] = useState<RecruitmentQuestion[]>([]);
  const [busy, setBusy] = useState(false);

  const updateQuestion = (index: number, patch: Partial<RecruitmentQuestion>) =>
    setQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));

  const submit = async () => {
    setBusy(true);
    try {
      await createRecruitmentCall({
        unitId,
        unitName,
        title: title.trim(),
        roleTitle: roleTitle.trim(),
        summary: summary.trim(),
        description: description.trim(),
        expectations: expectations.trim(),
        capacity: capacity === '' ? null : Number(capacity),
        opensAt: Timestamp.fromDate(new Date(opensAt)),
        closesAt: Timestamp.fromDate(new Date(closesAt)),
        questions: questions.map((question) => ({ ...question, label: question.label.trim(), options: question.options.map((option) => option.trim()).filter(Boolean) })),
      });
      notifySuccess('İlan taslak olarak oluşturuldu. Kontrol ettikten sonra yayımlayabilirsiniz.');
      setTitle('');
      setSummary('');
      setDescription('');
      setExpectations('');
      setQuestions([]);
      onClose();
    } catch (error) {
      notifyError(error, 'İlan oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Yeni başvuru ilanı" size="xl" centered>
      <Stack>
        <Alert color="gray">İlan önce taslak oluşur; siz “Yayımla” dediğinizde kariyer vitrininde görünür.</Alert>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="İlan başlığı" placeholder="Örn. CS 2026 Güz Ekip Alımı" required value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
          <TextInput label="Pozisyon / ekip" placeholder="Örn. Etkinlik ekibi gönüllüsü" required value={roleTitle} onChange={(event) => setRoleTitle(event.currentTarget.value)} />
        </SimpleGrid>
        <Textarea label="Kartta görünecek kısa açıklama" required maxLength={500} autosize minRows={2} value={summary} onChange={(event) => setSummary(event.currentTarget.value)} />
        <Textarea label="İlan ayrıntıları" autosize minRows={3} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
        <Textarea label="Beklentiler" placeholder="Maddeleri satır satır yazabilirsiniz" autosize minRows={3} value={expectations} onChange={(event) => setExpectations(event.currentTarget.value)} />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput type="datetime-local" label="Başlangıç" required value={opensAt} onChange={(event) => setOpensAt(event.currentTarget.value)} />
          <TextInput type="datetime-local" label="Bitiş" required value={closesAt} onChange={(event) => setClosesAt(event.currentTarget.value)} />
          <NumberInput label="Kontenjan" placeholder="Sınırsız" min={1} max={500} value={capacity} onChange={setCapacity} />
        </SimpleGrid>
        <Group justify="space-between">
          <div>
            <Text fw={600}>Özel sorular</Text>
            <Text size="xs" c="dimmed">En fazla 10 soru; dosya yükleme ücretsiz planda desteklenmez.</Text>
          </div>
          <Button size="xs" variant="default" leftSection={<IconPlus size={14} />} disabled={questions.length >= 10} onClick={() => setQuestions((current) => [...current, emptyRecruitmentQuestion(current.length)])}>Soru ekle</Button>
        </Group>
        {questions.map((question, index) => (
          <Card key={question.id} bg="gray.0" padding="sm">
            <Stack gap="xs">
              <Group align="end" wrap="wrap">
                <TextInput label={`${index + 1}. soru`} value={question.label} onChange={(event) => updateQuestion(index, { label: event.currentTarget.value })} style={{ flex: '1 1 280px' }} />
                <Select
                  label="Yanıt türü"
                  data={[
                    { value: 'short', label: 'Kısa metin' },
                    { value: 'long', label: 'Uzun metin' },
                    { value: 'choice', label: 'Seçenek' },
                    { value: 'boolean', label: 'Onay kutusu' },
                  ]}
                  value={question.type}
                  onChange={(value) => updateQuestion(index, { type: (value ?? 'long') as RecruitmentQuestionType })}
                  w={170}
                  allowDeselect={false}
                />
                <Checkbox label="Zorunlu" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.currentTarget.checked })} mb={8} />
                <Button color="red" variant="subtle" px="xs" onClick={() => setQuestions((current) => current.filter((_, questionIndex) => questionIndex !== index))}><IconTrash size={16} /></Button>
              </Group>
              {question.type === 'choice' && (
                <TextInput label="Seçenekler" description="Virgülle ayırın" value={question.options.join(', ')} onChange={(event) => updateQuestion(index, { options: event.currentTarget.value.split(',') })} />
              )}
            </Stack>
          </Card>
        ))}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Vazgeç</Button>
          <Button onClick={submit} loading={busy}>Taslağı oluştur</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function ApplicantCard({ application, call }: { application: WithId<RecruitmentApplication>; call: WithId<RecruitmentCall> }) {
  const { units } = useOrg();
  const [note, setNote] = useState(application.decisionNote ?? '');
  const [busy, setBusy] = useState(false);
  const shortCode = application.unitId === BRANCH ? 'YK' : units.find((unit) => unit.id === application.unitId)?.shortCode ?? 'GRV';
  const answerRows = call.questions.map((question) => ({ question: question.label, answer: application.answers[question.id] || '—' }));

  const decide = async (status: Exclude<RecruitmentApplicationStatus, 'pending' | 'withdrawn'>) => {
    setBusy(true);
    try {
      const result = await decideRecruitmentApplication(application, status, note, shortCode);
      notifySuccess(status === 'accepted' ? `Aday kabul edildi; ${result.orientationTasks} oryantasyon görevi açıldı.` : 'Başvuru durumu güncellendi.');
    } catch (error) {
      notifyError(error, 'Başvuru güncellenemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card withBorder>
      <Stack>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>{application.name}</Title>
            <Text size="sm" c="dimmed">{application.email} · {application.department}{application.studentNo ? ` · ${application.studentNo}` : ''}</Text>
            <Text size="xs" c="dimmed">{fmtRelative(application.submittedAt)}{application.phone ? ` · ${application.phone}` : ''}{application.ieeeMemberNo ? ` · IEEE #${application.ieeeMemberNo}` : ''}</Text>
          </div>
          <Badge color={APP_STATUS[application.status].color}>{APP_STATUS[application.status].label}</Badge>
        </Group>
        <div>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">Motivasyon</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{application.motivation}</Text>
        </div>
        {application.availability && <Text size="sm"><b>Uygunluk:</b> {application.availability}</Text>}
        {answerRows.length > 0 && (
          <Table.ScrollContainer minWidth={480}>
            <Table withRowBorders={false} verticalSpacing="xs">
              <Table.Tbody>{answerRows.map((row) => <Table.Tr key={row.question}><Table.Td fw={600} w="38%">{row.question}</Table.Td><Table.Td>{row.answer}</Table.Td></Table.Tr>)}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
        {['pending', 'reviewing', 'waitlisted'].includes(application.status) && (
          <>
            <Textarea label="Değerlendirme / adaya gösterilecek karar notu" value={note} onChange={(event) => setNote(event.currentTarget.value)} autosize minRows={2} />
            <Group gap="xs">
              <Button size="xs" variant="light" color="yellow" loading={busy} onClick={() => void decide('reviewing')}>İncelemeye al</Button>
              <Button size="xs" variant="light" color="orange" loading={busy} onClick={() => void decide('waitlisted')}>Yedeğe al</Button>
              <Button size="xs" color="green" loading={busy} onClick={() => void decide('accepted')}>Kabul et</Button>
              <Button size="xs" color="red" variant="light" loading={busy} onClick={() => void decide('rejected')}>Olumsuz</Button>
            </Group>
          </>
        )}
        {application.status === 'accepted' && <Alert color="green" variant="light">Gönüllü rolü ve oryantasyon görevleri oluşturuldu. Standart IEEE üyelik kaydı ayrı üyelik sisteminden doğrulanmalıdır.</Alert>}
      </Stack>
    </Card>
  );
}
