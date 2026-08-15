import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  FileText, 
  Download, 
  Eye, 
  Calendar, 
  Tag, 
  HardDrive, 
  Trash2, 
  Edit3, 
  ArrowLeft, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  GraduationCap,
  Layers,
  ChevronRight,
  ShieldCheck,
  FileCheck
} from 'lucide-react';
import { ExamPaper, ExamSubject, ExamType } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { isUserAdmin } from '../../services/appSettings';
import { EXAM_TYPE_OPTIONS, ACADEMIC_YEAR_OPTIONS, triggerPaperDownload } from '../../services/examPapers';
import { formatRelativeTime } from '../../lib/utils';
import { ExamPaperViewerModal } from './ExamPaperViewerModal';
import { UploadExamPaperModal } from './UploadExamPaperModal';
import { useToast } from '../ui/Toast';

export const ExamPapersView: React.FC = () => {
  useAppStore();
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const isAdmin = currentUser ? isUserAdmin(currentUser) : false;

  const subjects = appStore.examSubjects;
  const allPapers = appStore.examPapers;

  // Selected Subject State (null = All Subjects overview)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Modals state
  const [activeViewerPaper, setActiveViewerPaper] = useState<ExamPaper | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [editingPaper, setEditingPaper] = useState<ExamPaper | null>(null);
  
  // Delete confirmation
  const [deletingPaper, setDeletingPaper] = useState<ExamPaper | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Map subjects with counts
  const subjectsWithCount = useMemo(() => {
    return subjects.map(subj => {
      const count = allPapers.filter(p => p.subject_id === subj.id).length;
      return {
        ...subj,
        papers_count: count,
      };
    });
  }, [subjects, allPapers]);

  // Selected Subject Object
  const currentSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return subjects.find(s => s.id === selectedSubjectId) || null;
  }, [selectedSubjectId, subjects]);

  // Filtered Papers
  const filteredPapers = useMemo(() => {
    return allPapers.filter(paper => {
      // 1. Subject filter
      if (selectedSubjectId && paper.subject_id !== selectedSubjectId) {
        return false;
      }

      // 2. Exam Type filter
      if (selectedExamType !== 'all' && paper.exam_type !== selectedExamType) {
        return false;
      }

      // 3. Academic Year filter
      if (selectedYear !== 'all' && paper.academic_year !== selectedYear) {
        return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const subject = subjects.find(s => s.id === paper.subject_id);
        const matchTitle = paper.title?.toLowerCase().includes(q);
        const matchType = paper.exam_type?.toLowerCase().includes(q);
        const matchYear = paper.academic_year?.toLowerCase().includes(q);
        const matchSubjName = subject?.name.toLowerCase().includes(q);
        const matchSubjCode = subject?.code.toLowerCase().includes(q);
        const matchUploader = paper.uploader_profile?.full_name?.toLowerCase().includes(q);

        return matchTitle || matchType || matchYear || matchSubjName || matchSubjCode || matchUploader;
      }

      return true;
    });
  }, [allPapers, selectedSubjectId, selectedExamType, selectedYear, searchQuery, subjects]);

  const handleDownload = async (paper: ExamPaper) => {
    try {
      const ok = await triggerPaperDownload(paper.file_path, paper.file_name || `${paper.title}.pdf`);
      if (ok) {
        showToast('Download Started', `Downloading ${paper.file_name || paper.title}`, 'success');
      } else {
        showToast('Download Error', 'Could not fetch paper file.', 'error');
      }
    } catch (e: any) {
      showToast('Download Error', e?.message || 'Error occurred', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingPaper) return;
    setIsDeleting(true);
    try {
      const res = await appStore.deleteExamPaper(deletingPaper.id);
      if (res.success) {
        showToast('Paper Deleted', `"${deletingPaper.title}" was removed.`, 'success');
        setDeletingPaper(null);
      } else {
        showToast('Delete Failed', res.error || 'Permission denied.', 'error');
      }
    } catch (e: any) {
      showToast('Delete Error', e?.message || 'Failed to delete', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-100 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  📚 Exam Papers
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {allPapers.length} Total Papers
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Previous papers, question papers and study resources
              </p>
            </div>
          </div>

          {/* Admin Upload Trigger */}
          {isAdmin && (
            <button
              onClick={() => {
                setEditingPaper(null);
                setShowUploadModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Upload Exam Paper</span>
            </button>
          )}
        </div>
      </div>

      {/* SUBJECT CATEGORIES GRID */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Semester Subjects</span>
          </h2>
          {selectedSubjectId && (
            <button
              onClick={() => setSelectedSubjectId(null)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Show All Subjects</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {subjectsWithCount.map((subj) => {
            const isSelected = selectedSubjectId === subj.id;
            return (
              <div
                key={subj.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedSubjectId(null);
                  } else {
                    setSelectedSubjectId(subj.id);
                  }
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between text-left group shadow-lg ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase font-mono tracking-wider ${
                      isSelected
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-800 text-indigo-400 group-hover:bg-indigo-500/20'
                    }`}>
                      {subj.code}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {subj.papers_count} {subj.papers_count === 1 ? 'Paper' : 'Papers'}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                    {subj.name}
                  </h3>
                </div>

                {subj.description && (
                  <p className="text-[10px] text-slate-500 mt-2 line-clamp-1">
                    {subj.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔎 Search exam papers (title, subject, TAE, year)..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Exam Type Filter */}
          <div className="flex items-center gap-2">
            <select
              value={selectedExamType}
              onChange={(e) => setSelectedExamType(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-xs text-slate-300 outline-none transition-colors"
            >
              <option value="all">All Exam Types</option>
              {EXAM_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Academic Year Filter */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-xs text-slate-300 outline-none transition-colors"
            >
              <option value="all">All Years</option>
              {ACADEMIC_YEAR_OPTIONS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedSubjectId || selectedExamType !== 'all' || selectedYear !== 'all' || searchQuery) && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-500">Active Filters:</span>
            
            {currentSubject && (
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                Subject: {currentSubject.code}
                <button onClick={() => setSelectedSubjectId(null)} className="hover:text-white ml-1">✕</button>
              </span>
            )}

            {selectedExamType !== 'all' && (
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                Type: {selectedExamType}
                <button onClick={() => setSelectedExamType('all')} className="hover:text-white ml-1">✕</button>
              </span>
            )}

            {selectedYear !== 'all' && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                Year: {selectedYear}
                <button onClick={() => setSelectedYear('all')} className="hover:text-white ml-1">✕</button>
              </span>
            )}

            {searchQuery && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 flex items-center gap-1">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-white ml-1">✕</button>
              </span>
            )}

            <button
              onClick={() => {
                setSelectedSubjectId(null);
                setSelectedExamType('all');
                setSelectedYear('all');
                setSearchQuery('');
              }}
              className="text-xs text-rose-400 hover:text-rose-300 underline ml-auto"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* PAPERS LIST SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>
              {currentSubject ? `${currentSubject.name} Papers` : 'Available Exam Papers'}
            </span>
          </h2>
          <span className="text-xs font-bold text-slate-500">
            {filteredPapers.length} {filteredPapers.length === 1 ? 'Result' : 'Results'}
          </span>
        </div>

        {/* Empty State */}
        {filteredPapers.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center text-slate-400 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-base font-extrabold text-white mb-1">
              📚 No exam papers yet
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              {currentSubject
                ? `Admin hasn't uploaded any papers for ${currentSubject.name} yet.`
                : 'No exam papers match your current search and filter criteria.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingPaper(null);
                  setShowUploadModal(true);
                }}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 inline-flex items-center gap-2 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Upload First Paper</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPapers.map((paper) => {
              const formattedSize = paper.file_size
                ? paper.file_size > 1024 * 1024
                  ? `${(paper.file_size / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.round(paper.file_size / 1024)} KB`
                : 'PDF';

              const subjectCode = paper.subject?.code || 'GENERAL';

              return (
                <div
                  key={paper.id}
                  className="p-4 sm:p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl group"
                >
                  {/* Left Metadata Block */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-mono tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {subjectCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {paper.exam_type}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-400 bg-slate-950 border border-slate-800">
                          {paper.academic_year}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500 bg-slate-950 border border-slate-800">
                          {formattedSize}
                        </span>
                      </div>

                      {/* Paper Title */}
                      <h3 className="text-sm sm:text-base font-extrabold text-white group-hover:text-indigo-300 transition-colors">
                        {paper.title}
                      </h3>

                      {/* Uploader & Timestamp */}
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>
                          Uploaded by <strong className="text-slate-300">{paper.uploader_profile?.full_name || 'Admin'}</strong>
                        </span>
                        <span>•</span>
                        <span>{formatRelativeTime(paper.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* View Button */}
                    <button
                      onClick={() => setActiveViewerPaper(paper)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>View</span>
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownload(paper)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>

                    {/* Admin Only Edit & Delete Controls */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-800">
                        <button
                          onClick={() => {
                            setEditingPaper(paper);
                            setShowUploadModal(true);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                          title="Edit Paper Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeletingPaper(paper)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete Paper"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PDF / Document Viewer Modal */}
      <ExamPaperViewerModal
        paper={activeViewerPaper}
        isOpen={!!activeViewerPaper}
        onClose={() => setActiveViewerPaper(null)}
      />

      {/* Upload / Edit Modal */}
      <UploadExamPaperModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setEditingPaper(null);
        }}
        editPaper={editingPaper}
        defaultSubjectId={selectedSubjectId || undefined}
      />

      {/* Delete Confirmation Dialog */}
      {deletingPaper && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white">Delete Exam Paper?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-white">"{deletingPaper.title}"</strong>? This will remove the file from storage and database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPaper(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
