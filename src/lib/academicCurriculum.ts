import { SubjectCurriculumItem, GradeScaleRule, SubjectMarkSummary } from '../types';
import { resolveCollegeId, SKILLTECH_COLLEGE_ID, GHRCE_COLLEGE_ID } from './timetables';

export const GRADING_SCALE: GradeScaleRule[] = [
  { grade: 'O', grade_point: 10, min_percentage: 90, max_percentage: 100, description: 'Outstanding' },
  { grade: 'A+', grade_point: 9, min_percentage: 80, max_percentage: 89.99, description: 'Excellent' },
  { grade: 'A', grade_point: 8, min_percentage: 70, max_percentage: 79.99, description: 'Very Good' },
  { grade: 'B+', grade_point: 7, min_percentage: 60, max_percentage: 69.99, description: 'Good' },
  { grade: 'B', grade_point: 6, min_percentage: 55, max_percentage: 59.99, description: 'Above Average' },
  { grade: 'C', grade_point: 5, min_percentage: 50, max_percentage: 54.99, description: 'Average' },
  { grade: 'P', grade_point: 4, min_percentage: 40, max_percentage: 49.99, description: 'Pass' },
  { grade: 'F', grade_point: 0, min_percentage: 0, max_percentage: 39.99, description: 'Fail / Re-appear' },
];

/**
 * Standard Unified Curriculum (Semesters 1-8)
 * Configured with:
 * - CAE 1: 15 Marks
 * - CAE 2: 15 Marks
 * - END SEM: 50 Marks
 * (Aptitude & Project work subjects removed as they don't have written exams).
 */
const UNIFIED_CURRICULUM: Record<number, SubjectCurriculumItem[]> = {
  1: [
    { code: 'M-1', name: 'Engineering Mathematics - I', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'PHY', name: 'Engineering Physics', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'BEE', name: 'Basic Electrical Engineering', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'EGD', name: 'Engineering Graphics & Design', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'CS', name: 'Communication Skills', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
  ],
  2: [
    { code: 'M-2', name: 'Engineering Mathematics - II', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'CHEM', name: 'Engineering Chemistry', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'PPS', name: 'Programming for Problem Solving (C/C++)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'EM', name: 'Engineering Mechanics', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'WP', name: 'Workshop Practices', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
  ],
  3: [
    { code: 'DSA', name: 'Data Structure and Algorithm', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'DMGT', name: 'Discrete Mathematics and Graph Theory', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'EEIM', name: 'Engineering Economics & Industrial Mgmt', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'MDM', name: 'Multidisciplinary Minor', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'HE', name: 'Human Electives', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
    { code: 'OE-1', name: 'Open Elective - 1', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
  ],
  4: [
    { code: 'DBMS', name: 'Database Management Systems', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'OS', name: 'Operating Systems', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'COA', name: 'Computer Organization & Architecture', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'OOP', name: 'Object Oriented Programming (Java)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'UHV', name: 'Universal Human Values', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'OE-2', name: 'Open Elective - 2', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
  ],
  5: [
    { code: 'CN', name: 'Computer Networks', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'TOC', name: 'Theory of Computation & Automata', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'SE', name: 'Software Engineering & Agile', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'PE-1', name: 'Professional Elective - 1 (Cloud / AI)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
    { code: 'OE-3', name: 'Open Elective - 3', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
  ],
  6: [
    { code: 'CD', name: 'Compiler Design', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'AIML', name: 'Artificial Intelligence & Machine Learning', credits: 4, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'ISC', name: 'Information Security & Cryptography', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'PE-2', name: 'Professional Elective - 2 (Data Science / DevOps)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
    { code: 'OE-4', name: 'Open Elective - 4', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
  ],
  7: [
    { code: 'CC', name: 'Cloud Computing & DevOps Architecture', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'BDA', name: 'Big Data Analytics', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'PE-3', name: 'Professional Elective - 3 (Cyber Security)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
    { code: 'PE-4', name: 'Professional Elective - 4 (Blockchain / IoT)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
    { code: 'OE-5', name: 'Open Elective - 5 (Management & Finance)', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
  ],
  8: [
    { code: 'SEMINAR', name: 'Technical Seminar & Paper Publication', credits: 2, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Theory' },
    { code: 'MOOC', name: 'MOOC / Advanced NPTEL Course', credits: 3, max_cae1: 15, max_cae2: 15, max_end_sem: 50, category: 'Elective' },
  ],
};

/**
 * Resolves curriculum list for any given college and semester.
 * All students share the exact same subjects uniformly.
 */
export function getCurriculumForCollegeAndSemester(
  _collegeId?: string | null,
  semesterNumber: number = 3
): SubjectCurriculumItem[] {
  const sem = Math.max(1, Math.min(8, Number(semesterNumber) || 3));

  if (UNIFIED_CURRICULUM[sem]) {
    return UNIFIED_CURRICULUM[sem];
  }

  // Fallback to Semester 3
  return UNIFIED_CURRICULUM[3] || [];
}

/**
 * Calculates grade and grade point from percentage.
 */
export function calculateGradeFromPercentage(percentage: number): {
  grade: string;
  gradePoint: number;
  description: string;
} {
  const rounded = Math.round(percentage * 100) / 100;
  for (const rule of GRADING_SCALE) {
    if (rounded >= rule.min_percentage && rounded <= rule.max_percentage) {
      return {
        grade: rule.grade,
        gradePoint: rule.grade_point,
        description: rule.description,
      };
    }
  }
  return { grade: 'F', gradePoint: 0, description: 'Fail / Re-appear' };
}

/**
 * Computes individual subject percentage & grade based on entered exam marks.
 * Supports:
 * - CAE1 (max e.g. 40)
 * - CAE2 (max e.g. 40)
 * - END_SEM (max e.g. 100)
 */
export function computeSubjectMarkSummary(
  item: SubjectCurriculumItem,
  marksMap: { cae1?: number | null; cae2?: number | null; end_sem?: number | null }
): SubjectMarkSummary {
  const cae1 = marksMap.cae1 !== undefined && marksMap.cae1 !== null && !isNaN(marksMap.cae1) ? Number(marksMap.cae1) : null;
  const cae2 = marksMap.cae2 !== undefined && marksMap.cae2 !== null && !isNaN(marksMap.cae2) ? Number(marksMap.cae2) : null;
  const endSem = marksMap.end_sem !== undefined && marksMap.end_sem !== null && !isNaN(marksMap.end_sem) ? Number(marksMap.end_sem) : null;

  let obtainedSum = 0;
  let maxEvaluatedSum = 0;
  let hasAnyMark = false;

  if (cae1 !== null) {
    obtainedSum += Math.max(0, Math.min(item.max_cae1, cae1));
    maxEvaluatedSum += item.max_cae1;
    hasAnyMark = true;
  }
  if (cae2 !== null) {
    obtainedSum += Math.max(0, Math.min(item.max_cae2, cae2));
    maxEvaluatedSum += item.max_cae2;
    hasAnyMark = true;
  }
  if (endSem !== null) {
    obtainedSum += Math.max(0, Math.min(item.max_end_sem, endSem));
    maxEvaluatedSum += item.max_end_sem;
    hasAnyMark = true;
  }

  const fullMax = item.max_cae1 + item.max_cae2 + item.max_end_sem;

  if (!hasAnyMark || maxEvaluatedSum === 0) {
    return {
      subject_code: item.code,
      subject_name: item.name,
      credits: item.credits,
      cae1,
      max_cae1: item.max_cae1,
      cae2,
      max_cae2: item.max_cae2,
      end_sem: endSem,
      max_end_sem: item.max_end_sem,
      total_obtained: null,
      total_max: fullMax,
      percentage: null,
      grade: '—',
      grade_point: null,
      is_complete: false,
    };
  }

  const percentage = Math.round((obtainedSum / maxEvaluatedSum) * 10000) / 100;
  const gradeInfo = calculateGradeFromPercentage(percentage);
  const isComplete = cae1 !== null && cae2 !== null && endSem !== null;

  return {
    subject_code: item.code,
    subject_name: item.name,
    credits: item.credits,
    cae1,
    max_cae1: item.max_cae1,
    cae2,
    max_cae2: item.max_cae2,
    end_sem: endSem,
    max_end_sem: item.max_end_sem,
    total_obtained: Math.round(obtainedSum * 10) / 10,
    total_max: maxEvaluatedSum,
    percentage,
    grade: gradeInfo.grade,
    grade_point: gradeInfo.gradePoint,
    is_complete: isComplete,
  };
}

/**
 * Calculates SGPA from evaluated subjects:
 * SGPA = sum(Credits * Grade Point) / sum(Credits)
 */
export function calculateSgpa(subjects: SubjectMarkSummary[]): {
  sgpa: number;
  totalCredits: number;
  evaluatedCredits: number;
  totalGradePoints: number;
  hasMarks: boolean;
  evaluatedCount: number;
  totalCount: number;
} {
  let totalCredits = 0;
  let evaluatedCredits = 0;
  let totalGradePoints = 0;
  let evaluatedCount = 0;

  for (const sub of subjects) {
    totalCredits += sub.credits;
    if (sub.grade_point !== null && sub.grade_point !== undefined) {
      evaluatedCredits += sub.credits;
      totalGradePoints += sub.credits * sub.grade_point;
      evaluatedCount++;
    }
  }

  const sgpa = evaluatedCredits > 0 ? Math.round((totalGradePoints / evaluatedCredits) * 100) / 100 : 0.0;

  return {
    sgpa,
    totalCredits,
    evaluatedCredits,
    totalGradePoints: Math.round(totalGradePoints * 100) / 100,
    hasMarks: evaluatedCount > 0,
    evaluatedCount,
    totalCount: subjects.length,
  };
}

/**
 * Calculates CGPA across semesters:
 * CGPA = sum(Semester Total Credits * Semester SGPA) / sum(Semester Total Credits)
 */
export function calculateCgpa(
  semesterEntries: { semester: number; sgpa: number; credits: number; is_included?: boolean }[]
): {
  cgpa: number;
  totalCredits: number;
  evaluatedSemestersCount: number;
} {
  let weightedSum = 0;
  let totalCredits = 0;
  let evaluatedSemestersCount = 0;

  for (const entry of semesterEntries) {
    if (entry.is_included !== false && entry.sgpa > 0 && entry.credits > 0) {
      weightedSum += entry.sgpa * entry.credits;
      totalCredits += entry.credits;
      evaluatedSemestersCount++;
    }
  }

  const cgpa = totalCredits > 0 ? Math.round((weightedSum / totalCredits) * 100) / 100 : 0.0;

  return {
    cgpa,
    totalCredits,
    evaluatedSemestersCount,
  };
}
