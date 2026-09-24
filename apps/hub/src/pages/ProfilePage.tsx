import { Badge, Button, Card, Grid, Group, Stack, Table, Text, TextInput } from '@mantine/core';
import { updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PageHeader, notifyError, notifySuccess } from '../components/ui';
import { auth, db } from '../firebase';
import { fmtDate } from '../lib/format';
import { useCollection } from '../lib/hooks';
import { useOrg } from '../lib/org';
import type { Assignment } from '../lib/types';
import { PERMISSION_MAP, type PermissionId } from '../lib/permissions';

export function ProfilePage() {
  const { member, user, access } = useAuth();
  const { unitName, terms } = useOrg();
  const [form, setForm] = useState({ displayName: '', phone: '', department: '', studentNo: '' });
  const [busy, setBusy] = useState(false);
  const asg = useCollection<Assignment>('assignments', [where('uid', '==', user!.uid)], user!.uid);

  useEffect(() => {
    if (member)
      setForm({
        displayName: member.displayName ?? '',
        phone: member.phone ?? '',
        department: member.department ?? '',
        studentNo: member.studentNo ?? '',
      });
  }, [member]);

  const save = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'members', user!.uid), { ...form, updatedAt: serverTimestamp() });
      if (auth.currentUser && form.displayName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: form.displayName });
      }
      notifySuccess('Profiliniz güncellendi.');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const perms = Object.keys(access?.perms ?? {}).filter((p) => access!.perms[p].toMillis() > Date.now());
  const termName = (id: string | null) => terms.find((t) => t.id === id)?.name ?? '—';

  return (
    <Stack>
      <PageHeader title="Profilim" description="Dilekçe formlarındaki bazı alanlar bu bilgilerden otomatik doldurulur." />
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card>
            <Stack>
              <TextInput label="Ad soyad" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.currentTarget.value })} />
              <TextInput label="E-posta" value={member?.email ?? ''} disabled />
              <TextInput label="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
              <TextInput label="Bölüm" value={form.department} onChange={(e) => setForm({ ...form, department: e.currentTarget.value })} />
              <TextInput label="Öğrenci no" value={form.studentNo} onChange={(e) => setForm({ ...form, studentNo: e.currentTarget.value })} />
              <Group justify="flex-end">
                <Button onClick={save} loading={busy}>
                  Kaydet
                </Button>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Stack>
            <Card>
              <Text fw={600} mb="sm">
                Görevlerim
              </Text>
              <Table.ScrollContainer minWidth={480}>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rol</Table.Th>
                      <Table.Th>Birim</Table.Th>
                      <Table.Th>Dönem</Table.Th>
                      <Table.Th>Durum</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {asg.data.map((a) => (
                      <Table.Tr key={a.id}>
                        <Table.Td>{a.roleName}</Table.Td>
                        <Table.Td>{unitName(a.unitId)}</Table.Td>
                        <Table.Td>{termName(a.termId)}</Table.Td>
                        <Table.Td>
                          {a.status === 'active' ? (
                            <Badge color="green">Aktif{a.endsAt ? ` · ${fmtDate(a.endsAt)}'e kadar` : ''}</Badge>
                          ) : (
                            <Badge color="gray">Sona erdi</Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {asg.data.length === 0 && (
                <Text size="sm" c="dimmed">
                  Görev atamanız yok.
                </Text>
              )}
            </Card>
            <Card>
              <Text fw={600} mb="sm">
                Yönetim yetkilerim
              </Text>
              {access?.superAdmin ? (
                <Badge color="grape">Kurucu yönetici — tüm yönetim yetkileri</Badge>
              ) : perms.length === 0 ? (
                <Text size="sm" c="dimmed">
                  Yönetim yetkiniz yok.
                </Text>
              ) : (
                <Group gap={6}>
                  {perms.map((p) => (
                    <Badge key={p} variant="outline">
                      {PERMISSION_MAP[p as PermissionId]?.label ?? p}
                    </Badge>
                  ))}
                </Group>
              )}
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
