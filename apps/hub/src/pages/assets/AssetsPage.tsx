import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { IconDownload, IconEdit, IconHistory, IconPlus, IconQrcode, IconSearch } from '@tabler/icons-react';
import { orderBy, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { EmptyState, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { createAsset, downloadAssetQr, updateAsset, type AssetInput } from '../../lib/assets';
import { fmtDateTime } from '../../lib/format';
import { useCollection } from '../../lib/hooks';
import { useActiveMembers } from '../../lib/members';
import { downloadText, toCsv } from '../../lib/ops';
import type { Asset, AssetCondition, AssetMovement, AssetStatus } from '../../lib/opsTypes';
import { useOrg } from '../../lib/org';
import type { WithId } from '../../lib/types';

const STATUS: Record<AssetStatus, { label: string; color: string }> = {
  available: { label: 'Müsait', color: 'green' }, assigned: { label: 'Zimmetli', color: 'blue' }, maintenance: { label: 'Bakımda', color: 'orange' }, lost: { label: 'Kayıp', color: 'red' }, retired: { label: 'Hurda / kullanım dışı', color: 'gray' },
};
const CONDITION: Record<AssetCondition, string> = { good: 'İyi', needs_service: 'Servis gerekli', damaged: 'Hasarlı' };
const MOVEMENT: Record<string, string> = { create: 'Kayıt', update: 'Güncelleme', assign: 'Zimmet', return: 'İade', move: 'Konum değişikliği', maintenance: 'Bakım', lost: 'Kayıp', retire: 'Kullanım dışı' };

const empty = (): AssetInput => ({
  code: `DMB-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  name: '', category: '', description: '', serialNo: '', unitId: 'branch', unitName: 'Kol Geneli', location: '', status: 'available', condition: 'good', custodianUid: null, custodianName: '', purchaseDate: null, purchaseValue: null, warrantyEndDate: null, notes: '',
});

export function AssetsPage() {
  const { can } = useAuth();
  const canManage = can('inventory.manage') || can('finance.manage') || can('secretary.ledger.manage');
  const assets = useCollection<Asset>('assets', [orderBy('updatedAt', 'desc')], 'assets');
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ item: WithId<Asset> | null; value: AssetInput; note: string } | null>(null);
  const [history, setHistory] = useState<WithId<Asset> | null>(null);

  useEffect(() => {
    const id = params.get('varlik');
    if (id && assets.data.length) setHistory(assets.data.find((item) => item.id === id) ?? null);
  }, [params, assets.data]);

  const filtered = useMemo(() => assets.data.filter((asset) => {
    const needle = search.toLocaleLowerCase('tr-TR');
    return (!status || asset.status === status) && (!needle || [asset.code, asset.name, asset.category, asset.serialNo, asset.location, asset.custodianName].some((value) => value.toLocaleLowerCase('tr-TR').includes(needle)));
  }), [assets.data, search, status]);

  return <Stack>
    <PageHeader title="Demirbaş ve zimmet" description="Fiziksel varlıkların kimde, nerede ve hangi durumda olduğunu hareket geçmişiyle izleyin." actions={canManage ? <Button leftSection={<IconPlus size={16} />} onClick={() => setEdit({ item: null, value: empty(), note: 'İlk kayıt' })}>Demirbaş ekle</Button> : undefined} />
    <SimpleGrid cols={{ base: 2, sm: 5 }}>{(Object.keys(STATUS) as AssetStatus[]).map((key) => <Card key={key} withBorder padding="sm"><Text size="xs" c="dimmed">{STATUS[key].label}</Text><Text fw={700} size="xl">{assets.data.filter((item) => item.status === key).length}</Text></Card>)}</SimpleGrid>
    <Group align="flex-end"><TextInput label="Ara" placeholder="Kod, ad, seri no, konum veya zimmetli" leftSection={<IconSearch size={16} />} value={search} onChange={(event) => setSearch(event.currentTarget.value)} style={{ flex: '1 1 280px' }} /><Select label="Durum" clearable value={status} onChange={setStatus} data={Object.entries(STATUS).map(([value, meta]) => ({ value, label: meta.label }))} w={220} /><Button variant="default" leftSection={<IconDownload size={16} />} onClick={() => downloadText(toCsv([['Kod', 'Ad', 'Kategori', 'Seri no', 'Birim', 'Konum', 'Durum', 'Kondisyon', 'Zimmetli', 'Alım tarihi', 'Değer'], ...filtered.map((a) => [a.code, a.name, a.category, a.serialNo, a.unitName, a.location, STATUS[a.status].label, CONDITION[a.condition], a.custodianName, a.purchaseDate, a.purchaseValue])]), 'demirbas_envanteri.csv')}>CSV</Button></Group>
    {assets.loading ? <SectionLoader /> : filtered.length === 0 ? <EmptyState title="Demirbaş kaydı bulunamadı" description={assets.data.length ? 'Arama veya filtreyi değiştirin.' : 'İlk fiziksel varlığı ekleyerek zimmet takibini başlatın.'} /> : <Table.ScrollContainer minWidth={980}><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Kod / varlık</Table.Th><Table.Th>Kategori</Table.Th><Table.Th>Birim / konum</Table.Th><Table.Th>Durum</Table.Th><Table.Th>Zimmetli</Table.Th><Table.Th>Güncelleme</Table.Th><Table.Th /></Table.Tr></Table.Thead><Table.Tbody>{filtered.map((asset) => <Table.Tr key={asset.id}><Table.Td><Text fw={600}>{asset.code}</Text><Text size="sm">{asset.name}</Text>{asset.serialNo && <Text size="xs" c="dimmed">S/N: {asset.serialNo}</Text>}</Table.Td><Table.Td>{asset.category || '—'}<Text size="xs" c="dimmed">{CONDITION[asset.condition]}</Text></Table.Td><Table.Td>{asset.unitName}<Text size="xs" c="dimmed">{asset.location || 'Konum yok'}</Text></Table.Td><Table.Td><Badge color={STATUS[asset.status].color}>{STATUS[asset.status].label}</Badge></Table.Td><Table.Td>{asset.custodianName || '—'}</Table.Td><Table.Td><Text size="xs">{fmtDateTime(asset.updatedAt)}</Text><Text size="xs" c="dimmed">{asset.updatedByName}</Text></Table.Td><Table.Td><Group gap={2} wrap="nowrap"><Tooltip label="Hareket geçmişi"><ActionIcon variant="subtle" onClick={() => setHistory(asset)}><IconHistory size={17} /></ActionIcon></Tooltip><Tooltip label="QR etiket indir"><ActionIcon variant="subtle" onClick={() => void downloadAssetQr(asset.id, asset).catch(notifyError)}><IconQrcode size={17} /></ActionIcon></Tooltip>{canManage && <Tooltip label="Düzenle / zimmet"><ActionIcon variant="subtle" onClick={() => setEdit({ item: asset, value: { code: asset.code, name: asset.name, category: asset.category, description: asset.description, serialNo: asset.serialNo, unitId: asset.unitId, unitName: asset.unitName, location: asset.location, status: asset.status, condition: asset.condition, custodianUid: asset.custodianUid, custodianName: asset.custodianName, purchaseDate: asset.purchaseDate, purchaseValue: asset.purchaseValue, warrantyEndDate: asset.warrantyEndDate, notes: asset.notes }, note: '' })}><IconEdit size={17} /></ActionIcon></Tooltip>}</Group></Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer>}
    <AssetModal state={edit} onClose={() => setEdit(null)} onSaved={() => setEdit(null)} />
    <HistoryModal asset={history} onClose={() => setHistory(null)} />
  </Stack>;
}

function AssetModal({ state, onClose, onSaved }: { state: { item: WithId<Asset> | null; value: AssetInput; note: string } | null; onClose: () => void; onSaved: () => void }) {
  const { unitOptions, unitName } = useOrg();
  const members = useActiveMembers(!!state);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  if (!state) return null;
  const set = (patch: Partial<AssetInput>) => { state.value = { ...state.value, ...patch }; rerender(); };
  // Modal formu üst nesne mutasyonu yerine basit bir yerel yenileme sayacıyla canlı tutulur.
  function rerender() { setTick((value) => value + 1); }
  const save = async () => {
    if (!state.value.code.trim() || !state.value.name.trim()) return notifyError(new Error('Demirbaş kodu ve adı zorunludur.'));
    setBusy(true);
    try {
      if (state.item) await updateAsset(state.item.id, state.item, state.value, state.note.trim());
      else await createAsset(state.value, state.note.trim());
      notifySuccess(state.item ? 'Demirbaş ve hareket kaydı güncellendi.' : 'Demirbaş kaydedildi.');
      onSaved();
    } catch (error) { notifyError(error); } finally { setBusy(false); }
  };
  return <Modal opened onClose={onClose} title={state.item ? `${state.item.code} · düzenle / zimmet` : 'Yeni demirbaş'} size="xl"><Stack><SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Demirbaş kodu" value={state.value.code} onChange={(e) => set({ code: e.currentTarget.value })} required /><TextInput label="Varlık adı" value={state.value.name} onChange={(e) => set({ name: e.currentTarget.value })} required /><TextInput label="Kategori" placeholder="Laptop, kamera, stand…" value={state.value.category} onChange={(e) => set({ category: e.currentTarget.value })} /><TextInput label="Seri numarası" value={state.value.serialNo} onChange={(e) => set({ serialNo: e.currentTarget.value })} /><Select label="Birim" searchable data={unitOptions({ includeBranch: true })} value={state.value.unitId} onChange={(value) => value && set({ unitId: value, unitName: unitName(value) })} /><TextInput label="Fiziksel konum" placeholder="Kulüp odası, dolap 2…" value={state.value.location} onChange={(e) => set({ location: e.currentTarget.value })} /><Select label="Durum" data={Object.entries(STATUS).map(([value, meta]) => ({ value, label: meta.label }))} value={state.value.status} onChange={(value) => value && set({ status: value as AssetStatus })} /><Select label="Kondisyon" data={Object.entries(CONDITION).map(([value, label]) => ({ value, label }))} value={state.value.condition} onChange={(value) => value && set({ condition: value as AssetCondition })} /><Select label="Zimmetli kişi" searchable clearable data={members.options} value={state.value.custodianUid} onChange={(value) => set({ custodianUid: value, custodianName: value ? members.nameOf(value) : '', status: value ? 'assigned' : state.value.status === 'assigned' ? 'available' : state.value.status })} /><TextInput label="Alım tarihi" type="date" value={state.value.purchaseDate ?? ''} onChange={(e) => set({ purchaseDate: e.currentTarget.value || null })} /><NumberInput label="Alım değeri (₺)" min={0} decimalScale={2} value={state.value.purchaseValue ?? ''} onChange={(value) => set({ purchaseValue: value === '' ? null : Number(value) })} /><TextInput label="Garanti bitişi" type="date" value={state.value.warrantyEndDate ?? ''} onChange={(e) => set({ warrantyEndDate: e.currentTarget.value || null })} /></SimpleGrid><Textarea label="Açıklama" value={state.value.description} onChange={(e) => set({ description: e.currentTarget.value })} autosize minRows={2} /><Textarea label="Demirbaş notları" value={state.value.notes} onChange={(e) => set({ notes: e.currentTarget.value })} autosize minRows={2} /><Textarea label="Bu hareketin açıklaması" description="Zimmet, iade, bakım veya konum değişikliğinin nedenini yazın." value={state.note} onChange={(e) => { state.note = e.currentTarget.value; rerender(); }} autosize minRows={2} /><Group justify="flex-end"><Button variant="default" onClick={onClose}>Vazgeç</Button><Button onClick={save} loading={busy}>Kaydet</Button></Group></Stack></Modal>;
}

function HistoryModal({ asset, onClose }: { asset: WithId<Asset> | null; onClose: () => void }) {
  const movements = useCollection<AssetMovement>(asset ? 'assetMovements' : null, asset ? [where('assetId', '==', asset.id)] : [], asset?.id ?? 'none');
  const sorted = [...movements.data].sort((a, b) => b.at.toMillis() - a.at.toMillis());
  return <Modal opened={!!asset} onClose={onClose} title={asset ? `${asset.code} · hareket geçmişi` : ''} size="lg">{movements.loading ? <SectionLoader /> : sorted.length === 0 ? <EmptyState title="Hareket kaydı yok" /> : <Stack>{sorted.map((item) => <Card key={item.id} withBorder padding="sm"><Group justify="space-between"><Badge variant="light">{MOVEMENT[item.type] ?? item.type}</Badge><Text size="xs" c="dimmed">{fmtDateTime(item.at)}</Text></Group><Text size="sm" mt="xs">{item.note || 'Açıklama girilmedi.'}</Text><Text size="xs" c="dimmed" mt={4}>{item.from ? `${STATUS[item.from.status].label} · ${item.from.location || 'konum yok'} · ${item.from.custodianName || 'zimmet yok'} → ` : ''}{STATUS[item.to.status].label} · {item.to.location || 'konum yok'} · {item.to.custodianName || 'zimmet yok'} · {item.byName}</Text></Card>)}</Stack>}</Modal>;
}
