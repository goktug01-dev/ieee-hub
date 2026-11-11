import { Alert, Button, Group, List, Menu, Modal, Stack, Text } from '@mantine/core';
import { IconCheck, IconDownload, IconWifiOff } from '@tabler/icons-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallContext = createContext({ open: () => {}, installed: false });

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Tek dinleyici: giriş ve menü aynı tarayıcı kurulum isteğini kullanır. */
export function AppInstallProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const displayChanged = () => setInstalled(isStandalone());
    const ready = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => { setInstalled(true); setPrompt(null); };
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', complete);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    display.addEventListener('change', displayChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', complete);
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
      display.removeEventListener('change', displayChanged);
    };
  }, []);

  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    setError(false);
    try {
      await prompt.prompt();
      // Kabul, kurulumun tamamlandığı anlamına gelmez; appinstalled olayı beklenir.
      await prompt.userChoice;
    } catch {
      setError(true);
    } finally {
      setPrompt(null); // Tarayıcı isteği yalnız bir kez kullanılabilir.
      setBusy(false);
    }
  };

  return (
    <InstallContext.Provider value={{ open: () => setOpened(true), installed }}>
      {!online && (
        <Alert color="yellow" icon={<IconWifiOff size={18} />} role="status" style={{ position: 'sticky', top: 0, zIndex: 301 }}>
          İnternet bağlantısı yok. İşlemlere devam etmek için bağlantınızı kontrol edin; ekrandaki bilgiler güncel olmayabilir.
        </Alert>
      )}
      {children}
      <Modal opened={opened} onClose={() => setOpened(false)} title="Uygulamayı yükle" centered>
        <Stack>
          {installed ? (
            <Alert color="green" icon={<IconCheck size={18} />}>Uygulama yüklü ve bu pencerede uygulama olarak açık.</Alert>
          ) : (
            <>
              <Text size="sm">Hub’ı telefonunuzun veya bilgisayarınızın ana ekranından uygulama olarak açabilirsiniz.</Text>
              {prompt && <Button leftSection={<IconDownload size={18} />} onClick={() => void install()} loading={busy}>Bu cihaza yükle</Button>}
              {error && <Alert color="yellow">Yükleme penceresi açılamadı. Aşağıdaki tarayıcı adımlarını kullanabilirsiniz.</Alert>}
              <Text fw={600} size="sm">iPhone / iPad</Text>
              <List type="ordered" size="sm" spacing="xs">
                <List.Item>Hub adresini Safari’de açın.</List.Item>
                <List.Item>Paylaş menüsünden “Ana Ekrana Ekle”yi seçin.</List.Item>
                <List.Item>Varsa “Web Uygulaması Olarak Aç” seçeneğini açık bırakıp “Ekle”ye dokunun.</List.Item>
              </List>
              <Text fw={600} size="sm">Android / bilgisayar</Text>
              <Text size="sm">Chrome veya Edge menüsündeki “Uygulamayı yükle” / “Ana ekrana ekle” seçeneğini kullanın. Yükleme seçeneği görünmüyorsa bağlantıyı doğrudan bu tarayıcılardan birinde açın. Uygulama zaten yüklüyse ana ekrandaki simgesinden açabilirsiniz.</Text>
            </>
          )}
          <Text size="sm" c="dimmed">Giriş, güncel veriler ve onay işlemleri için internet bağlantısı gerekir. Yüklemek e-posta veya telefon bildirimlerini kendiliğinden etkinleştirmez.</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setOpened(false)}>Kapat</Button></Group>
        </Stack>
      </Modal>
    </InstallContext.Provider>
  );
}

export function AppInstallButton({ menu = false }: { menu?: boolean }) {
  const { open, installed } = useContext(InstallContext);
  if (installed) return null;
  return menu
    ? <Menu.Item leftSection={<IconDownload size={16} />} onClick={open}>Uygulamayı yükle</Menu.Item>
    : <Button variant="light" leftSection={<IconDownload size={18} />} onClick={open}>Uygulamayı yükle</Button>;
}
