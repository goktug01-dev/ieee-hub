import {
  ActionIcon,
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
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconEdit, IconExternalLink, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import { Timestamp, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
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
  publishRecruitmentCallById,
  updateRecruitmentCall,
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
  // Yetki ve birimler geç yüklenirse ilk yönetilen birimi seç.
  useEffect(() => {
    if (!unitId && managedIds[0]) setUnitId(managedIds[0]);
  }, [unitId, managedIds]);
  const calls = useCollection<RecruitmentCall>(unitId ? 'recruitmentCalls' : null, unitId ? [where('unitId', '==', unitId)] : [], `recruitment-calls-${unitId}`);
  const applications = useCollection<RecruitmentApplication>(unitId ? 'recruitmentApplications' : null, unitId ? [where('unitId', '==', unitId)] : [], `recruitment-applications-${unitId}`);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>('ilanlar');
  const [creatorOpen, creator] = useDisclosure(false);
  const [editing, setEditing] = useState<WithId<RecruitmentCall> | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const openCreator = (call: WithId<RecruitmentCall> | null) => { setEditing(call); creator.open(); };
  const changeStatus = async (call: WithId<RecruitmentCall>, status: RecruitmentCall['status']) => {
    setStatusBusy(call.id);
    try {
      await setRecruitmentCallStatus(call, status);
      notifySuccess(status === 'open' ? 'İlan kariyer sayfasında yayımlandı.' : 'İlan durumu güncellendi.');
    } catch (error) {
      notifyError(error);
    } finally {
      setStatusBusy(null);
    }
  };
  const sortedCalls = [...calls.data].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
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
        <Button leftSection={<IconPlus size={16} />} onClick={() => openCreator(null)} disabled={!unitId}>Yeni ilan aç</Button>
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
              {sortedCalls.map((call) => {
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
                      {call.status === 'draft' && (
                        <Text size="xs" c="orange">Taslak — kariyer sayfasında görünmez. Yayınlamak için “Yayımla” deyin.</Text>
                      )}
                      {call.status === 'open' && call.opensAt.toMillis() > Date.now() && (
                        <Text size="xs" c="orange">Kariyer sayfasında “Yakında” olarak görünüyor; başvurular başlangıç tarihinde kendiliğinden açılır.</Text>
                      )}
                      <Text size="xs" c="dimmed">
                        {call.opensAt.toDate().toLocaleString('tr-TR')} – {call.closesAt.toDate().toLocaleString('tr-TR')} · {count} başvuru
                      </Text>
                      <Group gap="xs">
                        {call.status !== 'archived' && <Button size="xs" variant="default" leftSection={<IconEdit size={14} />} disabled={statusBusy === call.id} onClick={() => openCreator(call)}>Düzenle</Button>}
                        {call.status === 'draft' && <Button size="xs" color="green" loading={statusBusy === call.id} onClick={() => void changeStatus(call, 'open')}>Yayımla</Button>}
                        {call.status === 'open' && <Button size="xs" color="orange" variant="light" loading={statusBusy === call.id} onClick={() => void changeStatus(call, 'closed')}>Başvuruyu kapat</Button>}
                        {call.status === 'closed' && call.closesAt.toMillis() > Date.now() && <Button size="xs" color="green" variant="light" loading={statusBusy === call.id} onClick={() => void changeStatus(call, 'open')}>Yeniden aç</Button>}
                        {call.status !== 'archived' && <Button size="xs" color="gray" variant="subtle" disabled={statusBusy === call.id} onClick={() => void changeStatus(call, 'archived')}>Arşivle</Button>}
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
            data={sortedCalls.map((call) => ({ value: call.id, label: `${call.title} · ${CALL_STATUS[call.status].label}` }))}
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

      <CallEditor opened={creatorOpen} onClose={creator.close} unitId={unitId} unitName={unitName(unitId)} call={editing} />
    </Stack>
  );
}

const EMPTY_FORM = () => ({
  title: '',
  roleTitle: 'Gönüllü ekip üyesi',
  summary: '',
  description: '',
  expectations: '',
  capacity: '' as string | number,
  opensAt: localDateTime(new Date()),
  closesAt: localDateTime(new Date(Date.now() + 7 * 864e5)),
  questions: [] as RecruitmentQuestion[],
});

type CallForm = ReturnType<typeof EMPTY_FORM>;

const formFromCall = (call: WithId<RecruitmentCall>): CallForm => ({
  title: call.title,
  roleTitle: call.roleTitle,
  summary: call.summary,
  description: call.description,
  expectations: call.expectations,
  capacity: call.capacity ?? '',
  opensAt: localDateTime(call.opensAt.toDate()),
  closesAt: localDateTime(call.closesAt.toDate()),
  questions: call.questions,
});

const counter = (value: string, max: number) => `${value.length}/${max}`;

/** Yeni ilan oluşturur veya bir taslağı düzenler. */
function CallEditor({ opened, onClose, unitId, unitName, call }: {
  opened: boolean;
  onClose: () => void;
  unitId: string;
  unitName: string;
  call: WithId<RecruitmentCall> | null;
}) {
  const [form, setForm] = useState<CallForm>(EMPTY_FORM);
  // Yayımlanmış/kapalı ilanda tarih ve metin düzenlenir; sorular başvurulara bağlı olduğu için kilitlidir.
  const locked = !!call && call.status !== 'draft';
  const [busy, setBusy] = useState(false);

  // Modal her açıldığında düzenlenen ilanla ya da boş formla başlar.
  useEffect(() => {
    if (opened) setForm(call ? formFromCall(call) : EMPTY_FORM());
  }, [opened, call]);

  const set = <K extends keyof CallForm>(key: K, value: CallForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const updateQuestion = (index: number, patch: Partial<RecruitmentQuestion>) =>
    set('questions', form.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));

  const opens = new Date(form.opensAt);
  const closes = new Date(form.closesAt);
  const dateError = !form.opensAt || Number.isNaN(opens.getTime()) ? 'Başlangıç tarihini girin.'
    : !form.closesAt || Number.isNaN(closes.getTime()) ? 'Bitiş tarihini girin.'
    : closes <= opens ? 'Bitiş, başlangıçtan sonra olmalı.'
    : closes.getTime() <= Date.now() ? 'Bitiş tarihi geçmişte kalıyor.'
    : null;

  const [busyMode, setBusyMode] = useState<'draft' | 'publish' | null>(null);
  const submit = async (publish: boolean) => {
    if (dateError) return notifyError(new Error(dateError), 'Tarihleri kontrol edin');
    setBusy(true);
    setBusyMode(publish ? 'publish' : 'draft');
    try {
      const input = {
        unitId,
        unitName,
        title: form.title.trim(),
        roleTitle: form.roleTitle.trim(),
        summary: form.summary.trim(),
        description: form.description.trim(),
        expectations: form.expectations.trim(),
        capacity: form.capacity === '' ? null : Number(form.capacity),
        opensAt: Timestamp.fromDate(opens),
        closesAt: Timestamp.fromDate(closes),
        questions: form.questions.map((question) => ({
          ...question,
          label: question.label.trim(),
          options: question.type === 'choice' ? question.options.map((option) => option.trim()).filter(Boolean) : [],
        })),
      };
      let id = call?.id;
      if (call) await updateRecruitmentCall(call, input);
      else id = await createRecruitmentCall(input);
      if (publish && id) {
        await publishRecruitmentCallById(id, input);
        notifySuccess(
          opens.getTime() > Date.now()
            ? `İlan yayımlandı; kariyer sayfasında “Yakında” olarak görünüyor, başvurular ${opens.toLocaleString('tr-TR')} tarihinde açılır.`
            : 'İlan yayımlandı ve kariyer sayfasında görünüyor.',
        );
      } else {
        notifySuccess(locked ? 'İlan güncellendi.' : call ? 'Taslak güncellendi.' : 'İlan taslak olarak kaydedildi. Kariyer sayfasında görünmesi için “Yayımla” deyin.');
      }
      onClose();
    } catch (error) {
      notifyError(error, publish ? 'İlan yayımlanamadı' : call ? 'Taslak güncellenemedi' : 'İlan oluşturulamadı');
    } finally {
      setBusy(false);
      setBusyMode(null);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={locked ? 'İlanı düzenle' : call ? 'Taslak ilanı düzenle' : 'Yeni başvuru ilanı'} size="xl" centered>
      <Stack>
        <Alert color="gray" variant="light">
          {locked
            ? `${unitName} için. Tarih ve metin değişiklikleri kaydettiğinizde kariyer sayfasına hemen yansır. Başvurular sorulara bağlı olduğu için sorular değiştirilemez.`
            : `${unitName} için. “Kaydet ve yayımla” ilanı kariyer sayfasına çıkarır; taslak olarak kaydedilen ilan görünmez. Yayımlanan ilanın soruları değiştirilemez.`}
        </Alert>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="İlan başlığı"
            placeholder="Örn. CS 2026 Güz Ekip Alımı"
            required
            maxLength={120}
            description={counter(form.title, 120)}
            value={form.title}
            onChange={(event) => set('title', event.currentTarget.value)}
          />
          <TextInput
            label="Pozisyon / ekip"
            placeholder="Örn. Etkinlik ekibi gönüllüsü"
            required
            maxLength={120}
            description={counter(form.roleTitle, 120)}
            value={form.roleTitle}
            onChange={(event) => set('roleTitle', event.currentTarget.value)}
          />
        </SimpleGrid>
        <Textarea
          label="Kartta görünecek kısa açıklama"
          required
          maxLength={500}
          description={counter(form.summary, 500)}
          autosize
          minRows={2}
          value={form.summary}
          onChange={(event) => set('summary', event.currentTarget.value)}
        />
        <Textarea
          label="İlan ayrıntıları"
          description={`Başvuru formunun üstünde görünür · ${counter(form.description, 5000)}`}
          maxLength={5000}
          autosize
          minRows={3}
          maxRows={12}
          value={form.description}
          onChange={(event) => set('description', event.currentTarget.value)}
        />
        <Textarea
          label="Beklentiler"
          placeholder="Maddeleri satır satır yazabilirsiniz"
          description={counter(form.expectations, 3000)}
          maxLength={3000}
          autosize
          minRows={3}
          maxRows={10}
          value={form.expectations}
          onChange={(event) => set('expectations', event.currentTarget.value)}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput type="datetime-local" label="Başlangıç" required value={form.opensAt} onChange={(event) => set('opensAt', event.currentTarget.value)} />
          <TextInput
            type="datetime-local"
            label="Bitiş"
            required
            value={form.closesAt}
            min={form.opensAt || undefined}
            error={dateError}
            onChange={(event) => set('closesAt', event.currentTarget.value)}
          />
          <NumberInput label="Kontenjan" placeholder="Sınırsız" min={1} max={500} allowDecimal={false} value={form.capacity} onChange={(value) => set('capacity', value)} />
        </SimpleGrid>
        <Group justify="space-between">
          <div>
            <Text fw={600}>Özel sorular</Text>
            <Text size="xs" c="dimmed">En fazla 10 soru; dosya yükleme desteklenmez. Bölüm, telefon ve motivasyon zaten formda sorulur.</Text>
          </div>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            disabled={locked || form.questions.length >= 10}
            onClick={() => set('questions', [...form.questions, emptyRecruitmentQuestion(form.questions.length)])}
          >
            Soru ekle
          </Button>
        </Group>
        <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Stack gap="sm">
        {form.questions.map((question, index) => (
          <Card key={question.id} bg="var(--mantine-color-default-hover)" padding="sm" withBorder={false}>
            <Stack gap="xs">
              <Group align="flex-start" wrap="wrap">
                <TextInput
                  label={`${index + 1}. soru`}
                  required
                  maxLength={300}
                  value={question.label}
                  onChange={(event) => updateQuestion(index, { label: event.currentTarget.value })}
                  style={{ flex: '1 1 260px' }}
                />
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
                  w={{ base: '100%', xs: 170 }}
                  allowDeselect={false}
                />
                <Checkbox
                  label="Zorunlu"
                  checked={question.required}
                  onChange={(event) => updateQuestion(index, { required: event.currentTarget.checked })}
                  mt={{ base: 0, xs: 32 }}
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  size="lg"
                  mt={{ base: 0, xs: 26 }}
                  aria-label={`${index + 1}. soruyu sil`}
                  onClick={() => set('questions', form.questions.filter((_, questionIndex) => questionIndex !== index))}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              {question.type === 'choice' && (
                <TagsInput
                  label="Seçenekler"
                  description="Her seçeneği yazıp Enter'a basın (en az iki)"
                  value={question.options}
                  onChange={(options) => updateQuestion(index, { options })}
                  error={question.options.filter((option) => option.trim()).length < 2 ? 'En az iki seçenek girin' : undefined}
                />
              )}
            </Stack>
          </Card>
        ))}
        </Stack>
        </fieldset>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Vazgeç</Button>
          {locked ? (
            <Button onClick={() => void submit(false)} loading={busyMode === 'draft'} disabled={!!dateError || busy}>
              Kaydet
            </Button>
          ) : (
            <>
              <Button variant="default" onClick={() => void submit(false)} loading={busyMode === 'draft'} disabled={!!dateError || busy}>
                {call ? 'Taslağı kaydet' : 'Taslak olarak kaydet'}
              </Button>
              <Button onClick={() => void submit(true)} loading={busyMode === 'publish'} disabled={!!dateError || busy}>
                Kaydet ve yayımla
              </Button>
            </>
          )}
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
            <Textarea label="Adaya gösterilecek not" description="Aday bu notu kariyer sayfasında görür; iç değerlendirme yazmayın." maxLength={2000} value={note} onChange={(event) => setNote(event.currentTarget.value)} autosize minRows={2} />
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
