import React, { useState } from 'react';
import { CalendarDays, MapPin, Plus, Heart, Vote, Check, Users, HelpCircle, X } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { CreatePlanModal } from './CreatePlanModal';
import { useToast } from '../ui/Toast';

export const PlansList: React.FC = () => {
  const { showToast } = useToast();
  const store = useAppStore();
  const user = store.currentUser;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activePollPlanId, setActivePollPlanId] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const plans = store.plans;

  const handleRSVP = (planId: string, status: 'joined' | 'declined' | 'maybe') => {
    appStore.updatePlanStatus(planId, status);
    const label = status === 'joined' ? "I'm In! 🎉" : status === 'maybe' ? 'Maybe 🤔' : "Can't Come 😅";
    showToast('Plan RSVP', label, 'success');
  };

  const handleVote = async (planId: string, pollId: string, optionId: string) => {
    await appStore.votePollOption(planId, pollId, optionId);
    showToast('Vote Updated', 'Your poll vote has been recorded.', 'info');
  };

  const handleAddPoll = async (planId: string) => {
    const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || validOptions.length < 2) {
      showToast('Incomplete Poll', 'Please provide a question and at least 2 options.', 'error');
      return;
    }

    await appStore.addPollToPlan(planId, pollQuestion.trim(), validOptions);
    showToast('Poll Added', 'Friends can now vote on this plan.', 'success');
    setActivePollPlanId(null);
    setPollQuestion('');
    setPollOptions(['', '']);
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
            Organize hangouts, vote on polls, and RSVP in real time.
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
            const myRsvp = user ? plan.participants.find(p => p.user_id === user.id)?.status : undefined;
            const goingFriends = plan.participants.filter(p => p.status === 'joined');
            const maybeFriends = plan.participants.filter(p => p.status === 'maybe');
            const creator = plan.creator_profile || store.profiles.find(p => p.id === plan.creator_id);

            return (
              <div
                key={plan.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-slate-100 shadow-xl space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-white">{plan.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        {plan.location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
                        {plan.date} {plan.time ? `at ${plan.time}` : ''}
                      </span>
                    </p>
                  </div>

                  {creator && (
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-500 block">Created by</span>
                      <span className="text-xs font-semibold text-indigo-300">{creator.full_name}</span>
                    </div>
                  )}
                </div>

                {plan.description && (
                  <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    {plan.description}
                  </p>
                )}

                {/* Social Interested Header */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                      <span>{goingFriends.length} Going • {maybeFriends.length} Maybe</span>
                    </p>
                    <button
                      onClick={() => setActivePollPlanId(activePollPlanId === plan.id ? null : plan.id)}
                      className="text-[11px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <Vote className="w-3.5 h-3.5" />
                      <span>{activePollPlanId === plan.id ? 'Cancel' : '+ Add Poll'}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {goingFriends.map(p => {
                      const profile = store.profiles.find(prof => prof.id === p.user_id);
                      return (
                        <span
                          key={p.user_id}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-1"
                        >
                          <span>{profile?.full_name.split(' ')[0] || 'Friend'}</span>
                          <span className="text-pink-500">❤️</span>
                        </span>
                      );
                    })}
                    {maybeFriends.map(p => {
                      const profile = store.profiles.find(prof => prof.id === p.user_id);
                      return (
                        <span
                          key={p.user_id}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300 flex items-center gap-1"
                        >
                          <span>{profile?.full_name.split(' ')[0] || 'Friend'}</span>
                          <span>🤔</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Polls Section */}
                {plan.polls && plan.polls.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {plan.polls.map(poll => {
                      const totalVotes = poll.options.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);

                      return (
                        <div key={poll.id} className="p-3.5 rounded-2xl bg-slate-950/80 border border-violet-900/40 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                              <Vote className="w-3.5 h-3.5 text-violet-400" />
                              {poll.question}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {totalVotes} vote{totalVotes === 1 ? '' : 's'}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {poll.options.map(option => {
                              const voteCount = option.votes?.length || 0;
                              const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                              const hasMyVote = user && option.votes?.includes(user.id);

                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => handleVote(plan.id, poll.id, option.id)}
                                  className={`w-full text-left p-2.5 rounded-xl border relative overflow-hidden transition-all text-xs font-semibold flex items-center justify-between ${
                                    hasMyVote
                                      ? 'border-violet-500 bg-violet-950/40 text-white'
                                      : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700'
                                  }`}
                                >
                                  {/* Progress bar fill */}
                                  <div
                                    className={`absolute left-0 top-0 bottom-0 opacity-20 transition-all ${
                                      hasMyVote ? 'bg-violet-500' : 'bg-slate-600'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                  <span className="relative z-10 flex items-center gap-2">
                                    {hasMyVote && <Check className="w-3.5 h-3.5 text-violet-400 stroke-[3]" />}
                                    <span>{option.text}</span>
                                  </span>
                                  <span className="relative z-10 text-[10px] font-bold text-slate-400">
                                    {voteCount} ({pct}%)
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Add Poll Form */}
                {activePollPlanId === plan.id && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-violet-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Create Group Poll</span>
                      <button
                        type="button"
                        onClick={() => setActivePollPlanId(null)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="e.g. Which movie to watch?"
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
                    />

                    <div className="space-y-1.5">
                      {pollOptions.map((opt, idx) => (
                        <input
                          key={idx}
                          type="text"
                          placeholder={`Option ${idx + 1}`}
                          value={opt}
                          onChange={e => {
                            const copy = [...pollOptions];
                            copy[idx] = e.target.value;
                            setPollOptions(copy);
                          }}
                          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setPollOptions([...pollOptions, ''])}
                        className="text-[11px] font-bold text-violet-400 hover:text-violet-300"
                      >
                        + Add another option
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddPoll(plan.id)}
                        className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow"
                      >
                        Save Poll
                      </button>
                    </div>
                  </div>
                )}

                {/* Human RSVP Actions */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleRSVP(plan.id, 'joined')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                      myRsvp === 'joined'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    I'm In 🎉
                  </button>

                  <button
                    onClick={() => handleRSVP(plan.id, 'maybe')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                      myRsvp === 'maybe'
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    Maybe 🤔
                  </button>

                  <button
                    onClick={() => handleRSVP(plan.id, 'declined')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                      myRsvp === 'declined'
                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
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
