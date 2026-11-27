// Archivo: genişlik (wdth) ve kalınlık eksenli değişken yazı tipi; uygulamanın içine gömülür.
import '@fontsource-variable/archivo/wdth.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import './lib/format';
import { cssVariablesResolver, theme } from './theme';
import { AppInstallProvider } from './components/AppInstall';
import { registerAppWorker } from './lib/pwa';

registerAppWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: 'tr', firstDayOfWeek: 1 }}>
        <ModalsProvider labels={{ confirm: 'Onayla', cancel: 'Vazgeç' }}>
          <Notifications position="top-right" />
          <AppInstallProvider>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
          </AppInstallProvider>
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
