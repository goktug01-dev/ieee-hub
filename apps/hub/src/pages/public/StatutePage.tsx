import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  FileInput,
  Group,
  Image,
  Paper,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDownload, IconFileText, IconHistory, IconUpload } from '@tabler/icons-react';
import { orderBy } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { DocxPreview } from '../../components/DocxPreview';
import { EmptyState, ErrorAlert, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { fmtDateTime, formatFileSize } from '../../lib/format';
import { useCollection, useDoc } from '../../lib/hooks';
import { DOCX_MIME, downloadStatute, loadStatuteFile, publishStatute, validateStatuteFile } from '../../lib/statutes';
import type { StatuteVersion } from '../../lib/types';

export function StatutePage() {
  const { publicSettings, phase, can } = useAuth();
  const current = useDoc<StatuteVersion>('statutes/current');
  const versions = useCollection<StatuteVersion>('statuteVersions', [orderBy('publishedAt', 'desc')], 'statute-history');
  const canPublish = phase === 'active' && (can('org.manage') || can('secretary.ledger.manage'));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('IEEE İKÇÜ Öğrenci Kolu Tüzüğü');
  const [versionLabel, setVersionLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setBlob(null);
    setBlobUrl(null);
    setFileError(null);
    if (!current.data) return;
    loadStatuteFile(current.data)
      .then((nextBlob) => {
        if (!active) return;
        url = URL.createObjectURL(nextBlob);
        setBlob(nextBlob);
        setBlobUrl(url);
      })
      .catch((error) => active && setFileError(error instanceof Error ? error.message : String(error)));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [current.data?.versionId]);

  const history = useMemo(() => versions.data.filter((item) => item.versionId !== current.data?.versionId), [versions.data, current.data?.versionId]);

  const submit = () => {
    if (!file) return notifyError(new Error('Önce PDF veya Word tüzük dosyasını seçin.'));
    const validation = validateStatuteFile(file);
    if (validation) return notifyError(new Error(validation));
    if (!title.trim() || !versionLabel.trim()) return notifyError(new Error('Başlık ve sürüm bilgisi zorunludur.'));
    modals.openConfirmModal({
      title: 'Yeni tüzük sürümünü yayımla',
      children: <Text size="sm">Bu dosya anında herkese açık güncel tüzük olacaktır. Yayımlanan sürüm değiştirilemez.</Text>,
      labels: { confirm: 'Yayımla', cancel: 'Vazgeç' },
      confirmProps: { color: 'blue' },
      onConfirm: async () => {
        setBusy(true);
        try {
          await publishStatute({ file, title, versionLabel, summary });
          setFile(null);
          setVersionLabel('');
          setSummary('');
          notifySuccess('Yeni tüzük sürümü herkese açık olarak yayımlandı.');
        } catch (error) {
          notifyError(error, 'Tüzük yayımlanamadı');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="sm">
            <Image src={publicSettings.logoDataUrl ?? '/favicon.svg'} h={44} w="auto" fit="contain" alt="" />
            <div>
              <Title order={2}>Tüzük</Title>
              <Text c="dimmed">{publicSettings.orgName}</Text>
            </div>
          </Group>
          <Group>
            <Anchor component={Link} to="/dogrula">Belge doğrula</Anchor>
            <Button component={Link} to="/" variant="default">{phase === 'active' ? 'Hub’a dön' : 'Giriş yap'}</Button>
          </Group>
        </Group>

        {current.loading ? <SectionLoader /> : current.error ? <ErrorAlert error={current.error} /> : !current.data ? (
          <Paper withBorder><EmptyState title="Henüz tüzük yayımlanmadı" description="Yetkili yönetici ilk tüzük sürümünü yayımladığında burada herkes tarafından görülebilecek." /></Paper>
        ) : (
          <>
            <Paper withBorder p="lg">
              <Group justify="space-between" align="flex-start" wrap="wrap" mb="md">
                <div>
                  <Group gap="xs"><Title order={3}>{current.data.title}</Title><Badge>{current.data.versionLabel}</Badge></Group>
                  <Text c="dimmed" size="sm" mt={4}>Yayımlanma: {fmtDateTime(current.data.publishedAt)} · {formatFileSize(current.data.size)}</Text>
                  {current.data.summary && <Text mt="sm" maw={800}>{current.data.summary}</Text>}
                </div>
                <Button leftSection={<IconDownload size={17} />} onClick={() => void downloadStatute(current.data!).catch((error) => notifyError(error, 'Dosya indirilemedi'))}>İndir</Button>
              </Group>
              {fileError ? <ErrorAlert error={fileError} /> : !blob ? <SectionLoader /> : current.data.mimeType === DOCX_MIME ? (
                <DocxPreview blob={blob} />
              ) : (
                <iframe title="Güncel tüzük" src={blobUrl ?? undefined} style={{ width: '100%', height: '75vh', border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }} />
              )}
            </Paper>

            {history.length > 0 && <Paper withBorder p="lg"><Group gap="xs" mb="md"><IconHistory size={20} /><Title order={4}>Önceki sürümler</Title></Group><Table.ScrollContainer minWidth={600}><Table striped><Table.Thead><Table.Tr><Table.Th>Sürüm</Table.Th><Table.Th>Dosya</Table.Th><Table.Th>Yayımlanma</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{history.map((item) => <Table.Tr key={item.versionId}><Table.Td><Text fw={600}>{item.versionLabel}</Text><Text size="xs" c="dimmed">{item.title}</Text></Table.Td><Table.Td>{item.fileName} · {formatFileSize(item.size)}</Table.Td><Table.Td>{fmtDateTime(item.publishedAt)}</Table.Td><Table.Td><Button size="xs" variant="subtle" leftSection={<IconDownload size={14} />} onClick={() => void downloadStatute(item).catch((error) => notifyError(error, 'Dosya indirilemedi'))}>İndir</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>}
          </>
        )}

        {canPublish && <Paper withBorder p="lg"><Group gap="xs" mb="md"><IconUpload size={20} /><Title order={4}>Yeni tüzük sürümü yayımla</Title></Group><Alert color="blue" mb="md" icon={<IconFileText size={18} />}>Yayımlanan sürüm silinmez veya değiştirilmez; güncel sürüm olur ve önceki sürüm arşivde kalır.</Alert><Stack><FileInput label="Tüzük dosyası" description="PDF veya Word (.docx), en fazla 4 MB" accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" value={file} onChange={setFile} clearable required /><TextInput label="Başlık" value={title} onChange={(event) => setTitle(event.currentTarget.value)} required /><TextInput label="Sürüm / karar bilgisi" placeholder="Örn. 2026 Rev. 1 · 15.09.2026 Genel Kurul" value={versionLabel} onChange={(event) => setVersionLabel(event.currentTarget.value)} required /><Textarea label="Açıklama" placeholder="Bu sürümdeki önemli değişiklikler veya kabul kararı" value={summary} onChange={(event) => setSummary(event.currentTarget.value)} autosize minRows={2} /><Group justify="flex-end"><Button leftSection={<IconUpload size={16} />} onClick={submit} loading={busy}>Yayımla</Button></Group></Stack></Paper>}

        <Text size="xs" c="dimmed" ta="center">Dosya bütünlüğü yayımlama sırasında SHA-256 özetiyle doğrulanır. Güncel ve geçmiş sürümler herkese açıktır.</Text>
      </Stack>
    </Container>
  );
}
