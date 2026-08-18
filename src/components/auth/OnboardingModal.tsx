import React, { useState, useEffect } from 'react';
import { X, ArrowRight, CheckCircle2, Users, Lock, Calendar } from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { useToast } from '../ui/Toast';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  useAppStore();
  const currentUser = appStore.currentUser;

  const [step, setStep] = useState<number>(1);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [college, setCollege] = useState('');
  const [semester, setSemester] = useState('3');

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setUsername(currentUser.username || '');
      setEmail(currentUser.email || '');
      setBirthday(currentUser.birthday || '');
      setCollege(currentUser.college || 'GH Raisoni College of Engineering and Management (GHRCEMN)');
      setSemester(currentUser.semester?.toString() || '3');
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const isBirthdayAlreadySet = Boolean(currentUser.birthday);

  const handleNext = () => {
    if (step < 6) {
      setStep(step + 1);
    } else {
      // Save profile updates (preserving immutable birthday if already set)
      appStore.updateUserProfile({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        email: email.trim(),
        ...(isBirthdayAlreadySet ? {} : { birthday }),
        college,
        semester: parseInt(semester, 10) || 3,
      });

      setStep(7); // Welcome step
    }
  };

  const handleFinish = () => {
    showToast('Setup Completed 👋', 'Your FRIEND OS profile was updated.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        {step <= 6 && (
          <div className="space-y-5">
            <div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-400 uppercase tracking-wider">
                Step {step} of 6
              </span>
              <h3 className="text-lg font-black text-white mt-2">Edit your profile</h3>
            </div>

            {/* Step 1: Name */}
            {step === 1 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  What is your full name?
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
            )}

            {/* Step 2: Username */}
            {step === 2 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Pick a username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. rahul_05"
                />
              </div>
            )}

            {/* Step 3: Email */}
            {step === 3 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-500 mt-1">Managed via Supabase Authentication</p>
              </div>
            )}

            {/* Step 4: Birthday */}
            {step === 4 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-300 uppercase">
                    When is your birthday? 🎂
                  </label>
                  {isBirthdayAlreadySet && (
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={birthday}
                  disabled={isBirthdayAlreadySet}
                  onChange={e => setBirthday(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none ${
                    isBirthdayAlreadySet
                      ? 'bg-slate-950/60 border border-amber-500/30 text-amber-200/70 cursor-not-allowed'
                      : 'bg-slate-950 border border-slate-800 focus:border-indigo-500'
                  }`}
                />
                {isBirthdayAlreadySet && (
                  <p className="text-[10px] text-amber-400/80 mt-1.5 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Birthday is permanently locked and protected against modifications.
                  </p>
                )}
              </div>
            )}

            {/* Step 5: College */}
            {step === 5 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                  Select your College & Timetable 🏫
                </label>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setCollege('GH Raisoni College of Engineering and Management (GHRCEMN)')}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      college.includes('GH') || college.includes('GHRCE') || college.includes('GHRCEM')
                        ? 'bg-cyan-950/60 border-cyan-500 text-white ring-1 ring-cyan-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-white">GHRCEMN</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Section-A Class Schedule & Attendance</p>
                    </div>
                    {(college.includes('GH') || college.includes('GHRCE') || college.includes('GHRCEM')) && (
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCollege('SkillTech Institute')}
                    className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      college.includes('Skill')
                        ? 'bg-purple-950/60 border-purple-500 text-white ring-1 ring-purple-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-white">SkillTech Institute</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Section-A Class Schedule & Attendance</p>
                    </div>
                    {college.includes('Skill') && (
                      <CheckCircle2 className="w-4 h-4 text-purple-400" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 6: Semester */}
            {step === 6 && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                  Current Semester
                </label>
                <select
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleNext}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <span>{step === 6 ? 'Save Profile' : 'Next'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 7: Confirmation Screen */}
        {step === 7 && (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">Profile Updated 👋</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your profile information has been securely updated.
              </p>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <span>Done</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
