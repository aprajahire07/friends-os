import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  Film, 
  FileText, 
  X, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Sparkles,
  Loader2
} from 'lucide-react';
import { 
  StorageBucket, 
  validateUploadFile, 
  uploadFileToStorage, 
  getResolvedMediaUrl 
} from '../../services/storage';

export interface SelectedMediaItem {
  id: string;
  file?: File;
  previewUrl: string;
  storagePath?: string;
  fileName: string;
  fileSize: number;
  fileType: 'image' | 'video' | 'document' | 'unknown';
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

interface FileUploadProps {
  bucket: StorageBucket;
  userId?: string;
  multiple?: boolean;
  maxFiles?: number;
  allowedTypes?: ('image' | 'video' | 'document')[];
  initialUrls?: string[];
  initialStoragePath?: string;
  currentPreviewUrl?: string;
  onFilesSelected?: (items: SelectedMediaItem[]) => void;
  onUploadComplete?: (storagePaths: string[]) => void;
  autoUpload?: boolean;
  label?: string;
  helperText?: string;
  cameraOnly?: boolean;
  compact?: boolean;
  avatarMode?: boolean;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  bucket,
  userId,
  multiple = false,
  maxFiles = 6,
  allowedTypes = ['image'] as ('image' | 'video' | 'document')[],
  initialUrls = [],
  initialStoragePath,
  currentPreviewUrl,
  onFilesSelected,
  onUploadComplete,
  autoUpload = true,
  label = 'Add Photo / Video',
  helperText = 'Choose from your device or camera',
  cameraOnly = false,
  compact = false,
  avatarMode = false,
  className = ''
}) => {
  const [items, setItems] = useState<SelectedMediaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize from initialStoragePath or initialUrls if provided
  useEffect(() => {
    if (initialStoragePath && items.length === 0) {
      getResolvedMediaUrl(bucket, initialStoragePath).then(resolved => {
        setItems([{
          id: 'initial-0',
          previewUrl: resolved,
          storagePath: initialStoragePath,
          fileName: 'Uploaded Image',
          fileSize: 0,
          fileType: 'image',
          uploadStatus: 'success',
          progress: 100
        }]);
      });
    } else if (initialUrls.length > 0 && items.length === 0) {
      const initialItems = initialUrls.map((url, idx) => ({
        id: `initial-${idx}`,
        previewUrl: url,
        storagePath: url,
        fileName: `Media ${idx + 1}`,
        fileSize: 0,
        fileType: (url.match(/\.(mp4|webm|mov)/i) ? 'video' : 'image') as any,
        uploadStatus: 'success' as const,
        progress: 100
      }));
      setItems(initialItems);
    }
  }, [initialStoragePath, initialUrls, bucket]);

  // Compute accept attribute based on allowedTypes
  const acceptMime = allowedTypes.map(type => {
    if (type === 'image') return 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*';
    if (type === 'video') return 'video/mp4,video/webm,video/quicktime,video/*';
    if (type === 'document') return 'application/pdf,.doc,.docx,.txt';
    return '*/*';
  }).join(',');

  const processFiles = async (fileList: FileList | File[]) => {
    setGlobalError(null);
    const filesArray = Array.from(fileList);

    if (filesArray.length === 0) return;

    if (!multiple && filesArray.length > 1) {
      filesArray.splice(1);
    }

    if (multiple && items.length + filesArray.length > maxFiles) {
      setGlobalError(`You can upload a maximum of ${maxFiles} files at once.`);
      return;
    }

    const newItems: SelectedMediaItem[] = [];

    for (const file of filesArray) {
      const validation = validateUploadFile(file, allowedTypes);
      if (!validation.valid) {
        setGlobalError(validation.error || 'Invalid file.');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
        fileName: file.name,
        fileSize: file.size,
        fileType: validation.fileType,
        uploadStatus: autoUpload ? 'uploading' : 'idle',
        progress: autoUpload ? 20 : 0
      });
    }

    const updatedItems = multiple ? [...items, ...newItems] : newItems;
    setItems(updatedItems);
    if (onFilesSelected) {
      onFilesSelected(updatedItems);
    }

    // If auto-upload is enabled, upload immediately
    if (autoUpload) {
      await uploadItems(newItems, updatedItems);
    }
  };

  const uploadItems = async (itemsToUpload: SelectedMediaItem[], currentAllItems: SelectedMediaItem[]) => {
    let allCurrent = [...currentAllItems];
    const completedPaths: string[] = [];

    for (const item of itemsToUpload) {
      if (!item.file) continue;

      try {
        const res = await uploadFileToStorage(
          bucket,
          item.file,
          userId,
          (percent) => {
            allCurrent = allCurrent.map(it => 
              it.id === item.id ? { ...it, progress: percent, uploadStatus: 'uploading' } : it
            );
            setItems([...allCurrent]);
          }
        );

        if (res.error) {
          allCurrent = allCurrent.map(it => 
            it.id === item.id ? { 
              ...it, 
              uploadStatus: 'error', 
              errorMessage: res.error 
            } : it
          );
          setItems([...allCurrent]);
        } else {
          completedPaths.push(res.storagePath);
          allCurrent = allCurrent.map(it => 
            it.id === item.id ? { 
              ...it, 
              uploadStatus: 'success', 
              storagePath: res.storagePath,
              progress: 100 
            } : it
          );
          setItems([...allCurrent]);
        }
      } catch (err: any) {
        allCurrent = allCurrent.map(it => 
          it.id === item.id ? { 
            ...it, 
            uploadStatus: 'error', 
            errorMessage: err.message || 'Upload failed.' 
          } : it
        );
        setItems([...allCurrent]);
      }
    }

    const allSuccessfulPaths = allCurrent.map(i => i.storagePath).filter(Boolean) as string[];
    if (onUploadComplete && allSuccessfulPaths.length > 0) {
      onUploadComplete(allSuccessfulPaths);
    }
    if (onFilesSelected) {
      onFilesSelected(allCurrent);
    }
  };

  const handleRemove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = items.filter(it => it.id !== id);
    setItems(updated);
    if (onFilesSelected) onFilesSelected(updated);
    if (onUploadComplete) {
      const paths = updated.map(u => u.storagePath).filter(Boolean) as string[];
      onUploadComplete(paths);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Avatar-specific layout
  if (avatarMode) {
    const singleItem = items[0];
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptMime}
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />

        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-indigo-500/50 bg-slate-950 flex items-center justify-center shadow-xl">
            {singleItem?.previewUrl ? (
              <img
                src={singleItem.previewUrl}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500">
                <ImageIcon className="w-8 h-8 opacity-60 mb-1" />
                <span className="text-[10px] font-bold">Add Photo</span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex flex-col items-center justify-center text-white text-[11px] font-bold">
              <Camera className="w-5 h-5 mb-0.5" />
              <span>Change</span>
            </div>
          </div>

          {singleItem?.uploadStatus === 'uploading' && (
            <div className="absolute inset-0 bg-slate-950/80 rounded-full flex flex-col items-center justify-center text-indigo-400">
              <Loader2 className="w-6 h-6 animate-spin mb-1" />
              <span className="text-[10px] font-mono font-bold">{singleItem.progress}%</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{singleItem ? 'Change Photo' : 'Choose Photo'}</span>
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Take photo with camera"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Camera</span>
          </button>

          {singleItem && (
            <button
              type="button"
              onClick={e => handleRemove(singleItem.id, e)}
              className="p-1.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-400 hover:bg-rose-900 text-xs font-bold transition-colors"
              title="Remove Photo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {globalError && (
          <p className="text-xs text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{globalError}</span>
          </p>
        )}
      </div>
    );
  }

  // Compact Single Item View (for QR or direct snap selection)
  if (compact && !multiple && items.length > 0) {
    const singleItem = items[0];
    return (
      <div className={`space-y-2 ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptMime}
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files && processFiles(e.target.files)}
        />

        <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
          {singleItem.fileType === 'image' && (
            <div className="relative max-h-56 overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <img
                src={singleItem.previewUrl}
                alt="Uploaded media"
                className="max-h-56 w-full object-contain rounded-xl"
              />
            </div>
          )}

          {singleItem.fileType === 'video' && (
            <video
              src={singleItem.previewUrl}
              controls
              className="max-h-56 w-full object-contain rounded-xl bg-black"
            />
          )}

          {singleItem.fileType === 'document' && (
            <div className="p-4 flex items-center gap-3 bg-slate-900 rounded-xl">
              <FileText className="w-8 h-8 text-indigo-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{singleItem.fileName}</p>
                <p className="text-[10px] text-slate-400">{(singleItem.fileSize / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          )}

          {/* Upload Progress Overlay */}
          {singleItem.uploadStatus === 'uploading' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
              <p className="text-xs font-bold text-white mb-2">Uploading to FRIEND OS Vault...</p>
              <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-300"
                  style={{ width: `${singleItem.progress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-indigo-300 mt-1 font-bold">{singleItem.progress}%</span>
            </div>
          )}

          {/* Upload Status Badge */}
          {singleItem.uploadStatus === 'success' && (
            <div className="absolute top-3 left-3 bg-emerald-950/90 border border-emerald-800 text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-lg">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Uploaded</span>
            </div>
          )}

          {singleItem.uploadStatus === 'error' && (
            <div className="absolute top-3 left-3 bg-rose-950/90 border border-rose-800 text-rose-300 px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-lg">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              <span>Upload Failed</span>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-850 px-1">
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[160px]">
              {singleItem.fileName}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={e => handleRemove(singleItem.id, e)}
                className="p-1 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900 transition-colors"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {singleItem.errorMessage && (
          <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{singleItem.errorMessage}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptMime}
        className="hidden"
        onChange={e => e.target.files && processFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files && processFiles(e.target.files)}
      />

      {/* Main Drag & Drop / Click Zone */}
      {(!items.length || multiple) && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-950/30'
              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/40'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-400 flex items-center justify-center shadow-lg">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <p className="text-xs font-bold text-white">{label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
            </div>

            <div className="flex items-center gap-2 mt-1" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Choose Files</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Use Camera</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Items Grid (for multiple items or list view) */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {items.length} {items.length === 1 ? 'file selected' : 'files selected'}
            </span>
            {multiple && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-indigo-400 font-bold hover:underline"
              >
                + Add More
              </button>
            )}
          </div>

          <div className={`grid gap-2 ${multiple ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
            {items.map(item => (
              <div
                key={item.id}
                className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 group"
              >
                {item.fileType === 'image' && (
                  <div className="h-28 w-full overflow-hidden bg-black flex items-center justify-center">
                    <img
                      src={item.previewUrl}
                      alt={item.fileName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {item.fileType === 'video' && (
                  <div className="h-28 w-full bg-slate-950 flex items-center justify-center text-indigo-400">
                    <Film className="w-8 h-8" />
                  </div>
                )}

                {item.fileType === 'document' && (
                  <div className="h-28 w-full bg-slate-950 flex flex-col items-center justify-center p-2 text-center">
                    <FileText className="w-8 h-8 text-indigo-400 mb-1" />
                    <span className="text-[10px] font-bold text-slate-300 truncate w-full px-2">
                      {item.fileName}
                    </span>
                  </div>
                )}

                {/* Progress bar overlay during upload */}
                {item.uploadStatus === 'uploading' && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2">
                    <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-1" />
                    <span className="text-[10px] font-mono text-indigo-300 font-bold">{item.progress}%</span>
                  </div>
                )}

                {/* Success Indicator */}
                {item.uploadStatus === 'success' && (
                  <div className="absolute bottom-1.5 left-1.5 bg-emerald-950/90 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 shadow">
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Uploaded</span>
                  </div>
                )}

                {/* Error Indicator */}
                {item.uploadStatus === 'error' && (
                  <div className="absolute bottom-1.5 left-1.5 bg-rose-950/90 border border-rose-800 text-rose-300 px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 shadow">
                    <AlertCircle className="w-2.5 h-2.5 text-rose-400" />
                    <span>Failed</span>
                  </div>
                )}

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={e => handleRemove(item.id, e)}
                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-950/80 text-slate-300 hover:text-white hover:bg-rose-900 transition-colors shadow"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {globalError && (
        <div className="p-3 bg-rose-950/80 border border-rose-800/60 rounded-xl text-rose-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}
    </div>
  );
};
