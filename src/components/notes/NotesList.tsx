import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Lock, 
  Unlock, 
  Image as ImageIcon, 
  Calendar, 
  User, 
  ShieldCheck, 
  Trash2, 
  Download, 
  Eye,
  AlertTriangle,
  FolderOpen,
  Filter
} from 'lucide-react';
import { Note } from '../../types';
import { useAppStore, appStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { UploadNoteModal } from './UploadNoteModal';
import { ViewNoteModal } from './ViewNoteModal';
import { useToast } from '../ui/Toast';

export const NotesList: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const currentUser = store.currentUser;
  const isAdmin = isUserAdmin(currentUser);

  const notes = store.notes || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unlocked' | 'protected' | 'mine'>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Custom in-app delete modal state
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered & Searched Notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      // Search term in caption or uploader name
      const matchesSearch = 
        n.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.uploader_profile?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const isMine = currentUser && (
        n.uploaded_by === currentUser.id ||
        n.uploader_profile?.id === currentUser.id ||
        n.uploader_profile?.email?.toLowerCase() === currentUser.email?.toLowerCase()
      );

      if (filterType === 'protected') return n.is_password_protected;
      if (filterType === 'unlocked') return !n.is_password_protected;
      if (filterType === 'mine') return Boolean(isMine);

      return true;
    });
  }, [notes, searchQuery, filterType, currentUser]);

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);

    try {
      const ok = await appStore.deleteNote(noteToDelete.id);
      if (ok) {
        showToast('Note Deleted', `"${noteToDelete.caption}" has been removed.`, 'success');
        if (selectedNote?.id === noteToDelete.id) {
          setSelectedNote(null);
        }
      } else {
        showToast('Delete Failed', 'Could not delete the note. Please try again.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to delete note.', 'error');
    } finally {
      setIsDeleting(false);
      setNoteToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <FileText className="w-48 h-48 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3 text-indigo-400" />
                Shared Group Storage
              </span>
              {isAdmin && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Admin Master Access
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>📚 Group Notes & Study Docs</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Shared study materials, multi-photo lecture notes, and PDF documents visible to your entire friend circle.
            </p>
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 self-start sm:self-center shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>➕ Add Note</span>
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="pt-5 mt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes by title, topic, or friend name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {(
              [
                { id: 'all', label: `All (${notes.length})` },
                { id: 'unlocked', label: 'Open' },
                { id: 'protected', label: 'Password Locked' },
                { id: 'mine', label: 'My Uploads' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  filterType === tab.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-white">No Notes Found</h4>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? 'No notes matched your search query. Try changing search terms.'
                : 'No notes uploaded yet. Be the first to share study notes or PDF materials with your group!'}
            </p>
          </div>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 inline-flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Upload First Note</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(n => {
            const isUnlocked = appStore.isNoteUnlocked(n.id);
            const fileCount = n.files?.length || 0;
            const pdfCount = n.files?.filter(f => f.file_type === 'pdf').length || 0;
            const imgCount = n.files?.filter(f => f.file_type === 'image').length || 0;

            const isOwner = currentUser && (
              n.uploaded_by === currentUser.id ||
              n.uploader_profile?.id === currentUser.id ||
              n.uploader_profile?.email?.toLowerCase() === currentUser.email?.toLowerCase()
            );

            return (
              <div
                key={n.id}
                onClick={() => setSelectedNote(n)}
                className="group p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 transition-all cursor-pointer shadow-lg hover:shadow-indigo-950/20 flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                        {n.caption}
                      </h4>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>By {n.uploader_profile?.full_name?.split(' ')[0] || 'Friend'}</span>
                        <span>•</span>
                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>

                  {/* Lock Indicator */}
                  {n.is_password_protected ? (
                    <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0" title="Password Protected">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-lg bg-slate-800 text-slate-500 shrink-0" title="Open Note">
                      <Unlock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* File breakdown badges */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex items-center gap-1 text-slate-400">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                  </div>

                  {pdfCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/50 text-rose-300 text-[10px] font-bold">
                      {pdfCount} PDF{pdfCount !== 1 ? 's' : ''}
                    </span>
                  )}

                  {imgCount > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-800/50 text-sky-300 text-[10px] font-bold">
                      {imgCount} Photo{imgCount !== 1 ? 's' : ''}
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-1 text-indigo-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>View</span>
                    <Eye className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Note Modal */}
      <UploadNoteModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

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
              <h3 className="text-base font-bold text-white">Delete Group Note?</h3>
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
