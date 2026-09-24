import { Badge, Button, Card, Group, Modal, MultiSelect, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { IconPlus, IconWorld, IconBuildingCommunity } from '@tabler/icons-react';
import { orderBy } from 'firebase/firestore';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EmptyState, PageHeader, SectionLoader, notifyError } from '../../components/ui';
import { fmtDate, slugify } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import { createTemplate, type TemplateMeta } from '../../lib/templates';
import type { PetitionTemplate } from '../../lib/types';

export function TemplatesPage() {
  const navigate = useNavigate();
  const { unitOptions } = useOrg();
  const list = useCollection<PetitionTemplate>('petitionTemplates', [orderBy('name')], 'tpl');
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<TemplateMeta>({ name: '', description: '', category: '', scope: 'unit', unitIds: [], series: '' });
  const [busy, setBusy] = useState(false);

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

  return (
    <Stack>
      <PageHeader
        title="Dilekçe şablonları"
        description="Mevcut Word dilekçelerinizi yükleyin ya da sistemde yeni şablon oluşturun. Word içindeki {alan_adi} etiketleri otomatik olarak form alanına dönüşür."
        actions={
          <Button leftSection={<IconPlus size={18} />} onClick={() => setOpen(true)}>
            Yeni şablon
          </Button>
        }
      />
      {list.loading ? (
        <SectionLoader />
      ) : list.data.length === 0 ? (
        <EmptyState title="Henüz şablon yok" action={<Button size="xs" variant="light" onClick={() => setOpen(true)}>İlk şablonu oluştur</Button>} />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {list.data.map((t) => (
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
              <Text size="xs" c="dimmed">
                Seri: {t.series} · {t.draft?.source === 'builder' ? 'Sistem şablonu' : t.draft ? 'Word şablonu' : 'Belge yok'} · {fmtDate(t.updatedAt)}
              </Text>
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
            <TextInput label="Kategori" placeholder="Etkinlik, Finans, Genel…" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.currentTarget.value })} />
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
