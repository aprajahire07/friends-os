import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Lock, 
  Unlock, 
  AlertCircle, 
  Loader2, 
  Trash2,
  Plus
} from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface UploadNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedFileItem {
  id: string;
  file: File;
  type: 'image' | 'pdf';
  previewUrl?: string;
}

export const UploadNoteModal: React.FC<UploadNoteModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [caption, setCaption] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const filesArray: File[] = Array.from(e.target.files);
    const newItems: SelectedFileItem[] = [];

    for (const f of filesArray) {
      // Validation: Size limit 25MB per file
      if (f.size > 25 * 1024 * 1024) {
        setErrorMsg(`"${f.name}" exceeds the 25MB size limit.`);
        continue;
      }

      const lowerName = f.name.toLowerCase();
      const mime = f.type.toLowerCase();

      let type: 'image' | 'pdf' | null = null;
      if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
        type = 'pdf';
      } else if (
        mime.startsWith('image/') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.webp')
      ) {
        type = 'image';
      }

      if (!type) {
        setErrorMsg(`"${f.name}" is not a supported file type. Only JPG, PNG, WEBP, and PDF are allowed.`);
        continue;
      }

      const previewUrl = type === 'image' ? URL.createObjectURL(f) : undefined;
      newItems.push({
        id: crypto.randomUUID(),
        file: f,
        type,
        previewUrl
      });
    }

    setSelectedFiles(prev => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => {
      const removed = prev.find(item => item.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleClearAll = () => {
    selectedFiles.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setSelectedFiles([]);
    setCaption('');
    setIsPasswordProtected(false);
    setPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!caption.trim()) {
      setErrorMsg('Please enter a caption or title for the Note.');
      return;
    }

    if (selectedFiles.length === 0) {
      setErrorMsg('Please select at least one image or PDF document.');
      return;
    }

    if (isPasswordProtected) {
      if (!password || password.trim().length === 0) {
        setErrorMsg('Please enter a password to protect this note.');
        return;
      }
      if (password.length < 3) {
        setErrorMsg('Password is too short (minimum 3 characters required).');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setIsUploading(true);
    try {
      const payloadFiles = selectedFiles.map(item => ({
        file: item.file,
        type: item.type
      }));

      const res = await appStore.addNote({
        caption: caption.trim(),
        files: payloadFiles,
        isPasswordProtected,
        password: isPasswordProtected ? password.trim() : undefined
      });

      if (res.success) {
        showToast(
          'Note Uploaded! 📚',
          `"${caption.trim()}" with ${selectedFiles.length} file(s) has been shared with your group.`,
          'success'
        );
        handleClearAll();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to upload note. Please check your connection.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Create Group Note 📚</h3>
              <p className="text-[11px] text-slate-400">Share study notes, PDFs, and multi-photos with everyone</p>
            </div>
          </div>

          <button
            onClick={() => {
              handleClearAll();
              onClose();
            }}
            disabled={isUploading}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Caption / Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Caption / Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="e.g. Unit 3 Important Notes, OS Formula Sheet"
              disabled={isUploading}
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-hidden focus:border-indigo-500 transition-colors font-medium"
            />
          </div>

          {/* Multi-File Upload & Drag Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Files (Images & PDFs) <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/60 bg-slate-950/50 hover:bg-slate-950 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200">
                  Click to select multiple photos or PDF documents
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Supported: JPG, PNG, WEBP, PDF (Up to 25MB each)
                </p>
              </div>
            </button>

            {/* Selected Files Preview List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span className="font-semibold">Selected Files Preview:</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add more
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                  {selectedFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.type === 'image' && item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt="preview"
                            className="w-9 h-9 rounded-lg object-cover bg-slate-950 shrink-0 border border-slate-800"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.file.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-mono">
                            {item.type} • {(item.file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFile(item.id)}
                        disabled={isUploading}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors shrink-0"
                        title="Remove this file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optional Password Protection */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isPasswordProtected ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                  {isPasswordProtected ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Protect with Password</h4>
                  <p className="text-[10px] text-slate-400">
                    {isPasswordProtected ? 'Friends must enter password to unlock contents' : 'Open to everyone in the group'}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                id="protect-note-cb"
                checked={isPasswordProtected}
                onChange={e => setIsPasswordProtected(e.target.checked)}
                disabled={isUploading}
                className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>

            {isPasswordProtected && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/60 animate-in fade-in">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Enter Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password..."
                    disabled={isUploading}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password..."
                    disabled={isUploading}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                handleClearAll();
                onClose();
              }}
              disabled={isUploading}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isUploading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading to Group...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload Note</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
