import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Tag, 
  BookOpen,
  Paperclip
} from 'lucide-react';
import { ExamPaper, ExamSubject } from '../../types';
import { appStore, useAppStore } from '../../lib/store';
import { EXAM_TYPE_OPTIONS, ACADEMIC_YEAR_OPTIONS, uploadExamPaperFile } from '../../services/examPapers';
import { validateFile } from '../../services/storage';
import { useToast } from '../ui/Toast';

interface UploadExamPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  editPaper?: ExamPaper | null;
  defaultSubjectId?: string;
}

export const UploadExamPaperModal: React.FC<UploadExamPaperModalProps> = ({
  isOpen,
  onClose,
  editPaper,
  defaultSubjectId,
}) => {
  useAppStore();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subjects = appStore.examSubjects;

  const [subjectId, setSubjectId] = useState<string>(
    editPaper?.subject_id || defaultSubjectId || (subjects[0]?.id || '')
  );
  const [examType, setExamType] = useState<string>(editPaper?.exam_type || 'TAE-1');
  const [title, setTitle] = useState<string>(editPaper?.title || '');
  const [academicYear, setAcademicYear] = useState<string>(editPaper?.academic_year || '2026');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (editPaper) {
      setSubjectId(editPaper.subject_id);
      setExamType(editPaper.exam_type);
      setTitle(editPaper.title);
      setAcademicYear(editPaper.academic_year);
      setSelectedFile(null);
      setFileError(null);
    } else {
      if (defaultSubjectId) {
        setSubjectId(defaultSubjectId);
      } else if (subjects.length > 0 && !subjectId) {
        setSubjectId(subjects[0].id);
      }
      setExamType('TAE-1');
      setTitle('');
      setAcademicYear('2026');
      setSelectedFile(null);
      setFileError(null);
    }
    setUploadStatus('idle');
    setProgressPercent(0);
    setErrorMessage('');
  }, [editPaper, defaultSubjectId, isOpen, subjects]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const validation = validateFile(file, 'document');
    if (!validation.valid) {
      setFileError(validation.error || 'Invalid file. Please select a valid document (PDF, DOCX).');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Auto-fill title if empty
    if (!title && !editPaper) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-\s]+/g, ' ');
      setTitle(`${examType} — ${cleanName}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectId) {
      showToast('Subject Required', 'Please select a subject category.', 'warning');
      return;
    }

    if (!title.trim()) {
      showToast('Title Required', 'Please enter a title for the exam paper.', 'warning');
      return;
    }

    if (!editPaper && !selectedFile) {
      setFileError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setProgressPercent(10);
    setErrorMessage('');

    try {
      if (editPaper) {
        // Edit Mode
        let filePath = editPaper.file_path;
        let fileName = editPaper.file_name;
        let fileType = editPaper.file_type;
        let fileSize = editPaper.file_size;

        if (selectedFile) {
          const subject = appStore.examSubjects.find(s => s.id === subjectId);
          const uploadRes = await uploadExamPaperFile(
            selectedFile,
            subject?.code || 'GENERAL',
            academicYear,
            (pct) => setProgressPercent(pct)
          );
          if (uploadRes.error || !uploadRes.storagePath) {
            setUploadStatus('error');
            setErrorMessage(uploadRes.error || 'Failed to upload new document file.');
            return;
          }
          filePath = uploadRes.storagePath;
          fileName = uploadRes.fileName || selectedFile.name;
          fileType = uploadRes.fileType || selectedFile.type;
          fileSize = uploadRes.fileSize || selectedFile.size;
        }

        const res = await appStore.updateExamPaper(
          editPaper.id,
          {
            title: title.trim(),
            exam_type: examType,
            academic_year: academicYear,
            subject_id: subjectId,
            ...(selectedFile ? { file_path: filePath, file_name: fileName, file_type: fileType, file_size: fileSize } : {})
          }
        );

        if (res.success) {
          setProgressPercent(100);
          setUploadStatus('success');
          showToast('Paper Updated!', `"${title}" has been updated successfully.`, 'success');
          setTimeout(() => {
            onClose();
          }, 600);
        } else {
          setUploadStatus('error');
          setErrorMessage(res.error || 'Failed to update paper.');
          showToast('Update Failed', res.error || 'Check network connection.', 'error');
        }
      } else {
        // Upload New Mode
        if (!selectedFile) return;

        const res = await appStore.uploadExamPaper(
          selectedFile,
          subjectId,
          title.trim(),
          examType,
          academicYear,
          (pct) => setProgressPercent(pct)
        );

        if (res.success) {
          setProgressPercent(100);
          setUploadStatus('success');
          showToast('Paper Uploaded!', `"${title}" is now available for the group.`, 'success');
          setTimeout(() => {
            onClose();
          }, 700);
        } else {
          setUploadStatus('error');
          setErrorMessage(res.error || 'Failed to upload paper.');
          showToast('Upload Failed', res.error || 'Check Supabase permissions.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Upload paper error:', err);
      setUploadStatus('error');
      setErrorMessage(err?.message || 'Unexpected upload error.');
    } finally {
      setIsUploading(false);
    }
  };

  const selectedSubject = subjects.find(s => s.id === subjectId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 shadow-inner">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">
              {editPaper ? 'Edit Exam Paper' : 'Upload Exam Paper'}
            </h3>
            <p className="text-xs text-slate-400">
              {editPaper ? 'Update metadata or replace document' : 'Add previous question paper or study resource'}
            </p>
          </div>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Subject Category</span>
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={isUploading}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-xs text-white outline-none transition-colors"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  [{s.code}] {s.name}
                </option>
              ))}
            </select>
            {selectedSubject?.description && (
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                {selectedSubject.description}
              </p>
            )}
          </div>

          {/* Exam Type & Academic Year Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-violet-400" />
                <span>Exam Type</span>
              </label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                disabled={isUploading}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-xs text-white outline-none transition-colors"
              >
                {EXAM_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type} className="bg-slate-900 text-white">
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Academic Year</span>
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                disabled={isUploading}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-3 py-2.5 text-xs text-white outline-none transition-colors"
              >
                {ACADEMIC_YEAR_OPTIONS.map((yr) => (
                  <option key={yr} value={yr} className="bg-slate-900 text-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paper Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Paper Name / Title</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. TAE-1 Question Paper (Session 2026)"
              disabled={isUploading}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none transition-colors"
            />
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-pink-400" />
                <span>{editPaper ? 'Replace Document (Optional)' : 'Document File (PDF / DOCX)'}</span>
              </span>
              <span className="text-[10px] text-slate-500">Max 35MB</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all text-center ${
                selectedFile
                  ? 'border-indigo-500/60 bg-indigo-500/5'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
              }`}
            >
              {selectedFile ? (
                <div className="flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-bold px-2 py-1 rounded-lg bg-indigo-500/10">
                    Change
                  </span>
                </div>
              ) : editPaper ? (
                <div className="py-2">
                  <p className="text-xs font-medium text-slate-300">
                    Current: <span className="text-indigo-400 font-mono">{editPaper.file_name}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Click here if you want to upload a replacement file</p>
                </div>
              ) : (
                <div className="py-3 flex flex-col items-center gap-1.5">
                  <Upload className="w-6 h-6 text-slate-500" />
                  <p className="text-xs font-bold text-slate-300">Choose document from device</p>
                  <p className="text-[10px] text-slate-500">PDF, DOC, DOCX, PPTX supported</p>
                </div>
              )}
            </div>

            {fileError && (
              <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fileError}</span>
              </p>
            )}
          </div>

          {/* Progress Bar & Status */}
          {uploadStatus === 'uploading' && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-indigo-400 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading to Supabase Storage...</span>
                </span>
                <span className="text-white">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>✅ Paper uploaded and synchronized successfully</span>
            </div>
          )}

          {uploadStatus === 'error' && errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Modal Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isUploading || uploadStatus === 'success'}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{editPaper ? 'Save Changes' : 'Upload Paper'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
