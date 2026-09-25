import { Badge, Button, Card, FileButton, Group, Modal, MultiSelect, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconPlus, IconWorld, IconBuildingCommunity, IconUpload } from '@tabler/icons-react';
import { orderBy } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { fmtDate, slugify } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import { classifyPetitionFile } from '../../lib/petitionCategories';
import { createTemplate, saveDraftFile, type TemplateMeta } from '../../lib/templates';
import type { PetitionTemplate } from '../../lib/types';

export function TemplatesPage() {
  const navigate = useNavigate();
  const { orgSettings } = useAuth();
  const { unitOptions } = useOrg();
  const list = useCollection<PetitionTemplate>('petitionTemplates', [orderBy('name')], 'tpl');
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<TemplateMeta>({ name: '', description: '', category: '', scope: 'unit', unitIds: [], series: '' });
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLocaleLowerCase('tr');
    return list.data.filter((template) => (!category || template.category === category)
      && (!q || `${template.name} ${template.description ?? ''} ${template.category ?? ''}`.toLocaleLowerCase('tr').includes(q)));
  }, [list.data, query, category]);
  const categoryOptions = useMemo(() => [...new Set([
    ...orgSettings.petitionCategories,
    ...list.data.map((template) => template.category).filter((value): value is string => !!value),
  ])], [orgSettings.petitionCategories, list.data]);

  const create = async () => {
    const id = slugify(meta.name);
    if (!id || !meta.series.trim()) return;
    setBusy(true);
    try {
      await createTemplate(id, { ...meta, series: meta.series.toUpperCase() });
      navigate(`/yonetim/sablonlar/${id}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    setImportBusy(true);
    let created = 0;
    const skipped: string[] = [];
    const failed: string[] = [];
    const used = new Set(list.data.map((template) => template.id));
    const docxFiles = files.filter((file) => file.name.toLocaleLowerCase('tr').endsWith('.docx'));
    const numberedFiles = docxFiles.filter((file) => /^\d+[_\-\s]/.test(file.name));
    const candidates = numberedFiles.length ? numberedFiles : docxFiles;
    skipped.push(...docxFiles.filter((file) => !candidates.includes(file)).map((file) => file.name));
    for (const file of candidates) {
      const suggestion = classifyPetitionFile(file.name);
      const id = slugify(suggestion.name);
      if (!id || used.has(id)) {
        skipped.push(file.name);
        continue;
      }
      try {
        await createTemplate(id, {
          name: suggestion.name,
          description: `${suggestion.category} kategorisinden içe aktarılan kurumsal Word belgesi.`,
          category: suggestion.category,
          scope: 'branch',
          unitIds: [],
          series: suggestion.series,
        });
        await saveDraftFile(id, null, { name: file.name, buf: await file.arrayBuffer(), source: 'upload' });
        used.add(id);
        created++;
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    setImportBusy(false);
    if (created) notifySuccess(`${created} Word belgesi kategori ve evrak serisiyle taslak olarak içe aktarıldı.`);
    if (skipped.length) notifySuccess(`${skipped.length} numarasız/eski kopya veya zaten mevcut dosya atlandı.`);
    if (failed.length) notifyError(new Error(failed.join('\n')), 'Bazı belgeler içe aktarılamadı');
  };

  return (
    <Stack>
      <PageHeader
        title="Dilekçe şablonları"
        description="Mevcut Word dilekçelerinizi yükleyin ya da sistemde yeni şablon oluşturun. Word içindeki {alan_adi} etiketleri otomatik olarak form alanına dönüşür."
        actions={<>
          <FileButton onChange={(files) => void importFiles(files)} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple>
            {(props) => <Button {...props} variant="light" leftSection={<IconUpload size={18} />} loading={importBusy}>Word klasöründen aktar</Button>}
          </FileButton>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setOpen(true)}>Yeni şablon</Button>
        </>}
      />
      <Group wrap="wrap">
        <TextInput placeholder="Şablon ara…" value={query} onChange={(event) => setQuery(event.currentTarget.value)} style={{ flex: '1 1 260px' }} />
        <Select placeholder="Kategori" data={categoryOptions} value={category} onChange={setCategory} clearable searchable w={240} />
      </Group>
      {list.loading ? (
        <SectionLoader />
      ) : list.data.length === 0 ? (
        <EmptyState title="Henüz şablon yok" action={<Button size="xs" variant="light" onClick={() => setOpen(true)}>İlk şablonu oluştur</Button>} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Filtreye uyan şablon yok" description="Arama metnini veya kategori filtresini değiştirin." />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {filtered.map((t) => (
            <Card key={t.id} component={Link} to={`/yonetim/sablonlar/${t.id}`} style={{ textDecoration: 'none' }}>
              <Group justify="space-between" mb={6}>
                <Badge
                  color={t.scope === 'branch' ? 'ieee' : 'teal'}
                  leftSection={t.scope === 'branch' ? <IconWorld size={12} /> : <IconBuildingCommunity size={12} />}
                >
                  {t.scope === 'branch' ? 'Kol geneli' : 'Komite / birim'}
                </Badge>
                {t.currentVersion === 0 ? (
                  <Badge color="gray">Yayımlanmadı</Badge>
                ) : t.active ? (
                  <Badge color="green">Kullanımda · s{t.currentVersion}</Badge>
                ) : (
                  <Badge color="orange">Kapalı · s{t.currentVersion}</Badge>
                )}
              </Group>
              <Text fw={600}>{t.name}</Text>
              {t.category && <Badge mt={6} variant="light" color="violet">{t.category}</Badge>}
              <Text size="xs" c="dimmed">
                Seri: {t.series} · {t.draft?.source === 'builder' ? 'Sistem şablonu' : t.draft ? 'Word şablonu' : 'Belge yok'} · {fmtDate(t.updatedAt)}
              </Text>
              {t.draft && t.draft.fields.length === 0 && (
                <Badge mt={6} variant="light" color="red">Alan etiketi bekliyor</Badge>
              )}
              {t.description && (
                <Text size="sm" c="dimmed" mt={4} lineClamp={2}>
                  {t.description}
                </Text>
              )}
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={open} onClose={() => setOpen(false)} title="Yeni dilekçe şablonu" size="lg">
        <Stack>
          <TextInput label="Şablon adı" placeholder="örn. Salon Tahsis Dilekçesi" required value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.currentTarget.value })} />
          <div>
            <Text size="sm" fw={500} mb={4}>
              Kapsam
            </Text>
            <SegmentedControl
              fullWidth
              value={meta.scope}
              onChange={(v) => setMeta({ ...meta, scope: v as 'branch' | 'unit' })}
              data={[
                { value: 'branch', label: 'Kol geneli' },
                { value: 'unit', label: 'Komite / birim içi' },
              ]}
            />
          </div>
          {meta.scope === 'unit' && (
            <MultiSelect
              label="Hangi birimler kullanabilir?"
              description="Boş bırakırsanız tüm komite ve birimler kullanabilir."
              data={unitOptions()}
              value={meta.unitIds}
              onChange={(v) => setMeta({ ...meta, unitIds: v })}
              searchable
              clearable
            />
          )}
          <Group grow>
            <TextInput
              label="Evrak serisi"
              description="Evrak numarasında görünür (2–6 harf)"
              placeholder="SLN"
              required
              maxLength={6}
              value={meta.series}
              onChange={(e) => setMeta({ ...meta, series: e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
            />
            <Select label="Kategori" placeholder="Kategori seçin" data={categoryOptions} value={meta.category || null} onChange={(value) => setMeta({ ...meta, category: value ?? '' })} searchable clearable />
          </Group>
          <Textarea label="Açıklama" description="Dilekçe seçim ekranında görünür" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.currentTarget.value })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={create} loading={busy} disabled={!meta.name.trim() || meta.series.length < 2}>
              Oluştur ve düzenle
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
