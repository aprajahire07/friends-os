import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Lock, 
  Unlock, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  KeyRound,
  ShieldCheck,
  Plus,
  RefreshCw,
  Edit3
} from 'lucide-react';
import { Note, NoteFile } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { useToast } from '../ui/Toast';

interface EditNoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedNote: Note) => void;
}

export const EditNoteModal: React.FC<EditNoteModalProps> = ({ note, isOpen, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [existingFiles, setExistingFiles] = useState<NoteFile[]>([]);
  const [newFiles, setNewFiles] = useState<{ file: File; type: 'image' | 'pdf' | 'document' | string; preview?: string }[]>([]);
  
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordAction, setPasswordAction] = useState<'keep' | 'change'>('keep');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state with incoming note
  useEffect(() => {
    if (note) {
      setCaption(note.caption || '');
      setExistingFiles(note.files || []);
      setNewFiles([]);
      const hasLock = Boolean(note.is_password_protected);
      setIsPasswordProtected(hasLock);
      setPasswordAction(hasLock ? 'keep' : 'change');
      setNewPassword('');
      setErrorMsg(null);
    }
  }, [note, isOpen]);

  if (!isOpen || !note) return null;

  const isOwner = currentUser && (
    note.uploaded_by === currentUser.id ||
    note.uploader_profile?.id === currentUser.id ||
    note.uploader_profile?.email?.toLowerCase() === currentUser.email?.toLowerCase()
  );

  // Admin or Owner can edit
  const canEdit = isOwner || isAdmin;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setErrorMsg(null);
    const addedFiles: typeof newFiles = [];

    Array.from(e.target.files).forEach(f => {
      // 25MB max size per file
      if (f.size > 25 * 1024 * 1024) {
        setErrorMsg(`"${f.name}" is larger than 25MB limit.`);
        return;
      }

      const lowerName = f.name.toLowerCase();
      const ext = lowerName.split('.').pop() || '';
      const mime = f.type.toLowerCase();

      let type: 'image' | 'pdf' | 'document' = 'document';
      if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
        type = 'pdf';
      } else if (
        mime.startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'svg'].includes(ext)
      ) {
        type = 'image';
      }

      const preview = type === 'image' ? URL.createObjectURL(f) : undefined;
      addedFiles.push({ file: f, type, preview });
    });

    setNewFiles(prev => [...prev, ...addedFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeExistingFile = (fileId: string) => {
    setExistingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!canEdit) {
      setErrorMsg('You are not authorized to edit this note.');
      return;
    }

    if (!caption.trim()) {
      setErrorMsg('Please provide a title/caption for the note.');
      return;
    }

    const totalFilesCount = existingFiles.length + newFiles.length;
    if (totalFilesCount === 0) {
      setErrorMsg('A note must have at least one file (image, PDF, or document).');
      return;
    }

    // Password validation logic
    const willKeepExisting = isPasswordProtected && Boolean(note.is_password_protected) && passwordAction === 'keep' && (!newPassword || newPassword.trim().length === 0);

    if (isPasswordProtected && !willKeepExisting && (!newPassword || newPassword.trim().length === 0)) {
      setErrorMsg('Please enter a password to lock this note.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await appStore.updateNote({
        noteId: note.id,
        caption: caption.trim(),
        isPasswordProtected,
        newPassword: (isPasswordProtected && !willKeepExisting) ? newPassword.trim() : undefined,
        keepExistingPassword: willKeepExisting,
        retainedExistingFiles: existingFiles,
        newFiles: newFiles.map(nf => ({ file: nf.file, type: nf.type }))
      });

      if (result.success && result.note) {
        showToast('Note Updated! 📝', `"${caption.trim()}" has been updated for all friends.`, 'success');
        if (onSuccess) onSuccess(result.note);
        onClose();
      } else {
        setErrorMsg(result.error || 'Failed to update note.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalFiles = existingFiles.length + newFiles.length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Edit Group Note</span>
                {isAdmin && !isOwner && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin Edit
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Update title, add/remove files, or change password protection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Note Caption / Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Caption / Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="e.g. DSA Lecture 4 Notes, Calculus Unit 2..."
              disabled={isSubmitting}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Files Management Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Note Files ({totalFiles}) <span className="text-rose-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More Files</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="*/*"
              className="hidden"
            />

            {/* Existing and New Files List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {/* Existing Uploaded Files */}
              {existingFiles.map((f, idx) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-[11px]">{f.file_name}</p>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        Saved • {f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : 'File'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeExistingFile(f.id)}
                    disabled={isSubmitting}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    title="Remove File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Newly Added Pending Files */}
              {newFiles.map((nf, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {nf.preview ? (
                      <img
                        src={nf.preview}
                        alt={nf.file.name}
                        className="w-8 h-8 rounded-lg object-cover bg-slate-950 border border-indigo-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-indigo-200 truncate text-[11px]">{nf.file.name}</p>
                      <span className="text-[10px] text-emerald-400 font-bold">
                        New • {(nf.file.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeNewFile(idx)}
                    disabled={isSubmitting}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                    title="Remove File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {totalFiles === 0 && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl text-center cursor-pointer transition-colors space-y-2 bg-slate-950/40"
                >
                  <Upload className="w-6 h-6 text-indigo-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-300">Click to upload replacement or new files</p>
                  <p className="text-[10px] text-slate-500">Supports JPG, PNG, PDF, TXT, Code, DOC</p>
                </div>
              )}
            </div>
          </div>

          {/* Password Protection Controls */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${isPasswordProtected ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {isPasswordProtected ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Protect with Password</p>
                  <p className="text-[10px] text-slate-400">
                    {isPasswordProtected ? 'Only users with password can view note contents' : 'Open to everyone in the group'}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                checked={isPasswordProtected}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsPasswordProtected(checked);
                  if (checked) {
                    if (note.is_password_protected) {
                      setPasswordAction('keep');
                    } else {
                      setPasswordAction('change');
                    }
                  }
                }}
                disabled={isSubmitting}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {isPasswordProtected && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                {note.is_password_protected && (
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPasswordAction('keep')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                        passwordAction === 'keep'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Keep Current</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasswordAction('change')}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                        passwordAction === 'change'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Set New Password</span>
                    </button>
                  </div>
                )}

                {(!note.is_password_protected || passwordAction === 'change') && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-300">
                        {note.is_password_protected ? 'New Password for Note' : 'Password for Note'}
                      </label>
                      <span className="text-[10px] text-indigo-400">Updates for all users</span>
                    </div>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => {
                          setNewPassword(e.target.value);
                          if (passwordAction !== 'change') setPasswordAction('change');
                        }}
                        placeholder="Type new password..."
                        disabled={isSubmitting}
                        className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {note.is_password_protected && passwordAction === 'keep' && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-950/20 border border-amber-900/30 text-amber-300 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Existing password remains active. Friends who know the old password can still open it.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
