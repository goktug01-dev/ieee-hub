import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Group,
  Image,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
  PasswordInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconArrowRight, IconBriefcase2, IconCalendar, IconLogout, IconUsersGroup } from '@tabler/icons-react';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import { where } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { auth } from '../../firebase';
import { useCollection } from '../../lib/hooks';
import type { RecruitmentApplication, RecruitmentCall, RecruitmentQuestion } from '../../lib/opsTypes';
import { applyToRecruitmentCall, recruitmentCallIsOpen, withdrawRecruitmentApplication } from '../../lib/recruitment';
import type { WithId } from '../../lib/types';

const STATUS = {
  pending: { label: 'Başvuru alındı', color: 'blue' },
  reviewing: { label: 'İnceleniyor', color: 'yellow' },
  waitlisted: { label: 'Yedek listede', color: 'orange' },
  accepted: { label: 'Kabul edildi', color: 'green' },
  rejected: { label: 'Olumsuz', color: 'red' },
  withdrawn: { label: 'Geri çekildi', color: 'gray' },
} as const;

const dateTime = (value: RecruitmentCall['closesAt']) =>
  new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(value.toDate());

export function CareerPage() {
  const { user, publicSettings, signOut } = useAuth();
  const calls = useCollection<RecruitmentCall>('recruitmentCalls', [where('status', '==', 'open')], 'career-open-calls');
  const mine = useCollection<RecruitmentApplication>(
    user ? 'recruitmentApplications' : null,
    user ? [where('uid', '==', user.uid)] : [],
    `career-applications-${user?.uid ?? 'guest'}`,
  );
  const [selected, setSelected] = useState<WithId<RecruitmentCall> | null>(null);
  const [opened, modal] = useDisclosure(false);
  const [authOpened, authModal] = useDisclosure(false);
  const openCalls = useMemo(
    () => calls.data.filter((call) => recruitmentCallIsOpen(call)).sort((a, b) => a.closesAt.toMillis() - b.closesAt.toMillis()),
    [calls.data],
  );
  const applicationByCall = useMemo(() => new Map(mine.data.map((application) => [application.callId, application])), [mine.data]);

  const choose = (call: WithId<RecruitmentCall>) => {
    if (!user) {
      setSelected(call);
      authModal.open();
      return;
    }
    setSelected(call);
    modal.open();
  };

  return (
    <Box mih="100vh" bg="var(--mantine-color-gray-0)" style={{ colorScheme: 'light' }}>
      <Box bg="linear-gradient(135deg, #00629b 0%, #003b5c 62%, #111827 100%)" c="white" py={{ base: 42, sm: 72 }}>
        <Container size="lg">
          <Group justify="space-between" align="flex-start" mb={48}>
            <Group gap="sm">
              <Image src={publicSettings.logoDataUrl ?? '/favicon.svg'} h={44} w={44} fit="contain" alt="" />
              <div>
                <Text fw={800} size="lg">{publicSettings.orgShortName}</Text>
                <Text size="xs" c="rgba(255,255,255,.72)">Kariyer ve gönüllülük</Text>
              </div>
            </Group>
            {user ? (
              <Button variant="white" color="dark" size="xs" leftSection={<IconLogout size={15} />} onClick={() => void signOut()}>
                Çıkış
              </Button>
            ) : null}
          </Group>
          <Stack maw={760} gap="md">
            <Badge variant="light" color="cyan" size="lg" w="fit-content">Birlikte üretelim</Badge>
            <Title order={1} fz={{ base: 38, sm: 58 }} lh={1.06}>IEEE İKÇÜ’de yerini bul.</Title>
            <Text size="lg" c="rgba(255,255,255,.82)" maw={650}>
              Komitelerin, Yönetim Kurulunun ve proje ekiplerinin açık gönüllü pozisyonlarını incele; sana uygun ekibe doğrudan başvur.
            </Text>
          </Stack>
        </Container>
      </Box>

      <Container size="lg" py={{ base: 'xl', sm: 44 }}>
        <Alert color="blue" variant="light" mb="xl" title="Bu portal komite başvuruları içindir">
          IEEE üyeliği ve standart öğrenci kolu üyelik işlemleri mevcut üyelik sistemi üzerinden yürür. Buradaki hesap ve başvuru, tek başına IEEE üyeliği oluşturmaz.
        </Alert>

        {user && (
          <Card withBorder mb="xl" padding="lg">
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={700}>Başvurularım</Text>
                <Text size="sm" c="dimmed">{user.email}</Text>
              </div>
              <Badge variant="light">{mine.data.length} başvuru</Badge>
            </Group>
            {mine.loading ? <SectionLoader /> : mine.data.length === 0 ? (
              <Text size="sm" c="dimmed">Henüz bir ilana başvurmadınız.</Text>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                {mine.data.sort((a, b) => b.submittedAt.toMillis() - a.submittedAt.toMillis()).map((application) => (
                  <Card key={application.id} bg="gray.0" padding="sm">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div>
                        <Text size="sm" fw={600}>{application.callTitle}</Text>
                        <Text size="xs" c="dimmed">{application.unitName}</Text>
                      </div>
                      <Badge color={STATUS[application.status].color} variant="light">{STATUS[application.status].label}</Badge>
                    </Group>
                    {application.decisionNote && <Text size="xs" mt="xs">Not: {application.decisionNote}</Text>}
                    {['pending', 'reviewing', 'waitlisted'].includes(application.status) && (
                      <Button
                        size="compact-xs"
                        color="red"
                        variant="subtle"
                        mt="xs"
                        onClick={() => withdrawRecruitmentApplication(application).then(() => notifySuccess('Başvuru geri çekildi.')).catch(notifyError)}
                      >
                        Geri çek
                      </Button>
                    )}
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Card>
        )}

        <Group justify="space-between" align="end" mb="lg">
          <div>
            <Title order={2}>Açık pozisyonlar</Title>
            <Text c="dimmed">Sana uygun ekibi seç, soruları yanıtla ve başvurunu takip et.</Text>
          </div>
          {!user && <Badge color="gray" variant="light">Başvuru için Google ile giriş gerekir</Badge>}
        </Group>

        {calls.loading ? <SectionLoader /> : calls.error ? <ErrorAlert error={calls.error} /> : openCalls.length === 0 ? (
          <Card withBorder padding="xl" ta="center">
            <IconBriefcase2 size={40} color="var(--mantine-color-gray-5)" />
            <Title order={4} mt="sm">Şu anda açık ilan yok</Title>
            <Text size="sm" c="dimmed" mt={4}>Yeni komite ve ekip alımları açıldığında burada görünecek.</Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {openCalls.map((call) => {
              const existing = applicationByCall.get(call.id);
              return (
                <Card key={call.id} withBorder padding="xl" radius="lg">
                  <Stack h="100%">
                    <Group justify="space-between" align="flex-start">
                      <Badge leftSection={<IconUsersGroup size={13} />} variant="light">{call.unitName}</Badge>
                      {call.capacity && <Badge color="gray" variant="outline">{call.capacity} kişi</Badge>}
                    </Group>
                    <div>
                      <Title order={3}>{call.title}</Title>
                      <Text fw={600} c="blue.8" mt={4}>{call.roleTitle}</Text>
                    </div>
                    <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{call.summary}</Text>
                    {call.expectations && <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{call.expectations}</Text>}
                    <Divider mt="auto" />
                    <Group justify="space-between" align="center">
                      <Text size="xs" c="dimmed"><IconCalendar size={14} style={{ verticalAlign: -2 }} /> Son gün: {dateTime(call.closesAt)}</Text>
                      {existing ? (
                        <Badge color={STATUS[existing.status].color}>{STATUS[existing.status].label}</Badge>
                      ) : (
                        <Button rightSection={<IconArrowRight size={16} />} onClick={() => choose(call)}>
                          {user ? 'Başvur' : 'Giriş yap ve başvur'}
                        </Button>
                      )}
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}

        <Divider my="xl" />
        <Group justify="space-between" gap="xs">
          <Text size="xs" c="dimmed">© {new Date().getFullYear()} {publicSettings.orgName}</Text>
          <Group gap="md">
            <Anchor href={window.location.hostname.includes('ieee-ikcu-kariyer') ? 'https://ieee-hub-techops.web.app/tuzuk' : '/tuzuk'} size="xs">Tüzük</Anchor>
            <Anchor href={window.location.hostname.includes('ieee-ikcu-kariyer') ? 'https://ieee-hub-techops.web.app' : '/'} size="xs">İç operasyon Hub’ı</Anchor>
          </Group>
        </Group>
      </Container>

      <ApplicationModal call={selected} opened={opened} onClose={modal.close} />
      <CandidateAuthModal
        opened={authOpened}
        onClose={authModal.close}
        onDone={() => { authModal.close(); modal.open(); }}
      />
    </Box>
  );
}

function CandidateAuthModal({ opened, onClose, onDone }: { opened: boolean; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      onDone();
    } catch (error) {
      notifyError(error, 'Google ile giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (name.trim().length < 3) throw new Error('Ad soyad girin.');
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name.trim() });
      }
      onDone();
    } catch (error) {
      notifyError(error, mode === 'login' ? 'Giriş yapılamadı' : 'Hesap oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Başvuru hesabı" centered>
      <Stack>
        <Alert color="blue" variant="light">Bu hesap yalnızca başvurunuzu güvenli biçimde sahiplenmeniz ve takip etmeniz içindir; IEEE üyeliği oluşturmaz.</Alert>
        <Button variant="default" onClick={() => void google()} loading={busy}>Google ile devam et</Button>
        <Divider label="veya e-posta ile" />
        <form onSubmit={submit}>
          <Stack gap="sm">
            {mode === 'register' && <TextInput label="Ad soyad" required value={name} onChange={(event) => setName(event.currentTarget.value)} />}
            <TextInput label="E-posta" type="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
            <PasswordInput label="Şifre" required minLength={6} value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
            <Button type="submit" loading={busy}>{mode === 'login' ? 'Giriş yap' : 'Başvuru hesabı oluştur'}</Button>
          </Stack>
        </form>
        <Anchor component="button" size="sm" onClick={() => setMode((current) => current === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Hesabın yok mu? Başvuru hesabı oluştur' : 'Zaten hesabın var mı? Giriş yap'}
        </Anchor>
      </Stack>
    </Modal>
  );
}

function ApplicationModal({ call, opened, onClose }: { call: WithId<RecruitmentCall> | null; opened: boolean; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [ieeeMemberNo, setIeeeMemberNo] = useState('');
  const [motivation, setMotivation] = useState('');
  const [availability, setAvailability] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!call) return null;
  const setAnswer = (id: string, value: string) => setAnswers((current) => ({ ...current, [id]: value }));
  const submit = async () => {
    setBusy(true);
    try {
      await applyToRecruitmentCall(call, { phone, department, studentNo, ieeeMemberNo, motivation, availability, answers, privacyConsent: true });
      notifySuccess('Başvurunuz ekibe iletildi. Durumunu bu sayfadan takip edebilirsiniz.', 'Başvuru alındı');
      onClose();
    } catch (error) {
      notifyError(error, 'Başvuru gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={`${call.title} · Başvuru`} size="lg" centered>
      <Stack>
        <Alert color="blue" variant="light">{call.unitName} · {call.roleTitle}</Alert>
        {call.description && <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{call.description}</Text>}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Bölüm" required value={department} onChange={(event) => setDepartment(event.currentTarget.value)} />
          <TextInput label="Öğrenci numarası" value={studentNo} onChange={(event) => setStudentNo(event.currentTarget.value)} />
          <TextInput label="Telefon" value={phone} onChange={(event) => setPhone(event.currentTarget.value)} />
          <TextInput label="IEEE üye numarası" description="Varsa" value={ieeeMemberNo} onChange={(event) => setIeeeMemberNo(event.currentTarget.value)} />
        </SimpleGrid>
        <Textarea label="Neden bu ekibe katılmak istiyorsunuz?" required minRows={4} autosize value={motivation} onChange={(event) => setMotivation(event.currentTarget.value)} />
        <TextInput label="Haftalık uygunluk" placeholder="Örn. haftada 3–4 saat" value={availability} onChange={(event) => setAvailability(event.currentTarget.value)} />
        {call.questions.map((question) => (
          <QuestionField key={question.id} question={question} value={answers[question.id] ?? ''} onChange={(value) => setAnswer(question.id, value)} />
        ))}
        <Checkbox
          checked={consent}
          onChange={(event) => setConsent(event.currentTarget.checked)}
          label="Başvuru bilgilerimin ilgili komite/YK yöneticileri tarafından değerlendirme ve gönüllülük süreci amacıyla işlenmesini kabul ediyorum."
        />
        <Button onClick={submit} disabled={!consent} loading={busy}>Başvuruyu gönder</Button>
      </Stack>
    </Modal>
  );
}

function QuestionField({ question, value, onChange }: { question: RecruitmentQuestion; value: string; onChange: (value: string) => void }) {
  if (question.type === 'long') return <Textarea label={question.label} required={question.required} autosize minRows={3} value={value} onChange={(event) => onChange(event.currentTarget.value)} />;
  if (question.type === 'choice') return <Select label={question.label} required={question.required} data={question.options} value={value || null} onChange={(next) => onChange(next ?? '')} />;
  if (question.type === 'boolean') return <Checkbox label={question.label} required={question.required} checked={value === 'Evet'} onChange={(event) => onChange(event.currentTarget.checked ? 'Evet' : '')} />;
  return <TextInput label={question.label} required={question.required} value={value} onChange={(event) => onChange(event.currentTarget.value)} />;
}
