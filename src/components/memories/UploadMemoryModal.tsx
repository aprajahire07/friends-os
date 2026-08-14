import React, { useState } from 'react';
import { X, Images, MapPin, Calendar, Tag, AlertCircle } from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { FileUpload, SelectedMediaItem } from '../ui/FileUpload';

interface UploadMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadMemoryModal: React.FC<UploadMemoryModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [uploadedStoragePaths, setUploadedStoragePaths] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedMediaItem[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleTagUser = (uid: string) => {
    if (taggedUserIds.includes(uid)) {
      setTaggedUserIds(taggedUserIds.filter(id => id !== uid));
    } else {
      setTaggedUserIds([...taggedUserIds, uid]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please enter a memory title.');
      return;
    }

    if (uploadedStoragePaths.length === 0 && selectedItems.length === 0) {
      setErrorMsg('Please select or upload at least one photo/video for this memory.');
      return;
    }

    // Check if any uploads are still in progress
    const isStillUploading = selectedItems.some(item => item.uploadStatus === 'uploading');
    if (isStillUploading) {
      setErrorMsg('Please wait for photos to finish uploading.');
      return;
    }

    const pathsToSave = uploadedStoragePaths.length > 0 
      ? uploadedStoragePaths 
      : selectedItems.map(item => item.storagePath || item.previewUrl).filter(Boolean);

    appStore.addMemory(title.trim(), caption.trim(), pathsToSave, date, location.trim(), taggedUserIds);
    showToast('Memory Published!', `Saved "${title}" in crew timeline.`, 'success');
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
          <div className="p-3 bg-indigo-950/80 border border-indigo-800/60 rounded-2xl text-indigo-400">
            <Images className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Upload Group Memory</h3>
            <p className="text-xs text-slate-400">Preserve trip photos, party moments & milestones</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Memory Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Goa Weekend Trip 🏖️"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Photos & Videos *</label>
            <FileUpload
              bucket="memories"
              multiple={true}
              maxFiles={10}
              allowedTypes={['image', 'video']}
              userId={appStore.currentUser.id}
              label="Select Photos / Videos from Device"
              helperText="Choose from gallery, camera, or drop files here"
              onFilesSelected={setSelectedItems}
              onUploadComplete={setUploadedStoragePaths}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Caption / Story</label>
            <textarea
              rows={2}
              placeholder="Write something memorable about this day..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Location</label>
              <input
                type="text"
                placeholder="e.g. Candolim, Goa"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Tagged Friends */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tag Crew Friends</label>
            <div className="flex flex-wrap gap-1.5">
              {appStore.profiles.map(p => {
                const isTagged = taggedUserIds.includes(p.id);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleTagUser(p.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      isTagged ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    @{p.username}
                  </button>
                );
              })}
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
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            Save Memory to Timeline
          </button>
        </form>
      </div>
    </div>
  );
};
