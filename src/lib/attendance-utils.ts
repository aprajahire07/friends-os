import { AttendanceRecord } from '../types';

export interface SubjectAttendanceSummary {
  subject_name: string;
  attended: number;
  missed: number;
  cancelled: number;
  valid_total: number; // attended + missed (excluding cancelled)
  percentage: number;
  statusCategory: 'Safe' | 'Low' | 'Critical';
  classesCanMiss75: number; // How many more classes student can miss to maintain >= 75%
  classesNeeded75: number; // How many consecutive classes student must attend to reach 75%
}

export function calculateAttendance(records: AttendanceRecord[], targetPercentage = 75): {
  overallAttended: number;
  overallMissed: number;
  overallCancelled: number;
  overallValidTotal: number;
  overallPercentage: number;
  subjectSummaries: SubjectAttendanceSummary[];
} {
  const subjectMap = new Map<string, { attended: number; missed: number; cancelled: number }>();

  records.forEach(record => {
    const key = record.subject_name.trim();
    if (!subjectMap.has(key)) {
      subjectMap.set(key, { attended: 0, missed: 0, cancelled: 0 });
    }
    const current = subjectMap.get(key)!;

    if (record.status === 'attended') {
      current.attended += 1;
    } else if (record.status === 'absent') {
      current.missed += 1;
    } else if (record.status === 'cancelled') {
      // CANCELLED LECTURES DO NOT COUNT TOWARDS DENOMINATOR!
      current.cancelled += 1;
    }
  });

  let overallAttended = 0;
  let overallMissed = 0;
  let overallCancelled = 0;

  const subjectSummaries: SubjectAttendanceSummary[] = [];

  subjectMap.forEach((stats, subject_name) => {
    overallAttended += stats.attended;
    overallMissed += stats.missed;
    overallCancelled += stats.cancelled;

    const valid_total = stats.attended + stats.missed; // Excludes cancelled!
    const percentage = valid_total > 0 ? Number(((stats.attended / valid_total) * 100).toFixed(2)) : 100;

    let statusCategory: 'Safe' | 'Low' | 'Critical' = 'Safe';
    if (percentage < 70) {
      statusCategory = 'Critical';
    } else if (percentage < 80) {
      statusCategory = 'Low';
    }

    // Attendance Target Math:
    // Target formula: (Attended) / (ValidTotal + x) >= 0.75  =>  x calculation
    // Or if currently above 75%: How many can I miss?
    // (Attended) / (ValidTotal + MissedExtra) >= 0.75  => MissedExtra <= (Attended / 0.75) - ValidTotal
    let classesCanMiss75 = 0;
    let classesNeeded75 = 0;

    const targetDecimal = targetPercentage / 100;

    if (valid_total > 0) {
      if (percentage >= targetPercentage) {
        // Can miss = Math.floor((Attended / targetDecimal) - ValidTotal)
        classesCanMiss75 = Math.max(0, Math.floor((stats.attended / targetDecimal) - valid_total));
      } else {
        // Classes needed = Math.ceil((targetDecimal * ValidTotal - Attended) / (1 - targetDecimal))
        classesNeeded75 = Math.max(0, Math.ceil((targetDecimal * valid_total - stats.attended) / (1 - targetDecimal)));
      }
    }

    subjectSummaries.push({
      subject_name,
      attended: stats.attended,
      missed: stats.missed,
      cancelled: stats.cancelled,
      valid_total,
      percentage,
      statusCategory,
      classesCanMiss75,
      classesNeeded75
    });
  });

  const overallValidTotal = overallAttended + overallMissed;
  const overallPercentage = overallValidTotal > 0 ? Number(((overallAttended / overallValidTotal) * 100).toFixed(2)) : 100;

  return {
    overallAttended,
    overallMissed,
    overallCancelled,
    overallValidTotal,
    overallPercentage,
    subjectSummaries
  };
}
