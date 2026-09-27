import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, PageBreak, Paragraph, TextRun } from 'docx';
import { MANUAL_AUDIENCES, manualFor, type ManualAudience } from './manual';

const FONT = 'Arial';
const run = (text: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text, font: FONT, size: options.size ?? 21, bold: options.bold, italics: options.italics, color: options.color });

/** Kılavuzun seçilen kitlelere göre Word belgesi (Yardım sayfasındaki içerikle aynı kaynak). */
export async function buildManualDocx(audiences: ManualAudience[], orgName: string): Promise<Blob> {
  const date = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' }).format(new Date());
  const children: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 240 }, children: [run(orgName, { bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run('Hub Kullanma Kılavuzu', { bold: true, size: 44 })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [run(audiences.map((audience) => MANUAL_AUDIENCES[audience].label).join(' · '), { size: 24 })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(`Oluşturulma: ${date}`, { italics: true, color: '666666' })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480 },
      children: [run('Bu belge Hub’daki Yardım › Kullanma kılavuzu içeriğinden üretilmiştir; en güncel hâli her zaman Hub’dadır.', { italics: true, color: '666666', size: 18 })],
    }),
  ];

  audiences.forEach((audience) => {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { after: 120 }, children: [run(MANUAL_AUDIENCES[audience].label, { bold: true, size: 32 })] }));
    children.push(new Paragraph({ spacing: { after: 240 }, children: [run(MANUAL_AUDIENCES[audience].description, { color: '555555' })] }));

    manualFor(audience).forEach((section, index) => {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        keepNext: true,
        spacing: { before: 320, after: 80 },
        children: [run(`${index + 1}. ${section.title}`, { bold: true, size: 26 })],
      }));
      children.push(new Paragraph({ keepNext: true, spacing: { after: 80 }, children: [run('Nerede: ', { bold: true }), run(section.where)] }));
      children.push(new Paragraph({ spacing: { after: 120 }, children: [run(section.summary)] }));
      section.steps.forEach((step) => {
        children.push(new Paragraph({ numbering: { reference: `steps-${audience}-${section.id}`, level: 0 }, spacing: { after: 60 }, children: [run(step)] }));
      });
      section.tips?.forEach((tip) => {
        children.push(new Paragraph({ spacing: { before: 60 }, indent: { left: 360 }, children: [run('İpucu: ', { bold: true, color: '00629B' }), run(tip)] }));
      });
    });
  });

  // Her bölümün adım listesi 1'den başlasın diye ayrı numaralandırma tanımı.
  const numberingConfig = audiences.flatMap((audience) =>
    manualFor(audience).map((section) => ({
      reference: `steps-${audience}-${section.id}`,
      levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }],
    })),
  );

  const document = new Document({
    creator: orgName,
    title: 'Hub Kullanma Kılavuzu',
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    numbering: { config: numberingConfig },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  return Packer.toBlob(document);
}

export function downloadManual(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'Hub-kullanma-kilavuzu.docx';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
