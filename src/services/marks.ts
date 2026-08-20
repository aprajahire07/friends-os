import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  StudentMark, 
  StudentAcademicProfile, 
  SemesterResult, 
  SubjectMarkSummary, 
  ExamType,
  Profile 
} from '../types';
import { 
  getCurriculumForCollegeAndSemester, 
  computeSubjectMarkSummary, 
  calculateSgpa,
  calculateCgpa 
} from '../lib/academicCurriculum';
import { computeSha256, isUserAdmin, FRIEND_OS_ADMIN_EMAIL } from './appSettings';

// In-memory / local storage cache keys
const MARKS_CACHE_PREFIX = 'friend_os_marks_';
const ACADEMIC_PROFILE_CACHE_PREFIX = 'friend_os_academic_';
const SEMESTER_RESULTS_CACHE_PREFIX = 'friend_os_sem_results_';
const UNLOCKED_MARKS_SESSION = new Set<string>();

/**
 * Checks if current user has unlocked or can bypass the student's marks.
 */
export function isMarksUnlockedForUser(
  targetUserId: string, 
  currentLoggedInUser?: Profile | null,
  isProtected: boolean = false
): boolean {
  if (!isProtected) return true;
  if (!currentLoggedInUser) return false;
  if (currentLoggedInUser.id === targetUserId) return true;
  if (isUserAdmin(currentLoggedInUser)) return true;
  if (currentLoggedInUser.email?.toLowerCase().trim() === FRIEND_OS_ADMIN_EMAIL.toLowerCase().trim()) return true;
  return UNLOCKED_MARKS_SESSION.has(targetUserId);
}

/**
 * Unlock marks for target user in current session.
 */
export function markStudentAsUnlocked(targetUserId: string) {
  UNLOCKED_MARKS_SESSION.add(targetUserId);
}

/**
 * Fetch Academic Profile for a student (Semester, College, Password Protected).
 */
export async function fetchAcademicProfileFromSupabase(
  userId: string,
  userProfile?: Profile | null
): Promise<StudentAcademicProfile> {
  const fallbackSemester = userProfile?.semester || 3;
  const fallbackCollege = userProfile?.college || 'GHRCE_SEM3_SECTION_A';

  const defaultProfile: StudentAcademicProfile = {
    user_id: userId,
    college_id: fallbackCollege,
    current_semester: fallbackSemester,
    is_marks_password_protected: false,
    marks_password_hash: null,
  };

  if (!isSupabaseConfigured || !supabase) {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${ACADEMIC_PROFILE_CACHE_PREFIX}${userId}`);
      if (stored) {
        try {
          return { ...defaultProfile, ...JSON.parse(stored) };
        } catch {}
      }
    }
    return defaultProfile;
  }

  try {
    const { data, error } = await supabase
      .from('student_academic_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.warn('Notice while fetching student academic profile:', error.message);
      }
      return defaultProfile;
    }

    if (data) {
      const profileResult: StudentAcademicProfile = {
        id: data.id,
        user_id: data.user_id,
        college_id: data.college_id || fallbackCollege,
        current_semester: Number(data.current_semester) || fallbackSemester,
        is_marks_password_protected: Boolean(data.is_marks_password_protected),
        marks_password_hash: data.marks_password_hash || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${ACADEMIC_PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify(profileResult));
      }
      return profileResult;
    }

    return defaultProfile;
  } catch (err) {
    console.warn('Error fetching academic profile from Supabase:', err);
    return defaultProfile;
  }
}

/**
 * Save/Update Student's Active Semester and College.
 */
export async function updateAcademicProfileInSupabase(
  userId: string,
  semester: number,
  collegeId?: string
): Promise<boolean> {
  const sem = Math.max(1, Math.min(8, Number(semester) || 3));

  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(`${ACADEMIC_PROFILE_CACHE_PREFIX}${userId}`);
    const prev = stored ? JSON.parse(stored) : {};
    localStorage.setItem(`${ACADEMIC_PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify({
      ...prev,
      user_id: userId,
      current_semester: sem,
      ...(collegeId ? { college_id: collegeId } : {}),
      updated_at: new Date().toISOString(),
    }));
  }

  if (!isSupabaseConfigured || !supabase) return true;

  try {
    const payload: any = {
      user_id: userId,
      current_semester: sem,
      updated_at: new Date().toISOString(),
    };
    if (collegeId) payload.college_id = collegeId;

    const { error } = await supabase
      .from('student_academic_profiles')
      .upsert(payload, { onConflict: 'user_id' });

    if (error) {
      console.warn('Error updating academic profile in Supabase:', error.message);
      return false;
    }

    // Also update profiles table semester column if possible
    await supabase.from('profiles').update({ semester: sem }).eq('id', userId);
    return true;
  } catch (err) {
    console.warn('Exception updating academic profile:', err);
    return false;
  }
}

/**
 * Set or Remove Marks Privacy Password.
 */
export async function setMarksPasswordInSupabase(
  userId: string,
  isProtected: boolean,
  passwordPlain?: string
): Promise<boolean> {
  let hash: string | null = null;
  if (isProtected && passwordPlain && passwordPlain.trim().length > 0) {
    hash = await computeSha256(passwordPlain.trim());
  }

  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(`${ACADEMIC_PROFILE_CACHE_PREFIX}${userId}`);
    const prev = stored ? JSON.parse(stored) : {};
    localStorage.setItem(`${ACADEMIC_PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify({
      ...prev,
      user_id: userId,
      is_marks_password_protected: isProtected,
      marks_password_hash: hash,
      updated_at: new Date().toISOString(),
    }));
  }

  if (!isSupabaseConfigured || !supabase) return true;

  try {
    const { error } = await supabase
      .from('student_academic_profiles')
      .upsert({
        user_id: userId,
        is_marks_password_protected: isProtected,
        marks_password_hash: hash,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.warn('Error setting marks password in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception setting marks password:', err);
    return false;
  }
}

/**
 * Verify Student Marks Password.
 * Admin and Self always return true.
 */
export async function verifyMarksPassword(
  targetUserId: string,
  inputPasswordPlain: string,
  targetProfile?: StudentAcademicProfile | null,
  currentLoggedInUser?: Profile | null
): Promise<{ success: boolean; message?: string }> {
  // Admin bypass
  if (currentLoggedInUser && (isUserAdmin(currentLoggedInUser) || isMarksUnlockedForUser(targetUserId, currentLoggedInUser, true))) {
    markStudentAsUnlocked(targetUserId);
    return { success: true };
  }

  if (!targetProfile || !targetProfile.is_marks_password_protected) {
    markStudentAsUnlocked(targetUserId);
    return { success: true };
  }

  const inputHash = await computeSha256(inputPasswordPlain.trim());

  // Check stored hash
  if (targetProfile.marks_password_hash) {
    if (inputHash === targetProfile.marks_password_hash) {
      markStudentAsUnlocked(targetUserId);
      return { success: true };
    }
    return { success: false, message: 'Incorrect marks security password. Please try again.' };
  }

  // Try RPC if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('verify_student_marks_password', {
        p_target_user_id: targetUserId,
        p_password_hash: inputHash,
      });

      if (!error && data === true) {
        markStudentAsUnlocked(targetUserId);
        return { success: true };
      }
    } catch (e) {
      console.warn('RPC verify_student_marks_password fallback:', e);
    }
  }

  return { success: false, message: 'Incorrect marks security password.' };
}

/**
 * Fetch all marks for a student across all exams & semesters.
 */
export async function fetchMarksFromSupabase(
  userId: string,
  semester?: number
): Promise<StudentMark[]> {
  if (!isSupabaseConfigured || !supabase) {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${MARKS_CACHE_PREFIX}${userId}`);
      if (stored) {
        try {
          const parsed: StudentMark[] = JSON.parse(stored);
          if (semester) {
            return parsed.filter(m => m.semester === semester);
          }
          return parsed;
        } catch {}
      }
    }
    return [];
  }

  try {
    let query = supabase
      .from('student_marks')
      .select('*')
      .eq('user_id', userId);

    if (semester) {
      query = query.eq('semester', semester);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Supabase fetchMarks error:', error.message);
      return [];
    }

    const marks: StudentMark[] = (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      semester: Number(row.semester),
      subject_code: row.subject_code,
      subject_name: row.subject_name,
      credits: Number(row.credits) || 4,
      exam_type: row.exam_type as ExamType,
      marks: row.marks !== null ? Number(row.marks) : null,
      max_marks: Number(row.max_marks) || 100,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${MARKS_CACHE_PREFIX}${userId}`, JSON.stringify(marks));
    }

    return marks;
  } catch (err) {
    console.warn('Error fetching marks:', err);
    return [];
  }
}

/**
 * Save / Update a single exam mark in Supabase in real-time.
 */
export async function saveSingleMarkInSupabase(
  userId: string,
  semester: number,
  subjectCode: string,
  subjectName: string,
  credits: number,
  examType: ExamType,
  marks: number | null,
  maxMarks: number
): Promise<boolean> {
  const cleanedMarks = marks !== null && !isNaN(marks) ? Math.max(0, Math.min(maxMarks, Number(marks))) : null;

  // Local cache optimistic update
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${MARKS_CACHE_PREFIX}${userId}`);
      const list: StudentMark[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex(
        m => m.semester === semester && m.subject_code === subjectCode && m.exam_type === examType
      );

      const item: StudentMark = {
        user_id: userId,
        semester,
        subject_code: subjectCode,
        subject_name: subjectName,
        credits,
        exam_type: examType,
        marks: cleanedMarks,
        max_marks: maxMarks,
        updated_at: new Date().toISOString(),
      };

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...item };
      } else {
        list.push(item);
      }
      localStorage.setItem(`${MARKS_CACHE_PREFIX}${userId}`, JSON.stringify(list));
    } catch {}
  }

  if (!isSupabaseConfigured || !supabase) return true;

  try {
    const { error } = await supabase
      .from('student_marks')
      .upsert({
        user_id: userId,
        semester,
        subject_code: subjectCode,
        subject_name: subjectName,
        credits,
        exam_type: examType,
        marks: cleanedMarks,
        max_marks: maxMarks,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,semester,subject_code,exam_type',
      });

    if (error) {
      console.warn('Error saving mark to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception saving mark:', err);
    return false;
  }
}

/**
 * Bulk save marks (used by SGPA calculator save button).
 */
export async function saveBulkMarksInSupabase(
  userId: string,
  semester: number,
  marksList: Array<{
    subject_code: string;
    subject_name: string;
    credits: number;
    cae1?: number | null;
    max_cae1: number;
    cae2?: number | null;
    max_cae2: number;
    end_sem?: number | null;
    max_end_sem: number;
  }>
): Promise<boolean> {
  const rowsToUpsert: any[] = [];
  const now = new Date().toISOString();

  for (const item of marksList) {
    // CAE1
    if (item.cae1 !== undefined) {
      rowsToUpsert.push({
        user_id: userId,
        semester,
        subject_code: item.subject_code,
        subject_name: item.subject_name,
        credits: item.credits,
        exam_type: 'CAE1',
        marks: item.cae1 !== null && !isNaN(item.cae1) ? Math.max(0, Math.min(item.max_cae1, Number(item.cae1))) : null,
        max_marks: item.max_cae1,
        updated_at: now,
      });
    }
    // CAE2
    if (item.cae2 !== undefined) {
      rowsToUpsert.push({
        user_id: userId,
        semester,
        subject_code: item.subject_code,
        subject_name: item.subject_name,
        credits: item.credits,
        exam_type: 'CAE2',
        marks: item.cae2 !== null && !isNaN(item.cae2) ? Math.max(0, Math.min(item.max_cae2, Number(item.cae2))) : null,
        max_marks: item.max_cae2,
        updated_at: now,
      });
    }
    // END_SEM
    if (item.end_sem !== undefined) {
      rowsToUpsert.push({
        user_id: userId,
        semester,
        subject_code: item.subject_code,
        subject_name: item.subject_name,
        credits: item.credits,
        exam_type: 'END_SEM',
        marks: item.end_sem !== null && !isNaN(item.end_sem) ? Math.max(0, Math.min(item.max_end_sem, Number(item.end_sem))) : null,
        max_marks: item.max_end_sem,
        updated_at: now,
      });
    }
  }

  if (rowsToUpsert.length === 0) return true;

  if (!isSupabaseConfigured || !supabase) {
    // Update local cache
    return true;
  }

  try {
    const { error } = await supabase
      .from('student_marks')
      .upsert(rowsToUpsert, {
        onConflict: 'user_id,semester,subject_code,exam_type',
      });

    if (error) {
      console.warn('Error bulk saving marks in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception bulk saving marks:', err);
    return false;
  }
}

/**
 * Fetch Semester Results (SGPA and total credits) for a user.
 */
export async function fetchSemesterResultsFromSupabase(
  userId: string
): Promise<SemesterResult[]> {
  if (!isSupabaseConfigured || !supabase) {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`${SEMESTER_RESULTS_CACHE_PREFIX}${userId}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('semester_results')
      .select('*')
      .eq('user_id', userId)
      .order('semester', { ascending: true });

    if (error) {
      console.warn('Supabase fetchSemesterResults error:', error.message);
      return [];
    }

    const results: SemesterResult[] = (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      semester: Number(row.semester),
      sgpa: Number(row.sgpa) || 0.0,
      total_credits: Number(row.total_credits) || 0,
      total_grade_points: Number(row.total_grade_points) || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${SEMESTER_RESULTS_CACHE_PREFIX}${userId}`, JSON.stringify(results));
    }

    return results;
  } catch (err) {
    console.warn('Error fetching semester results:', err);
    return [];
  }
}

/**
 * Save Semester Result (SGPA, total credits, total grade points).
 */
export async function saveSemesterResultInSupabase(
  userId: string,
  semester: number,
  sgpa: number,
  totalCredits: number,
  totalGradePoints: number
): Promise<boolean> {
  const resultItem: SemesterResult = {
    user_id: userId,
    semester,
    sgpa: Math.round(sgpa * 100) / 100,
    total_credits: totalCredits,
    total_grade_points: Math.round(totalGradePoints * 100) / 100,
    updated_at: new Date().toISOString(),
  };

  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${SEMESTER_RESULTS_CACHE_PREFIX}${userId}`);
      const list: SemesterResult[] = stored ? JSON.parse(stored) : [];
      const idx = list.findIndex(r => r.semester === semester);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...resultItem };
      } else {
        list.push(resultItem);
      }
      localStorage.setItem(`${SEMESTER_RESULTS_CACHE_PREFIX}${userId}`, JSON.stringify(list));
    } catch {}
  }

  if (!isSupabaseConfigured || !supabase) return true;

  try {
    const { error } = await supabase
      .from('semester_results')
      .upsert({
        user_id: userId,
        semester,
        sgpa: resultItem.sgpa,
        total_credits: resultItem.total_credits,
        total_grade_points: resultItem.total_grade_points,
        updated_at: resultItem.updated_at,
      }, {
        onConflict: 'user_id,semester',
      });

    if (error) {
      console.warn('Error saving semester result to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception saving semester result:', err);
    return false;
  }
}

/**
 * Build Full Subject Mark Summary for a student's semester.
 * Merges standard curriculum subjects with all saved marks.
 */
export async function getStudentMarksOverview(
  userId: string,
  semester: number,
  collegeId?: string
): Promise<{
  subjects: SubjectMarkSummary[];
  sgpaInfo: ReturnType<typeof calculateSgpa>;
}> {
  const curriculum = getCurriculumForCollegeAndSemester(collegeId, semester);
  const marks = await fetchMarksFromSupabase(userId, semester);

  const subjectSummaries: SubjectMarkSummary[] = curriculum.map(curr => {
    const subMarks = marks.filter(m => m.subject_code === curr.code);
    const cae1Obj = subMarks.find(m => m.exam_type === 'CAE1');
    const cae2Obj = subMarks.find(m => m.exam_type === 'CAE2');
    const endSemObj = subMarks.find(m => m.exam_type === 'END_SEM');

    return computeSubjectMarkSummary(curr, {
      cae1: cae1Obj?.marks ?? null,
      cae2: cae2Obj?.marks ?? null,
      end_sem: endSemObj?.marks ?? null,
    });
  });

  const sgpaInfo = calculateSgpa(subjectSummaries);

  return {
    subjects: subjectSummaries,
    sgpaInfo,
  };
}
