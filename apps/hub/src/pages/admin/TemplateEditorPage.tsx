import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Grid,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  Accordion,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCheck,
  IconDownload,
  IconFileTypeDocx,
  IconPlus,
  IconRocket,
  IconTrash,
  IconUpload,
  IconWand,
  IconX,
} from '@tabler/icons-react';
import { Timestamp, orderBy } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { DocxPreview } from '../../components/DocxPreview';
import { EmptyState, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import {
  DEFAULT_BUILDER,
  DOCX_MIME,
  MAX_TEMPLATE_BYTES,
  RESERVED_TAGS,
  downloadBlob,
  readChunks,
  renderDocx,
} from '../../lib/docx';
import { fmtDateTime, formatFileSize } from '../../lib/format';
import { useCollection, useDoc } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import { templateData } from '../../lib/petitions';
import {
  publishTemplate,
  saveBuilderDraft,
  saveDraftContent,
  saveDraftFile,
  setCurrentVersion,
  updateTemplateMeta,
  validateSteps,
} from '../../lib/templates';
import type {
  ApprovalRecord,
  ApprovalStep,
  BuilderSpec,
  FieldType,
  Petition,
  PetitionTemplate,
  TemplateField,
  TemplateVersion,
} from '../../lib/types';
import { BRANCH } from '../../lib/types';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Kısa metin' },
  { value: 'textarea', label: 'Uzun metin' },
  { value: 'date', label: 'Tarih' },
  { value: 'number', label: 'Sayı' },
  { value: 'select', label: 'Seçenek listesi' },
  { value: 'email', label: 'E-posta' },
  { value: 'phone', label: 'Telefon' },
];

const PREFILL = [
  { value: 'displayName', label: 'Ad soyad' },
  { value: 'email', label: 'E-posta' },
  { value: 'phone', label: 'Telefon' },
  { value: 'department', label: 'Bölüm' },
  { value: 'studentNo', label: 'Öğrenci no' },
];

function sampleValue(f: TemplateField): string {
  if (f.type === 'date') return new Date().toISOString().slice(0, 10);
  if (f.type === 'number') return '10';
  if (f.type === 'select') return f.options?.[0] ?? `[${f.label}]`;
  return `[${f.label}]`;
}

export function TemplateEditorPage() {
  const { id } = useParams();
  const { publicSettings, orgSettings } = useAuth();
  const { roles, unitOptions, unitName, roleName } = useOrg();
  const { data: t, loading } = useDoc<PetitionTemplate>(`petitionTemplates/${id}`);
  const versions = useCollection<TemplateVersion>(`petitionTemplates/${id}/versions`, [orderBy('version', 'desc')], id);

  const [tab, setTab] = useState<string | null>('belge');
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [dirty, setDirty] = useState<{ fields?: boolean; steps?: boolean }>({});
  const [draftFile, setDraftFile] = useState<ArrayBuffer | null>(null);
  const [preview, setPreview] = useState<Blob | null>(null);
  const [mode, setMode] = useState<'upload' | 'builder'>('upload');
  const [spec, setSpec] = useState<BuilderSpec>(DEFAULT_BUILDER);
  const [busy, setBusy] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  const draft = t?.draft ?? null;
  const draftKey = draft ? `${draft.fileName}-${draft.sizeBytes}-${draft.chunkCount}-${t?.updatedAt?.toMillis?.()}` : '';

  // Taslak içeriğini yerel düzenleme durumuna aktar
  useEffect(() => {
    if (!draft) return;
    if (!dirty.fields) setFields(draft.fields);
    if (!dirty.steps) setSteps(draft.steps);
    setMode(draft.source);
    if (draft.builder) setSpec(draft.builder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Taslak Word dosyasını indir
  useEffect(() => {
    if (!draft || !id) {
      setDraftFile(null);
      return;
    }
    readChunks(db, `petitionTemplates/${id}/draftChunks`, false).then(setDraftFile).catch(notifyError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Örnek verilerle önizleme
  useEffect(() => {
    if (!draftFile || !t) return;
    const data = Object.fromEntries(fields.map((f) => [f.key, sampleValue(f)]));
    const fakeApprovals: ApprovalRecord[] = steps.map((s, i) => ({
      step: i,
      stepName: s.name,
      revision: 1,
      uid: 'x',
      name: 'Örnek Kişi',
      roleId: s.roleIds[0] ?? '',
      roleName: s.roleIds[0] ? roleName(s.roleIds[0]) : '—',
      unitId: s.unitMode === 'branch' ? BRANCH : 'ornek',
      unitName: s.unitMode === 'fixed' && s.unitId ? unitName(s.unitId) : 'Örnek Birim',
      decision: 'approve',
      at: Timestamp.now(),
    }));
    const fake: Petition = {
      templateId: id!,
      templateVersion: 0,
      templateName: t.name,
      unitId: t.scope === 'branch' ? BRANCH : 'ornek',
      unitName: 'Örnek Komite',
      ownerUid: 'x',
      ownerName: 'Örnek Dilekçe Sahibi',
      title: t.name,
      data,
      status: 'approved',
      visibleTo: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      documentNo: `${orgSettings.numberingPrefix}-${new Date().getFullYear()}-${t.series}-0001`,
      verificationCode: 'ORNEK0KOD123',
      approvals: fakeApprovals,
      revision: 1,
      submittedAt: Timestamp.now(),
    };
    try {
      setPreview(renderDocx(draftFile, templateData(fake, { orgName: publicSettings.orgName, settings: orgSettings })));
    } catch (e) {
      notifyError(e, 'Şablon doldurulamadı');
    }
  }, [draftFile, fields, steps, t, id, publicSettings.orgName, orgSettings, roleName, unitName]);

  const stepErrors = useMemo(() => validateSteps(steps), [steps]);

  if (loading) return <SectionLoader />;
  if (!t || !id) return <EmptyState title="Şablon bulunamadı" />;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (files: File[]) =>
    run('upload', async () => {
      const file = files[0];
      const buf = await file.arrayBuffer();
      const { content, warnings } = await saveDraftFile(id, draft ? { ...draft, fields, steps } : null, {
        name: file.name,
        buf,
        source: 'upload',
      });
      setDirty({});
      notifySuccess(
        `${content.fields.length} alan algılandı${warnings.length ? `. Uyarı: ${warnings.join(' ')}` : ''}`,
        'Word şablonu yüklendi',
      );
      if (content.fields.length) setTab('alanlar');
    });

  const buildFromSpec = () =>
    run('build', async () => {
      const { content } = await saveBuilderDraft(id, draft ? { ...draft, fields, steps } : null, spec);
      setDirty({});
      notifySuccess(`${content.fields.length} alan algılandı.`, 'Şablon belgesi oluşturuldu');
    });

  const saveFields = () =>
    run('fields', async () => {
      if (!draft) return;
      await saveDraftContent(id, { ...draft, fields });
      setDirty((d) => ({ ...d, fields: false }));
      notifySuccess('Alanlar kaydedildi (taslak).');
    });

  const saveSteps = () =>
    run('steps', async () => {
      if (!draft) return notifyError(new Error('Önce belge yükleyin veya oluşturun.'));
      await saveDraftContent(id, { ...draft, steps });
      setDirty((d) => ({ ...d, steps: false }));
      notifySuccess('Onay zinciri kaydedildi (taslak).');
    });

  const publish = () =>
    run('publish', async () => {
      if (draft && (dirty.fields || dirty.steps)) await saveDraftContent(id, { ...draft, fields, steps });
      const v = await publishTemplate(id, changeNote.trim());
      setDirty({});
      setPublishOpen(false);
      setChangeNote('');
      notifySuccess(`Sürüm ${v} yayımlandı ve kullanıma açıldı.`, 'Şablon yayımlandı');
    });

  const setField = (key: string, patch: Partial<TemplateField>) => {
    setFields((fs) => fs.map((f) => (f.key === key ? { ...f, ...patch } : f)));
    setDirty((d) => ({ ...d, fields: true }));
  };
  const setStep = (i: number, patch: Partial<ApprovalStep>) => {
    setSteps((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setDirty((d) => ({ ...d, steps: true }));
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    setSteps((ss) => {
      const out = [...ss];
      const [s] = out.splice(i, 1);
      out.splice(i + dir, 0, s);
      return out;
    });
    setDirty((d) => ({ ...d, steps: true }));
  };
  const addStep = () => {
    setSteps((ss) => [...ss, { name: '', roleIds: [], unitMode: t.scope === 'unit' ? 'petition' : 'branch', unitId: null }]);
    setDirty((d) => ({ ...d, steps: true }));
  };

  const rolesFor = (mode: ApprovalStep['unitMode']) =>
    roles.filter((r) => r.active && (mode === 'branch' ? r.scope === 'branch' : r.scope === 'unit')).map((r) => ({ value: r.id, label: r.name }));

  const unsaved = dirty.fields || dirty.steps;
  const hasUnpublished = !!draft && (!versions.data.length || draftKey !== '' && versions.data[0]?.publishedAt?.toMillis() < (t.updatedAt?.toMillis() ?? 0));

  return (
    <Stack>
      <Anchor component={Link} to="/yonetim/sablonlar" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> Dilekçe şablonları
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Group gap="sm">
            <Title order={2}>{t.name}</Title>
            {t.currentVersion ? (
              <Badge color={t.active ? 'green' : 'orange'}>
                {t.active ? 'Kullanımda' : 'Kullanıma kapalı'} · sürüm {t.currentVersion}
              </Badge>
            ) : (
              <Badge color="gray">Yayımlanmadı</Badge>
            )}
            {hasUnpublished && <Badge color="yellow">Yayımlanmamış değişiklik var</Badge>}
          </Group>
          <Text c="dimmed" size="sm">
            {t.scope === 'branch' ? 'Kol geneli' : 'Komite / birim'} · Seri {t.series}
            {draft ? ` · ${draft.fileName} (${formatFileSize(draft.sizeBytes)})` : ''}
          </Text>
        </div>
        <Group gap="xs">
          {t.currentVersion > 0 && (
            <Switch
              label="Kullanıma açık"
              checked={t.active}
              onChange={(e) => void run('active', () => updateTemplateMeta(id, { active: e.currentTarget.checked }))}
            />
          )}
          <Button leftSection={<IconRocket size={18} />} onClick={() => setPublishOpen(true)} disabled={!draft}>
            Yayımla
          </Button>
        </Group>
      </Group>

      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="belge">1. Belge</Tabs.Tab>
          <Tabs.Tab value="alanlar" rightSection={draft ? <Badge size="xs" variant="light">{fields.length}</Badge> : null}>
            2. Form alanları
          </Tabs.Tab>
          <Tabs.Tab value="onay" rightSection={stepErrors.length && draft ? <Badge size="xs" color="red" variant="filled">!</Badge> : null}>
            3. Onay zinciri
          </Tabs.Tab>
          <Tabs.Tab value="genel">Genel bilgiler</Tabs.Tab>
          <Tabs.Tab value="surumler">Sürümler ({versions.data.length})</Tabs.Tab>
        </Tabs.List>

        {/* ---------- BELGE ---------- */}
        <Tabs.Panel value="belge">
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack>
                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={(v) => setMode(v as typeof mode)}
                  data={[
                    { value: 'upload', label: 'Word dosyası yükle' },
                    { value: 'builder', label: 'Sistemde oluştur' },
                  ]}
                />
                {mode === 'upload' ? (
                  <Card>
                    <Stack>
                      <Dropzone
                        onDrop={onDrop}
                        onReject={() => notifyError(new Error(`Yalnızca .docx dosyası (en fazla ${formatFileSize(MAX_TEMPLATE_BYTES)}).`))}
                        maxSize={MAX_TEMPLATE_BYTES}
                        maxFiles={1}
                        accept={[DOCX_MIME]}
                        loading={busy === 'upload'}
                      >
                        <Group justify="center" gap="md" mih={120} style={{ pointerEvents: 'none' }}>
                          <Dropzone.Accept>
                            <IconUpload size={40} />
                          </Dropzone.Accept>
                          <Dropzone.Reject>
                            <IconX size={40} />
                          </Dropzone.Reject>
                          <Dropzone.Idle>
                            <IconFileTypeDocx size={40} stroke={1.5} />
                          </Dropzone.Idle>
                          <div>
                            <Text fw={500}>Word dosyasını sürükleyin veya seçin</Text>
                            <Text size="sm" c="dimmed">
                              .docx · biçim, logo ve yazı tipi aynen korunur
                            </Text>
                          </div>
                        </Group>
                      </Dropzone>
                      <Accordion variant="contained">
                        <Accordion.Item value="howto">
                          <Accordion.Control>Word şablonu nasıl hazırlanır?</Accordion.Control>
                          <Accordion.Panel>
                            <Stack gap="xs">
                              <Text size="sm">
                                Mevcut dilekçenizi Word'de açın. Doldurulacak her yere süslü parantez içinde bir alan adı yazın:
                              </Text>
                              <Code block>{'Adı Soyadı: {ad_soyad}\nEtkinlik tarihi: {etkinlik_tarihi}\nAçıklama: {aciklama}'}</Code>
                              <Text size="sm">
                                Alan adlarında Türkçe karakter ve boşluk yerine <Code>_</Code> kullanın. Yüklediğinizde her alan otomatik
                                olarak form sorusuna dönüşür; soru metnini ve türünü sonra düzenleyebilirsiniz.
                              </Text>
                              <Text size="sm">Aşağıdaki etiketler sistem tarafından doldurulur:</Text>
                              <Table fz="xs" withTableBorder>
                                <Table.Tbody>
                                  {RESERVED_TAGS.map((r) => (
                                    <Table.Tr key={r.tag}>
                                      <Table.Td>
                                        <CopyButton value={r.tag.startsWith('#') ? '{#onaylar}{adim} {ad_soyad} {unvan} {onay_tarihi}{/onaylar}' : `{${r.tag}}`}>
                                          {({ copied, copy }) => (
                                            <Tooltip label={copied ? 'Kopyalandı' : 'Kopyala'}>
                                              <Code style={{ cursor: 'pointer' }} onClick={copy}>
                                                {r.tag.startsWith('#') ? `{${r.tag}}` : `{${r.tag}}`}
                                              </Code>
                                            </Tooltip>
                                          )}
                                        </CopyButton>
                                      </Table.Td>
                                      <Table.Td>{r.description}</Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      </Accordion>
                    </Stack>
                  </Card>
                ) : (
                  <Card>
                    <Stack>
                      <Textarea
                        label="Başlık satırları"
                        description="Her satır ortalanmış kalın başlık olur"
                        autosize
                        minRows={2}
                        value={spec.orgLines.join('\n')}
                        onChange={(e) => setSpec({ ...spec, orgLines: e.currentTarget.value.split('\n') })}
                      />
                      <TextInput label="Hitap (makam)" value={spec.recipient} onChange={(e) => setSpec({ ...spec, recipient: e.currentTarget.value })} />
                      <TextInput label="Konu" description="Boş bırakılırsa basılmaz" value={spec.subject} onChange={(e) => setSpec({ ...spec, subject: e.currentTarget.value })} />
                      <Textarea
                        label="Dilekçe metni"
                        description="Doldurulacak yerlere {alan_adi} yazın. Boş satır yeni paragraf başlatır."
                        autosize
                        minRows={8}
                        value={spec.body}
                        onChange={(e) => setSpec({ ...spec, body: e.currentTarget.value })}
                      />
                      <TextInput label="Kapanış" value={spec.closing} onChange={(e) => setSpec({ ...spec, closing: e.currentTarget.value })} />
                      <Switch label="Sayı (evrak no) ve tarih satırı" checked={spec.includeDocMeta} onChange={(e) => setSpec({ ...spec, includeDocMeta: e.currentTarget.checked })} />
                      <Switch label="Onaylar tablosu" checked={spec.includeApprovals} onChange={(e) => setSpec({ ...spec, includeApprovals: e.currentTarget.checked })} />
                      <Switch label="Doğrulama alt bilgisi" checked={spec.includeVerification} onChange={(e) => setSpec({ ...spec, includeVerification: e.currentTarget.checked })} />
                      <Button leftSection={<IconWand size={18} />} onClick={buildFromSpec} loading={busy === 'build'}>
                        Belgeyi oluştur / güncelle
                      </Button>
                    </Stack>
                  </Card>
                )}
                {draftFile && draft && (
                  <Button
                    variant="default"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => downloadBlob(new Blob([draftFile], { type: DOCX_MIME }), draft.fileName)}
                  >
                    Şablonu Word olarak indir (düzenleyip tekrar yükleyebilirsiniz)
                  </Button>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Card padding="sm">
                <Text fw={600} px="xs" mb="xs">
                  Önizleme (örnek verilerle)
                </Text>
                {!draft ? (
                  <EmptyState title="Henüz belge yok" description="Soldan Word dosyası yükleyin veya sistemde oluşturun." />
                ) : preview ? (
                  <DocxPreview blob={preview} />
                ) : (
                  <SectionLoader />
                )}
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* ---------- ALANLAR ---------- */}
        <Tabs.Panel value="alanlar">
          {!draft ? (
            <EmptyState title="Önce belge yükleyin" />
          ) : fields.length === 0 ? (
            <EmptyState title="Belgede alan etiketi bulunamadı" description="Word dosyasına {alan_adi} biçiminde etiket ekleyip tekrar yükleyin." />
          ) : (
            <Stack>
              <Text size="sm" c="dimmed">
                Her satır belgedeki bir <Code>{'{etiket}'}</Code> için dilekçe formunda sorulacak soruyu tanımlar. Sıra, belgedeki sıradır.
              </Text>
              <Table.ScrollContainer minWidth={980}>
                <Table verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Etiket</Table.Th>
                      <Table.Th>Soru metni</Table.Th>
                      <Table.Th>Tür</Table.Th>
                      <Table.Th>Zorunlu</Table.Th>
                      <Table.Th>Profilden doldur</Table.Th>
                      <Table.Th>Seçenekler / yardım</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {fields.map((f) => (
                      <Table.Tr key={f.key}>
                        <Table.Td>
                          <Code>{`{${f.key}}`}</Code>
                        </Table.Td>
                        <Table.Td>
                          <TextInput size="xs" value={f.label} onChange={(e) => setField(f.key, { label: e.currentTarget.value })} />
                        </Table.Td>
                        <Table.Td w={150}>
                          <Select size="xs" data={FIELD_TYPES} value={f.type} onChange={(v) => setField(f.key, { type: (v ?? 'text') as FieldType })} />
                        </Table.Td>
                        <Table.Td>
                          <Switch checked={f.required} onChange={(e) => setField(f.key, { required: e.currentTarget.checked })} />
                        </Table.Td>
                        <Table.Td w={150}>
                          <Select
                            size="xs"
                            data={PREFILL}
                            value={f.prefill ?? null}
                            onChange={(v) => setField(f.key, { prefill: (v as TemplateField['prefill']) ?? null })}
                            clearable
                            allowDeselect
                            placeholder="—"
                          />
                        </Table.Td>
                        <Table.Td miw={240}>
                          {f.type === 'select' ? (
                            <TagsInput size="xs" placeholder="Seçenek yazıp Enter" value={f.options ?? []} onChange={(v) => setField(f.key, { options: v })} />
                          ) : (
                            <TextInput size="xs" placeholder="Yardım metni (isteğe bağlı)" value={f.help ?? ''} onChange={(e) => setField(f.key, { help: e.currentTarget.value })} />
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              <Group justify="flex-end">
                <Button onClick={saveFields} loading={busy === 'fields'} disabled={!dirty.fields}>
                  Alanları kaydet
                </Button>
              </Group>
            </Stack>
          )}
        </Tabs.Panel>

        {/* ---------- ONAY ZİNCİRİ ---------- */}
        <Tabs.Panel value="onay">
          <Stack>
            <Text size="sm" c="dimmed">
              Dilekçe bu adımlardan sırayla geçer. Her adımda seçilen rollerden <b>birini</b> taşıyan kişi karar verir. Dilekçe
              sahibi kendi dilekçesini onaylayamaz.
            </Text>
            {steps.map((s, i) => (
              <Card key={i} padding="md">
                <Group align="flex-start" wrap="nowrap">
                  <Badge size="lg" circle mt={26}>
                    {i + 1}
                  </Badge>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group grow wrap="wrap" align="flex-start">
                      <TextInput label="Adım adı" placeholder="örn. Komite Başkanı onayı" value={s.name} onChange={(e) => setStep(i, { name: e.currentTarget.value })} />
                      <Select
                        label="Hangi birimdeki yetkili?"
                        data={[
                          ...(t.scope === 'unit' ? [{ value: 'petition', label: 'Dilekçenin ait olduğu komite/birim' }] : []),
                          { value: 'branch', label: 'Kol geneli (YK, GS, Başkan…)' },
                          { value: 'fixed', label: 'Belirli bir birim' },
                        ]}
                        value={s.unitMode}
                        onChange={(v) => setStep(i, { unitMode: (v ?? 'branch') as ApprovalStep['unitMode'], roleIds: [], unitId: null })}
                      />
                    </Group>
                    <Group grow wrap="wrap" align="flex-start">
                      <MultiSelect
                        label="Onaylayabilecek roller"
                        description="Örn. Başkan ve Başkan Yardımcısı (ikame)"
                        data={rolesFor(s.unitMode)}
                        value={s.roleIds}
                        onChange={(v) => setStep(i, { roleIds: v })}
                      />
                      {s.unitMode === 'fixed' && (
                        <Select label="Birim" data={unitOptions()} value={s.unitId} onChange={(v) => setStep(i, { unitId: v })} searchable />
                      )}
                    </Group>
                  </Stack>
                  <Stack gap={4} mt={24}>
                    <ActionIcon variant="subtle" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Yukarı">
                      <IconArrowUp size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Aşağı">
                      <IconArrowDown size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => {
                        setSteps((ss) => ss.filter((_, j) => j !== i));
                        setDirty((d) => ({ ...d, steps: true }));
                      }}
                      aria-label="Adımı sil"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Stack>
                </Group>
              </Card>
            ))}
            <Group justify="space-between">
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addStep}>
                Adım ekle
              </Button>
              <Button onClick={saveSteps} loading={busy === 'steps'} disabled={!dirty.steps}>
                Onay zincirini kaydet
              </Button>
            </Group>
            {stepErrors.length > 0 && (
              <Alert color="orange" variant="light">
                {stepErrors.map((e) => (
                  <div key={e}>{e}</div>
                ))}
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>

        {/* ---------- GENEL ---------- */}
        <Tabs.Panel value="genel">
          <MetaForm t={t} id={id} unitOptions={unitOptions()} />
        </Tabs.Panel>

        {/* ---------- SÜRÜMLER ---------- */}
        <Tabs.Panel value="surumler">
          {versions.data.length === 0 ? (
            <EmptyState title="Henüz yayımlanmış sürüm yok" description="Belge, alanlar ve onay zinciri hazır olduğunda Yayımla'ya basın." />
          ) : (
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Sürüm</Table.Th>
                    <Table.Th>Yayımlayan</Table.Th>
                    <Table.Th>Tarih</Table.Th>
                    <Table.Th>Not</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {versions.data.map((v) => (
                    <Table.Tr key={v.id}>
                      <Table.Td>
                        <Group gap={6}>
                          <Text fw={600}>s{v.version}</Text>
                          {v.version === t.currentVersion && (
                            <Badge size="xs" color="green">
                              yürürlükte
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>{v.publishedByName}</Table.Td>
                      <Table.Td>{fmtDateTime(v.publishedAt)}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {v.changeNote || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Button
                            size="xs"
                            variant="default"
                            leftSection={<IconDownload size={14} />}
                            onClick={() =>
                              void run(`dl-${v.version}`, async () => {
                                const buf = await readChunks(db, `petitionTemplates/${id}/versions/${v.version}/chunks`);
                                downloadBlob(new Blob([buf], { type: DOCX_MIME }), `${t.name} s${v.version}.docx`);
                              })
                            }
                          >
                            Word
                          </Button>
                          {v.version !== t.currentVersion && (
                            <Button size="xs" variant="light" onClick={() => void run('rollback', () => setCurrentVersion(id, v.version))}>
                              Yürürlüğe al
                            </Button>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal opened={publishOpen} onClose={() => setPublishOpen(false)} title="Yeni sürüm yayımla">
        <Stack>
          {stepErrors.length > 0 ? (
            <Alert color="red" title="Onay zinciri eksik">
              {stepErrors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </Alert>
          ) : (
            <Alert color="blue" variant="light">
              Yayımlanan sürüm <b>değiştirilemez</b>. Onay sürecindeki dilekçeler kendi sürümleriyle devam eder; yeni dilekçeler bu
              sürümü kullanır.
              {unsaved && ' Kaydedilmemiş değişiklikleriniz de yayıma dahil edilecek.'}
            </Alert>
          )}
          <Group gap={6}>
            <Badge variant="outline">{fields.length} alan</Badge>
            <Badge variant="outline">{steps.length} onay adımı</Badge>
          </Group>
          <Textarea label="Değişiklik notu" placeholder="örn. Konu satırı eklendi" value={changeNote} onChange={(e) => setChangeNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPublishOpen(false)}>
              Vazgeç
            </Button>
            <Button leftSection={<IconCheck size={16} />} onClick={publish} loading={busy === 'publish'} disabled={stepErrors.length > 0}>
              Yayımla
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function MetaForm({ t, id, unitOptions }: { t: PetitionTemplate; id: string; unitOptions: { value: string; label: string }[] }) {
  const [m, setM] = useState({
    name: t.name,
    description: t.description ?? '',
    category: t.category ?? '',
    unitIds: t.unitIds,
    series: t.series,
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await updateTemplateMeta(id, { ...m, series: m.series.toUpperCase() });
      notifySuccess('Genel bilgiler kaydedildi.');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card maw={720}>
      <Stack>
        <TextInput label="Şablon adı" value={m.name} onChange={(e) => setM({ ...m, name: e.currentTarget.value })} />
        <Textarea label="Açıklama" value={m.description} onChange={(e) => setM({ ...m, description: e.currentTarget.value })} />
        <Group grow>
          <TextInput label="Kategori" value={m.category} onChange={(e) => setM({ ...m, category: e.currentTarget.value })} />
          <TextInput
            label="Evrak serisi"
            description="Değişiklik yalnızca yeni gönderimleri etkiler"
            value={m.series}
            onChange={(e) => setM({ ...m, series: e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
          />
        </Group>
        <Text size="sm">
          Kapsam: <b>{t.scope === 'branch' ? 'Kol geneli' : 'Komite / birim içi'}</b>{' '}
          <Text span c="dimmed" size="xs">
            (onay zincirini bozmamak için değiştirilemez; farklı kapsam için yeni şablon oluşturun)
          </Text>
        </Text>
        {t.scope === 'unit' && (
          <MultiSelect
            label="Kullanabilecek birimler"
            description="Boşsa tüm birimler"
            data={unitOptions}
            value={m.unitIds}
            onChange={(v) => setM({ ...m, unitIds: v })}
            searchable
            clearable
          />
        )}
        <Group justify="flex-end">
          <Button onClick={save} loading={busy}>
            Kaydet
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
