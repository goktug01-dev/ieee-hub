/**
 * Sayfadaki görünür `.print-area` öğesini uygulama düzeninden bağımsız, gizli bir çerçevede yazdırır.
 * window.print() tüm uygulamayı basıyordu: menü, kaydırma alanları ve konumlu kapsayıcılar belgeyi
 * kaydırıyor, çok sayfalı dilekçelerde sonraki sayfalar kesiliyordu. Çerçevede yalnız bu öğe ve
 * uygulamanın stilleri bulunur; tema her zaman açıktır.
 */
const PRINT_CSS = `
  html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body > .print-area { position: static !important; max-height: none !important; overflow: visible !important; }
`;

// Word önizlemesi: her Word sayfası bir A4 sayfası; kenar boşluklarını belgenin kendisi taşır.
const DOCX_PRINT_CSS = `
  @page { size: A4; margin: 0; }
  .docx-preview-host { background: #fff !important; border-radius: 0 !important; }
  .docx-wrapper { background: #fff !important; padding: 0 !important; display: block !important; }
  .docx-wrapper > section.docx {
    box-shadow: none !important; margin: 0 auto !important; zoom: 1 !important;
    min-height: 0 !important; break-after: page; page-break-after: always;
  }
  .docx-wrapper > section.docx:last-of-type { break-after: auto; page-break-after: auto; }
`;

const GENERAL_PRINT_CSS = `@page { size: A4; margin: 14mm; }`;

function visiblePrintArea(): HTMLElement | null {
  const areas = Array.from(document.querySelectorAll<HTMLElement>('.print-area'));
  return areas.find((area) => area.getClientRects().length > 0) ?? null;
}

export function printArea(title = document.title): void {
  const area = visiblePrintArea();
  if (!area) {
    window.print();
    return;
  }
  const isDocx = !!area.querySelector('.docx-wrapper');
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    window.print();
    return;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');
  doc.open();
  doc.write(
    `<!doctype html><html lang="tr" data-mantine-color-scheme="light"><head><meta charset="utf-8"><title></title>${styles}` +
      `<style>${PRINT_CSS}${isDocx ? DOCX_PRINT_CSS : GENERAL_PRINT_CSS}</style></head><body></body></html>`,
  );
  doc.close();
  doc.title = title;
  doc.body.appendChild(doc.importNode(area, true));

  let printed = false;
  const cleanup = () => window.setTimeout(() => iframe.remove(), 1000);
  const run = () => {
    if (printed) return;
    printed = true;
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
    // Bazı tarayıcılar afterprint göndermez; çerçeve yine de temizlenir.
    window.setTimeout(() => iframe.remove(), 60_000);
  };

  // Stil dosyaları ve görseller yüklenince yazdır.
  const pending = Array.from(doc.querySelectorAll<HTMLLinkElement | HTMLImageElement>('link[rel="stylesheet"], img')).filter(
    // Çerçevedeki düğümler başka bir pencereye ait olduğundan instanceof yerine etiket adı kullanılır.
    (node) => (node.tagName === 'IMG' ? !(node as HTMLImageElement).complete : !(node as HTMLLinkElement).sheet),
  );
  if (!pending.length) {
    window.setTimeout(run, 50);
    return;
  }
  let left = pending.length;
  const done = () => {
    left -= 1;
    if (left <= 0) window.setTimeout(run, 50);
  };
  pending.forEach((node) => {
    node.addEventListener('load', done, { once: true });
    node.addEventListener('error', done, { once: true });
  });
  window.setTimeout(run, 3000);
}
