import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Note, NoteFile } from '../types';
import { 
  uploadFileWithBucketRotation, 
  getUniversalStorageUrl, 
  deleteUniversalStorageFile 
} from './storage';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

/**
 * Standard SHA-256 hash using Web Crypto API.
 * Compatible with Supabase Postgres pgcrypto `encode(digest(password, 'sha256'), 'hex')`.
 */
export async function hashNotePassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fetch all shared notes metadata and their note_files.
 * Visible to ALL authorized users in the Friend Group.
 */
export async function fetchNotesFromSupabase(): Promise<Note[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*, note_files(*), uploader_profile:uploaded_by(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchNotes primary error, trying fallback:', error.message);
      // Fallback if join alias differs
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('notes')
        .select('*, note_files(*)')
        .order('created_at', { ascending: false });

      if (fallbackErr) {
        console.warn('Supabase fetchNotes fallback error:', fallbackErr.message);
        return null;
      }
      return mapNotes(fallbackData || []);
    }

    return mapNotes(data || []);
  } catch (err) {
    console.warn('Exception in fetchNotesFromSupabase:', err);
    return null;
  }
}

function mapNotes(data: any[]): Note[] {
  return data.map((n: any) => {
    let files: NoteFile[] = [];
    if (Array.isArray(n.note_files) && n.note_files.length > 0) {
      files = [...n.note_files]
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((f: any, idx: number) => ({
          id: f.id,
          note_id: f.note_id || n.id,
          storage_path: f.storage_path,
          file_name: f.file_name || `file_${idx + 1}`,
          file_type: (f.file_type === 'pdf' || f.storage_path?.toLowerCase().endsWith('.pdf')) 
            ? 'pdf' 
            : (f.file_type === 'document' || f.storage_path?.toLowerCase().endsWith('.txt') || f.file_name?.toLowerCase().endsWith('.txt'))
            ? 'document'
            : (f.file_type || 'image'),
          file_size: f.file_size,
          display_order: f.display_order ?? (idx + 1),
          created_at: f.created_at || n.created_at
        }));
    }

    return {
      id: n.id,
      uploaded_by: n.uploaded_by,
      caption: n.caption || 'Untitled Note',
      is_password_protected: Boolean(n.is_password_protected),
      password_hash: n.password_hash || null,
      created_at: n.created_at || new Date().toISOString(),
      updated_at: n.updated_at,
      files,
      uploader_profile: n.uploader_profile
    };
  });
}

/**
 * Upload files with Automatic Multi-Bucket Rotation & Fallback,
 * inserts row in 'notes', and inserts child rows in 'note_files'.
 * Never fails on "bucket not found" or "50mb quota full" as it rotates to next available bucket!
 */
export async function createNoteInSupabase(params: {
  caption: string;
  files: { file: File; type: 'image' | 'pdf' | 'document' | string }[];
  isPasswordProtected: boolean;
  password?: string;
  uploaderId: string;
}): Promise<{ success: boolean; note?: Note; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not connected.' };
  }

  const { caption, files, isPasswordProtected, password, uploaderId } = params;

  if (!files || files.length === 0) {
    return { success: false, error: 'At least one file is required.' };
  }

  if (isPasswordProtected && (!password || password.trim().length === 0)) {
    return { success: false, error: 'Password is required for protected notes.' };
  }

  try {
    const noteId = crypto.randomUUID();
    let passwordHash: string | null = null;

    if (isPasswordProtected && password) {
      passwordHash = await hashNotePassword(password.trim());
    }

    // Step 1: Upload each file with Multi-Bucket Rotation
    const uploadedNoteFiles: {
      id: string;
      note_id: string;
      storage_path: string;
      file_name: string;
      file_type: 'image' | 'pdf' | 'document' | string;
      file_size: number;
      display_order: number;
      created_at: string;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const { file, type } = files[i];
      const fileId = crypto.randomUUID();

      const uploadResult = await uploadFileWithBucketRotation('notes', file, uploaderId);

      if (!uploadResult.storagePath) {
        // Attempt cleanup of already uploaded files
        for (const uf of uploadedNoteFiles) {
          await deleteUniversalStorageFile(uf.storage_path, 'notes');
        }
        return { 
          success: false, 
          error: uploadResult.error || `Failed to upload file "${file.name}".` 
        };
      }

      uploadedNoteFiles.push({
        id: fileId,
        note_id: noteId,
        storage_path: uploadResult.storagePath,
        file_name: file.name,
        file_type: type,
        file_size: file.size,
        display_order: i + 1,
        created_at: new Date().toISOString()
      });
    }

    // Step 2: Insert into 'notes' table
    const noteRow = {
      id: noteId,
      uploaded_by: uploaderId,
      caption: caption.trim(),
      is_password_protected: isPasswordProtected,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertNoteErr } = await supabase
      .from('notes')
      .insert(noteRow);

    if (insertNoteErr) {
      console.warn('Failed to insert note record:', insertNoteErr);
      // Cleanup uploaded files
      for (const uf of uploadedNoteFiles) {
        await deleteUniversalStorageFile(uf.storage_path, 'notes');
      }
      return { success: false, error: `Failed to create note: ${insertNoteErr.message}` };
    }

    // Step 3: Insert into 'note_files' table (ensures check constraint compatibility with existing schemas)
    const noteFilesRows = uploadedNoteFiles.map(f => ({
      id: f.id,
      note_id: noteId,
      storage_path: f.storage_path,
      file_name: f.file_name,
      // Database check constraint allows 'image' or 'pdf'. Non-images fallback to 'pdf' in DB column without issue.
      file_type: f.file_type === 'image' ? 'image' : 'pdf',
      file_size: f.file_size,
      display_order: f.display_order,
      created_at: f.created_at
    }));

    const { error: insertFilesErr } = await supabase
      .from('note_files')
      .insert(noteFilesRows);

    if (insertFilesErr) {
      console.warn('Failed to insert note_files records:', insertFilesErr);
      // Cleanup
      await supabase.from('notes').delete().eq('id', noteId);
      for (const uf of uploadedNoteFiles) {
        await deleteUniversalStorageFile(uf.storage_path, 'notes');
      }
      return { success: false, error: `Failed to save note files: ${insertFilesErr.message}` };
    }

    const createdNote: Note = {
      ...noteRow,
      files: uploadedNoteFiles
    };

    return { success: true, note: createdNote };
  } catch (err: any) {
    console.error('createNoteInSupabase error:', err);
    return { success: false, error: err?.message || 'Failed to upload note.' };
  }
}

/**
 * Verify password for a protected note via RPC or secure hash check.
 */
export async function verifyNotePasswordInSupabase(noteId: string, passwordAttempt: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    const inputHash = await hashNotePassword(passwordAttempt.trim());

    // 1. Try server-side RPC if available
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('verify_note_password', {
      p_note_id: noteId,
      p_password_hash: inputHash
    });

    if (!rpcErr && typeof rpcResult === 'boolean') {
      return rpcResult;
    }

    // 2. Fallback: query note row directly to compare hash securely
    const { data, error } = await supabase
      .from('notes')
      .select('password_hash, is_password_protected')
      .eq('id', noteId)
      .maybeSingle();

    if (error || !data) return false;
    if (!data.is_password_protected) return true;

    return data.password_hash === inputHash;
  } catch (err) {
    console.warn('Error in verifyNotePasswordInSupabase:', err);
    return false;
  }
}

/**
 * Generates an authorized temporary signed URL for viewing an image or PDF from any bucket.
 * Universal resolver handles bucket prefixing (`bucket::path`) and automatic bucket fallback.
 */
export async function getAuthorizedNoteFileUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  if (!storagePath) return null;
  return getUniversalStorageUrl(storagePath, 'notes', expiresIn);
}

/**
 * Update an existing Note in Supabase.
 * Supports updating caption, modifying password, deleting discarded files, and uploading new files.
 */
export async function updateNoteInSupabase(params: {
  noteId: string;
  caption: string;
  isPasswordProtected: boolean;
  newPassword?: string;
  keepExistingPassword?: boolean;
  retainedExistingFiles: NoteFile[];
  newFiles: { file: File; type: 'image' | 'pdf' | 'document' | string }[];
  userId: string;
}): Promise<{ success: boolean; note?: Note; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase is not configured' };
  }

  const {
    noteId,
    caption,
    isPasswordProtected,
    newPassword,
    keepExistingPassword,
    retainedExistingFiles,
    newFiles,
    userId
  } = params;

  try {
    // 1. Fetch current note to check existing password hash and current files
    const { data: currentNoteData, error: currentNoteErr } = await supabase
      .from('notes')
      .select('*, note_files(*)')
      .eq('id', noteId)
      .single();

    if (currentNoteErr || !currentNoteData) {
      return { success: false, error: 'Note not found in database.' };
    }

    let passwordHash: string | null = null;
    if (isPasswordProtected) {
      if (keepExistingPassword && currentNoteData.password_hash) {
        passwordHash = currentNoteData.password_hash;
      } else if (newPassword && newPassword.trim().length > 0) {
        passwordHash = await hashNotePassword(newPassword.trim());
      } else {
        passwordHash = currentNoteData.password_hash || null;
      }
    }

    // 2. Identify and remove discarded files
    const retainedIds = new Set(retainedExistingFiles.map(f => f.id));
    const currentFiles: NoteFile[] = currentNoteData.note_files || [];
    const filesToDelete = currentFiles.filter(f => !retainedIds.has(f.id));

    for (const f of filesToDelete) {
      if (f.storage_path) {
        await deleteUniversalStorageFile(f.storage_path, 'notes');
      }
      await supabase.from('note_files').delete().eq('id', f.id);
    }

    // 3. Upload any new files
    const newlyUploadedFiles: NoteFile[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const { file, type } = newFiles[i];
      const fileId = crypto.randomUUID();

      const uploadResult = await uploadFileWithBucketRotation('notes', file, userId);

      if (!uploadResult.storagePath) {
        throw new Error(uploadResult.error || `Failed to upload ${file.name}`);
      }

      const newFileObj: NoteFile = {
        id: fileId,
        note_id: noteId,
        storage_path: uploadResult.storagePath,
        file_name: file.name,
        file_type: type,
        file_size: file.size,
        display_order: retainedExistingFiles.length + i + 1,
        created_at: new Date().toISOString()
      };

      newlyUploadedFiles.push(newFileObj);

      // Insert DB record for this file
      await supabase.from('note_files').insert({
        id: newFileObj.id,
        note_id: noteId,
        storage_path: newFileObj.storage_path,
        file_name: newFileObj.file_name,
        file_type: newFileObj.file_type === 'image' ? 'image' : 'pdf',
        file_size: newFileObj.file_size,
        display_order: newFileObj.display_order,
        created_at: newFileObj.created_at
      });
    }

    // 4. Update parent note record
    const updatedPayload = {
      caption,
      is_password_protected: isPasswordProtected,
      password_hash: passwordHash,
      updated_at: new Date().toISOString()
    };

    const { data: updatedNoteRow, error: updateErr } = await supabase
      .from('notes')
      .update(updatedPayload)
      .eq('id', noteId)
      .select('*, uploader_profile:uploaded_by(*)')
      .single();

    if (updateErr) {
      console.warn('Failed to update note parent record:', updateErr);
      return { success: false, error: updateErr.message };
    }

    const allCombinedFiles = [...retainedExistingFiles, ...newlyUploadedFiles];
    const finalNote: Note = {
      ...(updatedNoteRow || currentNoteData),
      ...updatedPayload,
      files: allCombinedFiles
    };

    return { success: true, note: finalNote };
  } catch (err: any) {
    console.error('updateNoteInSupabase error:', err);
    return { success: false, error: err?.message || 'Failed to update note.' };
  }
}

/**
 * Delete a Note and its associated storage files and database records across all buckets.
 */
export async function deleteNoteFromSupabase(noteId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;

  try {
    // 1. Fetch file storage paths to clean up from storage
    const { data: files } = await supabase
      .from('note_files')
      .select('storage_path')
      .eq('note_id', noteId);

    if (files && files.length > 0) {
      for (const f of files) {
        if (f.storage_path) {
          await deleteUniversalStorageFile(f.storage_path, 'notes');
        }
      }
    }

    // 2. Delete child records from note_files
    await supabase.from('note_files').delete().eq('note_id', noteId);

    // 3. Delete parent note
    const { error } = await supabase.from('notes').delete().eq('id', noteId);

    if (error) {
      console.warn('Error deleting note:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Exception deleting note from Supabase:', err);
    return false;
  }
}
