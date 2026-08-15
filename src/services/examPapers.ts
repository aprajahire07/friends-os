import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ExamPaper, ExamSubject, ExamType } from '../types';
import { uploadFileToStorage, deleteStorageFile, getResolvedMediaUrl, getSyncMediaUrl } from './storage';
import { FRIEND_OS_ADMIN_EMAIL } from './appSettings';

// The 8 Exact Subject Categories for Current Semester
export const DEFAULT_EXAM_SUBJECTS: Omit<ExamSubject, 'id' | 'created_at'>[] = [
  {
    name: 'Data Structures and Algorithms',
    code: 'DSA',
    description: 'Arrays, linked lists, trees, graphs, sorting, searching & algorithmic complexity analysis',
    order_index: 1,
  },
  {
    name: 'Discrete Mathematics and Graph Theory',
    code: 'DMGT',
    description: 'Set theory, propositional logic, relations, combinatorics, trees & graph theory',
    order_index: 2,
  },
  {
    name: 'Multidisciplinary Minor-1 (Cyber Laws)',
    code: 'CYBER_LAWS',
    description: 'Cyber crimes, Indian IT Act, intellectual property rights & digital ethics',
    order_index: 3,
  },
  {
    name: 'Engineering Economics and Industrial Management',
    code: 'EEIM',
    description: 'Cost estimation, financial viability, project management & organizational strategy',
    order_index: 4,
  },
  {
    name: 'Human Elective',
    code: 'HE',
    description: 'Human values, behavioral psychology, professional ethics & social awareness',
    order_index: 5,
  },
  {
    name: 'Project-1',
    code: 'PROJECT_1',
    description: 'Capstone project planning, architectural specifications & milestone reports',
    order_index: 6,
  },
  {
    name: 'Open Elective-1',
    code: 'OE_1',
    description: 'Interdisciplinary domain coursework, semester problem sets & evaluations',
    order_index: 7,
  },
  {
    name: 'Aptitude',
    code: 'APTITUDE',
    description: 'Quantitative aptitude, logical reasoning, data interpretation & verbal skills',
    order_index: 8,
  },
];

export const EXAM_TYPE_OPTIONS: ExamType[] = [
  'TAE-1',
  'TAE-2',
  'CAE',
  'Mid Semester',
  'End Semester',
  'Unit Test',
  'Class Test',
  'Assignment',
  'Question Bank',
  'Other',
];

export const ACADEMIC_YEAR_OPTIONS = ['2026', '2025-2026', '2025', '2024-2025', '2024'];

/**
 * Fetches all exam subjects from Supabase, seeding the 8 standard categories if table is empty.
 */
export async function fetchExamSubjectsFromSupabase(): Promise<ExamSubject[]> {
  if (!isSupabaseConfigured || !supabase) {
    return DEFAULT_EXAM_SUBJECTS.map((s, idx) => ({
      ...s,
      id: `local-subject-${s.code}`,
      created_at: new Date().toISOString(),
      papers_count: 0
    }));
  }

  try {
    const { data, error } = await supabase
      .from('exam_subjects')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        console.info('Supabase: exam_subjects table not yet created. Using standard semester subjects.');
      } else {
        console.warn('Error fetching exam subjects:', error.message);
      }
      return DEFAULT_EXAM_SUBJECTS.map(s => ({
        ...s,
        id: `local-subject-${s.code}`,
        created_at: new Date().toISOString(),
        papers_count: 0
      }));
    }

    if (!data || data.length === 0) {
      // Attempt auto-seed if we have authenticated connection
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const seeds = DEFAULT_EXAM_SUBJECTS.map(s => ({
            name: s.name,
            code: s.code,
            description: s.description,
            order_index: s.order_index
          }));
          const { data: inserted } = await supabase.from('exam_subjects').insert(seeds).select('*');
          if (inserted && inserted.length > 0) {
            return inserted;
          }
        } catch (e) {
          console.warn('Auto-seed exam_subjects notice:', e);
        }
      }
      return DEFAULT_EXAM_SUBJECTS.map(s => ({
        ...s,
        id: `local-subject-${s.code}`,
        created_at: new Date().toISOString(),
        papers_count: 0
      }));
    }

    return data;
  } catch (err) {
    console.warn('Exam subjects fetch catch:', err);
    return DEFAULT_EXAM_SUBJECTS.map(s => ({
      ...s,
      id: `local-subject-${s.code}`,
      created_at: new Date().toISOString(),
      papers_count: 0
    }));
  }
}

/**
 * Fetches all exam papers from Supabase, joined with subject and uploader profiles.
 */
export async function fetchExamPapersFromSupabase(subjectId?: string): Promise<ExamPaper[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    let query = supabase
      .from('exam_papers')
      .select(`
        *,
        subject:exam_subjects(*),
        uploader_profile:profiles(*)
      `)
      .order('created_at', { ascending: false });

    if (subjectId) {
      query = query.eq('subject_id', subjectId);
    }

    const { data, error } = await query;

    if (error) {
      if (error.message?.includes('does not exist') || error.message?.includes('schema cache')) {
        console.info('Supabase: exam_papers table not yet created.');
      } else {
        console.warn('Notice while fetching exam papers:', error.message);
      }
      return [];
    }

    return (data || []).map(p => ({
      ...p,
      file_size: Number(p.file_size) || 0
    }));
  } catch (err) {
    console.warn('Error fetching exam papers:', err);
    return [];
  }
}

/**
 * Uploads a paper document file to the Supabase Storage bucket 'exam-papers'.
 * Organizes storage cleanly: exam-papers/{subject_code}/{academic_year}/{timestamp}_{safeName}.pdf
 */
export async function uploadExamPaperFile(
  file: File,
  subjectCode: string,
  academicYear: string,
  onProgress?: (percent: number) => void
): Promise<{ storagePath: string; fileName: string; fileType: string; fileSize: number; error?: string }> {
  if (!file) {
    return { storagePath: '', fileName: '', fileType: '', fileSize: 0, error: 'Please choose a file to upload.' };
  }

  const safeSubject = subjectCode ? subjectCode.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : 'GENERAL';
  const safeYear = academicYear ? academicYear.replace(/[^a-zA-Z0-9-]/g, '') : '2026';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const storagePath = `${safeSubject}/${safeYear}/${timestamp}_${randomStr}_${safeName}`;

  if (onProgress) onProgress(20);

  try {
    if (!isSupabaseConfigured || !supabase) {
      const objectUrl = URL.createObjectURL(file);
      if (onProgress) onProgress(100);
      return {
        storagePath: objectUrl,
        fileName: file.name,
        fileType: file.type || 'application/pdf',
        fileSize: file.size
      };
    }

    if (onProgress) onProgress(45);

    const { data, error } = await supabase.storage
      .from('exam-papers')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.warn('Supabase storage upload error in exam-papers:', error.message);
      return {
        storagePath: '',
        fileName: file.name,
        fileType: file.type || 'application/pdf',
        fileSize: file.size,
        error: error.message || 'Storage upload failed. Please verify storage permissions.'
      };
    }

    if (onProgress) onProgress(90);

    return {
      storagePath: data?.path || storagePath,
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      fileSize: file.size
    };
  } catch (err: any) {
    console.error('File upload exception:', err);
    return {
      storagePath: '',
      fileName: file.name,
      fileType: file.type || 'application/pdf',
      fileSize: file.size,
      error: err.message || 'Failed to upload paper file.'
    };
  }
}

/**
 * Creates an exam paper metadata record in Supabase Database.
 * If database insert fails, cleans up the newly uploaded file to avoid orphaned storage data.
 */
export async function createExamPaperInSupabase(paperData: {
  subject_id: string;
  title: string;
  exam_type: string;
  academic_year: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
}): Promise<{ paper?: ExamPaper; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    const localPaper: ExamPaper = {
      id: `local-paper-${Date.now()}`,
      ...paperData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return { paper: localPaper };
  }

  try {
    const { data, error } = await supabase
      .from('exam_papers')
      .insert({
        subject_id: paperData.subject_id,
        title: paperData.title.trim(),
        exam_type: paperData.exam_type,
        academic_year: paperData.academic_year,
        file_path: paperData.file_path,
        file_name: paperData.file_name,
        file_type: paperData.file_type,
        file_size: paperData.file_size,
        uploaded_by: paperData.uploaded_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        subject:exam_subjects(*),
        uploader_profile:profiles(*)
      `)
      .single();

    if (error) {
      console.warn('Error inserting exam paper into database:', error.message);
      // Clean up uploaded file if DB insert failed
      if (paperData.file_path && !paperData.file_path.startsWith('blob:')) {
        await deleteStorageFile('exam-papers', paperData.file_path);
      }
      return { error: error.message || 'Failed to save paper record in database.' };
    }

    return { paper: data };
  } catch (err: any) {
    console.error('Exception in createExamPaperInSupabase:', err);
    if (paperData.file_path && !paperData.file_path.startsWith('blob:')) {
      await deleteStorageFile('exam-papers', paperData.file_path);
    }
    return { error: err.message || 'Network error while creating exam paper.' };
  }
}

/**
 * Updates metadata of an existing exam paper.
 */
export async function updateExamPaperInSupabase(
  paperId: string,
  updates: Partial<{
    title: string;
    exam_type: string;
    academic_year: string;
    subject_id: string;
    file_path: string;
    file_name: string;
    file_type: string;
    file_size: number;
  }>
): Promise<{ paper?: ExamPaper; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Database unconfigured' };
  }

  try {
    const payload: any = {
      ...updates,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('exam_papers')
      .update(payload)
      .eq('id', paperId)
      .select(`
        *,
        subject:exam_subjects(*),
        uploader_profile:profiles(*)
      `)
      .single();

    if (error) {
      return { error: error.message || 'Failed to update exam paper metadata.' };
    }

    return { paper: data };
  } catch (err: any) {
    return { error: err.message || 'Error updating paper.' };
  }
}

/**
 * Deletes an exam paper record from database AND deletes the file from Supabase Storage.
 */
export async function deleteExamPaperInSupabase(
  paperId: string,
  filePath?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  try {
    // 1. Delete record from database
    const { error: dbError } = await supabase
      .from('exam_papers')
      .delete()
      .eq('id', paperId);

    if (dbError) {
      return { success: false, error: dbError.message || 'Failed to delete paper record.' };
    }

    // 2. Delete storage file if path exists
    if (filePath && !filePath.startsWith('blob:') && !filePath.startsWith('http')) {
      await deleteStorageFile('exam-papers', filePath);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error deleting exam paper.' };
  }
}

/**
 * Resolves a paper's file path to an accessible view/download URL.
 */
export async function getExamPaperResolvedUrl(filePath: string): Promise<string> {
  if (!filePath) return '';
  return await getResolvedMediaUrl('exam-papers', filePath, 7200);
}

/**
 * Directly downloads the actual paper file binary from Supabase Storage to user's device.
 */
export async function triggerPaperDownload(filePath: string, fileName: string): Promise<boolean> {
  if (!filePath) return false;

  try {
    const directUrl = await getExamPaperResolvedUrl(filePath);
    if (!directUrl) return false;

    // Fetch the binary blob to guarantee a clean filename download
    const response = await fetch(directUrl);
    if (!response.ok) {
      // Fallback: standard anchor trigger
      const a = document.createElement('a');
      a.href = directUrl;
      a.download = fileName || 'exam-paper.pdf';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'exam-paper.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    console.warn('Download via blob fallback to direct URL:', err);
    const directUrl = getSyncMediaUrl('exam-papers', filePath);
    const a = document.createElement('a');
    a.href = directUrl;
    a.download = fileName || 'exam-paper.pdf';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }
}
