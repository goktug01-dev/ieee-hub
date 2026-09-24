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
import { PageHeader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { rebuildAccessMany } from '../../lib/access';
import { logAudit } from '../../lib/audit';
import { slugify } from '../../lib/format';
import { useOrg } from '../../lib/org';
import { PERMISSIONS, PERMISSION_MAP, type PermissionId } from '../../lib/permissions';
import type { Role, RoleScope, WithId } from '../../lib/types';

const EMPTY: Role = { name: '', scope: 'unit', description: '', permissions: [], active: true, order: 20 };

export function RolesPage() {
  const { roles } = useOrg();
  const [editing, setEditing] = useState<{ id: string | null; data: Role } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!editing || !editing.data.name.trim()) return;
    const id = editing.id ?? slugify(editing.data.name);
    const d = {
      ...editing.data,
      permissions: editing.data.permissions.filter((p) => PERMISSION_MAP[p as PermissionId]?.scope === editing.data.scope),
    };
    setBusy(true);
    try {
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

  const RoleCard = ({ r }: { r: WithId<Role> }) => (
    <Card padding="md" style={{ opacity: r.active ? 1 : 0.55 }}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div style={{ minWidth: 0 }}>
          <Text fw={600}>{r.name}</Text>
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
    </Card>
  );

  return (
    <Stack>
      <PageHeader
        title="Roller ve yetkiler"
        description="Unvanlar ve bu unvanların sistemde neler yapabileceği. Dilekçe onay zincirleri bu rollere göre kurulur."
        actions={
          <Button leftSection={<IconPlus size={18} />} onClick={() => setEditing({ id: null, data: { ...EMPTY } })}>
            Yeni rol
          </Button>
        }
      />
      <Text fw={600}>Kol geneli roller</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {roles.filter((r) => r.scope === 'branch').map((r) => (
          <RoleCard key={r.id} r={r} />
        ))}
      </SimpleGrid>
      <Text fw={600} mt="md">
        Komite / birim rolleri
      </Text>
      <Text size="sm" c="dimmed" mt={-8}>
        Bu roller atanırken bir birim seçilir (örn. "Başkan · CS"). Aynı rol her komitede kullanılır.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {roles.filter((r) => r.scope === 'unit').map((r) => (
          <RoleCard key={r.id} r={r} />
        ))}
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
