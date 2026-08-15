import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  Calendar, 
  User, 
  HardDrive, 
  Tag,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { ExamPaper } from '../../types';
import { getExamPaperResolvedUrl, triggerPaperDownload } from '../../services/examPapers';
import { formatRelativeTime } from '../../lib/utils';
import { useToast } from '../ui/Toast';

interface ExamPaperViewerModalProps {
  paper: ExamPaper | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ExamPaperViewerModal: React.FC<ExamPaperViewerModalProps> = ({
  paper,
  isOpen,
  onClose,
}) => {
  const { showToast } = useToast();
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (paper && isOpen) {
      setLoading(true);
      setLoadError(false);
      getExamPaperResolvedUrl(paper.file_path)
        .then(url => {
          if (isMounted) {
            setResolvedUrl(url);
            setLoading(false);
          }
        })
        .catch(err => {
          console.warn('Error resolving exam paper url:', err);
          if (isMounted) {
            setLoadError(true);
            setLoading(false);
          }
        });
    } else {
      setResolvedUrl('');
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [paper, isOpen]);

  if (!isOpen || !paper) return null;

  const handleDownload = async () => {
    if (!paper) return;
    setDownloading(true);
    try {
      const ok = await triggerPaperDownload(paper.file_path, paper.file_name || `${paper.title}.pdf`);
      if (ok) {
        showToast('Download Started', `Downloading ${paper.file_name || paper.title}`, 'success');
      } else {
        showToast('Download Error', 'Could not retrieve paper file. Please try again.', 'error');
      }
    } catch (e: any) {
      showToast('Download Failed', e?.message || 'Error occurred', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleOpenExternal = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const formattedSize = paper.file_size
    ? paper.file_size > 1024 * 1024
      ? `${(paper.file_size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(paper.file_size / 1024)} KB`
    : 'Document';

  const isPdf = (paper.file_type?.toLowerCase().includes('pdf') || paper.file_name?.toLowerCase().endsWith('.pdf') || paper.file_path?.toLowerCase().endsWith('.pdf'));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {paper.subject?.code || 'SUBJECT'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {paper.exam_type}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-400 bg-slate-800">
                  {paper.academic_year}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate mt-1">
                {paper.title}
              </h3>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {resolvedUrl && (
              <button
                onClick={handleOpenExternal}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                title="Open in new window"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Open</span>
              </button>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Viewer Canvas */}
        <div className="flex-1 min-h-[360px] sm:min-h-[480px] bg-slate-950 relative flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
              <p className="text-xs font-semibold uppercase tracking-wider">Loading Exam Paper...</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="p-8 text-center max-w-sm text-slate-300">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-white mb-1">Failed to load preview</h4>
              <p className="text-xs text-slate-400 mb-4">
                The document preview couldn't be loaded directly. You can download the file to view on your device.
              </p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Paper</span>
              </button>
            </div>
          )}

          {!loading && !loadError && resolvedUrl && (
            isPdf ? (
              <iframe
                src={`${resolvedUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                title={paper.title}
                className="w-full h-full border-0 min-h-[400px] sm:min-h-[520px]"
              />
            ) : (
              <div className="p-8 text-center max-w-md text-slate-300">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto mb-4 flex items-center justify-center">
                  <FileText className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">{paper.file_name}</h4>
                <p className="text-xs text-slate-400 mb-5">
                  This file format ({paper.file_type || 'Document'}) can be opened after downloading.
                </p>
                <button
                  onClick={handleDownload}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File ({formattedSize})</span>
                </button>
              </div>
            )
          )}
        </div>

        {/* Bottom Details Footer */}
        <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Uploaded by <strong className="text-slate-200">{paper.uploader_profile?.full_name || 'Admin'}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatRelativeTime(paper.created_at)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              <span>{formattedSize}</span>
            </span>
          </div>

          <span className="text-[11px] text-indigo-400 font-mono font-medium">
            FRIEND OS • Exam Archives
          </span>
        </div>

      </div>
    </div>
  );
};
