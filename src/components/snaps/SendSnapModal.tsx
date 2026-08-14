import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Flame, 
  Camera, 
  Image as ImageIcon, 
  AlertCircle, 
  Loader2, 
  Check, 
  RotateCcw,
  Sparkles,
  Clock
} from 'lucide-react';
import { appStore } from '../../lib/store';
import { Profile } from '../../types';
import { useToast } from '../ui/Toast';
import { uploadSnapImage, deleteSnapStorageFile } from '../../services/snaps';
import { validateUploadFile } from '../../services/storage';

interface SendSnapModalProps {
  recipient: Profile | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SendSnapModal: React.FC<SendSnapModalProps> = ({ recipient, isOpen, onClose }) => {
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const friendsList = appStore.profiles.filter(p => p.id !== currentUser.id);

  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(
    recipient?.id || friendsList[0]?.id || ''
  );
  
  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [viewDuration, setViewDuration] = useState<number>(5);
  
  // Upload and progress state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Update selected recipient if recipient prop changes
  useEffect(() => {
    if (recipient) {
      setSelectedRecipientId(recipient.id);
    } else if (!selectedRecipientId && friendsList.length > 0) {
      setSelectedRecipientId(friendsList[0].id);
    }
  }, [recipient, friendsList]);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFileSelect = (file: File) => {
    setErrorMsg(null);
    setIsSuccess(false);

    // Validate file
    const validation = validateUploadFile(file, ['image']);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Please select a valid image (JPEG, PNG, WEBP, HEIC).');
      return;
    }

    // Revoke previous blob URL if exists
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemoveImage = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg(null);
    setIsSuccess(false);
    setUploadProgress(0);
  };

  const handleSendSnap = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedRecipientId) {
      setErrorMsg('Please select a recipient friend.');
      return;
    }

    if (!selectedFile) {
      setErrorMsg('Please choose an image or take a photo first.');
      return;
    }

    // 1. Start upload state
    setIsUploading(true);
    setUploadProgress(15);
    setStatusMessage('Validating image...');

    try {
      // 2. Upload actual File to Supabase Storage 'snaps' bucket
      setStatusMessage('Uploading to Supabase Storage...');
      const uploadRes = await uploadSnapImage(
        selectedFile,
        currentUser.id,
        (percent) => {
          setUploadProgress(percent);
          if (percent >= 80) {
            setStatusMessage('Verifying storage upload...');
          }
        }
      );

      if (uploadRes.error || !uploadRes.storagePath) {
        setIsUploading(false);
        setUploadProgress(0);
        setErrorMsg(uploadRes.error || "Couldn't upload snap. Please try again.");
        return;
      }

      const storagePath = uploadRes.storagePath;

      // 3. Create Snap database record
      setUploadProgress(90);
      setStatusMessage('Creating Snap record & delivering to friend...');

      const newSnap = await appStore.sendSnap(selectedRecipientId, storagePath, caption.trim() || undefined);

      if (!newSnap) {
        // Clean up orphaned storage file
        await deleteSnapStorageFile(storagePath);
        setIsUploading(false);
        setUploadProgress(0);
        setErrorMsg("Couldn't save snap record to database. Please try again.");
        return;
      }

      // 4. Success state
      setUploadProgress(100);
      setStatusMessage('✓ Snap sent successfully!');
      setIsSuccess(true);

      const targetFriend = appStore.profiles.find(p => p.id === selectedRecipientId);
      showToast('Snap Sent! 🔥', `Delivered disappearing snap to ${targetFriend?.full_name || 'friend'}`, 'success');

      // Close modal smoothly after brief success animation
      setTimeout(() => {
        handleResetAndClose();
      }, 700);

    } catch (err: any) {
      console.error('Snap send exception:', err);
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    }
  };

  const handleResetAndClose = () => {
    handleRemoveImage();
    setCaption('');
    setErrorMsg(null);
    setIsUploading(false);
    setIsSuccess(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleResetAndClose}
          disabled={isUploading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/60 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl text-amber-400">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Send Snap / Streak</h3>
            <p className="text-xs text-slate-400">1-time ephemeral photo delivered via Supabase</p>
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,image/*"
          className="hidden"
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        <form onSubmit={handleSendSnap} className="space-y-4">
          {/* Recipient Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Recipient</label>
            <select
              value={selectedRecipientId}
              onChange={e => setSelectedRecipientId(e.target.value)}
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
            >
              {friendsList.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name} (@{p.username})
                </option>
              ))}
            </select>
          </div>

          {/* Photo Capture / Picker Zone OR Image Preview */}
          {!previewUrl ? (
            <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/60 bg-slate-950/60 rounded-2xl p-6 text-center transition-all">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-800/40 text-amber-400 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>

                <div>
                  <p className="text-xs font-bold text-white">Capture or Choose Snap Image</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, WEBP, or HEIC (Up to 15MB)</p>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>📷 Take Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>🖼 Gallery / File</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-2">
              {/* Image Preview Container */}
              <div className="relative h-64 w-full bg-black rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Snap Preview"
                  className="w-full h-full object-contain"
                />

                {/* Live Caption Overlay Preview */}
                {caption && (
                  <div className="absolute bottom-3 inset-x-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-center text-xs font-semibold text-white shadow-lg truncate">
                    {caption}
                  </div>
                )}
              </div>

              {/* Action Buttons under preview */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 px-1">
                <span className="text-[11px] text-slate-400 truncate max-w-[170px]">
                  {selectedFile?.name}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retake</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleRemoveImage}
                    className="p-1 rounded-lg bg-rose-950/60 text-rose-400 hover:bg-rose-900 transition-colors"
                    title="Remove Image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Caption Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Caption Overlay</label>
            <input
              type="text"
              placeholder="e.g. Canteen vibes ☕..."
              value={caption}
              disabled={isUploading}
              onChange={e => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* View Duration Timer Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">View Timer (Seconds)</label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 10].map(sec => (
                <button
                  key={sec}
                  type="button"
                  disabled={isUploading}
                  onClick={() => setViewDuration(sec)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                    viewDuration === sec 
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{sec}s Timer</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="p-3 bg-slate-950 border border-amber-500/40 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{statusMessage || 'Uploading Snap...'}</span>
                </span>
                <span className="font-mono text-amber-300">{uploadProgress}%</span>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={handleSendSnap}
                className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded-lg font-bold text-[11px] shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Send Snap Button */}
          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className={`w-full py-3 rounded-xl font-black text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
              isSuccess
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending Snap...</span>
              </>
            ) : isSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>✓ Snap Sent!</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Snap Now</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
