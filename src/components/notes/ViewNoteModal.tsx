import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  FileText, 
  Image as ImageIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ExternalLink, 
  Calendar, 
  User, 
  Trash2, 
  ShieldCheck, 
  KeyRound, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Note, NoteFile } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { getAuthorizedNoteFileUrl } from '../../services/notes';
import { useToast } from '../ui/Toast';

interface ViewNoteModalProps {
  note: Note | null;
  onClose: () => void;
  onDeleteNote: (note: Note) => void;
}

export const ViewNoteModal: React.FC<ViewNoteModalProps> = ({ note, onClose, onDeleteNote }) => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // Cache signed URLs for private storage files
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);

  const isUnlocked = note ? appStore.isNoteUnlocked(note.id) : false;
  const files = note?.files || [];
  const currentFile = files[activeFileIndex];

  // Resolve signed URLs whenever note is unlocked
  useEffect(() => {
    let mounted = true;
    if (!note || !isUnlocked || files.length === 0) return;

    async function loadUrls() {
      setIsLoadingUrls(true);
      const urlMap: Record<string, string> = {};

      for (const f of files) {
        try {
          const url = await getAuthorizedNoteFileUrl(f.storage_path);
          if (url && mounted) {
            urlMap[f.id] = url;
          }
        } catch (e) {
          console.warn('Failed loading url for file:', f.file_name, e);
        }
      }

      if (mounted) {
        setFileUrls(urlMap);
        setIsLoadingUrls(false);
      }
    }

    loadUrls();
    return () => { mounted = false; };
  }, [note?.id, isUnlocked, files.length]);

  if (!note) return null;

  const isOwner = currentUser && (
    note.uploaded_by === currentUser.id ||
    note.uploader_profile?.id === currentUser.id ||
    note.uploader_profile?.email?.toLowerCase() === currentUser.email?.toLowerCase()
  );

  const canDelete = isOwner || isAdmin;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    if (!passwordInput.trim()) {
      setUnlockError('Please enter password.');
      return;
    }

    setIsVerifying(true);
    try {
      const ok = await appStore.verifyAndUnlockNote(note.id, passwordInput.trim());
      if (ok) {
        showToast('Note Unlocked! 🔓', 'Access granted for this session.', 'success');
        setPasswordInput('');
      } else {
        setUnlockError('Incorrect password. Access denied.');
      }
    } catch (err: any) {
      setUnlockError(err?.message || 'Verification error.');
    } finally {
      setIsVerifying(false);
    }
  };

  const currentFileUrl = currentFile ? fileUrls[currentFile.id] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Top Navigation Bar */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>{note.caption}</span>
                {note.is_password_protected && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1 shrink-0">
                    <Lock className="w-3 h-3" /> Protected
                  </span>
                )}
                {isAdmin && note.is_password_protected && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30 flex items-center gap-1 shrink-0">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" /> Master Access
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span>By {note.uploader_profile?.full_name || 'Group Friend'}</span>
                <span>•</span>
                <span>{new Date(note.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canDelete && (
              <button
                onClick={() => onDeleteNote(note)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                title="Delete Note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-slate-950 flex flex-col items-center justify-center p-4 min-h-[340px]">
          {!isUnlocked ? (
            /* Locked State Screen */
            <div className="max-w-md w-full p-6 bg-slate-900 border border-amber-900/40 rounded-3xl text-center space-y-4 shadow-xl my-auto">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center shadow-lg">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">This Note is Password Protected</h4>
                <p className="text-xs text-slate-400 mt-1">
                  The uploader has locked the file contents of this note. Enter the password below to unlock and view.
                </p>
              </div>

              {unlockError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <form onSubmit={handleUnlock} className="space-y-3 pt-2">
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    placeholder="Enter Note password..."
                    disabled={isVerifying}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Unlock Note</span>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Unlocked File Viewer */
            <div className="w-full h-full flex flex-col justify-between">
              {/* Active File Display */}
              <div className="relative w-full flex-1 flex items-center justify-center min-h-[320px] max-h-[55vh] overflow-hidden bg-slate-950 rounded-2xl border border-slate-800/60 p-2">
                {isLoadingUrls ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs">Loading secure files...</span>
                  </div>
                ) : currentFile ? (
                  currentFile.file_type === 'pdf' ? (
                    <div className="p-8 text-center space-y-4 max-w-md">
                      <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto shadow-xl">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white break-all">{currentFile.file_name}</h4>
                        <p className="text-xs text-slate-400 mt-1">
                          PDF Document • {(currentFile.file_size ? (currentFile.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'Standard')}
                        </p>
                      </div>

                      {currentFileUrl && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                          <a
                            href={currentFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Open PDF in New Tab</span>
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <img
                      src={currentFileUrl || ''}
                      alt={currentFile.file_name}
                      className="max-w-full max-h-[54vh] object-contain rounded-lg"
                    />
                  )
                ) : (
                  <p className="text-xs text-slate-500">No files found for this note.</p>
                )}

                {/* Left / Right Carousel Controls */}
                {files.length > 1 && (
                  <>
                    {activeFileIndex > 0 && (
                      <button
                        onClick={() => setActiveFileIndex(prev => prev - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 text-white hover:bg-indigo-600 border border-white/10 transition-all shadow-lg active:scale-95"
                        title="Previous File"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    {activeFileIndex < files.length - 1 && (
                      <button
                        onClick={() => setActiveFileIndex(prev => prev + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 text-white hover:bg-indigo-600 border border-white/10 transition-all shadow-lg active:scale-95"
                        title="Next File"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Thumbnail / File Strip */}
              {files.length > 1 && (
                <div className="mt-3 px-2 py-2 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-2 overflow-x-auto">
                  {files.map((f, idx) => {
                    const isSelected = activeFileIndex === idx;
                    const url = fileUrls[f.id];

                    return (
                      <button
                        key={f.id}
                        onClick={() => setActiveFileIndex(idx)}
                        className={`relative p-1.5 rounded-xl border-2 shrink-0 flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-slate-950 shadow-md ring-2 ring-indigo-500/20'
                            : 'border-slate-800 opacity-60 hover:opacity-100 bg-slate-950/50'
                        }`}
                      >
                        {f.file_type === 'pdf' ? (
                          <div className="w-10 h-10 rounded-lg bg-rose-950/60 text-rose-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        ) : (
                          <img
                            src={url || ''}
                            alt={f.file_name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                          />
                        )}
                        <div className="text-left pr-1 max-w-[100px]">
                          <p className="text-[11px] font-bold text-white truncate">{f.file_name}</p>
                          <p className="text-[9px] text-slate-400 uppercase font-mono">{f.file_type}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
