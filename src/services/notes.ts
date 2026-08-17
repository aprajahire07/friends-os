import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Note, NoteFile } from '../types';

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
          file_type: (f.file_type === 'pdf' || f.storage_path?.toLowerCase().endsWith('.pdf')) ? 'pdf' : 'image',
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
 * Upload files to private Supabase Storage bucket 'notes',
 * insert row in 'notes', and insert child rows in 'note_files'.
 */
export async function createNoteInSupabase(params: {
  caption: string;
  files: { file: File; type: 'image' | 'pdf' }[];
  isPasswordProtected: boolean;
  password?: string;
  uploaderId: string;
}): Promise<{ success: boolean; note?: Note; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not connected.' };
  }

  const { caption, files, isPasswordProtected, password, uploaderId } = params;

  if (!files || files.length === 0) {
    return { success: false, error: 'At least one file (image or PDF) is required.' };
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

    // Step 1: Upload each file to Supabase Storage in private 'notes' bucket
    const uploadedNoteFiles: {
      id: string;
      note_id: string;
      storage_path: string;
      file_name: string;
      file_type: 'image' | 'pdf';
      file_size: number;
      display_order: number;
      created_at: string;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const { file, type } = files[i];
      const fileId = crypto.randomUUID();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${noteId}/${fileId}_${cleanFileName}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('notes')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) {
        console.warn('Storage upload error for note file:', uploadErr);
        // Attempt cleanup of already uploaded files
        for (const uf of uploadedNoteFiles) {
          await supabase.storage.from('notes').remove([uf.storage_path]);
        }
        return { success: false, error: `Failed to upload file ${file.name}: ${uploadErr.message}` };
      }

      uploadedNoteFiles.push({
        id: fileId,
        note_id: noteId,
        storage_path: uploadData?.path || storagePath,
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
        await supabase.storage.from('notes').remove([uf.storage_path]);
      }
      return { success: false, error: `Failed to create note: ${insertNoteErr.message}` };
    }

    // Step 3: Insert into 'note_files' table
    const noteFilesRows = uploadedNoteFiles.map(f => ({
      id: f.id,
      note_id: noteId,
      storage_path: f.storage_path,
      file_name: f.file_name,
      file_type: f.file_type,
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
        await supabase.storage.from('notes').remove([uf.storage_path]);
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
 * Generates an authorized temporary signed URL for viewing an image or PDF from private 'notes' bucket.
 */
export async function getAuthorizedNoteFileUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    // If it's already an absolute http URL (e.g. data or external)
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('blob:') || storagePath.startsWith('data:')) {
      return storagePath;
    }

    const { data, error } = await supabase.storage
      .from('notes')
      .createSignedUrl(storagePath, expiresIn);

    if (error || !data?.signedUrl) {
      console.warn('Failed to generate signed URL for note file:', storagePath, error?.message);
      // Try public url fallback in case bucket is configured with read
      const { data: pub } = supabase.storage.from('notes').getPublicUrl(storagePath);
      return pub?.publicUrl || null;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('Error generating signed URL:', err);
    return null;
  }
}

/**
 * Delete a Note and its associated storage files and database records.
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
      const pathsToRemove = files.map(f => f.storage_path).filter(Boolean);
      if (pathsToRemove.length > 0) {
        await supabase.storage.from('notes').remove(pathsToRemove);
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
