import { ProgramRow } from '../types';
import { formatMinutes, programSections, rowHeading, rowNumbers, assigneeText } from './program';

export interface SheetDoc {
  /** e.g. "Midweek Meeting" */
  meetingName: string;
  /** e.g. "21–27 September 2026" */
  weekRange: string;
  /** the reading, e.g. "YEREMIA 36-37" (may be empty) */
  title: string;
  /** e.g. "Wednesday 23 September · 7:00 PM" */
  dateLine: string;
  rows: ProgramRow[];
  minutesFormat: string;
}

function line(row: ProgramRow, n: number | null, fmt: string): { left: string; right: string } {
  const mins = row.kind !== 'song' && row.minutes > 0 ? ` (${formatMinutes(fmt, row.minutes)})` : '';
  return {
    left: `${n ? `${n}. ` : ''}${rowHeading(row)}${mins}`,
    right: row.kind === 'part' ? assigneeText(row) : '',
  };
}

/** Plain text for WhatsApp, SMS or e-mail. */
export function sheetToText(doc: SheetDoc): string {
  const numbers = rowNumbers(doc.rows);
  const index = new Map(doc.rows.map((r, i) => [r.id, numbers[i]]));
  const out: string[] = [doc.meetingName.toUpperCase(), [doc.weekRange, doc.title].filter(Boolean).join('  |  '), doc.dateLine, ''];
  for (const s of programSections(doc.rows)) {
    out.push(s.section.toUpperCase());
    for (const r of s.rows) {
      const { left, right } = line(r, index.get(r.id) ?? null, doc.minutesFormat);
      out.push(r.kind === 'part' ? `${left}: ${right || '—'}` : left);
    }
    out.push('');
  }
  return out.join('\n').trim();
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const BANDS = ['#5B6770', '#C4912B', '#A3283A', '#0E5A66', '#3B5B8C', '#6B4E9B', '#3E7B4F'];

/** A clean one-page sheet for the Android print dialog (which also offers "Save as PDF"). */
export function sheetToHtml(doc: SheetDoc): string {
  const numbers = rowNumbers(doc.rows);
  const index = new Map(doc.rows.map((r, i) => [r.id, numbers[i]]));
  const sections = programSections(doc.rows)
    .map((s, i) => {
      const rows = s.rows
        .map(r => {
          const { left, right } = line(r, index.get(r.id) ?? null, doc.minutesFormat);
          return `<tr><td class="l">${esc(r.icon)} ${esc(left)}</td><td class="r">${esc(right)}</td></tr>`;
        })
        .join('');
      return `<div class="band" style="background:${BANDS[i % BANDS.length]}">${esc(s.section.toUpperCase())}</div><table>${rows}</table>`;
    })
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #14252D; }
    h1 { font-size: 22px; margin: 0 0 4px; } .sub { color: #55666E; font-size: 14px; margin-bottom: 14px; }
    .band { color: #fff; font-weight: 700; font-size: 13px; letter-spacing: .5px; padding: 6px 10px; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; } td { padding: 7px 10px; border-bottom: 1px solid #DCE3E5; font-size: 15px; vertical-align: top; }
    td.l { width: 62%; font-weight: 600; } td.r { color: #0E5A66; }
  </style></head><body>
    <h1>${esc(doc.meetingName)}</h1>
    <div class="sub">${esc([doc.weekRange, doc.title].filter(Boolean).join('  ·  '))}<br>${esc(doc.dateLine)}</div>
    ${sections}
  </body></html>`;
}
