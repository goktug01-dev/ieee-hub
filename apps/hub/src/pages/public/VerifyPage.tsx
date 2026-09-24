import {
  Alert,
  Badge,
  Button,
  Center,
  Container,
  Group,
  Image,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCircleCheck, IconSearch, IconShieldCheck, IconAlertTriangle } from '@tabler/icons-react';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { SectionLoader, StatusBadge } from '../../components/ui';
import { db } from '../../firebase';
import { DECISION_LABEL, fmtDateTime } from '../../lib/format';
import type { PetitionVerification } from '../../lib/types';

export function VerifyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { publicSettings } = useAuth();
  const [input, setInput] = useState(code ?? '');
  const [state, setState] = useState<{ loading: boolean; data: PetitionVerification | null; notFound: boolean }>({
    loading: false,
    data: null,
    notFound: false,
  });

  useEffect(() => {
    if (!code) return;
    const normalized = code.toUpperCase().replace(/[^0-9A-Z]/g, '');
    setState({ loading: true, data: null, notFound: false });
    getDoc(doc(db, 'petitionVerifications', normalized))
      .then((s) => setState({ loading: false, data: s.exists() ? (s.data() as PetitionVerification) : null, notFound: !s.exists() }))
      .catch(() => setState({ loading: false, data: null, notFound: true }));
  }, [code]);

  const v = state.data;
  const currentApprovals = v?.approvals.filter((a) => a.revision === v.revision) ?? [];

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group gap="sm">
          <Image src={publicSettings.logoDataUrl ?? '/favicon.svg'} h={40} w="auto" fit="contain" alt="" />
          <div>
            <Title order={3}>Belge doğrulama</Title>
            <Text c="dimmed" size="sm">
              {publicSettings.orgName}
            </Text>
          </div>
        </Group>

        <Paper withBorder p="md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) navigate(`/dogrula/${input.trim().toUpperCase()}`);
            }}
          >
            <Group align="flex-end" wrap="nowrap">
              <TextInput
                label="Doğrulama kodu"
                description="Belgenin alt bilgisindeki 12 karakterlik kod"
                placeholder="örn. 7K2M9QXA4TRB"
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                style={{ flex: 1 }}
                maxLength={20}
              />
              <Button type="submit" leftSection={<IconSearch size={16} />}>
                Sorgula
              </Button>
            </Group>
          </form>
        </Paper>

        {state.loading && <SectionLoader />}

        {state.notFound && (
          <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Kayıt bulunamadı">
            Bu koda ait bir belge kaydı yok. Kodu doğru yazdığınızdan emin olun. Belge sahte veya değiştirilmiş olabilir.
          </Alert>
        )}

        {v && (
          <Paper withBorder p="lg">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size={44} radius="xl" color={v.status === 'approved' ? 'green' : 'blue'} variant="light">
                  {v.status === 'approved' ? <IconCircleCheck size={26} /> : <IconShieldCheck size={26} />}
                </ThemeIcon>
                <div>
                  <Text fw={700} size="lg">
                    {v.documentNo}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {v.templateName}
                    {v.unitName ? ` · ${v.unitName}` : ''}
                  </Text>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <StatusBadge status={v.status} />
                </div>
              </Group>

              <Table variant="vertical" withTableBorder>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Th w={180}>Dilekçe sahibi</Table.Th>
                    <Table.Td>{v.ownerMasked}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Gönderim</Table.Th>
                    <Table.Td>{fmtDateTime(v.submittedAt)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Revizyon</Table.Th>
                    <Table.Td>{v.revision}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th>Son güncelleme</Table.Th>
                    <Table.Td>{fmtDateTime(v.updatedAt)}</Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>

              <div>
                <Text fw={600} mb="xs">
                  Onaylar
                </Text>
                {currentApprovals.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Henüz onay yok.
                  </Text>
                ) : (
                  <Stack gap="xs">
                    {currentApprovals.map((a, i) => (
                      <Group key={i} justify="space-between" wrap="nowrap">
                        <div>
                          <Text size="sm" fw={500}>
                            {a.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {a.roleName}
                            {a.unitId !== 'branch' ? ` · ${a.unitName}` : ''} — {a.stepName}
                          </Text>
                        </div>
                        <Stack gap={0} align="flex-end">
                          <Badge color={a.decision === 'approve' ? 'green' : a.decision === 'reject' ? 'red' : 'orange'}>
                            {DECISION_LABEL[a.decision]}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {fmtDateTime(a.at)}
                          </Text>
                        </Stack>
                      </Group>
                    ))}
                  </Stack>
                )}
              </div>

              <Text size="xs" c="dimmed">
                Bu sayfa yalnızca belgenin Hub kaydını gösterir; dilekçe içeriği gizlilik gereği paylaşılmaz. Onaylar, 5070 sayılı
                Kanun kapsamında e-imza değil, rol bazlı sistem içi elektronik onaydır. Elinizdeki belgedeki evrak numarası ve
                onaylar bu kayıtla uyuşmuyorsa belge geçerli değildir.
              </Text>
            </Stack>
          </Paper>
        )}

        {!code && (
          <Center>
            <Text c="dimmed" size="sm">
              Belgenin alt bilgisindeki bağlantıyı açarak da doğrulama yapabilirsiniz.
            </Text>
          </Center>
        )}
      </Stack>
    </Container>
  );
}
