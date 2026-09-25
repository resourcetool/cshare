import { AppSettings, AssignmentType } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  categories: ['Opening', 'Treasures', 'Field Ministry', 'Christian Living', 'Public Talk', 'Watchtower Study', 'Closing'],
  // three days, one day, and two hours before
  reminderOffsetsMinutes: [4320, 1440, 120],
  callStyleEnabled: true,
  meetingDay: 3,
  meetingTime: '19:00',
  minutesFormat: '{n} min',
  weekendDay: 0,
  weekendTime: '10:00',
  midweekName: 'Midweek Meeting',
  weekendName: 'Weekend Meeting',
  regularPioneerHours: 50,
  auxiliaryPioneerHours: 30,
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const ICONS = ['🎤', '🎵', '🙏', '💬', '📖', '💎', '🗣️', '🏠', '👥', '📚', '🎓', '📌'];

export type TemplateLang = 'en' | 'tw';

type T = Omit<AssignmentType, 'id'>;
const t = (sortOrder: number, o: Partial<T> & Pick<T, 'name' | 'category'>): T => ({
  description: '',
  requiresQualification: false,
  allowsMultipleAssignees: false,
  active: true,
  kind: 'part',
  minutes: 5,
  people: 1,
  numbered: true,
  icon: '📌',
  meeting: 'midweek',
  sortOrder,
  ...o,
});
/** a line of the weekend meeting (sort order continues after the midweek lines) */
const w = (sortOrder: number, o: Partial<T> & Pick<T, 'name' | 'category'>): T => t(sortOrder + 200, { numbered: false, meeting: 'weekend', ...o });

export interface MeetingTemplate {
  label: string;
  categories: string[];
  minutesFormat: string;
  midweekName: string;
  weekendName: string;
  types: T[];
}

/**
 * Ready-made layouts of the two weekly meetings. They only pre-fill NAMES, minutes and icons:
 * every word can be changed afterwards (Settings > Assignment types / Sections), so a
 * congregation can use its own language. Minutes also change from week to week on the sheet.
 */
export const MEETING_TEMPLATES: Record<TemplateLang, MeetingTemplate> = {
  en: {
    label: 'English',
    categories: ['Opening', 'Treasures', 'Field Ministry', 'Christian Living', 'Public Talk', 'Watchtower Study', 'Closing'],
    minutesFormat: '{n} min',
    midweekName: 'Midweek Meeting',
    weekendName: 'Weekend Meeting',
    types: [
      t(10, { name: 'Chairman', category: 'Opening', minutes: 0, numbered: false, requiresQualification: true, requiredRole: 'ministerial_servant', icon: '🎤' }),
      t(20, { name: 'Song', category: 'Opening', kind: 'song', minutes: 3, numbered: false, icon: '🎵' }),
      t(30, { name: 'Prayer', category: 'Opening', minutes: 1, numbered: false, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),
      t(40, { name: 'Opening Comments', category: 'Opening', kind: 'note', minutes: 1, numbered: false, icon: '💬' }),

      t(50, { name: 'Talk', category: 'Treasures', minutes: 10, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '📖' }),
      t(60, { name: 'Spiritual Gems', category: 'Treasures', minutes: 10, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '💎' }),
      t(70, { name: 'Bible Reading', category: 'Treasures', minutes: 4, requiresQualification: true, requiredRole: 'publisher', icon: '📜' }),

      t(80, { name: 'Starting a Conversation', category: 'Field Ministry', minutes: 3, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'publisher', icon: '🗣️' }),
      t(90, { name: 'Return Visit', category: 'Field Ministry', minutes: 4, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'publisher', icon: '🏠' }),
      t(100, { name: 'Making Disciples', category: 'Field Ministry', minutes: 5, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'publisher', icon: '🎓' }),

      t(110, { name: 'Song', category: 'Christian Living', kind: 'song', minutes: 3, numbered: false, icon: '🎵' }),
      t(120, { name: 'Local Needs', category: 'Christian Living', minutes: 15, requiresQualification: true, requiredRole: 'ministerial_servant', icon: '👥' }),
      t(130, { name: 'Congregation Bible Study', description: 'Conductor / reader', category: 'Christian Living', minutes: 30, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'elder', icon: '📚' }),

      t(140, { name: 'Concluding Comments', category: 'Closing', kind: 'note', minutes: 3, numbered: false, icon: '💬' }),
      t(150, { name: 'Song', category: 'Closing', kind: 'song', minutes: 3, numbered: false, icon: '🎵' }),
      t(160, { name: 'Prayer', category: 'Closing', minutes: 1, numbered: false, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),

      // ---- weekend meeting
      w(10, { name: 'Chairman', category: 'Opening', minutes: 0, requiresQualification: true, requiredRole: 'ministerial_servant', icon: '🎤' }),
      w(20, { name: 'Song', category: 'Opening', kind: 'song', minutes: 3, icon: '🎵' }),
      w(30, { name: 'Prayer', category: 'Opening', minutes: 1, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),
      w(40, { name: 'Public Talk', description: 'Speaker', category: 'Public Talk', minutes: 30, requiresQualification: true, requiredRole: 'elder', icon: '🗣️' }),
      w(50, { name: 'Song', category: 'Watchtower Study', kind: 'song', minutes: 3, icon: '🎵' }),
      w(60, { name: 'Watchtower Study', description: 'Conductor / reader', category: 'Watchtower Study', minutes: 30, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'elder', icon: '📗' }),
      w(70, { name: 'Song', category: 'Closing', kind: 'song', minutes: 3, icon: '🎵' }),
      w(80, { name: 'Prayer', category: 'Closing', minutes: 1, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),
    ],
  },

  tw: {
    label: 'Twi',
    categories: ['Opening', 'Bible mu Akorade', "Ma W'ani Nku Asɛnka Ho", 'Kristofo Abrabɔ', 'Public Talk', 'Watchtower Study', 'Closing'],
    minutesFormat: 'Simma {n}',
    midweekName: 'Nnawɔtwe Mfinimfini Adesua Ho Nhyehyɛe',
    weekendName: 'Weekend Meeting',
    types: [
      t(10, { name: 'Oguamtenani', description: 'Chairman', category: 'Opening', minutes: 0, numbered: false, requiresQualification: true, requiredRole: 'ministerial_servant', icon: '🎤' }),
      t(20, { name: 'Dwom', description: 'Song', category: 'Opening', kind: 'song', minutes: 3, numbered: false, icon: '🎵' }),
      t(30, { name: 'Mpaebɔ', description: 'Prayer', category: 'Opening', minutes: 1, numbered: false, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),
      t(40, { name: 'Nnianim Nsɛm', description: 'Opening comments', category: 'Opening', kind: 'note', minutes: 1, numbered: false, icon: '💬' }),

      t(50, { name: 'Kasa', description: 'Talk', category: 'Bible mu Akorade', minutes: 7, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '📖' }),
      t(60, { name: 'Tweetwee Bible Mu', description: 'Spiritual gems', category: 'Bible mu Akorade', minutes: 7, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '💎' }),
      t(70, { name: 'Bible Akenkan', description: 'Bible reading', category: 'Bible mu Akorade', minutes: 4, requiresQualification: true, requiredRole: 'publisher', icon: '📜' }),

      t(80, { name: 'Hyɛ Nkɔmmɔ Ase', description: 'Starting a conversation', category: "Ma W'ani Nku Asɛnka Ho", minutes: 3, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'publisher', icon: '🗣️' }),
      t(90, { name: 'Yɛ Sankɔhwɛ', description: 'Follow-up visit', category: "Ma W'ani Nku Asɛnka Ho", minutes: 4, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'publisher', icon: '🏠' }),
      t(100, { name: 'Asɛnka Adesua', description: 'Student talk', category: "Ma W'ani Nku Asɛnka Ho", minutes: 6, requiresQualification: true, requiredRole: 'publisher', icon: '🎓' }),

      t(110, { name: 'Dwom', description: 'Song', category: 'Kristofo Abrabɔ', kind: 'song', minutes: 3, numbered: false, icon: '🎵' }),
      t(120, { name: 'Asafo Mu Ahiade', description: 'Local needs', category: 'Kristofo Abrabɔ', minutes: 15, requiresQualification: true, requiredRole: 'ministerial_servant', icon: '👥' }),
      t(130, { name: 'Kristofo Abrabɔ Adwuma', description: 'Living part', category: 'Kristofo Abrabɔ', minutes: 10, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '📌' }),
      t(140, { name: 'Asafo Bible Adesua', description: 'Congregation Bible study (conductor / reader)', category: 'Kristofo Abrabɔ', minutes: 23, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'elder', icon: '📚' }),

      t(150, { name: 'Nsɛm a Wɔde Wie', description: 'Concluding comments', category: 'Closing', kind: 'note', minutes: 2, numbered: false, icon: '💬' }),
      t(160, { name: 'Dwom', description: 'Song', category: 'Closing', kind: 'song', minutes: 3, numbered: false, icon: '🎵' }),
      t(170, { name: 'Mpaebɔ', description: 'Prayer', category: 'Closing', minutes: 1, numbered: false, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),

      // ---- weekend meeting (change these words to your language)
      w(10, { name: 'Oguamtenani', description: 'Chairman', category: 'Opening', minutes: 0, requiresQualification: true, requiredRole: 'ministerial_servant', icon: '🎤' }),
      w(20, { name: 'Dwom', description: 'Song', category: 'Opening', kind: 'song', minutes: 3, icon: '🎵' }),
      w(30, { name: 'Mpaebɔ', description: 'Prayer', category: 'Opening', minutes: 1, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),
      w(40, { name: 'Public Talk', description: 'Speaker', category: 'Public Talk', minutes: 30, requiresQualification: true, requiredRole: 'elder', icon: '🗣️' }),
      w(50, { name: 'Dwom', description: 'Song', category: 'Watchtower Study', kind: 'song', minutes: 3, icon: '🎵' }),
      w(60, { name: 'Watchtower Study', description: 'Conductor / reader', category: 'Watchtower Study', minutes: 30, people: 2, allowsMultipleAssignees: true, requiresQualification: true, requiredRole: 'elder', icon: '📗' }),
      w(70, { name: 'Dwom', description: 'Song', category: 'Closing', kind: 'song', minutes: 3, icon: '🎵' }),
      w(80, { name: 'Mpaebɔ', description: 'Prayer', category: 'Closing', minutes: 1, requiresQualification: true, requiredRole: 'baptized_publisher', icon: '🙏' }),
    ],
  },
};
