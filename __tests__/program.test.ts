import { MEETING_TEMPLATES } from '../src/constants';
import { sheetToHtml, sheetToText } from '../src/utils/sheetShare';
import { belongsToSheet, sameAssignment } from '../src/utils/program';
import { makeAssignment } from './helpers';
import { AssignmentType } from '../src/types';
import {
  assigneeText, programSections, rowAssignmentId, rowHeading, rowNeedsAssignment, rowNumbers,
  rowToAssignmentInput, rowsFromTypes, scheduleRows, unqualifiedAssignments, formatMinutes, insertInSection, rowFromType, blankRow,
} from '../src/utils/program';

const TW = MEETING_TEMPLATES.tw.types;
const types: AssignmentType[] = TW.map((t, i) => ({ ...t, id: `t${i}` })).reverse(); // shuffled on purpose
const mid = (ts: AssignmentType[]) => rowsFromTypes(ts, 'midweek');

describe('weekly sheet from the template', () => {
  const rows = mid(types);

  it('lays the rows out in printed order', () => {
    expect(rows.map(r => r.label).slice(0, 4)).toEqual(['Oguamtenani', 'Dwom', 'Mpaebɔ', 'Nnianim Nsɛm']);
    expect(rows.length).toBe(TW.filter(x => x.meeting === 'midweek').length);
    expect(rows[rows.length - 1].section).toBe('Closing');
  });

  it('numbers only the real parts, like the printed sheet (1-9)', () => {
    const nums = rowNumbers(rows).filter((n): n is number => n !== null);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bibleStudy = rows.findIndex(r => r.label === 'Asafo Bible Adesua');
    expect(rowNumbers(rows)[bibleStudy]).toBe(9);
    expect(rows[bibleStudy].people).toBe(2);
  });

  it('works out each time from the start time and the minutes', () => {
    const s = scheduleRows(rows, '19:00');
    expect(s[0]).toMatchObject({ label: 'Oguamtenani', startTime: '19:00' }); // chairman takes no minutes
    expect(s[0].endTime).toBeUndefined();
    expect(s[1]).toMatchObject({ label: 'Dwom', startTime: '19:00', endTime: '19:03' });
    expect(s[2]).toMatchObject({ startTime: '19:03', endTime: '19:04' }); // prayer
    expect(s[3]).toMatchObject({ startTime: '19:04', endTime: '19:05' }); // opening comments
    expect(s[4]).toMatchObject({ label: 'Kasa', startTime: '19:05', endTime: '19:12' });
    const total = rows.reduce((n, r) => n + r.minutes, 0);
    expect(total).toBe(3 + 1 + 1 + 7 + 7 + 4 + 3 + 4 + 6 + 3 + 15 + 10 + 23 + 2 + 3 + 1);
    expect(s[s.length - 1].endTime).toBe('20:33'); // 19:00 + 93 minutes
  });

  it('keeps times sensible past midnight', () => {
    const s = scheduleRows(rows, '23:30');
    expect(s[s.length - 1].endTime).toBe('01:03');
  });

  it('groups by section in order', () => {
    expect(programSections(rows).map(s => s.section)).toEqual(['Opening', 'Bible mu Akorade', "Ma W'ani Nku Asɛnka Ho", 'Kristofo Abrabɔ', 'Closing']);
  });

  it('both prayers need the same qualification', () => {
    const prayers = rows.filter(r => r.label === 'Mpaebɔ');
    expect(prayers).toHaveLength(2);
    expect(prayers[0].requiredRole).toBe('baptized_publisher');
    expect(prayers[1].requiredRole).toBe('baptized_publisher');
  });
});

describe('rows become assignments', () => {
  const rows = scheduleRows(mid(types), '19:00');

  it('only parts with people become assignments', () => {
    const song = { ...rows.find(r => r.kind === 'song')!, assigneeIds: ['u1'] };
    expect(rowNeedsAssignment(song)).toBe(false);
    const part = rows.find(r => r.label === 'Bible Akenkan')!;
    expect(rowNeedsAssignment(part)).toBe(false);
    expect(rowNeedsAssignment({ ...part, assigneeIds: ['u1'], assigneeNames: { u1: 'Samuel Appiah' } })).toBe(true);
  });

  it('builds the assignment the same way every time', () => {
    const part = { ...rows.find(r => r.label === 'Asafo Bible Adesua')!, title: 'Asafo Bible Adesua', assigneeIds: ['u1', 'u2'], assigneeNames: { u1: 'Ferlix Akrofi', u2: 'Isaac Arthur' } };
    const input = rowToAssignmentInput(part, { date: '2026-09-23', meeting: 'midweek', reminders: [1440, 120], index: 13 });
    expect(input).toMatchObject({ title: 'Asafo Bible Adesua', category: 'Kristofo Abrabɔ', date: '2026-09-23', requiresQualification: true, sortOrder: 130, icon: '📚' });
    expect(input.startTime).toBe(part.startTime);
    expect(assigneeText(part)).toBe('Ferlix Akrofi / Isaac Arthur');
    expect(rowAssignmentId('2026-09-21', 'midweek', part.id)).toBe(`2026-09-21_mw_${part.id}`);
    expect(input.meeting).toBe('midweek');
  });

  it('writes songs and titles like the printed sheet', () => {
    const song = { ...rows.find(r => r.kind === 'song')!, number: '74' };
    expect(rowHeading(song)).toBe('Dwom [74]');
    expect(rowHeading({ ...rows[4], title: 'Yehowa Boa Wɔn a Wɔtaa N’Ahenni Akyi' })).toBe('Yehowa Boa Wɔn a Wɔtaa N’Ahenni Akyi');
    expect(rowHeading({ ...rows[4], title: '' })).toBe('Kasa');
  });

  it('spots people who are not qualified', () => {
    const part = { ...rows.find(r => r.label === 'Bible Akenkan')!, assigneeIds: ['u1', 'u2'], assigneeNames: {} };
    const found = unqualifiedAssignments([part], { u1: ['publisher'], u2: [] });
    expect(found.map(f => f.personId)).toEqual(['u2']);
    const noRule = { ...part, requiresQualification: false };
    expect(unqualifiedAssignments([noRule], { u2: [] })).toEqual([]);
  });
});

describe('languages, minutes wording and the Add button', () => {
  const en: AssignmentType[] = MEETING_TEMPLATES.en.types.map((t, i) => ({ ...t, id: `e${i}` }));
  const rows = rowsFromTypes(en, 'midweek');

  it('the English layout follows the current meeting shape', () => {
    expect(programSections(rows).map(s => s.section)).toEqual(['Opening', 'Treasures', 'Field Ministry', 'Christian Living', 'Closing']);
    expect(rowNumbers(rows).filter(n => n !== null)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const study = rows.find(r => r.label === 'Congregation Bible Study')!;
    expect(study).toMatchObject({ minutes: 30, people: 2, multiple: true });
    expect(scheduleRows(rows, '19:00')[rows.length - 1].endTime).toBe('20:36'); // 5 + 24 + 12 + 48 + 7 = 96 minutes in total
  });

  it('every preset can be used in any language: names are just data', () => {
    for (const lang of ['en', 'tw'] as const) {
      const t = MEETING_TEMPLATES[lang];
      const prayers = t.types.filter(x => x.icon === '🙏');
      expect(prayers).toHaveLength(4); // opening + closing, midweek + weekend
      expect(prayers.every(p => p.requiredRole === 'baptized_publisher')).toBe(true);
      expect(t.categories.length).toBe(7);
      expect(t.types.every(x => t.categories.includes(x.category))).toBe(true);
      expect(t.minutesFormat.includes('{n}')).toBe(true);
    }
  });

  it('writes minutes the way the congregation wants', () => {
    expect(formatMinutes('{n} min', 7)).toBe('7 min');
    expect(formatMinutes('Simma {n}', 7)).toBe('Simma 7');
    expect(formatMinutes('nonsense', 7)).toBe('7 min');
  });

  it('adds an extra part to a section, at its end, from a type or blank', () => {
    const local = en.find(t => t.name === 'Local Needs')!;
    const extra = rowFromType(local, 'x1', 'Christian Living');
    const next = insertInSection(rows, extra);
    const idx = next.findIndex(r => r.id === 'x1');
    expect(next[idx - 1].label).toBe('Congregation Bible Study');
    expect(next[idx + 1].section).toBe('Closing');
    expect(extra).toMatchObject({ minutes: 15, requiresQualification: true, assigneeIds: [] });
    const blank = blankRow('Nowhere', 'x2');
    expect(insertInSection(rows, blank)[rows.length].id).toBe('x2');
  });
});

describe('two meetings per week', () => {
  const en: AssignmentType[] = MEETING_TEMPLATES.en.types.map((t, i) => ({ ...t, id: `e${i}` }));

  it('the weekend sheet has chairman, public talk and Watchtower study', () => {
    const rows = rowsFromTypes(en, 'weekend');
    expect(rows.map(r => r.label)).toEqual(['Chairman', 'Song', 'Prayer', 'Public Talk', 'Song', 'Watchtower Study', 'Song', 'Prayer']);
    expect(rowNumbers(rows).every(n => n === null)).toBe(true); // weekend parts are not numbered
    expect(rows.find(r => r.label === 'Watchtower Study')).toMatchObject({ people: 2, minutes: 30 });
    expect(scheduleRows(rows, '10:00')[rows.length - 1].endTime).toBe('11:11'); // 0+3+1+30+3+30+3+1 = 71
  });

  it('a person can hold parts in both meetings, with separate stable ids', () => {
    const w = '2026-09-21';
    expect(rowAssignmentId(w, 'midweek', 'abc')).not.toBe(rowAssignmentId(w, 'weekend', 'abc'));
    expect(belongsToSheet(`${w}_mw_abc`, w, 'midweek')).toBe(true);
    expect(belongsToSheet(`${w}_mw_abc`, w, 'weekend')).toBe(false);
    expect(belongsToSheet(`${w}_we_abc`, w, 'weekend')).toBe(true);
    expect(belongsToSheet(`${w}_we_abc`, w, 'midweek')).toBe(false);
    expect(belongsToSheet(`${w}_oldStyleId`, w, 'midweek')).toBe(true); // first-version ids
    expect(belongsToSheet(`${w}_oldStyleId`, w, 'weekend')).toBe(false);
    expect(belongsToSheet('2026-09-28_mw_abc', w, 'midweek')).toBe(false);
  });

  it('chairman needs the same qualification in both meetings', () => {
    const chairs = en.filter(t => t.name === 'Chairman');
    expect(chairs).toHaveLength(2);
    expect(chairs.every(c => c.requiredRole === 'ministerial_servant')).toBe(true);
  });

  it('skips writes when nothing visible changed', () => {
    const row = { ...scheduleRows(rowsFromTypes(en, 'midweek'), '19:00').find(r => r.label === 'Talk')!, assigneeIds: ['u1'], assigneeNames: { u1: 'John' } };
    const input = rowToAssignmentInput(row, { date: '2026-09-23', meeting: 'midweek', reminders: [1440, 120], index: 4 });
    const existing = makeAssignment({ ...input, id: 'x', startAt: new Date() });
    expect(sameAssignment(existing, input)).toBe(true);
    expect(sameAssignment(existing, { ...input, assigneeIds: ['u1', 'u2'], assigneeNames: { u1: 'John', u2: 'Ben' } })).toBe(false);
    expect(sameAssignment(existing, { ...input, startTime: '19:10' })).toBe(false);
    expect(sameAssignment(existing, { ...input, title: 'New title' })).toBe(false);
  });
});

describe('sharing and printing', () => {
  const en: AssignmentType[] = MEETING_TEMPLATES.en.types.map((t, i) => ({ ...t, id: `e${i}` }));
  const rows = scheduleRows(rowsFromTypes(en, 'midweek'), '19:00').map(r =>
    r.label === 'Chairman' ? { ...r, assigneeIds: ['a'], assigneeNames: { a: 'Alex Ahenkorah' } }
    : r.label === 'Return Visit' ? { ...r, assigneeIds: ['b', 'c'], assigneeNames: { b: 'Gifty Annan', c: 'Florince Addo' } }
    : r.kind === 'song' && r.section === 'Opening' ? { ...r, number: '74' } : r);
  const doc = { meetingName: 'Midweek Meeting', weekRange: '21–27 September 2026', title: 'YEREMIA 36-37', dateLine: 'Wednesday 23 September · 7:00 PM', rows, minutesFormat: '{n} min' };

  it('makes text that reads like the printed sheet', () => {
    const text = sheetToText(doc);
    expect(text).toContain('MIDWEEK MEETING');
    expect(text).toContain('YEREMIA 36-37');
    expect(text).toContain('Chairman: Alex Ahenkorah');
    expect(text).toContain('Song [74]');
    expect(text).toContain('5. Return Visit (4 min): Gifty Annan / Florince Addo');
    expect(text).toContain('Talk (10 min): —'); // not assigned yet
    expect(text.indexOf('OPENING')).toBeLessThan(text.indexOf('TREASURES'));
  });

  it('makes safe printable HTML', () => {
    const html = sheetToHtml({ ...doc, title: 'A <b>&</b> B' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Gifty Annan / Florince Addo');
    expect(html).toContain('A &lt;b&gt;&amp;&lt;/b&gt; B');
    expect(html).not.toContain('<b>&</b>');
  });
});
