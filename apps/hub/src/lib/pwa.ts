/** Yalnız üretimde çalışır; geliştirme/emülatör oturumlarına worker karışmaz. */
export function registerAppWorker() {
  if (window.location.hostname.includes('ieee-ikcu-kariyer')) {
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute('href', '/career.webmanifest');
  }
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch((error: unknown) => {
      console.warn('Uygulama bağlantı desteği başlatılamadı.', error);
    });
  }, { once: true });
}
