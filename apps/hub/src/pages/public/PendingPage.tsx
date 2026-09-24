import { Button, Center, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconHourglass, IconLock } from '@tabler/icons-react';
import { useAuth } from '../../auth/AuthContext';

export function PendingPage() {
  const { phase, member, user, signOut } = useAuth();
  const suspended = phase === 'suspended';
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" maw={460} w="100%">
        <Stack align="center" gap="md" ta="center">
          <ThemeIcon size={64} radius="xl" variant="light" color={suspended ? 'red' : 'yellow'}>
            {suspended ? <IconLock size={32} /> : <IconHourglass size={32} />}
          </ThemeIcon>
          <Title order={3}>{suspended ? 'Üyeliğiniz askıya alındı' : 'Üyelik onayı bekleniyor'}</Title>
          <Text c="dimmed">
            {suspended
              ? 'Hub erişiminiz şu anda kapalı. Bir hata olduğunu düşünüyorsanız Genel Sekreterlik ile iletişime geçin.'
              : 'Kaydınız alındı. Üyelik sorumlusu hesabınızı onayladığında Hub’a erişebileceksiniz. Bu sayfa onaydan sonra kendiliğinden yenilenir.'}
          </Text>
          <Text size="sm">
            <b>{member?.displayName ?? user?.displayName}</b>
            <br />
            {user?.email}
          </Text>
          <Button variant="default" onClick={() => void signOut()}>
            Farklı hesapla giriş yap
          </Button>
        </Stack>
      </Paper>
    </Center>
  );
}
