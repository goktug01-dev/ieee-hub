import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Timeline,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { IconBuildingCommunity, IconSearch, IconSend, IconDeviceFloppy, IconWorld } from '@tabler/icons-react';
import { Timestamp, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { DocxPreview } from '../../components/DocxPreview';
import { PetitionForm, missingRequired, prefillValues } from '../../components/PetitionForm';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { renderDocx } from '../../lib/docx';
import { useCollection, useDoc } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import { createDraft, loadVersionFile, stepUnitId, submitPetition, templateData } from '../../lib/petitions';
import type { Assignment, Petition, PetitionTemplate, TemplateVersion, WithId } from '../../lib/types';
import { BRANCH } from '../../lib/types';

export function NewPetitionPage() {
  const { user, member, publicSettings, orgSettings } = useAuth();
  const { unitName, unitOptions, roleName } = useOrg();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'branch' | 'unit'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [template, setTemplate] = useState<WithId<PetitionTemplate> | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [file, setFile] = useState<ArrayBuffer | null>(null);
  const [preview, setPreview] = useState<Blob | null>(null);

  const templates = useCollection<PetitionTemplate>('petitionTemplates', [where('active', '==', true)], 'active');
  const myRoles = useCollection<Assignment>('assignments', [where('uid', '==', user!.uid), where('status', '==', 'active')], user!.uid);
  const version = useDoc<TemplateVersion>(
    template ? `petitionTemplates/${template.id}/versions/${template.currentVersion}` : null,
  );

  const list = useMemo(() => {
    const q = search.toLocaleLowerCase('tr');
    return templates.data
      .filter((t) => t.currentVersion > 0)
      .filter((t) => scopeFilter === 'all' || t.scope === scopeFilter)
      .filter((t) => !categoryFilter || (t.category ?? 'Genel') === categoryFilter)
      .filter((t) => !q || `${t.name} ${t.description ?? ''} ${t.category ?? ''}`.toLocaleLowerCase('tr').includes(q))
      .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '', 'tr') || a.name.localeCompare(b.name, 'tr'));
  }, [templates.data, search, scopeFilter, categoryFilter]);

  const categories = useMemo(() => [...new Set([
    ...orgSettings.petitionCategories,
    ...templates.data.map((template) => template.category).filter((value): value is string => !!value),
  ])].map((value) => ({ value, label: value })), [orgSettings.petitionCategories, templates.data]);

  const allowedUnits = useMemo(() => {
    if (!template || template.scope === 'branch') return [];
    const all = unitOptions();
    return template.unitIds.length ? all.filter((o) => template.unitIds.includes(o.value)) : all;
  }, [template, unitOptions]);

  const choose = (t: WithId<PetitionTemplate>) => {
    setTemplate(t);
    setValues({});
    setShowErrors(false);
    setFile(null);
    setPreview(null);
    setTitle(t.name);
    if (t.scope === 'branch') setUnitId(BRANCH);
    else {
      const preset = params.get('birim');
      const presetAllowed = preset && unitOptions().some((option) => option.value === preset) && (!t.unitIds.length || t.unitIds.includes(preset));
      const mine = myRoles.data.map((a) => a.unitId).find((u) => u !== BRANCH && (!t.unitIds.length || t.unitIds.includes(u)));
      setUnitId(presetAllowed ? preset : (mine ?? null));
    }
    setStep(1);
  };

  // Alanlar yüklendiğinde profilden ön doldurma
  useEffect(() => {
    if (version.data) setValues((v) => prefillValues(version.data!.fields, member, v));
  }, [version.data, member]);

  // Şablon dosyasını bir kez indir
  useEffect(() => {
    if (!template || !version.data) return;
    loadVersionFile(template.id, template.currentVersion).then(setFile).catch(notifyError);
  }, [template, version.data]);

  const [debounced] = useDebouncedValue(values, 500);
  const fakePetition = useMemo<Petition | null>(
    () =>
      template && unitId
        ? {
            templateId: template.id,
            templateVersion: template.currentVersion,
            templateName: template.name,
            unitId,
            unitName: unitName(unitId),
            ownerUid: user!.uid,
            ownerName: member?.displayName ?? '',
            title,
            data: debounced,
            status: 'draft',
            visibleTo: [],
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          }
        : null,
    [template, unitId, debounced, title, member, user, unitName],
  );

  useEffect(() => {
    if (!file || !fakePetition) return;
    try {
      setPreview(renderDocx(file, templateData(fakePetition, { orgName: publicSettings.orgName, settings: orgSettings })));
    } catch (e) {
      console.warn(e);
    }
  }, [file, fakePetition, publicSettings.orgName, orgSettings]);

  const fields = version.data?.fields ?? [];
  const steps = version.data?.steps ?? [];
  const missing = missingRequired(fields, values);

  const save = async (andSubmit: boolean) => {
    if (!template || !unitId) return;
    if (andSubmit && missing.length) {
      setShowErrors(true);
      notifyError(new Error(`Zorunlu alanları doldurun: ${missing.map((f) => f.label).join(', ')}`), 'Eksik bilgi');
      return;
    }
    const run = async () => {
      setBusy(andSubmit ? 'submit' : 'draft');
      try {
        const id = await createDraft({ template, unitId, unitName: unitName(unitId), title: title.trim() || template.name, data: values });
        if (andSubmit) {
          const no = await submitPetition(id, values, title.trim() || template.name);
          notifySuccess(`Evrak sayısı: ${no}`, 'Dilekçe onaya gönderildi');
        } else {
          notifySuccess('Taslak kaydedildi. Daha sonra düzenleyip gönderebilirsiniz.');
        }
        navigate(`/dilekceler/${id}`);
      } catch (e) {
        notifyError(e);
      } finally {
        setBusy(null);
      }
    };
    if (!andSubmit) return run();
    modals.openConfirmModal({
      title: 'Dilekçe onaya gönderilsin mi?',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Gönderildiğinde evrak numarası atanır ve içerik onay zincirindeki yetkililere iletilir. Onay sürecinde içerik
            değiştirilemez; düzeltme gerekirse yetkili dilekçeyi size iade eder.
          </Text>
          <Text size="sm" fw={600}>
            Onay sırası:
          </Text>
          {steps.map((s, i) => (
            <Text size="sm" key={i}>
              {i + 1}. {s.name} — {s.roleIds.map(roleName).join(' / ')} ({unitName(stepUnitId(s, unitId))})
            </Text>
          ))}
        </Stack>
      ),
      labels: { confirm: 'Gönder', cancel: 'Vazgeç' },
      onConfirm: () => void run(),
    });
  };

  return (
    <Stack>
      <PageHeader title="Yeni dilekçe" description="Şablonu seçin, formu doldurun; belge sağda anında oluşur." />
      <Stepper active={step} onStepClick={(s) => s < step && setStep(s)} size="sm" allowNextStepsSelect={false}>
        <Stepper.Step label="Şablon" description={template?.name ?? 'Dilekçe türünü seçin'} />
        <Stepper.Step label="Doldur ve gönder" description="Form + canlı önizleme" />
      </Stepper>

      {step === 0 && (
        <Stack>
          <Group wrap="wrap">
            <TextInput
              placeholder="Şablon ara…"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: '1 1 260px' }}
            />
            <SegmentedControl
              value={scopeFilter}
              onChange={(v) => setScopeFilter(v as typeof scopeFilter)}
              data={[
                { value: 'all', label: 'Tümü' },
                { value: 'branch', label: 'Kol geneli' },
                { value: 'unit', label: 'Komite / birim' },
              ]}
            />
            <Select
              placeholder="Kategori"
              data={categories}
              value={categoryFilter}
              onChange={setCategoryFilter}
              clearable
              searchable
              w={240}
            />
          </Group>
          {templates.loading ? (
            <SectionLoader />
          ) : list.length === 0 ? (
            <EmptyState
              title="Kullanılabilir şablon yok"
              description="Dilekçe şablonları Yönetim > Dilekçe şablonları bölümünden eklenir."
            />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {list.map((t) => (
                <Card key={t.id} onClick={() => choose(t)} style={{ cursor: 'pointer' }} className="hover-card">
                  <Group justify="space-between" mb={6} wrap="nowrap">
                    <Badge
                      color={t.scope === 'branch' ? 'ieee' : 'teal'}
                      leftSection={t.scope === 'branch' ? <IconWorld size={12} /> : <IconBuildingCommunity size={12} />}
                    >
                      {t.scope === 'branch' ? 'Kol geneli' : 'Komite / birim'}
                    </Badge>
                    {t.category && <Badge variant="light" color="violet">{t.category}</Badge>}
                  </Group>
                  <Text fw={600}>{t.name}</Text>
                  {t.description && (
                    <Text size="sm" c="dimmed" mt={4} lineClamp={3}>
                      {t.description}
                    </Text>
                  )}
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      )}

      {step === 1 && template && (
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Stack>
              <Card>
                <Stack>
                  <Title order={4}>{template.name}</Title>
                  {template.scope === 'unit' ? (
                    <Select
                      label="Hangi komite / birim adına?"
                      data={allowedUnits}
                      value={unitId}
                      onChange={setUnitId}
                      searchable
                      required
                      placeholder="Birim seçin"
                      nothingFoundMessage="Birim bulunamadı"
                    />
                  ) : (
                    <Alert color="blue" variant="light" p="xs">
                      Bu dilekçe <b>kol geneli</b> bir dilekçedir.
                    </Alert>
                  )}
                  <TextInput
                    label="Dilekçe başlığı"
                    description="Listelerde görünür; belgeye basılmaz."
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                  />
                </Stack>
              </Card>
              <Card>
                {version.loading ? (
                  <SectionLoader />
                ) : fields.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Bu şablonda doldurulacak alan yok.
                  </Text>
                ) : (
                  <PetitionForm fields={fields} values={values} onChange={setValues} showErrors={showErrors} />
                )}
              </Card>
              {unitId && steps.length > 0 && (
                <Card>
                  <Text fw={600} mb="sm">
                    Onay zinciri
                  </Text>
                  <Timeline bulletSize={20} lineWidth={2}>
                    {steps.map((s, i) => (
                      <Timeline.Item key={i} title={s.name}>
                        <Text size="xs" c="dimmed">
                          {s.roleIds.map(roleName).join(' / ')} · {unitName(stepUnitId(s, unitId))}
                        </Text>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card>
              )}
              <Group grow>
                <Button
                  variant="default"
                  leftSection={<IconDeviceFloppy size={18} />}
                  loading={busy === 'draft'}
                  disabled={!unitId || !!busy}
                  onClick={() => void save(false)}
                >
                  Taslak kaydet
                </Button>
                <Button
                  leftSection={<IconSend size={18} />}
                  loading={busy === 'submit'}
                  disabled={!unitId || !!busy}
                  onClick={() => void save(true)}
                >
                  Onaya gönder
                </Button>
              </Group>
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Card padding="sm">
              <Text fw={600} mb="xs" px="xs">
                Belge önizlemesi
              </Text>
              {preview ? <DocxPreview blob={preview} /> : <SectionLoader />}
            </Card>
          </Grid.Col>
        </Grid>
      )}
    </Stack>
  );
}
