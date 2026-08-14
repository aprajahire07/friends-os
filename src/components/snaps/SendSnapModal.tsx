import React, { useState } from 'react';
import { X, Send, Flame, Sparkles, AlertCircle } from 'lucide-react';
import { appStore } from '../../lib/store';
import { Profile } from '../../types';
import { useToast } from '../ui/Toast';
import { FileUpload, SelectedMediaItem } from '../ui/FileUpload';

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
  const [uploadedStoragePath, setUploadedStoragePath] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<SelectedMediaItem[]>([]);
  const [caption, setCaption] = useState('');
  const [viewDuration, setViewDuration] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedRecipientId) {
      setErrorMsg('Please select a recipient.');
      return;
    }

    if (!uploadedStoragePath && selectedItems.length === 0) {
      setErrorMsg('Please take a photo or select an image from your device.');
      return;
    }

    const isUploading = selectedItems.some(i => i.uploadStatus === 'uploading');
    if (isUploading) {
      setErrorMsg('Please wait for snap to finish uploading.');
      return;
    }

    const finalPath = uploadedStoragePath || selectedItems[0]?.storagePath || selectedItems[0]?.previewUrl;
    if (!finalPath) {
      setErrorMsg('Snap upload failed. Please choose another image.');
      return;
    }

    appStore.sendSnap(selectedRecipientId, finalPath, caption);

    const rec = appStore.profiles.find(p => p.id === selectedRecipientId);
    showToast('Snap Sent! 🔥', `Sent snap streak to @${rec?.username}`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-slate-100 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-amber-950/80 border border-amber-800/60 rounded-2xl text-amber-400">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Send Daily Snap / Streak</h3>
            <p className="text-xs text-slate-400">Ephemeral photo snap with custom view timer</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Recipient</label>
            <select
              value={selectedRecipientId}
              onChange={e => setSelectedRecipientId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
            >
              {friendsList.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>
              ))}
            </select>
          </div>

          {/* Photo / Camera Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Snap Photo *</label>
            <FileUpload
              bucket="snaps"
              allowedTypes={['image']}
              userId={currentUser.id}
              label="Capture or Choose Snap"
              helperText="Take photo from camera or pick from gallery"
              compact={true}
              onFilesSelected={setSelectedItems}
              onUploadComplete={(paths) => {
                if (paths.length > 0) {
                  setUploadedStoragePath(paths[0]);
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Caption overlay</label>
            <input
              type="text"
              placeholder="e.g. Canteen vibes ☕..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">View Timer (Seconds)</label>
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 10].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setViewDuration(sec)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    viewDuration === sec ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {sec} Seconds
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Send Snap Now</span>
          </button>
        </form>
      </div>
    </div>
  );
};
