import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import dayjs from 'dayjs';
import type { Meeting } from './opsTypes';

const border = { style: BorderStyle.SINGLE, size: 1, color: 'B8C2CC' };
const borders = { top: border, bottom: border, left: border, right: border };
const text = (value: string, bold = false) => new TextRun({ text: value || '—', bold, font: 'Arial', size: 20 });

function row(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({ borders, width: { size: 28, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [text(label, true)] })] }),
      new TableCell({ borders, width: { size: 72, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [text(value)] })] }),
    ],
  });
}

export async function buildMeetingMinutes(meeting: Meeting): Promise<Blob> {
  const attendees = [...meeting.attendeeNames, meeting.guestAttendees].filter(Boolean).join(', ');
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: 'IEEE İKÇÜ ÖĞRENCİ KOLU', bold: true, font: 'Arial', size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'TOPLANTI TUTANAĞI', bold: true, font: 'Arial', size: 26 })],
      spacing: { after: 320 },
    }),
    ...(meeting.status === 'draft'
      ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TASLAK — KESİNLEŞMEMİŞTİR', bold: true, color: 'C92A2A', font: 'Arial', size: 22 })], spacing: { after: 240 } })]
      : []),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        row('Birim', meeting.unitName),
        row('Toplantı / sayı', `${meeting.title}${meeting.meetingNo ? ` — ${meeting.meetingNo}` : ''}`),
        row('Tarih ve saat', `${dayjs(meeting.date).format('DD.MM.YYYY')} ${meeting.startTime || ''}${meeting.endTime ? `–${meeting.endTime}` : ''}`.trim()),
        row('Yer / bağlantı', meeting.location),
        row('Toplantı başkanı', meeting.chairName),
        row('Tutanak sorumlusu', meeting.recorderName),
        row('Katılanlar', attendees),
      ],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text('Gündem ve görüşmeler', true)], spacing: { before: 360, after: 160 } }),
  ];

  if (meeting.agenda.length) {
    meeting.agenda.forEach((item, index) => {
      children.push(new Paragraph({ children: [text(`${index + 1}. ${item.title}`, true)], spacing: { before: 140 } }));
      if (item.notes) children.push(new Paragraph({ children: [text(item.notes)], spacing: { after: 100 } }));
    });
  } else {
    children.push(new Paragraph({ children: [text('Gündem maddesi girilmedi.')] }));
  }

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text('Kararlar', true)], spacing: { before: 360, after: 160 } }));
  if (meeting.decisions.length) {
    const decisionRows = [
      new TableRow({ children: ['No', 'Karar', 'Oylama', 'Sorumlu / tarih'].map((value) => new TableCell({ borders, children: [new Paragraph({ children: [text(value, true)] })] })) }),
      ...meeting.decisions.map((decision, index) => new TableRow({
        children: [
          decision.number || String(index + 1),
          decision.text,
          decision.vote,
          [decision.responsible, decision.dueDate ? dayjs(decision.dueDate).format('DD.MM.YYYY') : ''].filter(Boolean).join(' — '),
        ].map((value) => new TableCell({ borders, children: [new Paragraph({ children: [text(value)] })] })),
      })),
    ];
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: decisionRows }));
  } else {
    children.push(new Paragraph({ children: [text('Karar kaydı girilmedi.')] }));
  }

  if (meeting.generalNotes) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [text('Diğer notlar', true)], spacing: { before: 360, after: 120 } }));
    children.push(new Paragraph({ children: [text(meeting.generalNotes)] }));
  }
  if (meeting.nextMeetingDate) {
    children.push(new Paragraph({ children: [text(`Sonraki toplantı: ${dayjs(meeting.nextMeetingDate).format('DD.MM.YYYY')}`, true)], spacing: { before: 260 } }));
  }
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [text(meeting.status === 'final' ? 'Bu tutanak IEEE İKÇÜ Hub üzerinde kesinleştirilmiştir.' : 'Bu çıktı taslaktır; Hub üzerinde kesinleştirilmeden resmî kayıt sayılmaz.')],
    spacing: { before: 520 },
  }));

  const document = new Document({
    creator: 'IEEE İKÇÜ Hub',
    title: `${meeting.unitName} — ${meeting.title}`,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  return Packer.toBlob(document);
}

export function downloadMeetingMinutes(blob: Blob, meeting: Meeting) {
  const safe = `${meeting.unitName}-${meeting.meetingNo || meeting.date}-tutanak`.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_-]+/g, '-');
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safe}.docx`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
