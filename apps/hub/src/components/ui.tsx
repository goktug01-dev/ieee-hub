import { Alert, Badge, Center, Group, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconCheck, IconInbox, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { STATUS_META } from '../lib/format';
import type { PetitionStatus } from '../lib/types';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="lg" gap="md" wrap="wrap">
      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <Title order={2}>{title}</Title>
        {description && (
          <Text c="dimmed" mt={4} maw={760}>
            {description}
          </Text>
        )}
      </div>
      {actions && <Group gap="sm">{actions}</Group>}
    </Group>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Center py={48}>
      <Stack align="center" gap="xs" maw={420} ta="center">
        <ThemeIcon size={56} radius="xl" variant="light" color="gray">
          <IconInbox size={28} />
        </ThemeIcon>
        <Text fw={600}>{title}</Text>
        {description && (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Center>
  );
}

export function FullPageLoader({ label }: { label?: string }) {
  return (
    <Center h="100vh">
      <Stack align="center" gap="sm">
        <Loader />
        {label && <Text c="dimmed">{label}</Text>}
      </Stack>
    </Center>
  );
}

export function SectionLoader() {
  return (
    <Center py={48}>
      <Loader size="sm" />
    </Center>
  );
}

export function StatusBadge({ status }: { status: PetitionStatus }) {
  const m = STATUS_META[status];
  return <Badge color={m.color}>{m.label}</Badge>;
}

export function ErrorAlert({ error }: { error: Error | string | null | undefined }) {
  if (!error) return null;
  const msg = typeof error === 'string' ? error : friendlyError(error);
  return (
    <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Bir sorun oluştu" style={{ whiteSpace: 'pre-line' }}>
      {msg}
    </Alert>
  );
}

/** Firestore hata kodlarını kullanıcıya anlaşılır Türkçe mesaja çevirir. */
export function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  switch (err.code) {
    case 'permission-denied':
      return 'Bu işlem için yetkiniz yok ya da işlem kurallara uymuyor. Rolünüz yakın zamanda değiştiyse sayfayı yenileyin.';
    case 'failed-precondition':
      return 'Bu sorgu için veritabanı dizini henüz hazır değil. Birkaç dakika sonra tekrar deneyin.';
    case 'unavailable':
      return 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.';
    case 'resource-exhausted':
      return 'Günlük ücretsiz kullanım kotası doldu. Yarın tekrar deneyin veya TechOps ile iletişime geçin.';
    case 'auth/popup-closed-by-user':
      return 'Giriş penceresi kapatıldı.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-posta veya şifre hatalı.';
    case 'auth/email-already-in-use':
      return 'Bu e-posta adresiyle zaten bir hesap var.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalı.';
    default:
      return err.message ?? String(e);
  }
}

export function notifySuccess(message: string, title?: string) {
  notifications.show({ color: 'green', icon: <IconCheck size={18} />, title, message });
}

export function notifyError(e: unknown, title = 'İşlem tamamlanamadı') {
  console.error(e);
  notifications.show({ color: 'red', icon: <IconX size={18} />, title, message: friendlyError(e), autoClose: 8000 });
}
