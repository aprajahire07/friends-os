import { Timetable, SpecialCollegeDate, DateAttendanceRecord, SubjectAttendanceSummary } from '../types';

export const GHRCE_COLLEGE_ID = 'GHRCE_SEM3_SECTION_A';
export const SKILLTECH_COLLEGE_ID = 'SKILLTECH_SEM3_SECTION_A';

export const SEMESTER_CONFIG = {
  startDate: '2026-07-01',
  endDate: '2026-12-20',
  targetAttendance: 75,
};

export const COLLEGE_OPTIONS = [
  {
    id: GHRCE_COLLEGE_ID,
    name: 'GH Raisoni College of Engineering and Management (GHRCEMN)',
    shortName: 'GHRCEMN',
    branch: 'Computer Science & Engineering',
    semester: 3,
    section: 'A',
  },
  {
    id: SKILLTECH_COLLEGE_ID,
    name: 'SkillTech Institute of Technology (SkillTech)',
    shortName: 'SkillTech',
    branch: 'Computer Science & Engineering',
    semester: 3,
    section: 'A',
  },
];

export function resolveCollegeId(collegeStr?: string): string {
  if (!collegeStr) return GHRCE_COLLEGE_ID;
  const normalized = collegeStr.toLowerCase();
  if (normalized.includes('skilltech') || normalized.includes('skill')) {
    return SKILLTECH_COLLEGE_ID;
  }
  return GHRCE_COLLEGE_ID;
}

export function getCollegeName(collegeId: string): string {
  if (collegeId === SKILLTECH_COLLEGE_ID) return 'SkillTech';
  return 'GHRCEMN';
}

// Exact Timetables
export const TIMETABLES: Record<string, Timetable> = {
  [GHRCE_COLLEGE_ID]: {
    id: 'tt-ghrce-sem3a',
    college_id: GHRCE_COLLEGE_ID,
    college_name: 'GH Raisoni College of Engineering and Management (GHRCEMN)',
    branch: 'Computer Science & Engineering',
    semester: 3,
    section: 'A',
    slots: [
      // Monday
      { id: 'ghr-m1', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '12:10', end_time: '01:05', subject_code: 'DSA', subject_name: 'Data Structure and Algorithm', is_academic: true, room: 'A-201' },
      { id: 'ghr-m2', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '01:05', end_time: '02:00', subject_code: 'LIB', subject_name: 'Library', is_academic: false, room: 'Central Lib' },
      { id: 'ghr-mb', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '02:00', end_time: '02:20', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-m3', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '02:20', end_time: '03:15', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'A-201' },
      { id: 'ghr-m4', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '03:15', end_time: '04:10', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'B-102' },
      { id: 'ghr-mb2', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '04:10', end_time: '04:15', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-m5', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '04:15', end_time: '05:10', subject_code: 'Aptitude', subject_name: 'Aptitude & Logical Reasoning', is_academic: true, room: 'A-201' },
      { id: 'ghr-m6', college_id: GHRCE_COLLEGE_ID, day_of_week: 1, start_time: '05:10', end_time: '06:05', subject_code: 'LIB', subject_name: 'Library', is_academic: false },

      // Tuesday
      { id: 'ghr-t1', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '12:10', end_time: '01:05', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'A-201' },
      { id: 'ghr-t2', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '01:05', end_time: '02:00', subject_code: 'EEIM', subject_name: 'Engineering Economics & Industrial Mgmt', is_academic: true, room: 'A-201' },
      { id: 'ghr-tb', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '02:00', end_time: '02:20', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-t3', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '02:20', end_time: '03:15', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'B-102' },
      { id: 'ghr-t4', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '03:15', end_time: '04:10', subject_code: 'DSA', subject_name: 'Data Structure and Algorithm', is_academic: true, room: 'A-201' },
      { id: 'ghr-tb2', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '04:10', end_time: '04:15', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-t5', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '04:15', end_time: '05:10', subject_code: 'LIB', subject_name: 'Library', is_academic: false },
      { id: 'ghr-t6', college_id: GHRCE_COLLEGE_ID, day_of_week: 2, start_time: '05:10', end_time: '06:05', subject_code: 'LIB', subject_name: 'Library', is_academic: false },

      // Wednesday
      { id: 'ghr-w1', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '12:10', end_time: '01:05', subject_code: 'DSA Practical', subject_name: 'DSA Practical Lab', is_academic: true, room: 'Computer Lab 3' },
      { id: 'ghr-w2', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '01:05', end_time: '02:00', subject_code: 'DSA Practical', subject_name: 'DSA Practical Lab', is_academic: true, room: 'Computer Lab 3' },
      { id: 'ghr-wb', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '02:00', end_time: '02:20', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-w3', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '02:20', end_time: '03:15', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'B-102' },
      { id: 'ghr-w4', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '03:15', end_time: '04:10', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'A-201' },
      { id: 'ghr-wb2', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '04:10', end_time: '04:15', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-w5', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '04:15', end_time: '05:10', subject_code: 'Project-1', subject_name: 'Project-1 Work', is_academic: true, room: 'Lab 1' },
      { id: 'ghr-w6', college_id: GHRCE_COLLEGE_ID, day_of_week: 3, start_time: '05:10', end_time: '06:05', subject_code: 'Project-1', subject_name: 'Project-1 Work', is_academic: true, room: 'Lab 1' },

      // Thursday
      { id: 'ghr-th1', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '12:10', end_time: '01:05', subject_code: 'EEIM', subject_name: 'Engineering Economics & Industrial Mgmt', is_academic: true, room: 'A-201' },
      { id: 'ghr-th2', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '01:05', end_time: '02:00', subject_code: 'MDM', subject_name: 'Multidisciplinary Minor', is_academic: true, room: 'C-301' },
      { id: 'ghr-thb', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '02:00', end_time: '02:20', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-th3', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '02:20', end_time: '03:15', subject_code: 'HE', subject_name: 'Human Electives', is_academic: true, room: 'A-201' },
      { id: 'ghr-th4', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '03:15', end_time: '04:10', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'B-102' },
      { id: 'ghr-thb2', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '04:10', end_time: '04:15', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-th5', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '04:15', end_time: '05:10', subject_code: 'DSA', subject_name: 'Data Structure and Algorithm', is_academic: true, room: 'A-201' },
      { id: 'ghr-th6', college_id: GHRCE_COLLEGE_ID, day_of_week: 4, start_time: '05:10', end_time: '06:05', subject_code: 'LIB', subject_name: 'Library', is_academic: false },

      // Friday
      { id: 'ghr-f1', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '12:10', end_time: '01:05', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'A-201' },
      { id: 'ghr-f2', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '01:05', end_time: '02:00', subject_code: 'MDM', subject_name: 'Multidisciplinary Minor', is_academic: true, room: 'C-301' },
      { id: 'ghr-fb', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '02:00', end_time: '02:20', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-f3', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '02:20', end_time: '03:15', subject_code: 'HE', subject_name: 'Human Electives', is_academic: true, room: 'A-201' },
      { id: 'ghr-f4', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '03:15', end_time: '04:10', subject_code: 'LIB', subject_name: 'Library', is_academic: false },
      { id: 'ghr-fb2', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '04:10', end_time: '04:15', subject_code: 'BREAK', subject_name: 'Break', is_academic: false },
      { id: 'ghr-f5', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '04:15', end_time: '05:10', subject_code: 'ACT', subject_name: 'Activity / Guest Lecture', is_academic: false },
      { id: 'ghr-f6', college_id: GHRCE_COLLEGE_ID, day_of_week: 5, start_time: '05:10', end_time: '06:05', subject_code: 'ACT', subject_name: 'Activity / Guest Lecture', is_academic: false },

      // Saturday (Activity only)
      { id: 'ghr-s1', college_id: GHRCE_COLLEGE_ID, day_of_week: 6, start_time: '10:00', end_time: '01:00', subject_code: 'ACT', subject_name: 'College Activity & Sports', is_academic: false },
    ],
  },

  [SKILLTECH_COLLEGE_ID]: {
    id: 'tt-skilltech-sem3a',
    college_id: SKILLTECH_COLLEGE_ID,
    college_name: 'SkillTech Institute of Technology (SkillTech)',
    branch: 'Computer Science & Engineering',
    semester: 3,
    section: 'A',
    slots: [
      // Monday
      { id: 'skt-m1', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '09:30', end_time: '10:25', subject_code: 'DSA', subject_name: 'Data Structure and Algorithm', is_academic: true, room: 'S-101' },
      { id: 'skt-m2', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '10:25', end_time: '11:20', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'S-101' },
      { id: 'skt-mb', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '11:20', end_time: '11:40', subject_code: 'BREAK', subject_name: 'Tea Break', is_academic: false },
      { id: 'skt-m3', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '11:40', end_time: '12:35', subject_code: 'EEIM', subject_name: 'Engineering Economics and Industrial Mgmt', is_academic: true, room: 'S-101' },
      { id: 'skt-m4', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '12:35', end_time: '01:30', subject_code: 'Aptitude', subject_name: 'Aptitude & Reasoning', is_academic: true, room: 'S-101' },
      { id: 'skt-ml', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '01:30', end_time: '02:15', subject_code: 'BREAK', subject_name: 'Lunch Break', is_academic: false },
      { id: 'skt-m5', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 1, start_time: '02:15', end_time: '03:10', subject_code: 'HE', subject_name: 'Human Electives', is_academic: true, room: 'S-101' },

      // Tuesday
      { id: 'skt-t1', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '09:30', end_time: '10:25', subject_code: 'MDM-1', subject_name: 'Multidisciplinary Minor-1', is_academic: true, room: 'S-204' },
      { id: 'skt-t2', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '10:25', end_time: '11:20', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'S-102' },
      { id: 'skt-tb', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '11:20', end_time: '11:40', subject_code: 'BREAK', subject_name: 'Tea Break', is_academic: false },
      { id: 'skt-t3', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '11:40', end_time: '12:35', subject_code: 'DSA', subject_name: 'Data Structure and Algorithm', is_academic: true, room: 'S-101' },
      { id: 'skt-t4', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '12:35', end_time: '01:30', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'S-101' },
      { id: 'skt-tl', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '01:30', end_time: '02:15', subject_code: 'BREAK', subject_name: 'Lunch Break', is_academic: false },
      { id: 'skt-t5', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 2, start_time: '02:15', end_time: '03:10', subject_code: 'LIB', subject_name: 'Library Session', is_academic: false },

      // Wednesday
      { id: 'skt-w1', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '09:30', end_time: '10:25', subject_code: 'DSA Practical', subject_name: 'DSA Practical Lab', is_academic: true, room: 'Advanced Lab 2' },
      { id: 'skt-w2', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '10:25', end_time: '11:20', subject_code: 'DSA Practical', subject_name: 'DSA Practical Lab', is_academic: true, room: 'Advanced Lab 2' },
      { id: 'skt-wb', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '11:20', end_time: '11:40', subject_code: 'BREAK', subject_name: 'Tea Break', is_academic: false },
      { id: 'skt-w3', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '11:40', end_time: '12:35', subject_code: 'EEIM', subject_name: 'Engineering Economics and Industrial Mgmt', is_academic: true, room: 'S-101' },
      { id: 'skt-w4', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '12:35', end_time: '01:30', subject_code: 'MDM-1', subject_name: 'Multidisciplinary Minor-1', is_academic: true, room: 'S-204' },
      { id: 'skt-wl', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '01:30', end_time: '02:15', subject_code: 'BREAK', subject_name: 'Lunch Break', is_academic: false },
      { id: 'skt-w5', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '02:15', end_time: '03:10', subject_code: 'Project-1', subject_name: 'Project-1 Lab', is_academic: true, room: 'Lab 4' },
      { id: 'skt-w6', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 3, start_time: '03:10', end_time: '04:05', subject_code: 'Project-1', subject_name: 'Project-1 Lab', is_academic: true, room: 'Lab 4' },

      // Thursday
      { id: 'skt-th1', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '09:30', end_time: '10:25', subject_code: 'HE', subject_name: 'Human Electives', is_academic: true, room: 'S-101' },
      { id: 'skt-th2', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '10:25', end_time: '11:20', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'S-102' },
      { id: 'skt-thb', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '11:20', end_time: '11:40', subject_code: 'BREAK', subject_name: 'Tea Break', is_academic: false },
      { id: 'skt-th3', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '11:40', end_time: '12:35', subject_code: 'DMGT', subject_name: 'Discrete Mathematics and Graph Theory', is_academic: true, room: 'S-101' },
      { id: 'skt-th4', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '12:35', end_time: '01:30', subject_code: 'DSA', subject_name: 'Data Structure and Algorithm', is_academic: true, room: 'S-101' },
      { id: 'skt-thl', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '01:30', end_time: '02:15', subject_code: 'BREAK', subject_name: 'Lunch Break', is_academic: false },
      { id: 'skt-th5', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 4, start_time: '02:15', end_time: '03:10', subject_code: 'Aptitude', subject_name: 'Aptitude & Reasoning', is_academic: true, room: 'S-101' },

      // Friday
      { id: 'skt-f1', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '09:30', end_time: '10:25', subject_code: 'EEIM', subject_name: 'Engineering Economics and Industrial Mgmt', is_academic: true, room: 'S-101' },
      { id: 'skt-f2', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '10:25', end_time: '11:20', subject_code: 'MDM-1', subject_name: 'Multidisciplinary Minor-1', is_academic: true, room: 'S-204' },
      { id: 'skt-fb', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '11:20', end_time: '11:40', subject_code: 'BREAK', subject_name: 'Tea Break', is_academic: false },
      { id: 'skt-f3', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '11:40', end_time: '12:35', subject_code: 'HE', subject_name: 'Human Electives', is_academic: true, room: 'S-101' },
      { id: 'skt-f4', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '12:35', end_time: '01:30', subject_code: 'OE-1', subject_name: 'Open Elective-1', is_academic: true, room: 'S-102' },
      { id: 'skt-fl', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '01:30', end_time: '02:15', subject_code: 'BREAK', subject_name: 'Lunch Break', is_academic: false },
      { id: 'skt-f5', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 5, start_time: '02:15', end_time: '03:10', subject_code: 'GL', subject_name: 'Industry Guest Lecture', is_academic: false },

      // Saturday
      { id: 'skt-s1', college_id: SKILLTECH_COLLEGE_ID, day_of_week: 6, start_time: '10:00', end_time: '01:00', subject_code: 'ACT', subject_name: 'Sports & Student Club Activity', is_academic: false },
    ],
  },
};

// Holidays / Special Dates
export const SPECIAL_COLLEGE_DATES: SpecialCollegeDate[] = [
  { id: 'hol-1', college_id: GHRCE_COLLEGE_ID, date: '2026-08-15', title: 'Independence Day 🇮🇳', type: 'holiday' },
  { id: 'hol-2', college_id: SKILLTECH_COLLEGE_ID, date: '2026-08-15', title: 'Independence Day 🇮🇳', type: 'holiday' },
  { id: 'hol-3', college_id: GHRCE_COLLEGE_ID, date: '2026-08-28', title: 'Ganesh Chaturthi 🌸', type: 'holiday' },
  { id: 'hol-4', college_id: SKILLTECH_COLLEGE_ID, date: '2026-08-28', title: 'Ganesh Chaturthi 🌸', type: 'holiday' },
  { id: 'hol-5', college_id: GHRCE_COLLEGE_ID, date: '2026-09-10', title: 'Mid-Semester Examinations 📝', type: 'exam' },
  { id: 'hol-6', college_id: GHRCE_COLLEGE_ID, date: '2026-09-11', title: 'Mid-Semester Examinations 📝', type: 'exam' },
];

export function getAcademicSubjectsForCollege(collegeId: string): { code: string; name: string }[] {
  if (collegeId === SKILLTECH_COLLEGE_ID) {
    return [
      { code: 'DSA', name: 'Data Structure and Algorithm' },
      { code: 'DMGT', name: 'Discrete Mathematics and Graph Theory' },
      { code: 'MDM-1', name: 'Multidisciplinary Minor-1' },
      { code: 'EEIM', name: 'Engineering Economics and Industrial Management' },
      { code: 'HE', name: 'Human Electives' },
      { code: 'OE-1', name: 'Open Elective-1' },
      { code: 'Aptitude', name: 'Aptitude & Reasoning' },
      { code: 'Project-1', name: 'Project-1 Work' },
    ];
  }
  return [
    { code: 'DSA', name: 'Data Structure and Algorithm' },
    { code: 'DMGT', name: 'Discrete Mathematics and Graph Theory' },
    { code: 'EEIM', name: 'Engineering Economics & Industrial Management' },
    { code: 'MDM', name: 'Multidisciplinary Minor' },
    { code: 'HE', name: 'Human Electives' },
    { code: 'OE-1', name: 'Open Elective-1' },
    { code: 'Aptitude', name: 'Aptitude & Logical Reasoning' },
    { code: 'Project-1', name: 'Project-1 Work' },
  ];
}

// Extract base subject code (e.g. "DSA Practical" -> "DSA", "MDM-1" -> "MDM-1", etc.)
export function normalizeSubjectCode(code: string): string {
  if (code.startsWith('DSA')) return 'DSA';
  return code;
}

// Get Day of Week number (1 = Mon, ..., 6 = Sat, 0 = Sun)
export function getDayOfWeekNumber(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getDay();
}

// Check special date for college
export function getSpecialDateInfo(collegeId: string, dateStr: string): SpecialCollegeDate | undefined {
  return SPECIAL_COLLEGE_DATES.find(s => s.college_id === collegeId && s.date === dateStr);
}

// Check if date is in semester range
export function isDateInSemester(dateStr: string): boolean {
  return dateStr >= SEMESTER_CONFIG.startDate && dateStr <= SEMESTER_CONFIG.endDate;
}

// Get Academic slots for a date
export function getAcademicSlotsForDate(collegeId: string, dateStr: string) {
  const resolvedId = resolveCollegeId(collegeId);
  const special = getSpecialDateInfo(resolvedId, dateStr);
  if (special && (special.type === 'holiday' || special.type === 'no_classes' || special.type === 'exam')) {
    return []; // No regular academic classes on holiday/exam day
  }

  const tt = TIMETABLES[resolvedId] || TIMETABLES[GHRCE_COLLEGE_ID];
  const dayNum = getDayOfWeekNumber(dateStr);
  if (dayNum === 0) return []; // Sunday

  return tt.slots.filter(slot => slot.day_of_week === dayNum && slot.is_academic);
}

// Calculate attendance summaries per subject
export function calculateAttendanceSummaries(
  records: DateAttendanceRecord[],
  collegeId: string
): {
  overallPercentage: number;
  totalConducted: number;
  totalAttended: number;
  totalAbsent: number;
  totalCancelled: number;
  subjects: SubjectAttendanceSummary[];
} {
  const resolvedId = resolveCollegeId(collegeId);
  const subjectsList = getAcademicSubjectsForCollege(resolvedId);

  let grandAttended = 0;
  let grandConducted = 0;
  let grandAbsent = 0;
  let grandCancelled = 0;

  const subjectSummaries: SubjectAttendanceSummary[] = subjectsList.map(sub => {
    // Filter records belonging to this subject or its practicals (e.g. DSA and DSA Practical)
    const subRecords = records.filter(r => {
      const norm = normalizeSubjectCode(r.subject_code);
      return norm === sub.code && r.college_id === resolvedId;
    });

    let attended = 0;
    let absent = 0;
    let cancelled = 0;

    subRecords.forEach(r => {
      if (r.status === 'attended') attended++;
      else if (r.status === 'absent') absent++;
      else if (r.status === 'cancelled') cancelled++;
    });

    // Conducted classes = Attended + Absent (Cancelled DO NOT INCREASE conducted total!)
    const conducted = attended + absent;
    const percentage = conducted > 0 ? Math.round((attended / conducted) * 100) : 100;

    grandAttended += attended;
    grandConducted += conducted;
    grandAbsent += absent;
    grandCancelled += cancelled;

    // Attendance Calculator
    let can_miss = 0;
    let need_to_attend = 0;

    if (percentage >= 75) {
      // How many classes can I miss?
      // Attended / (Conducted + X) >= 0.75 => Attended / 0.75 >= Conducted + X
      can_miss = Math.max(0, Math.floor(attended / 0.75 - conducted));
    } else {
      // How many consecutive classes needed?
      // (Attended + Y) / (Conducted + Y) >= 0.75 => 0.25 * Y >= 0.75 * Conducted - Attended
      need_to_attend = Math.max(0, Math.ceil((0.75 * conducted - attended) / 0.25));
    }

    return {
      subject_code: sub.code,
      subject_name: sub.name,
      attended,
      absent,
      cancelled,
      conducted,
      percentage,
      can_miss,
      need_to_attend,
    };
  });

  const overallPercentage = grandConducted > 0 ? Math.round((grandAttended / grandConducted) * 100) : 100;

  return {
    overallPercentage,
    totalConducted: grandConducted,
    totalAttended: grandAttended,
    totalAbsent: grandAbsent,
    totalCancelled: grandCancelled,
    subjects: subjectSummaries,
  };
}
