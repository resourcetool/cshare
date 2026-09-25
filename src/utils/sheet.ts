import { Assignment } from '../types';

/** Category order (as configured), then sortOrder, then time. Unknown categories go last. */
export function sortAssignments(list: Assignment[], categories: string[]): Assignment[] {
  const rank = (c: string): number => {
    const i = categories.indexOf(c);
    return i === -1 ? categories.length : i;
  };
  return [...list].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.sortOrder - b.sortOrder ||
      a.startAt.getTime() - b.startAt.getTime() ||
      a.title.localeCompare(b.title),
  );
}

export interface Section {
  category: string;
  items: Assignment[];
}

export function groupByCategory(list: Assignment[], categories: string[]): Section[] {
  const sections: Section[] = [];
  for (const a of sortAssignments(list, categories)) {
    const name = a.category || 'Other';
    const last = sections[sections.length - 1];
    if (last && last.category === name) last.items.push(a);
    else sections.push({ category: name, items: [a] });
  }
  return sections;
}
