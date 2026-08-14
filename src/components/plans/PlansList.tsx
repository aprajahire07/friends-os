import React, { useState } from 'react';
import { CalendarDays, MapPin, Plus, Heart } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { CreatePlanModal } from './CreatePlanModal';
import { useToast } from '../ui/Toast';

export const PlansList: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const user = store.currentUser;
  const [showCreateModal, setShowCreateModal] = useState(false);

  const plans = store.plans;

  const handleRSVP = (planId: string, status: 'joined' | 'declined' | 'maybe') => {
    appStore.updatePlanStatus(planId, status);
    const label = status === 'joined' ? "I'm In! 🎉" : status === 'maybe' ? 'Maybe 🤔' : "Can't Come 😅";
    showToast('Plan RSVP', label, 'success');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-400" />
            <span>Plans 📅</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize outings and see who is coming.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>+ Create Plan</span>
        </button>
      </div>

      {/* Empty State */}
      {plans.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-400 text-xs space-y-3">
          <p className="text-sm font-bold text-white">No plans yet 😴</p>
          <p className="text-slate-400">Plan something with the gang!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs"
          >
            Create Plan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => {
            const myRsvp = plan.participants.find(p => p.user_id === user.id)?.status;
            const interestedCount = plan.participants.filter(p => p.status === 'joined').length;

            return (
              <div
                key={plan.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-slate-100 shadow-xl space-y-4"
              >
                <div>
                  <h3 className="text-base font-extrabold text-white">{plan.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>📍 {plan.location}</span>
                    <span>•</span>
                    <span>📅 {plan.date}</span>
                  </p>
                </div>

                {/* Social Interested Header */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
                  <p className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                    <span>{interestedCount} friends are interested</span>
                  </p>

                  <div className="flex flex-wrap gap-1.5">
                    {plan.participants
                      .filter(p => p.status === 'joined')
                      .map(p => {
                        const profile = appStore.profiles.find(prof => prof.id === p.user_id);
                        return (
                          <span
                            key={p.user_id}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 flex items-center gap-1"
                          >
                            <span>{profile?.full_name.split(' ')[0]}</span>
                            <span className="text-pink-500">❤️</span>
                          </span>
                        );
                      })}
                  </div>
                </div>

                {/* Human RSVP Actions */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleRSVP(plan.id, 'joined')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                      myRsvp === 'joined'
                        ? 'bg-emerald-600 text-white shadow-lg'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    I'm In 🎉
                  </button>

                  <button
                    onClick={() => handleRSVP(plan.id, 'maybe')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                      myRsvp === 'maybe'
                        ? 'bg-amber-600 text-white shadow-lg'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    Maybe 🤔
                  </button>

                  <button
                    onClick={() => handleRSVP(plan.id, 'declined')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                      myRsvp === 'declined'
                        ? 'bg-rose-600 text-white shadow-lg'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    Can't Come 😅
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreatePlanModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
};
