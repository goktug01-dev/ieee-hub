import { Alert, Box, Loader, Center } from '@mantine/core';
import { renderAsync } from 'docx-preview';
import { useEffect, useRef, useState } from 'react';

/** .docx dosyasını tarayıcıda Word görünümüne yakın biçimde gösterir. */
export function DocxPreview({ blob, printable = false }: { blob: Blob | null; printable?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el || !blob) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    renderAsync(blob, el, el, {
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: true,
    })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [blob]);

  return (
    <Box pos="relative">
      {error && (
        <Alert color="yellow" mb="sm">
          Önizleme oluşturulamadı: {error}. Belgeyi indirip Word ile açabilirsiniz.
        </Alert>
      )}
      {busy && (
        <Center pos="absolute" inset={0} style={{ zIndex: 1 }}>
          <Loader size="sm" />
        </Center>
      )}
      <div ref={host} className={`docx-preview-host${printable ? ' print-area' : ''}`} />
    </Box>
  );
}
