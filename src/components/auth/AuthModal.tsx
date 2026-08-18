import React, { useState } from 'react';
import { 
  Shield, 
  Mail, 
  Lock, 
  User, 
  Calendar, 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  KeyRound,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appStore } from '../../lib/store';
import { Profile } from '../../types';
import { useToast } from '../ui/Toast';
import { createProfileInSupabase, fetchProfileById } from '../../services/profiles';

interface AuthModalProps {
  onSuccess: (profile: Profile) => void;
  initialMode?: 'login' | 'signup' | 'forgot' | 'reset_password';
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, initialMode = 'login' }) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'verification_notice' | 'reset_password'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [birthday, setBirthday] = useState('');
  const [college, setCollege] = useState('GH Raisoni College of Engineering and Management (GHRCEMN / GHRCE / GHRSTU)');
  const [courseBranch, setCourseBranch] = useState('Computer Science & Engineering');
  const [semester, setSemester] = useState(3);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase is not configured. Please check your Supabase credentials in settings.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
          throw new Error('Invalid email or password. Please check your credentials or create a new account.');
        }
        if (msg.includes('email not confirmed')) {
          throw new Error('Email not confirmed yet. (Tip: Supabase Dashboard > Authentication > Providers > Email me "Confirm email" ko OFF karein taaki instant login ho sake).');
        }
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit') || (error as any).status === 429) {
          throw new Error('Email rate limit exceeded (Supabase Free limit 3 emails/hr). Please wait a few minutes or disable "Confirm email" in Supabase Dashboard.');
        }
        throw error;
      }

      if (data.user) {
        // Fetch user profile from Supabase
        let profile = await fetchProfileById(data.user.id);
        
        if (!profile) {
          // If profile does not exist yet (e.g., initial migration), create one from auth metadata
          const meta = data.user.user_metadata || {};
          const fallbackProfile: Profile = {
            id: data.user.id,
            email: data.user.email || email,
            full_name: meta.full_name || email.split('@')[0],
            username: meta.username || email.split('@')[0].toLowerCase(),
            birthday: meta.birthday || '2004-09-15',
            college: meta.college || 'GH Raisoni College of Engineering and Management (GHRCEMN / GHRCE / GHRSTU)',
            course_branch: meta.course_branch || 'Computer Science & Engineering',
            semester: meta.semester || 3,
            role: 'member',
            created_at: new Date().toISOString()
          };
          await createProfileInSupabase(fallbackProfile);
          profile = fallbackProfile;
        }

        appStore.setCurrentUser(profile);
        showToast('Welcome back!', `Signed in as ${profile.full_name}`, 'success');
        onSuccess(profile);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
      showToast('Authentication Error', err.message || 'Please check credentials', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      setLoading(false);
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Username is required.');
      setLoading(false);
      return;
    }

    if (!birthday) {
      setErrorMessage('Birthday is required and is permanently immutable once registered.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase is not configured. Please configure Supabase project credentials.');
      }

      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: cleanUsername,
            birthday,
            college,
            course_branch: courseBranch,
            semester: Number(semester)
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        const newProfile: Profile = {
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          username: cleanUsername,
          birthday,
          college,
          course_branch: courseBranch,
          semester: Number(semester),
          role: 'member',
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
          created_at: new Date().toISOString()
        };

        await createProfileInSupabase(newProfile);

        if (data.session) {
          appStore.setCurrentUser(newProfile);
          showToast('Account Created!', `Welcome to FRIEND OS, ${newProfile.full_name}!`, 'success');
          onSuccess(newProfile);
        } else {
          // Email confirmation required
          setMode('verification_notice');
          setSuccessMessage('Registration successful! Please check your email inbox to confirm your account.');
        }
      }
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      let customErr = err.message || 'Failed to create account.';
      
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit') || err?.status === 429) {
        customErr = 'Email rate limit exceeded (Supabase Free limit 3 emails/hr). Please turn OFF "Confirm email" in Supabase Dashboard (Authentication > Providers > Email) for unlimited instant signups.';
      } else if (msg.includes('user already registered') || msg.includes('already registered')) {
        customErr = 'An account with this email already exists. Please sign in instead.';
      }
      
      setErrorMessage(customErr);
      showToast('Signup Notice', customErr, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase is not configured.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit') || (error as any).status === 429) {
          throw new Error('Email rate limit exceeded for password reset. Please wait 15 minutes before retrying.');
        }
        throw error;
      }

      setSuccessMessage(`Password reset link sent to ${email}. Please check your inbox and spam folder.`);
      showToast('Reset Link Sent', 'Check your email inbox for the recovery link.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase is not configured.');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showToast('Password Updated', 'Your password was successfully updated. Please sign in.', 'success');
      setMode('login');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 text-slate-100 shadow-2xl relative z-10 backdrop-blur-2xl">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-violet-600 to-pink-500 text-white font-black text-2xl shadow-xl shadow-indigo-500/25 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">FRIEND OS</h1>
          <p className="text-xs text-slate-400 mt-1">Real-Time Private Digital OS for College Friends</p>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/80 border border-rose-800/60 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800/60 rounded-xl text-emerald-200 text-xs flex items-start gap-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@college.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setMode('forgot');
                  }}
                  className="text-[11px] text-indigo-400 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-3 border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage('');
                    setSuccessMessage('');
                    setMode('signup');
                  }}
                  className="text-indigo-400 font-bold hover:underline"
                >
                  Create Account
                </button>
              </p>
            </div>
          </form>
        )}

        {/* 2. SIGNUP MODE */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Apraj Ahire"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="apraj"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center justify-between">
                  <span>Birthday</span>
                  <span className="text-[10px] text-amber-400/80 font-mono">🔒 Locked</span>
                </label>
                <input
                  type="date"
                  required
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">College Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="apraj@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">College / Institute</label>
              <select
                value={college}
                onChange={e => setCollege(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="GH Raisoni College of Engineering and Management (GHRCEMN / GHRCE / GHRSTU)">GH Raisoni College of Engineering & Management (GHRCEMN / GHRCE / GHRSTU)</option>
                <option value="SkillTech Institute">SkillTech Institute</option>
                <option value="Other Engineering College">Other Engineering College</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Branch / Course</label>
                <input
                  type="text"
                  required
                  value={courseBranch}
                  onChange={e => setCourseBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Semester</label>
                <select
                  value={semester}
                  onChange={e => setSemester(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{loading ? 'Creating Real Account...' : 'Complete Sign Up'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setSuccessMessage('');
                  setMode('login');
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Already have an account? <span className="text-indigo-400 font-bold">Sign In</span>
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Enter your registered college email address to receive a secure password recovery link.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setSuccessMessage('');
                  setMode('login');
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {/* 4. VERIFICATION NOTICE */}
        {mode === 'verification_notice' && (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Check your email inbox</h3>
              <p className="text-xs text-slate-400 mt-1">
                We sent a confirmation link to <span className="text-indigo-300 font-medium">{email || 'your email'}</span>. Please click the link to verify your account and sign in.
              </p>
            </div>
            <button
              onClick={() => {
                setErrorMessage('');
                setSuccessMessage('');
                setMode('login');
              }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors"
            >
              Return to Sign In
            </button>
          </div>
        )}

        {/* 5. RESET PASSWORD UPDATE */}
        {mode === 'reset_password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <p className="text-xs text-slate-400">
              Enter your new account password below.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
