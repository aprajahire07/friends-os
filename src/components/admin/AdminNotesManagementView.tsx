import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Trash2, 
  Eye, 
  Search, 
  AlertTriangle,
  FolderOpen,
  User,
  Calendar,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Note } from '../../types';
import { useAppStore, appStore } from '../../lib/store';
import { ViewNoteModal } from '../notes/ViewNoteModal';
import { useToast } from '../ui/Toast';

export const AdminNotesManagementView: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const notes = store.notes || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'protected' | 'open'>('all');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // In-app delete confirmation state
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchSearch = 
        n.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.uploader_profile?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.uploader_profile?.email || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterType === 'protected') return n.is_password_protected;
      if (filterType === 'open') return !n.is_password_protected;
      return true;
    });
  }, [notes, searchQuery, filterType]);

  // Statistics
  const totalNotes = notes.length;
  const protectedCount = notes.filter(n => n.is_password_protected).length;
  const totalFiles = notes.reduce((acc, n) => acc + (n.files?.length || 0), 0);
  const totalPdfs = notes.reduce((acc, n) => acc + (n.files?.filter(f => f.file_type === 'pdf').length || 0), 0);
  const totalImages = notes.reduce((acc, n) => acc + (n.files?.filter(f => f.file_type === 'image').length || 0), 0);

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);

    try {
      const ok = await appStore.deleteNote(noteToDelete.id);
      if (ok) {
        showToast('Admin Delete Success', `"${noteToDelete.caption}" permanently removed.`, 'success');
        if (selectedNote?.id === noteToDelete.id) {
          setSelectedNote(null);
        }
      } else {
        showToast('Delete Failed', 'Could not delete the note.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to delete note.', 'error');
    } finally {
      setIsDeleting(false);
      setNoteToDelete(null);
    }
  };

  const handleOpenMasterAccess = (note: Note) => {
    // Automatically unlocks for Admin in current session via master clearance
    appStore.unlockNoteAsAdmin(note.id);
    setSelectedNote(note);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider border border-indigo-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Master Authority
            </span>
          </div>
          <h3 className="text-lg font-black text-white mt-1 flex items-center gap-2">
            <span>👑 Notes Master Access & Management</span>
          </h3>
          <p className="text-xs text-slate-400">
            Inspect all group uploaded notes, review protection statuses, and open any note with administrative Master Access.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Total Notes</p>
          <p className="text-2xl font-black text-white mt-1">{totalNotes}</p>
          <p className="text-[10px] text-indigo-400 font-medium mt-0.5">In group storage</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Password Protected</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{protectedCount}</p>
          <p className="text-[10px] text-amber-400/80 font-medium mt-0.5">Encrypted hash</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Attached Files</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{totalFiles}</p>
          <p className="text-[10px] text-emerald-400/80 font-medium mt-0.5">{totalPdfs} PDFs • {totalImages} Images</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
          <p className="text-[11px] font-bold text-slate-400 uppercase">Master Access</p>
          <p className="text-2xl font-black text-cyan-400 mt-1">ACTIVE</p>
          <p className="text-[10px] text-cyan-400/80 font-medium mt-0.5">Instant unlock clearance</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by note title, author name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(
            [
              { id: 'all', label: `All (${totalNotes})` },
              { id: 'protected', label: `Protected (${protectedCount})` },
              { id: 'open', label: `Open (${totalNotes - protectedCount})` },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes List / Table */}
      {filteredNotes.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
          <FolderOpen className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">No notes found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map(n => {
            const fileCount = n.files?.length || 0;
            const pdfCount = n.files?.filter(f => f.file_type === 'pdf').length || 0;
            const imgCount = n.files?.filter(f => f.file_type === 'image').length || 0;

            return (
              <div
                key={n.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Note Details */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-white truncate">{n.caption}</h4>
                    {n.is_password_protected ? (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Password Protected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> Open Access
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 text-indigo-300">
                      <User className="w-3.5 h-3.5" />
                      <span>{n.uploader_profile?.full_name || 'Friend'} ({n.uploader_profile?.email || 'Unknown'})</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-300">
                      {fileCount} file{fileCount !== 1 ? 's' : ''} ({pdfCount} PDFs, {imgCount} Images)
                    </span>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleOpenMasterAccess(n)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                    title="Open with Master Access"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                    <span>👑 Master Open</span>
                  </button>

                  <button
                    onClick={() => setNoteToDelete(n)}
                    className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/50 text-rose-400 hover:text-rose-300 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Note Modal */}
      <ViewNoteModal
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onDeleteNote={note => setNoteToDelete(note)}
      />

      {/* Custom In-App Delete Confirmation Modal (Iframe Safe) */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-slate-900 border border-rose-900/40 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Admin Delete Group Note?</h3>
              <p className="text-xs text-slate-300">
                Are you sure you want to permanently delete <span className="font-bold text-white">"{noteToDelete.caption}"</span> and all attached files from group storage?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Deleting...' : 'Delete Note'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
