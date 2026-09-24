import {
  Alert,
  Button,
  Center,
  Checkbox,
  Paper,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert, friendlyError } from '../../components/ui';
import { DEFAULT_ROLES, claimFounder, markSetupDone, seedOrganization } from '../../lib/setup';

export function SetupPage() {
  const { phase, user, signOut } = useAuth();
  const step = phase === 'needsFounder' ? 0 : 1;
  const [name, setName] = useState(user?.displayName ?? '');
  const [orgName, setOrgName] = useState('IEEE İzmir Kâtip Çelebi Üniversitesi Öğrenci Kolu');
  const [orgShort, setOrgShort] = useState('IEEE İKÇÜ');
  const [founderRole, setFounderRole] = useState<string | null>('baskan');
  const [sampleUnits, setSampleUnits] = useState(true);
  const [sampleTemplates, setSampleTemplates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      await claimFounder(name.trim() || user?.email || 'Kurucu');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    setBusy(true);
    setError(null);
    try {
      await seedOrganization(
        {
          orgName,
          orgShortName: orgShort,
          founderRoleId: founderRole,
          includeSampleUnits: sampleUnits,
          includeSampleTemplates: sampleTemplates,
        },
        setProgress,
      );
      await markSetupDone();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const branchRoles = Object.entries(DEFAULT_ROLES)
    .filter(([, r]) => r.scope === 'branch')
    .map(([id, r]) => ({ value: id, label: r.name }));

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p={{ base: 'lg', sm: 'xl' }} w="100%" maw={620}>
        <Stack gap="lg">
          <div>
            <Title order={2}>Hub kurulumu</Title>
            <Text c="dimmed">İlk kurulum yalnızca bir kez yapılır. Buradaki her şey daha sonra Yönetim menüsünden değiştirilebilir.</Text>
          </div>

          <Stepper active={step} size="sm">
            <Stepper.Step label="Kurucu yönetici" description="Sistemi kuran kişi" />
            <Stepper.Step label="Organizasyon" description="Roller, birimler, şablonlar" />
          </Stepper>

          <ErrorAlert error={error} />

          {step === 0 ? (
            <Stack>
              <Alert icon={<IconInfoCircle size={18} />} color="blue">
                Sistemde henüz yönetici yok. Devam ederseniz <b>{user?.email}</b> hesabı <b>kurucu yönetici</b> olur ve tüm
                yönetim yetkilerine sahip olur. Kurucu yönetici yetkisi daha sonra başka bir kişiye devredilebilir.
              </Alert>
              <TextInput label="Adınız soyadınız" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
              <Button onClick={claim} loading={busy} disabled={!name.trim()}>
                Kurucu yönetici ol
              </Button>
              <Button variant="subtle" color="gray" onClick={() => void signOut()}>
                Farklı hesapla giriş yap
              </Button>
            </Stack>
          ) : (
            <Stack>
              <TextInput label="Kurum adı" value={orgName} onChange={(e) => setOrgName(e.currentTarget.value)} required />
              <TextInput label="Kısa ad" value={orgShort} onChange={(e) => setOrgShort(e.currentTarget.value)} required />
              <Select
                label="Sizin görevinizi seçin"
                description="Bu dönem için kol geneli rolünüz. Boş bırakabilirsiniz."
                data={branchRoles}
                value={founderRole}
                onChange={setFounderRole}
                clearable
                allowDeselect
              />
              <Checkbox
                checked={sampleUnits}
                onChange={(e) => setSampleUnits(e.currentTarget.checked)}
                label="Örnek komiteleri ekle (YK, CS, RAS, WIE, TechOps)"
              />
              <Checkbox
                checked={sampleTemplates}
                onChange={(e) => setSampleTemplates(e.currentTarget.checked)}
                label="Örnek dilekçe şablonlarını ekle (Genel Dilekçe, Etkinlik İzin Dilekçesi)"
              />
              {progress && (
                <Text size="sm" c="dimmed">
                  {progress}
                </Text>
              )}
              <Button onClick={seed} loading={busy} disabled={!orgName.trim() || !orgShort.trim()}>
                Kurulumu tamamla
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Center>
  );
}
