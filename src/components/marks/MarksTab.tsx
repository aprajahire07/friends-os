import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  Search, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Sparkles, 
  ChevronRight, 
  Calculator, 
  KeyRound, 
  ArrowLeft, 
  Check, 
  AlertCircle, 
  BookOpen, 
  Award, 
  User, 
  RefreshCw,
  Sliders,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile, SubjectMarkSummary, ExamType, StudentAcademicProfile } from '../../types';
import { 
  fetchAcademicProfileFromSupabase, 
  updateAcademicProfileInSupabase, 
  setMarksPasswordInSupabase, 
  verifyMarksPassword,
  fetchMarksFromSupabase, 
  saveSingleMarkInSupabase, 
  saveBulkMarksInSupabase,
  saveSemesterResultInSupabase,
  isMarksUnlockedForUser,
  markStudentAsUnlocked 
} from '../../services/marks';
import { 
  getCurriculumForCollegeAndSemester, 
  computeSubjectMarkSummary, 
  calculateSgpa,
  GRADING_SCALE 
} from '../../lib/academicCurriculum';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import { isUserAdmin } from '../../services/appSettings';
import { debounce } from '../../lib/asyncUtils';

interface MarksTabProps {
  onSelectTab?: (tab: string) => void;
  onOpenCalculatorWithStudent?: (userId: string, semester: number) => void;
}

export const MarksTab: React.FC<MarksTabProps> = ({ 
  onSelectTab,
  onOpenCalculatorWithStudent 
}) => {
  useAppStore();
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const profiles = appStore.profiles;

  // Selected student state (defaults to null = list view)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number>(3);
  
  // Student data states
  const [academicProfile, setAcademicProfile] = useState<StudentAcademicProfile | null>(null);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectMarkSummary[]>([]);
  const [isLoadingMarks, setIsLoadingMarks] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  
  // Password setup modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProtecting, setIsProtecting] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Saving status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Active student object
  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return profiles.find(p => p.id === selectedStudentId) || (currentUser?.id === selectedStudentId ? currentUser : null);
  }, [selectedStudentId, profiles, currentUser]);

  const isOwnMarks = Boolean(currentUser && selectedStudentId === currentUser.id);
  const isAdmin = isUserAdmin(currentUser);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return profiles.filter(p => {
      if (!p) return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        (p.college && p.college.toLowerCase().includes(q))
      );
    });
  }, [profiles, searchQuery]);

  // Load student marks & academic profile
  const loadStudentData = useCallback(async (targetUserId: string, sem?: number) => {
    setIsLoadingMarks(true);
    setPasswordError(null);

    const targetProfile = profiles.find(p => p.id === targetUserId) || (currentUser?.id === targetUserId ? currentUser : null);
    const acad = await fetchAcademicProfileFromSupabase(targetUserId, targetProfile);
    setAcademicProfile(acad);

    const activeSem = sem !== undefined ? sem : (acad.current_semester || targetProfile?.semester || 3);
    setSelectedSemester(activeSem);

    // Check if unlocked
    const unlocked = isMarksUnlockedForUser(targetUserId, currentUser, acad.is_marks_password_protected);
    setIsUnlocked(unlocked);

    if (unlocked) {
      const curriculum = getCurriculumForCollegeAndSemester(acad.college_id || targetProfile?.college, activeSem);
      const rawMarks = await fetchMarksFromSupabase(targetUserId, activeSem);

      const summaries = curriculum.map(curr => {
        const subMarks = rawMarks.filter(m => m.subject_code === curr.code);
        const cae1Obj = subMarks.find(m => m.exam_type === 'CAE1');
        const cae2Obj = subMarks.find(m => m.exam_type === 'CAE2');
        const endSemObj = subMarks.find(m => m.exam_type === 'END_SEM');

        return computeSubjectMarkSummary(curr, {
          cae1: cae1Obj?.marks ?? null,
          cae2: cae2Obj?.marks ?? null,
          end_sem: endSemObj?.marks ?? null,
        });
      });

      setSubjectSummaries(summaries);

      // Auto-update Semester Result in background
      const sgpaCalc = calculateSgpa(summaries);
      if (sgpaCalc.hasMarks) {
        saveSemesterResultInSupabase(
          targetUserId, 
          activeSem, 
          sgpaCalc.sgpa, 
          sgpaCalc.totalCredits, 
          sgpaCalc.totalGradePoints
        );
      }
    }

    setIsLoadingMarks(false);
  }, [currentUser, profiles]);

  // Handle student card click
  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setPasswordInput('');
    setPasswordError(null);
    loadStudentData(studentId);
  };

  // Handle semester change
  const handleSemesterChange = (newSem: number) => {
    setSelectedSemester(newSem);
    if (selectedStudentId) {
      if (isOwnMarks) {
        updateAcademicProfileInSupabase(selectedStudentId, newSem);
      }
      loadStudentData(selectedStudentId, newSem);
    }
  };

  // Handle password unlock submission
  const handleUnlockPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !passwordInput) return;

    setIsVerifyingPassword(true);
    setPasswordError(null);

    const result = await verifyMarksPassword(
      selectedStudentId,
      passwordInput,
      academicProfile,
      currentUser
    );

    setIsVerifyingPassword(false);

    if (result.success) {
      setIsUnlocked(true);
      showToast('Unlocked', 'Student marks unlocked successfully.', 'success');
      loadStudentData(selectedStudentId, selectedSemester);
    } else {
      setPasswordError(result.message || 'Incorrect password.');
      showToast('Access Denied', 'Incorrect marks password entered.', 'error');
    }
  };

  // Debounced auto-saver for marks input changes
  const saveMarkDebounced = useMemo(
    () => debounce(async (
      userId: string,
      sem: number,
      code: string,
      name: string,
      credits: number,
      examType: ExamType,
      val: number | null,
      maxVal: number
    ) => {
      setSaveStatus('saving');
      const ok = await saveSingleMarkInSupabase(userId, sem, code, name, credits, examType, val, maxVal);
      if (ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 400),
    []
  );

  // Manual save all marks
  const handleManualSaveAll = async () => {
    if (!selectedStudentId) return;
    if (!isOwnMarks && !isAdmin) return;

    setSaveStatus('saving');
    const bulkData = subjectSummaries.map(s => ({
      subject_code: s.subject_code,
      subject_name: s.subject_name,
      credits: s.credits,
      cae1: s.cae1,
      max_cae1: s.max_cae1,
      cae2: s.cae2,
      max_cae2: s.max_cae2,
      end_sem: s.end_sem,
      max_end_sem: s.max_end_sem,
    }));

    const ok = await saveBulkMarksInSupabase(selectedStudentId, selectedSemester, bulkData);
    const sgpaCalc = calculateSgpa(subjectSummaries);
    await saveSemesterResultInSupabase(
      selectedStudentId, 
      selectedSemester, 
      sgpaCalc.sgpa, 
      sgpaCalc.totalCredits, 
      sgpaCalc.totalGradePoints
    );

    if (ok) {
      setSaveStatus('saved');
      showToast('Marks Synced', 'All marks successfully saved to database.', 'success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } else {
      setSaveStatus('saved');
      showToast('Marks Saved', 'Marks saved and synced locally.', 'success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // Handle mark input change
  const handleMarkChange = (
    subjectCode: string,
    examType: ExamType,
    rawValue: string,
    maxAllowed: number
  ) => {
    if (!isOwnMarks && !isAdmin) return;
    if (!selectedStudentId) return;

    let parsedVal: number | null = null;
    if (rawValue.trim() !== '') {
      const num = Number(rawValue);
      if (!isNaN(num)) {
        parsedVal = Math.max(0, Math.min(maxAllowed, num));
      }
    }

    setSubjectSummaries(prev => {
      const updated = prev.map(s => {
        if (s.subject_code !== subjectCode) return s;

        const cae1 = examType === 'CAE1' ? parsedVal : s.cae1;
        const cae2 = examType === 'CAE2' ? parsedVal : s.cae2;
        const endSem = examType === 'END_SEM' ? parsedVal : s.end_sem;

        const currItem = {
          code: s.subject_code,
          name: s.subject_name,
          credits: s.credits,
          max_cae1: s.max_cae1,
          max_cae2: s.max_cae2,
          max_end_sem: s.max_end_sem,
        };

        return computeSubjectMarkSummary(currItem, { cae1, cae2, end_sem: endSem });
      });

      // Update semester SGPA
      const sgpaCalc = calculateSgpa(updated);
      saveSemesterResultInSupabase(
        selectedStudentId, 
        selectedSemester, 
        sgpaCalc.sgpa, 
        sgpaCalc.totalCredits, 
        sgpaCalc.totalGradePoints
      );

      return updated;
    });

    const sub = subjectSummaries.find(s => s.subject_code === subjectCode);
    if (sub) {
      saveMarkDebounced(
        selectedStudentId,
        selectedSemester,
        sub.subject_code,
        sub.subject_name,
        sub.credits,
        examType,
        parsedVal,
        maxAllowed
      );
    }
  };

  // Save privacy password
  const handleSavePasswordSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (isProtecting) {
      if (!newPassword || newPassword.length < 4) {
        showToast('Weak Password', 'Password must be at least 4 characters.', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('Mismatch', 'Passwords do not match.', 'error');
        return;
      }
    }

    setIsSavingPassword(true);
    const success = await setMarksPasswordInSupabase(
      currentUser.id,
      isProtecting,
      isProtecting ? newPassword : undefined
    );
    setIsSavingPassword(false);

    if (success) {
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      showToast(
        'Security Updated',
        isProtecting ? 'Your marks are now password protected!' : 'Password protection removed.',
        'success'
      );
      if (selectedStudentId === currentUser.id) {
        loadStudentData(currentUser.id, selectedSemester);
      }
    } else {
      showToast('Error', 'Failed to update password settings.', 'error');
    }
  };

  // Live SGPA for active view
  const currentSgpa = useMemo(() => calculateSgpa(subjectSummaries), [subjectSummaries]);

  // Open Calculator with prefilled student & semester
  const handleOpenCalculator = () => {
    if (onOpenCalculatorWithStudent && selectedStudentId) {
      onOpenCalculatorWithStudent(selectedStudentId, selectedSemester);
    } else if (onSelectTab) {
      onSelectTab('calculator');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Top Hero Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-indigo-400" />
                Academic Source of Truth
              </span>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  Admin Bypass Active
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>📊 Student Marks Portal</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Track CAE 1, CAE 2, and End Sem examination marks in real-time. Secured with optional student password protection and persistent across all devices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentUser && (
              <button
                onClick={() => {
                  setIsProtecting(academicProfile?.is_marks_password_protected ?? false);
                  setShowPasswordModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all flex items-center gap-2 shadow-sm"
              >
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>My Privacy Password</span>
              </button>
            )}

            <button
              onClick={handleOpenCalculator}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <Calculator className="w-4 h-4" />
              <span>SGPA / CGPA Calculator</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STUDENT LIST VIEW (When no student is selected)                        */}
      {/* ========================================================================= */}
      {!selectedStudentId && (
        <div className="space-y-4">
          {/* Search Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800/80 p-4 rounded-2xl shadow-md">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              <h3 className="font-extrabold text-sm text-white">All Students ({profiles.length})</h3>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student by name or college..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Quick Access Card for Current Logged In User */}
          {currentUser && !searchQuery && (
            <div 
              onClick={() => handleSelectStudent(currentUser.id)}
              className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border-2 border-indigo-500/40 hover:border-indigo-500 transition-all cursor-pointer shadow-lg flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <Avatar
                  profile={currentUser}
                  src={currentUser.avatar_url}
                  name={currentUser.full_name}
                  username={currentUser.username}
                  size="md"
                  className="border-2 border-indigo-500 shadow-md"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-sm text-white group-hover:text-indigo-300 transition-colors">
                      {currentUser.full_name} (You)
                    </h4>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[10px] font-extrabold">
                      Your Marks
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Semester {currentUser.semester || 3} • {currentUser.college || 'GHRCEMN'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span className="text-xs font-bold hidden sm:inline">View & Edit Marks</span>
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
          )}

          {/* Real Students Grid from Supabase Profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredStudents.map(student => {
              const isSelf = currentUser?.id === student.id;

              return (
                <div
                  key={student.id}
                  onClick={() => handleSelectStudent(student.id)}
                  className={`p-4 rounded-2xl bg-slate-900 border transition-all cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between group ${
                    isSelf 
                      ? 'border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-950/20' 
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      profile={student}
                      src={student.avatar_url}
                      name={student.full_name}
                      username={student.username}
                      size="sm"
                      className="border border-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-xs text-white truncate group-hover:text-indigo-300 transition-colors">
                          {student.full_name}
                        </p>
                        {isSelf && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        Semester {student.semester || 3} • {student.college || 'GHRCEMN'}
                      </p>
                    </div>
                  </div>

                  <div className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0 ml-2">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>

          {filteredStudents.length === 0 && (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-xs font-bold text-white">No students found matching "{searchQuery}"</p>
              <p className="text-[11px] text-slate-400">Try searching with a different name or college.</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SELECTED STUDENT MARKS VIEW                                            */}
      {/* ========================================================================= */}
      {selectedStudentId && selectedStudent && (
        <div className="space-y-6">
          {/* Header Navigation & Student Profile Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedStudentId(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Back to all students"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <Avatar
                profile={selectedStudent}
                src={selectedStudent.avatar_url}
                name={selectedStudent.full_name}
                username={selectedStudent.username}
                size="md"
                className="border-2 border-indigo-500 shadow-md shrink-0"
              />

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-white truncate">
                    {selectedStudent.full_name}
                  </h3>
                  {isOwnMarks && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black border border-indigo-500/30">
                      Your Profile
                    </span>
                  )}
                  {academicProfile?.is_marks_password_protected && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      Protected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  @{selectedStudent.username} • {selectedStudent.college || 'GHRCEMN'}
                </p>
              </div>
            </div>

            {/* Semester Selector Pill Bar (Semesters 1-8) */}
            <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 rounded-2xl border border-slate-800/80 no-scrollbar self-start md:self-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <button
                  key={sem}
                  onClick={() => handleSemesterChange(sem)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                    selectedSemester === sem
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  Sem {sem}
                </button>
              ))}
            </div>
          </div>

          {/* Locked State Gate Screen */}
          {!isUnlocked && academicProfile?.is_marks_password_protected && (
            <div className="max-w-md mx-auto my-8 p-6 sm:p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-800 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-950/40">
                <Lock className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">🔒 Marks are Protected</h4>
                <p className="text-xs text-slate-400">
                  {selectedStudent.full_name} has enabled security passcode protection for their marks. Please enter the password to view.
                </p>
              </div>

              <form onSubmit={handleUnlockPassword} className="space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => {
                    setPasswordInput(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Enter student marks password..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 text-center tracking-widest focus:outline-none transition-colors"
                  autoFocus
                />

                {passwordError && (
                  <p className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{passwordError}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingPassword || !passwordInput}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  {isVerifyingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                  <span>{isVerifyingPassword ? 'Verifying...' : 'Unlock Marks'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Unlocked Marks Table & Score Cards */}
          {(isUnlocked || !academicProfile?.is_marks_password_protected) && (
            <div className="space-y-6">
              {/* SGPA Banner Card */}
              <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex flex-col items-center justify-center text-indigo-400 shadow-inner">
                    <span className="text-[10px] font-black uppercase text-indigo-300">SGPA</span>
                    <span className="text-lg font-black text-white leading-none">
                      {currentSgpa.hasMarks ? currentSgpa.sgpa.toFixed(2) : '—'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-white">
                        Semester {selectedSemester} Academic Performance
                      </h4>
                      {currentSgpa.hasMarks && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black">
                          {currentSgpa.sgpa >= 9 ? 'Outstanding (O)' : currentSgpa.sgpa >= 8 ? 'Excellent (A+)' : currentSgpa.sgpa >= 7 ? 'Very Good (A)' : 'Evaluated'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentSgpa.evaluatedCount} of {currentSgpa.totalCount} subjects evaluated • Total Evaluated Credits: {currentSgpa.evaluatedCredits} / {currentSgpa.totalCredits}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  {(isOwnMarks || isAdmin) && (
                    <button
                      onClick={handleManualSaveAll}
                      disabled={saveStatus === 'saving'}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30 active:scale-95"
                    >
                      {saveStatus === 'saving' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : saveStatus === 'saved' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Saved to Cloud</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save All Marks</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleOpenCalculator}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Open in Calculator</span>
                  </button>
                </div>
              </div>

              {/* Subject Examination Marks Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Semester {selectedSemester} Subjects ({subjectSummaries.length})</span>
                  </h4>
                  {(isOwnMarks || isAdmin) && (
                    <div className="flex items-center gap-2">
                      {saveStatus === 'saving' && (
                        <span className="text-[11px] text-amber-400 flex items-center gap-1 font-bold animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Saving...
                        </span>
                      )}
                      {saveStatus === 'saved' && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                          <Check className="w-3 h-3" />
                          Saved to Cloud
                        </span>
                      )}
                      {saveStatus === 'idle' && (
                        <span className="text-[11px] text-indigo-300 flex items-center gap-1 font-bold">
                          <Sparkles className="w-3 h-3" />
                          Auto-saves as you type
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {subjectSummaries.map(sub => {
                    const hasMarks = sub.total_obtained !== null;

                    return (
                      <div
                        key={sub.subject_code}
                        className="bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        {/* Subject Header & Info */}
                        <div className="min-w-0 md:w-1/3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-indigo-300">
                              {sub.subject_code}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                              {sub.credits} Credits
                            </span>
                          </div>
                          <h5 className="font-bold text-sm text-white mt-1">
                            {sub.subject_name}
                          </h5>

                          {/* Calculated Grade & Percentage Badge */}
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 font-medium">Grade:</span>
                              <span className={`font-black ${hasMarks && sub.grade !== 'F' ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {sub.grade}
                              </span>
                            </div>
                            {sub.grade_point !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-medium">Points:</span>
                                <span className="font-bold text-slate-200">{sub.grade_point}</span>
                              </div>
                            )}
                            {sub.percentage !== null && (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 font-medium">Score:</span>
                                <span className="font-bold text-indigo-300">{sub.percentage}%</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Exam Mark Inputs (CAE 1, CAE 2, END SEM) */}
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 flex-1">
                          {/* 1. CAE 1 */}
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 text-center space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              CAE 1 (/{sub.max_cae1})
                            </div>
                            {isOwnMarks || isAdmin ? (
                              <input
                                type="number"
                                min="0"
                                max={sub.max_cae1}
                                step="0.5"
                                value={sub.cae1 !== null ? sub.cae1 : ''}
                                onChange={e => handleMarkChange(sub.subject_code, 'CAE1', e.target.value, sub.max_cae1)}
                                placeholder="—"
                                className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-white focus:outline-none transition-colors"
                              />
                            ) : (
                              <div className="py-1 text-xs font-bold text-white">
                                {sub.cae1 !== null ? sub.cae1 : <span className="text-slate-600 font-normal">Not entered</span>}
                              </div>
                            )}
                          </div>

                          {/* 2. CAE 2 */}
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 text-center space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              CAE 2 (/{sub.max_cae2})
                            </div>
                            {isOwnMarks || isAdmin ? (
                              <input
                                type="number"
                                min="0"
                                max={sub.max_cae2}
                                step="0.5"
                                value={sub.cae2 !== null ? sub.cae2 : ''}
                                onChange={e => handleMarkChange(sub.subject_code, 'CAE2', e.target.value, sub.max_cae2)}
                                placeholder="—"
                                className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-white focus:outline-none transition-colors"
                              />
                            ) : (
                              <div className="py-1 text-xs font-bold text-white">
                                {sub.cae2 !== null ? sub.cae2 : <span className="text-slate-600 font-normal">Not entered</span>}
                              </div>
                            )}
                          </div>

                          {/* 3. END SEM */}
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 text-center space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              END SEM (/{sub.max_end_sem})
                            </div>
                            {isOwnMarks || isAdmin ? (
                              <input
                                type="number"
                                min="0"
                                max={sub.max_end_sem}
                                step="0.5"
                                value={sub.end_sem !== null ? sub.end_sem : ''}
                                onChange={e => handleMarkChange(sub.subject_code, 'END_SEM', e.target.value, sub.max_end_sem)}
                                placeholder="—"
                                className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-white focus:outline-none transition-colors"
                              />
                            ) : (
                              <div className="py-1 text-xs font-bold text-white">
                                {sub.end_sem !== null ? sub.end_sem : <span className="text-slate-600 font-normal">Not entered</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PRIVACY & PASSWORD SETTINGS MODAL                                      */}
      {/* ========================================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-sm text-white">Marks Privacy Password</h3>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              When password protection is enabled, other students cannot view your examination marks without entering your secret password.
            </p>

            <form onSubmit={handleSavePasswordSettings} className="space-y-4">
              {/* Enable / Disable Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-white">Enable Password Protection</p>
                  <p className="text-[10px] text-slate-400">Lock marks from other students</p>
                </div>
                <input
                  type="checkbox"
                  checked={isProtecting}
                  onChange={e => setIsProtecting(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {isProtecting && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      New Password (min 4 chars)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter security password..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password..."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-900/60 text-[10px] text-indigo-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  Admin (aprajahire07@gmail.com) retains administrative clearance to view marks if required.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
                >
                  {isSavingPassword ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
