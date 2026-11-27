import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconEdit, IconPlus, IconAlertTriangle } from '@tabler/icons-react';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorAlert, PageHeader, SectionLoader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { rebuildAccessMany } from '../../lib/access';
import { logAudit } from '../../lib/audit';
import { slugify } from '../../lib/format';
import { useOrg } from '../../lib/org';
import { PERMISSIONS, PERMISSION_MAP, type PermissionId } from '../../lib/permissions';
import type { Role, RoleScope, WithId } from '../../lib/types';
import { DEFAULT_ROLES } from '../../lib/setup';
import { useAuth } from '../../auth/AuthContext';
import { useCollection } from '../../lib/hooks';
import { sameNamedRoles } from '../../lib/roleCatalog';
import type { Assignment } from '../../lib/types';

const EMPTY: Role = { name: '', scope: 'unit', description: '', permissions: [], active: true, order: 20 };

export function RolesPage() {
  const { roles, loading } = useOrg();
  const { can } = useAuth();
  const assignments = useCollection<Assignment>('assignments', [], 'role-catalog-assignments');
  const [editing, setEditing] = useState<{ id: string | null; data: Role } | null>(null);
  const [busy, setBusy] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const duplicates = roles.filter((role) => sameNamedRoles(role, roles).length > 1);
  const filtered = roles.filter((role) => (showInactive || role.active)
    && (!duplicatesOnly || duplicates.some((other) => other.id === role.id))
    && `${role.name} ${role.id} ${role.description ?? ''}`.toLocaleLowerCase('tr-TR').includes(queryText.trim().toLocaleLowerCase('tr-TR')));

  const save = async () => {
    if (!editing || !editing.data.name.trim()) return;
    const id = editing.id ?? slugify(editing.data.name);
    const d = {
      ...editing.data,
      permissions: editing.data.permissions.filter((p) => PERMISSION_MAP[p as PermissionId]?.scope === editing.data.scope),
    };
    setBusy(true);
    try {
      if (!roles.some((role) => role.id === editing.id) && sameNamedRoles(d, roles).length) throw new Error('Bu kapsamda aynı adlı bir rol zaten var. Mevcut rolü düzenleyin veya farklı bir ad seçin.');
      if (!editing.id && (await getDoc(doc(db, 'roles', id))).exists()) throw new Error('Bu adla bir rol zaten var.');
      await setDoc(doc(db, 'roles', id), d);
      await logAudit(editing.id ? 'role.update' : 'role.create', `roles/${id}`, { name: d.name, permissions: d.permissions });
      // Yetki değiştiyse bu rolü taşıyanların erişim özeti yeniden hesaplanır.
      if (editing.id) {
        const holders = await getDocs(query(collection(db, 'assignments'), where('roleId', '==', id), where('status', '==', 'active')));
        if (!holders.empty) await rebuildAccessMany(holders.docs.map((h) => h.data().uid as string));
      }
      notifySuccess('Rol kaydedildi.');
      setEditing(null);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof Role>(k: K, v: Role[K]) => setEditing((e) => (e ? { ...e, data: { ...e.data, [k]: v } } : e));
  const togglePerm = (p: string, on: boolean) =>
    set('permissions', on ? [...(editing?.data.permissions ?? []), p] : (editing?.data.permissions ?? []).filter((x) => x !== p));

  const renderRoleCard = (r: WithId<Role>) => {
    const holders = assignments.data.filter((assignment) => assignment.roleId === r.id && assignment.status === 'active'
      && (!assignment.startsAt || assignment.startsAt.toMillis() <= Date.now())
      && (!assignment.endsAt || assignment.endsAt.toMillis() > Date.now()));
    const similar = sameNamedRoles(r, roles).filter((other) => other.id !== r.id);
    const open = expanded.includes(r.id);
    return (
    <Card key={r.id} padding="md" style={{ opacity: r.active ? 1 : 0.55 }}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Text fw={600}>{r.name}</Text>
          <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>Rol kimliği: {r.id}</Text>
          {r.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {r.description}
            </Text>
          )}
        </div>
        <ActionIcon variant="subtle" onClick={() => setEditing({ id: r.id, data: { ...EMPTY, ...r } })} aria-label="Düzenle">
          <IconEdit size={16} />
        </ActionIcon>
      </Group>
      <Group gap="xs" mt="sm">
        <Badge variant="light" color={r.active ? 'teal' : 'gray'}>{r.active ? 'Aktif' : 'Pasif'}</Badge>
        <Badge variant="light">{assignments.loading ? 'Atamalar yükleniyor' : `${holders.length} aktif atama`}</Badge>
        {similar.length > 0 && <Badge color="orange">Aynı adlı {similar.length + 1} kayıt</Badge>}
      </Group>
      {similar.length > 0 && <Text size="sm" c="dimmed" mt="xs">Diğer kayıtlar: {similar.map((role) => role.id).join(', ')}. Yetkileri karşılaştırarak düzenleyin.</Text>}
      {holders.length > 0 && <Text size="sm" mt="xs">{holders.map((holder) => `${holder.memberName} · ${holder.unitName}`).join(', ')}</Text>}
      <Button variant="subtle" size="xs" mt="xs" onClick={() => setExpanded((current) => open ? current.filter((id) => id !== r.id) : [...current, r.id])}>{open ? 'Yetkileri gizle' : `${r.permissions.length} yetkiyi göster`}</Button>
      <Collapse expanded={open}>
      <Group gap={4} mt="sm">
        {r.permissions.length === 0 ? (
          <Text size="xs" c="dimmed">
            Yönetim yetkisi yok (yalnızca onay zincirinde kullanılır)
          </Text>
        ) : (
          r.permissions.map((p) => (
            <Badge key={p} size="xs" variant="outline" color={PERMISSION_MAP[p as PermissionId]?.critical ? 'red' : 'ieee'}>
              {PERMISSION_MAP[p as PermissionId]?.label ?? p}
            </Badge>
          ))
        )}
      </Group>
      </Collapse>
    </Card>
  );
  };

  return (
    <Stack>
      <PageHeader
        title="Roller ve yetkiler"
        description="Rol bir yetki tanımıdır; kişi ataması ayrı yapılır. Aynı komite rolünü her komitede yeniden oluşturmak gerekmez."
        actions={
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ id: null, data: { ...EMPTY } })}>
            Yeni rol
          </Button>
        }
      />
      <Group wrap="wrap">
        <TextInput aria-label="Rol ara" placeholder="Rol adı, kimliği veya açıklama ara…" value={queryText} onChange={(event) => setQueryText(event.currentTarget.value)} style={{ flex: '1 1 240px' }} />
        <Switch label="Pasifleri göster" checked={showInactive} onChange={(event) => setShowInactive(event.currentTarget.checked)} />
        <Switch label={`Aynı adlı kayıtlar (${duplicates.length})`} checked={duplicatesOnly} onChange={(event) => setDuplicatesOnly(event.currentTarget.checked)} />
        {can('assignments.manage') && <Button component={Link} to="/yonetim/atamalar" variant="light">Kişilere rol ata</Button>}
      </Group>
      <ErrorAlert error={assignments.error} />
      {duplicates.length > 0 && <Alert color="orange">Aynı kapsamda aynı adlı roller var. Kartlarda kimlik, görevli kişiler ve yetkilerle karşılaştırabilirsiniz. Kol geneli ile komite rolleri ayrı kapsamlardır.</Alert>}
      {loading && <SectionLoader />}
      {!loading && !filtered.length && <EmptyState title="Bu filtrelerde rol bulunamadı" />}
      <Text fw={600}>Kol geneli roller ({filtered.filter((role) => role.scope === 'branch').length})</Text>
      {!queryText.trim() && !duplicatesOnly && !loading && !roles.some(r => r.id === 'actor') && !sameNamedRoles(DEFAULT_ROLES.actor, roles).length && <Button variant="light" onClick={() => setEditing({ id: 'actor', data: DEFAULT_ROLES.actor })}>ACTOR rolünü ekle</Button>}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {filtered.filter((r) => r.scope === 'branch').map(renderRoleCard)}
      </SimpleGrid>
      <Text fw={600} mt="md">
        Komite / birim rolleri ({filtered.filter((role) => role.scope === 'unit').length})
      </Text>
      <Text size="sm" c="dimmed" mt={-8}>
        Bu roller atanırken bir birim seçilir (örn. "Başkan · CS"). Aynı rol her komitede kullanılır.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {filtered.filter((r) => r.scope === 'unit').map(renderRoleCard)}
      </SimpleGrid>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Rolü düzenle' : 'Yeni rol'} size="lg">
        {editing && (
          <Stack>
            <TextInput label="Rol adı" placeholder="örn. Sponsorluk Sorumlusu" required value={editing.data.name} onChange={(e) => set('name', e.currentTarget.value)} />
            <div>
              <Text size="sm" fw={500} mb={4}>
                Kapsam
              </Text>
              <SegmentedControl
                fullWidth
                value={editing.data.scope}
                onChange={(v) => set('scope', v as RoleScope)}
                disabled={!!editing.id}
                data={[
                  { value: 'branch', label: 'Kol geneli (YK, GS, Sayman…)' },
                  { value: 'unit', label: 'Komite / birim içi' },
                ]}
              />
              {editing.id && (
                <Text size="xs" c="dimmed" mt={4}>
                  Mevcut atamaları bozmamak için kapsam sonradan değiştirilemez.
                </Text>
              )}
            </div>
            <Textarea label="Açıklama" value={editing.data.description ?? ''} onChange={(e) => set('description', e.currentTarget.value)} />
            <div>
              <Text size="sm" fw={500} mb={6}>
                Yetkiler
              </Text>
              <Stack gap="xs">
                {PERMISSIONS.filter((p) => p.scope === editing.data.scope).map((p) => (
                  <Checkbox
                    key={p.id}
                    checked={editing.data.permissions.includes(p.id)}
                    onChange={(e) => togglePerm(p.id, e.currentTarget.checked)}
                    label={
                      <Group gap={6}>
                        {p.label}
                        {p.critical && (
                          <Badge size="xs" color="red">
                            kritik
                          </Badge>
                        )}
                      </Group>
                    }
                    description={p.description}
                  />
                ))}
              </Stack>
            </div>
            {editing.data.permissions.some((p) => PERMISSION_MAP[p as PermissionId]?.critical) && (
              <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                Kritik yetkiler rol ve yetki yapısının kendisini değiştirebilir. Yalnızca YK kararıyla verin.
              </Alert>
            )}
            <Group grow>
              <NumberInput label="Sıra" value={editing.data.order} onChange={(v) => set('order', Number(v) || 0)} />
              <Switch mt="lg" label="Aktif" checked={editing.data.active} onChange={(e) => set('active', e.currentTarget.checked)} />
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setEditing(null)}>
                Vazgeç
              </Button>
              <Button onClick={save} loading={busy}>
                Kaydet
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
