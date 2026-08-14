import { TimetableEntry } from '../types';

export function parseCSVTimetable(csvText: string, timetableId: string): TimetableEntry[] {
  const lines = csvText.split('\n').filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const entries: TimetableEntry[] = [];
  
  // Header expected: Day,StartTime,EndTime,SubjectCode,SubjectName,Room,Faculty
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 7) {
      const day = parseInt(cols[0], 10) || 1;
      entries.push({
        id: `e-csv-${i}-${Date.now()}`,
        timetable_id: timetableId,
        day_of_week: day > 0 && day <= 7 ? day : 1,
        start_time: cols[1] || '09:00',
        end_time: cols[2] || '10:00',
        subject_code: cols[3] || 'CS101',
        subject_name: cols[4] || 'Subject',
        room: cols[5] || 'A-101',
        faculty: cols[6] || 'Faculty Member'
      });
    }
  }

  return entries;
}

export function parseJSONTimetable(jsonText: string, timetableId: string): TimetableEntry[] {
  try {
    const raw = JSON.parse(jsonText);
    const list = Array.isArray(raw) ? raw : (raw.entries || []);

    return list.map((item: any, idx: number) => ({
      id: item.id || `e-json-${idx}-${Date.now()}`,
      timetable_id: timetableId,
      day_of_week: Number(item.day_of_week || item.day || 1),
      start_time: String(item.start_time || '09:00'),
      end_time: String(item.end_time || '10:00'),
      subject_code: String(item.subject_code || 'SUB101'),
      subject_name: String(item.subject_name || 'Subject Name'),
      room: String(item.room || 'Room 101'),
      faculty: String(item.faculty || 'Faculty')
    }));
  } catch (e) {
    console.error('Failed to parse JSON timetable', e);
    return [];
  }
}
