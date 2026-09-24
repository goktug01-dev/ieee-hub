import {
  Anchor,
  Badge,
  Box,
  Card,
  Group,
  Button,
  Center,
  Divider,
  Image,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconBrandGoogle, IconFlask } from '@tabler/icons-react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert, friendlyError, notifySuccess } from '../../components/ui';
import { auth, useEmulators } from '../../firebase';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../lib/demo';

export function LoginPage() {
  const { publicSettings } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const google = () =>
    run(() => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return signInWithPopup(auth, provider);
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') return run(() => signInWithEmailAndPassword(auth, email, password));
    return run(async () => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name.trim() });
    });
  };

  const reset = () =>
    run(async () => {
      if (!email) throw new Error('Önce e-posta adresinizi yazın.');
      await sendPasswordResetEmail(auth, email);
      notifySuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
    });

  const demoLogin = (email: string) => run(() => signInWithEmailAndPassword(auth, email, DEMO_PASSWORD));

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-body)">
      <Stack w="100%" maw={useEmulators ? 880 : 420} gap="md">
      <Group align="stretch" gap="md" wrap="wrap" justify="center">
      <Paper withBorder shadow="sm" p={{ base: 'lg', sm: 'xl' }} w="100%" maw={420}>
        <Stack gap="lg">
          <Stack gap={6} align="center">
            <Image src={publicSettings.logoDataUrl ?? '/favicon.svg'} h={56} w="auto" fit="contain" alt="" />
            <Title order={3} ta="center">
              {publicSettings.orgShortName} Hub
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              {publicSettings.loginNote ?? 'Öğrenci Kolu iç operasyon portalı: dilekçeler, onaylar, görevler ve organizasyon.'}
            </Text>
          </Stack>

          <ErrorAlert error={error} />

          <Button leftSection={<IconBrandGoogle size={18} />} variant="default" size="md" onClick={google} loading={busy}>
            Google ile devam et
          </Button>

          <Divider label="veya e-posta ile" labelPosition="center" />

          <Box component="form" onSubmit={submit}>
            <Stack gap="sm">
              {mode === 'register' && (
                <TextInput label="Ad soyad" required value={name} onChange={(e) => setName(e.currentTarget.value)} autoComplete="name" />
              )}
              <TextInput
                label="E-posta"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                autoComplete="email"
              />
              <PasswordInput
                label="Şifre"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <Button type="submit" loading={busy} size="md">
                {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
              </Button>
            </Stack>
          </Box>

          <Stack gap={4} align="center">
            {mode === 'login' ? (
              <>
                <Anchor component="button" size="sm" onClick={() => setMode('register')}>
                  Hesabın yok mu? Kayıt ol
                </Anchor>
                <Anchor component="button" size="sm" c="dimmed" onClick={reset}>
                  Şifremi unuttum
                </Anchor>
              </>
            ) : (
              <Anchor component="button" size="sm" onClick={() => setMode('login')}>
                Zaten hesabın var mı? Giriş yap
              </Anchor>
            )}
            <Anchor component={Link} to="/dogrula" size="sm" c="dimmed">
              Belge doğrula
            </Anchor>
          </Stack>
        </Stack>
      </Paper>
      {useEmulators && (
        <Paper withBorder shadow="sm" p={{ base: 'lg', sm: 'xl' }} w="100%" maw={420}>
          <Stack gap="sm">
            <Group gap="xs">
              <IconFlask size={20} />
              <Title order={4}>Demo hesapları</Title>
              <Badge color="orange">yalnızca yerel</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Tek tıkla giriş yapın. Şifre hepsi için <b>{DEMO_PASSWORD}</b>. Farklı rolleri denemek için çıkış yapıp başka hesapla girin.
            </Text>
            {DEMO_ACCOUNTS.map((a) => (
              <Card key={a.key} padding="xs" radius="md" onClick={() => void demoLogin(a.email)} style={{ cursor: 'pointer' }}>
                <Text size="sm" fw={600}>
                  {a.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {a.description}
                </Text>
              </Card>
            ))}
          </Stack>
        </Paper>
      )}
      </Group>
      </Stack>
    </Center>
  );
}
