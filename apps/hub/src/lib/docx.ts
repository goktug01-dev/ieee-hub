/**
 * Word (.docx) şablon işlemleri — tamamen tarayıcıda çalışır (Spark planında sunucu yoktur).
 *
 * - Şablon dosyası Cloud Storage yerine Firestore'da base64 parçalar hâlinde saklanır
 *   (Spark planında Storage kullanılamaz; bkz. docs/adr/0020).
 * - Word içindeki {alan_adi} etiketleri docxtemplater ile algılanır ve doldurulur.
 * - Sistem içi şablon oluşturucu, aynı biçimde etiketli bir .docx üretir; böylece iki kaynak da
 *   aynı doldurma hattından geçer.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Packer,
  Paragraph,
  Tab,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  WidthType,
} from 'docx';
import Docxtemplater from 'docxtemplater';
import InspectModule from 'docxtemplater/js/inspect-module.js';
import { collection, doc, getDocs, orderBy, query, writeBatch, type Firestore } from 'firebase/firestore';
import PizZip from 'pizzip';
import QRCode from 'qrcode';
import { humanizeKey } from './format';
import type { BuilderSpec, TemplateField } from './types';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Firestore doküman sınırı 1 MiB; base64 parça boyutu güvenli pay bırakılarak seçildi. */
const CHUNK_CHARS = 700_000;
/** Bir şablon dosyası için üst sınır (logolu kurumsal şablonlar için yeterli). */
export const MAX_TEMPLATE_BYTES = 4 * 1024 * 1024;

// ---------- Sistem etiketleri ----------

export const RESERVED_TAGS: { tag: string; description: string }[] = [
  { tag: 'kurum_adi', description: 'Kurum adı (Ayarlar)' },
  { tag: 'evrak_no', description: 'Evrak sayısı (gönderimde atanır; taslakta "TASLAK")' },
  { tag: 'tarih', description: 'Gönderim tarihi (GG.AA.YYYY)' },
  { tag: 'birim', description: 'Dilekçenin ait olduğu birim ("Kol Geneli" veya komite adı)' },
  { tag: 'dilekce_sahibi', description: 'Dilekçeyi oluşturan kişinin adı' },
  { tag: 'sablon_adi', description: 'Şablonun adı' },
  { tag: 'revizyon', description: 'Dilekçe revizyon numarası' },
  { tag: 'dogrulama_kodu', description: '12 karakterlik doğrulama kodu' },
  { tag: 'dogrulama_url', description: 'Doğrulama sayfası bağlantısı' },
  { tag: 'onay_durumu', description: 'Genel durum ("Onaylandı", "Onay sürecinde" …)' },
  { tag: 'onay_N_ad', description: 'N. onay adımındaki kişinin adı (örn. {onay_1_ad})' },
  { tag: 'onay_N_unvan', description: 'N. adımdaki unvan (örn. {onay_1_unvan})' },
  { tag: 'onay_N_tarih', description: 'N. adımın onay tarihi' },
  { tag: 'onay_N_karar', description: 'N. adımın kararı' },
  {
    tag: '#onaylar … /onaylar',
    description: 'Tüm onaylar için tekrar eden blok: {adim} {ad_soyad} {unvan} {birim_adi} {karar} {onay_tarihi}',
  },
];

const RESERVED_SET = new Set([
  'kurum_adi',
  'evrak_no',
  'tarih',
  'birim',
  'dilekce_sahibi',
  'sablon_adi',
  'revizyon',
  'dogrulama_kodu',
  'dogrulama_url',
  'onay_durumu',
  'onaylar',
]);

export function isReservedTag(tag: string): boolean {
  return RESERVED_SET.has(tag) || /^onay_\d+_(ad|unvan|tarih|karar)$/.test(tag);
}

// ---------- Base64 <-> ArrayBuffer ----------

export function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ---------- Firestore'da parçalı saklama ----------

/** Dosyayı `${basePath}/{i}` dokümanlarına yazar ve parça sayısını döndürür. */
export async function writeChunks(
  firestore: Firestore,
  basePath: string,
  buf: ArrayBuffer,
  previousCount = 0,
): Promise<number> {
  const b64 = bufferToBase64(buf);
  const count = Math.max(1, Math.ceil(b64.length / CHUNK_CHARS));
  const batch = writeBatch(firestore);
  for (let i = 0; i < count; i++) {
    batch.set(doc(firestore, `${basePath}/${String(i).padStart(3, '0')}`), {
      index: i,
      data: b64.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS),
    });
  }
  // Önceki daha uzun dosyadan kalan fazla parçaları sil (yalnızca taslak parçaları için).
  for (let i = count; i < previousCount; i++) {
    batch.delete(doc(firestore, `${basePath}/${String(i).padStart(3, '0')}`));
  }
  await batch.commit();
  return count;
}

const chunkCache = new Map<string, ArrayBuffer>();

/** Parçaları okuyup dosyayı birleştirir. Yayımlanmış sürümler değişmediği için önbelleğe alınır. */
export async function readChunks(firestore: Firestore, basePath: string, cache = true): Promise<ArrayBuffer> {
  if (cache && chunkCache.has(basePath)) return chunkCache.get(basePath)!;
  const snap = await getDocs(query(collection(firestore, basePath), orderBy('index')));
  if (snap.empty) throw new Error('Şablon dosyası bulunamadı.');
  const b64 = snap.docs.map((d) => d.data().data as string).join('');
  const buf = base64ToBuffer(b64);
  if (cache) chunkCache.set(basePath, buf);
  return buf;
}

// ---------- Etiket algılama ----------

export interface InspectResult {
  fieldTags: string[];
  reservedTags: string[];
  unsupportedLoops: string[];
  errors: string[];
}

function explainError(e: unknown): string[] {
  const err = e as { properties?: { errors?: { properties?: { explanation?: string } }[] }; message?: string };
  const list = err.properties?.errors;
  if (list?.length) return list.map((x) => x.properties?.explanation ?? 'Bilinmeyen şablon hatası');
  return [err.message ?? String(e)];
}

function newDoc(buf: ArrayBuffer, modules: unknown[] = []) {
  const zip = new PizZip(buf);
  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: modules as never[],
    nullGetter: () => '',
  });
}

/** Word dosyasındaki {etiket}'leri bulur. */
export function inspectDocx(buf: ArrayBuffer): InspectResult {
  const inspect = new InspectModule();
  try {
    newDoc(buf, [inspect]);
  } catch (e) {
    return { fieldTags: [], reservedTags: [], unsupportedLoops: [], errors: explainError(e) };
  }
  const all = inspect.getAllTags() as Record<string, unknown>;
  const fieldTags: string[] = [];
  const reservedTags: string[] = [];
  const unsupportedLoops: string[] = [];
  for (const [tag, value] of Object.entries(all)) {
    const isLoop = value && typeof value === 'object' && Object.keys(value as object).length > 0;
    if (isReservedTag(tag)) reservedTags.push(tag);
    else if (isLoop) unsupportedLoops.push(tag);
    else fieldTags.push(tag);
  }
  return { fieldTags, reservedTags, unsupportedLoops, errors: [] };
}

/** Algılanan etiketleri mevcut alan tanımlarıyla birleştirir (etiketi kalkan alanlar düşer). */
export function mergeFields(tags: string[], existing: TemplateField[]): TemplateField[] {
  const byKey = new Map(existing.map((f) => [f.key, f]));
  return tags.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        label: humanizeKey(key),
        type: guessType(key),
        required: true,
        options: [],
        help: '',
        prefill: guessPrefill(key),
      },
  );
}

function guessType(key: string): TemplateField['type'] {
  const k = key.toLowerCase();
  if (k.includes('tarih')) return 'date';
  if (k.includes('eposta') || k.includes('e_posta') || k.includes('mail')) return 'email';
  if (k.includes('telefon') || k.includes('tel')) return 'phone';
  if (k.includes('aciklama') || k.includes('gerekce') || k.includes('icerik') || k.includes('metin')) return 'textarea';
  if (k.includes('sayi') || k.includes('tutar') || k.includes('adet') || k.includes('kisi')) return 'number';
  return 'text';
}

function guessPrefill(key: string): TemplateField['prefill'] {
  const k = key.toLowerCase();
  if (k === 'ad_soyad' || k === 'adsoyad' || k === 'isim') return 'displayName';
  if (k.includes('eposta') || k.includes('mail')) return 'email';
  if (k.includes('telefon')) return 'phone';
  if (k.includes('ogrenci_no') || k.includes('numara')) return 'studentNo';
  if (k === 'bolum' || k.includes('bolum')) return 'department';
  return null;
}

// ---------- Doldurma ----------

export function renderDocx(buf: ArrayBuffer, data: Record<string, unknown>): Blob {
  const d = newDoc(buf);
  try {
    d.render(data);
  } catch (e) {
    throw new Error(explainError(e).join('\n'));
  }
  const out = d.getZip().generate({ type: 'arraybuffer', compression: 'DEFLATE' }) as ArrayBuffer;
  return new Blob([out], { type: DOCX_MIME });
}

export interface VerificationStamp {
  url: string;
  code: string;
  documentNo: string;
  status: string;
  approved: boolean;
}

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * Doldurulmuş Word belgesinin sonuna doğrulama QR'ı ve durum damgası ekler.
 * Şablonun nasıl üretildiğinden bağımsız çalışır; ücretli docxtemplater image modülü gerektirmez.
 */
export async function appendVerificationStamp(blob: Blob, stamp: VerificationStamp): Promise<Blob> {
  const zip = new PizZip(await blob.arrayBuffer());
  const documentFile = zip.file('word/document.xml');
  const relsFile = zip.file('word/_rels/document.xml.rels');
  const contentTypesFile = zip.file('[Content_Types].xml');
  if (!documentFile || !relsFile || !contentTypesFile) throw new Error('Word belgesine doğrulama damgası eklenemedi.');

  let documentXml = documentFile.asText();
  let relsXml = relsFile.asText();
  let contentTypesXml = contentTypesFile.asText();
  let suffix = 1;
  while (relsXml.includes(`rIdHubVerification${suffix}`)) suffix++;
  const relationshipId = `rIdHubVerification${suffix}`;
  const imageName = `hub-verification-${suffix}.png`;
  const dataUrl = await QRCode.toDataURL(stamp.url, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
  zip.file(`word/media/${imageName}`, base64ToBuffer(dataUrl.slice(dataUrl.indexOf(',') + 1)));

  if (!/Extension=["']png["']/i.test(contentTypesXml)) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      '<Default Extension="png" ContentType="image/png"/></Types>',
    );
    zip.file('[Content_Types].xml', contentTypesXml);
  }
  relsXml = relsXml.replace(
    '</Relationships>',
    `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageName}"/></Relationships>`,
  );
  zip.file('word/_rels/document.xml.rels', relsXml);

  const headline = stamp.approved ? 'ELEKTRONİK OLARAK ONAYLANMIŞTIR' : `BELGE DURUMU: ${stamp.status.toLocaleUpperCase('tr')}`;
  const color = stamp.approved ? '16803A' : '9A6700';
  const stampXml = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1371600" cy="1371600"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${900000 + suffix}" name="IEEE İKÇÜ Hub doğrulama QR"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${imageName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1371600" cy="1371600"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="24"/></w:rPr><w:t>${xmlEscape(headline)}</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:color w:val="555555"/><w:sz w:val="17"/></w:rPr><w:t>${xmlEscape(`Evrak: ${stamp.documentNo} • Kod: ${stamp.code} • QR kodu okutarak belgenin güncel durumunu doğrulayın.`)}</w:t></w:r></w:p>`;

  const sectionIndex = documentXml.lastIndexOf('<w:sectPr');
  if (sectionIndex >= 0) documentXml = `${documentXml.slice(0, sectionIndex)}${stampXml}${documentXml.slice(sectionIndex)}`;
  else documentXml = documentXml.replace('</w:body>', `${stampXml}</w:body>`);
  zip.file('word/document.xml', documentXml);

  const out = zip.generate({ type: 'arraybuffer', compression: 'DEFLATE' }) as ArrayBuffer;
  return new Blob([out], { type: DOCX_MIME });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Sistem içi şablon oluşturucu → .docx ----------

export const DEFAULT_BUILDER: BuilderSpec = {
  orgLines: ['İZMİR KÂTİP ÇELEBİ ÜNİVERSİTESİ', 'IEEE ÖĞRENCİ KOLU'],
  recipient: 'IEEE İKÇÜ ÖĞRENCİ KOLU YÖNETİM KURULU BAŞKANLIĞINA',
  subject: '{konu}',
  body:
    'Öğrenci Kolumuz bünyesinde {etkinlik_tarihi} tarihinde {etkinlik_yeri} adresinde "{etkinlik_adi}" etkinliğinin düzenlenmesi planlanmaktadır.\n\n{aciklama}\n\nGereğinin yapılmasını arz ederim.',
  closing: 'Saygılarımla,',
  includeDocMeta: true,
  includeApprovals: true,
  includeVerification: true,
};

const FONT = 'Times New Roman';

function runsWithBreaks(text: string, opts: { bold?: boolean; size?: number } = {}): TextRun[] {
  return text.split('\n').map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0, font: FONT, ...opts }));
}

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '999999' };

function cell(text: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, font: FONT, size: 20 })] })],
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
  });
}

export async function buildDocxFromSpec(spec: BuilderSpec): Promise<ArrayBuffer> {
  const children: (Paragraph | Table)[] = [];

  for (const line of spec.orgLines.filter((l) => l.trim())) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: line, bold: true, font: FONT, size: 24 })],
      }),
    );
  }
  children.push(new Paragraph({ children: [] }));

  if (spec.includeDocMeta) {
    children.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
        children: [
          new TextRun({ text: 'Sayı: {evrak_no}', font: FONT, size: 24 }),
          new TextRun({ children: [new Tab(), 'Tarih: {tarih}'], font: FONT, size: 24 }),
        ],
      }),
    );
  }
  if (spec.subject.trim()) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Konu: ${spec.subject}`, font: FONT, size: 24 })] }));
  }
  children.push(new Paragraph({ children: [] }));

  if (spec.recipient.trim()) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: spec.recipient, bold: true, font: FONT, size: 24 })],
      }),
    );
  }

  for (const para of spec.body.split(/\n\s*\n/)) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 709 },
        spacing: { after: 160, line: 320 },
        children: runsWithBreaks(para.trim(), { size: 24 }),
      }),
    );
  }

  children.push(new Paragraph({ children: [] }));
  if (spec.closing.trim()) {
    children.push(
      new Paragraph({ alignment: AlignmentType.RIGHT, children: runsWithBreaks(spec.closing, { size: 24 }) }),
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: '{dilekce_sahibi}', bold: true, font: FONT, size: 24 })],
    }),
  );

  if (spec.includeApprovals) {
    children.push(new Paragraph({ children: [] }));
    children.push(
      new Paragraph({ children: [new TextRun({ text: 'ONAYLAR', bold: true, font: FONT, size: 22 })] }),
    );
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: ['Adım', 'Ad Soyad', 'Unvan', 'Karar', 'Tarih'].map((h) => cell(h, true)),
          }),
          new TableRow({
            children: [
              cell('{#onaylar}{adim}'),
              cell('{ad_soyad}'),
              cell('{unvan}'),
              cell('{karar}'),
              cell('{onay_tarihi}{/onaylar}'),
            ],
          }),
        ],
      }),
    );
  }

  const footers = spec.includeVerification
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Bu belge IEEE İKÇÜ Hub üzerinden elektronik olarak onaylanmıştır. Doğrulama: {dogrulama_url}  Kod: {dogrulama_kodu}',
                  font: FONT,
                  size: 16,
                  color: '555555',
                }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  const document = new Document({
    creator: 'IEEE İKÇÜ Hub',
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
        footers,
        children,
      },
    ],
  });
  return Packer.toArrayBuffer(document);
}
