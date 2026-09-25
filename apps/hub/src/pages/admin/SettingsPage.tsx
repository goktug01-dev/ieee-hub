import { Alert, Button, Card, FileButton, Group, Image, Select, SimpleGrid, Stack, TagsInput, Text, TextInput, Textarea, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconPhoto, IconShieldLock } from '@tabler/icons-react';
import { doc, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader, notifyError, notifySuccess } from '../../components/ui';
import { db } from '../../firebase';
import { rebuildAccess } from '../../lib/access';
import { logAudit } from '../../lib/audit';
import { useCollection } from '../../lib/hooks';
import { useOrg } from '../../lib/org';
import { formatDocumentNo } from '../../lib/workflow';
import type { Access, Member, OrgSettings, PublicSettings } from '../../lib/types';

const MAX_LOGO = 150 * 1024;

export function SettingsPage() {
  const { publicSettings, orgSettings, isSuperAdmin, user } = useAuth();
  const { terms, roles } = useOrg();
  const [pub, setPub] = useState<PublicSettings>(publicSettings);
  const [org, setOrg] = useState<OrgSettings>(orgSettings);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPub(publicSettings), [publicSettings]);
  useEffect(() => setOrg(orgSettings), [orgSettings]);

  const save = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'settings', 'public'), pub);
      await setDoc(doc(db, 'settings', 'org'), org);
      await logAudit('settings.update', 'settings', { orgName: pub.orgName, numberingPattern: org.numberingPattern });
      notifySuccess('Ayarlar kaydedildi.');
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  };

  const onLogo = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_LOGO) return notifyError(new Error('Logo en fazla 150 KB olabilir (PNG/SVG önerilir).'));
    const r = new FileReader();
    r.onload = () => setPub((p) => ({ ...p, logoDataUrl: String(r.result) }));
    r.readAsDataURL(file);
  };

  const sample = formatDocumentNo(org.numberingPattern, {
    prefix: org.numberingPrefix,
    year: new Date().getFullYear(),
    series: 'ETK',
    seq: 7,
  });

  return (
    <Stack>
      <PageHeader
        title="Kurum ayarları"
        description="Kurum kimliği, evrak numarası biçimi ve doğrulama bağlantısı."
        actions={
          <Button onClick={save} loading={busy}>
            Kaydet
          </Button>
        }
      />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card>
          <Stack>
            <Title order={5}>Kurum kimliği</Title>
            <TextInput label="Kurum adı" value={pub.orgName} onChange={(e) => setPub({ ...pub, orgName: e.currentTarget.value })} />
            <TextInput label="Kısa ad" value={pub.orgShortName} onChange={(e) => setPub({ ...pub, orgShortName: e.currentTarget.value })} />
            <Group>
              <Image src={pub.logoDataUrl ?? '/favicon.svg'} h={56} w={56} fit="contain" radius="md" alt="" />
              <FileButton onChange={onLogo} accept="image/png,image/svg+xml,image/jpeg,image/webp">
                {(props) => (
                  <Button {...props} variant="default" leftSection={<IconPhoto size={16} />}>
                    Logo yükle
                  </Button>
                )}
              </FileButton>
              {pub.logoDataUrl && (
                <Button variant="subtle" color="red" onClick={() => setPub({ ...pub, logoDataUrl: null })}>
                  Kaldır
                </Button>
              )}
            </Group>
            <Textarea
              label="Giriş ekranı notu"
              value={pub.loginNote ?? ''}
              onChange={(e) => setPub({ ...pub, loginNote: e.currentTarget.value })}
              placeholder="örn. Üniversite e-posta adresinizle giriş yapın."
            />
          </Stack>
        </Card>

        <Card>
          <Stack>
            <Title order={5}>Evrak numarası</Title>
            <Group grow>
              <TextInput label="Ön ek" value={org.numberingPrefix} onChange={(e) => setOrg({ ...org, numberingPrefix: e.currentTarget.value })} />
              <TextInput
                label="Biçim"
                description="{prefix} {year} {series} {seq:4}"
                value={org.numberingPattern}
                onChange={(e) => setOrg({ ...org, numberingPattern: e.currentTarget.value })}
              />
            </Group>
            <Text size="sm">
              Örnek: <b>{sample}</b>
            </Text>
            <Text size="xs" c="dimmed">
              Sıra numarası her yıl ve her seri için 1'den başlar ve boşluksuz ilerler. Biçim değişikliği yalnızca yeni gönderilen
              dilekçeleri etkiler.
            </Text>
            <Title order={5} mt="md">
              Diğer
            </Title>
            <Select
              label="Varsayılan dönem"
              data={terms.map((t) => ({ value: t.id, label: t.name }))}
              value={org.activeTermId}
              onChange={(v) => setOrg({ ...org, activeTermId: v })}
            />
            <TextInput
              label="Doğrulama adresi"
              description="Boşsa Hub'ın kendi adresi kullanılır"
              placeholder="https://hub.ieeeikcu.org"
              value={org.verifyBaseUrl}
              onChange={(e) => setOrg({ ...org, verifyBaseUrl: e.currentTarget.value })}
            />
            <TagsInput
              label="İzin verilen e-posta alan adları"
              description="Üye onay ekranında bu alan adları dışındaki başvurular işaretlenir"
              placeholder="ogr.ikc.edu.tr"
              value={org.allowedEmailDomains}
              onChange={(v) => setOrg({ ...org, allowedEmailDomains: v })}
            />
            <Title order={5} mt="md">
              IEEE vTools Events
            </Title>
            <Text size="xs" c="dimmed">
              Bu bilgiler vTools hazırlık paketindeki tüm etkinliklere uygulanır. SPOID, IEEE organizasyon biriminin resmî kimliğidir.
            </Text>
            <TextInput
              label="Organizasyon birimi"
              placeholder="Örn. Izmir Katip Celebi University Student Branch"
              value={org.vtoolsOrganizationName}
              onChange={(e) => setOrg({ ...org, vtoolsOrganizationName: e.currentTarget.value })}
            />
            <Group grow>
              <TextInput label="SPOID" placeholder="STB..." value={org.vtoolsSpoid} onChange={(e) => setOrg({ ...org, vtoolsSpoid: e.currentTarget.value })} />
              <TextInput
                label="vTools iletişim e-postası"
                type="email"
                value={org.vtoolsContactEmail}
                onChange={(e) => setOrg({ ...org, vtoolsContactEmail: e.currentTarget.value })}
              />
            </Group>
            <TextInput
              label="Saat dilimi"
              description="IANA adı; Türkiye için Europe/Istanbul"
              value={org.vtoolsTimeZone}
              onChange={(e) => setOrg({ ...org, vtoolsTimeZone: e.currentTarget.value })}
            />
            <Title order={5} mt="md">
              Gönüllülük
            </Title>
            <Select
              label="Kabul edilen gönüllüye atanacak rol"
              description="Birim yöneticileri yalnızca bu rolü verebilir"
              data={roles.filter((r) => r.scope === 'unit').map((r) => ({ value: r.id, label: r.name }))}
              value={org.volunteerRoleId}
              onChange={(v) => setOrg({ ...org, volunteerRoleId: v ?? org.volunteerRoleId })}
            />
            <TagsInput
              label="Oryantasyon görevleri"
              description="Kabul edilen her gönüllüye otomatik açılır (yazıp Enter)"
              value={org.orientationItems}
              onChange={(v) => setOrg({ ...org, orientationItems: v })}
            />
          </Stack>
        </Card>
      </SimpleGrid>
      {isSuperAdmin && <SuperAdmins myUid={user!.uid} />}
    </Stack>
  );
}

function SuperAdmins({ myUid }: { myUid: string }) {
  const members = useCollection<Member>('members', [where('status', '==', 'active')], 'active-members');
  const admins = useCollection<Access>('access', [where('superAdmin', '==', true)], 'supers');
  const [pick, setPick] = useState<string | null>(null);
  const name = (uid: string) => members.data.find((m) => m.uid === uid)?.displayName ?? uid;

  const set = async (uid: string, value: boolean) => {
    try {
      await setDoc(doc(db, 'access', uid), { superAdmin: value }, { merge: true });
      // Erişim özetinin diğer alanları (izinler, roller, görünürlük) atamalardan yeniden hesaplanır.
      await rebuildAccess(uid);
      await logAudit(value ? 'superadmin.grant' : 'superadmin.revoke', `access/${uid}`, { name: name(uid) });
      notifySuccess(value ? `${name(uid)} kurucu yönetici yapıldı.` : `${name(uid)} kurucu yönetici yetkisi kaldırıldı.`);
      setPick(null);
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <Card>
      <Stack>
        <Group gap="xs">
          <IconShieldLock size={18} />
          <Title order={5}>Kurucu yöneticiler</Title>
        </Group>
        <Text size="sm" c="dimmed">
          Kurucu yöneticiler, rolünden bağımsız olarak tüm yönetim yetkilerine sahiptir. Yönetim devrinde bu yetkiyi yeni ekibe
          devredin ve kendinizden kaldırın. En az bir kurucu yönetici kalmalıdır.
        </Text>
        <Group gap="xs">
          {admins.data.map((a) => (
            <Button
              key={a.id}
              size="xs"
              variant="light"
              color="grape"
              rightSection={admins.data.length > 1 ? '✕' : undefined}
              onClick={() =>
                admins.data.length > 1 &&
                modals.openConfirmModal({
                  title: 'Kurucu yönetici yetkisi kaldırılsın mı?',
                  children: <Text size="sm">{name(a.id)}{a.id === myUid ? ' (siz)' : ''}</Text>,
                  labels: { confirm: 'Kaldır', cancel: 'Vazgeç' },
                  confirmProps: { color: 'red' },
                  onConfirm: () => void set(a.id, false),
                })
              }
            >
              {name(a.id)}
            </Button>
          ))}
        </Group>
        <Alert color="yellow" variant="light">
          Kurucu yönetici eklemek geri alınabilir ama güçlü bir işlemdir; denetim kaydına yazılır.
        </Alert>
        <Group align="flex-end">
          <Select
            label="Kurucu yönetici ekle"
            data={members.data.filter((m) => !admins.data.some((a) => a.id === m.uid)).map((m) => ({ value: m.uid, label: `${m.displayName} (${m.email})` }))}
            value={pick}
            onChange={setPick}
            searchable
            w={360}
          />
          <Button disabled={!pick} onClick={() => pick && void set(pick, true)}>
            Ekle
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
