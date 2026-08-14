import React, { useState } from 'react';
import { X, CalendarDays, MapPin } from 'lucide-react';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePlanModal: React.FC<CreatePlanModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [where, setWhere] = useState('');
  const [whenDate, setWhenDate] = useState('2026-08-15');
  const [activity, setActivity] = useState('🎬 Movie');

  if (!isOpen) return null;

  const activities = ['🎬 Movie', '🍕 Food', '🎮 Gaming', '☕ Cafe', 'Other'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!where.trim()) return;

    const title = `${activity} Plan at ${where.trim()}`;
    appStore.createPlan(title, whenDate, '18:00', where.trim(), `Let's go for ${activity}!`);
    showToast('Plan Created 😎', `Created "${title}"`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-black text-white">Let's go somewhere! 😎</h3>
          <p className="text-xs text-slate-400 mt-0.5">Make a quick plan with your friends</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Where? 📍
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cinepolis or Central Perk Cafe"
              value={where}
              onChange={e => setWhere(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              When? 📅
            </label>
            <input
              type="date"
              required
              value={whenDate}
              onChange={e => setWhenDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
              What should we do?
            </label>
            <div className="flex flex-wrap gap-1.5">
              {activities.map(act => (
                <button
                  key={act}
                  type="button"
                  onClick={() => setActivity(act)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activity === act
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
          >
            Create Plan
          </button>
        </form>
      </div>
    </div>
  );
};
