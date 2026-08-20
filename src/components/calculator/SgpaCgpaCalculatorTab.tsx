import { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Sparkles, 
  BookOpen, 
  GraduationCap, 
  Award, 
  Info, 
  Check, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { 
  getCurriculumForCollegeAndSemester, 
  computeSubjectMarkSummary, 
  calculateSgpa, 
  calculateCgpa,
  GRADING_SCALE 
} from '../../lib/academicCurriculum';
import { 
  fetchMarksFromSupabase, 
  saveBulkMarksInSupabase, 
  fetchSemesterResultsFromSupabase, 
  saveSemesterResultInSupabase,
  fetchAcademicProfileFromSupabase 
} from '../../services/marks';
import { SubjectMarkSummary, SemesterResult, ExamType } from '../../types';
import { useToast } from '../ui/Toast';

interface SgpaCgpaCalculatorTabProps {
  initialStudentId?: string | null;
  initialSemester?: number;
  onSelectTab?: (tab: string) => void;
}

interface EditableCalculatorSubject {
  id: string;
  code: string;
  name: string;
  credits: number;
  cae1: number | null;
  max_cae1: number;
  cae2: number | null;
  max_cae2: number;
  end_sem: number | null;
  max_end_sem: number;
  isCustom?: boolean;
}

interface EditableSemesterCgpaItem {
  semester: number;
  sgpa: number;
  credits: number;
  isIncluded: boolean;
}

export const SgpaCgpaCalculatorTab: React.FC<SgpaCgpaCalculatorTabProps> = ({
  initialStudentId,
  initialSemester = 3,
  onSelectTab,
}) => {
  useAppStore();
  const { showToast } = useToast();
  const currentUser = appStore.currentUser;
  const profiles = appStore.profiles;

  // Active calculator mode: 'sgpa' | 'cgpa'
  const [calculatorMode, setCalculatorMode] = useState<'sgpa' | 'cgpa'>('sgpa');
  
  // Student & Semester selection
  const [activeStudentId, setActiveStudentId] = useState<string>(
    initialStudentId || currentUser?.id || (profiles[0]?.id || '')
  );
  const [activeSemester, setActiveSemester] = useState<number>(initialSemester || 3);

  // SGPA Mode: local simulation state
  const [calcSubjects, setCalcSubjects] = useState<EditableCalculatorSubject[]>([]);
  const [isLoadingSgpaData, setIsLoadingSgpaData] = useState(false);
  const [isSavingToMarks, setIsSavingToMarks] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // CGPA Mode: local semester history state
  const [semesterResults, setSemesterResults] = useState<EditableSemesterCgpaItem[]>([]);
  const [isLoadingCgpaData, setIsLoadingCgpaData] = useState(false);
  const [isSavingCgpaResults, setIsSavingCgpaResults] = useState(false);

  // Selected student object
  const activeStudent = useMemo(() => {
    return profiles.find(p => p.id === activeStudentId) || (currentUser?.id === activeStudentId ? currentUser : null);
  }, [profiles, activeStudentId, currentUser]);

  // =========================================================================
  // SGPA CALCULATOR: LOAD & PRE-FILL FROM SAVED MARKS TOOL DATA
  // =========================================================================
  const loadSgpaDataFromMarks = async (studentId: string, sem: number) => {
    if (!studentId) return;
    setIsLoadingSgpaData(true);
    setHasUnsavedChanges(false);

    try {
      const studentProfile = profiles.find(p => p.id === studentId) || (currentUser?.id === studentId ? currentUser : null);
      const curriculum = getCurriculumForCollegeAndSemester(studentProfile?.college, sem);
      const savedMarks = await fetchMarksFromSupabase(studentId, sem);

      const loadedList: EditableCalculatorSubject[] = curriculum.map(curr => {
        const subMarks = savedMarks.filter(m => m.subject_code === curr.code);
        const cae1Obj = subMarks.find(m => m.exam_type === 'CAE1');
        const cae2Obj = subMarks.find(m => m.exam_type === 'CAE2');
        const endSemObj = subMarks.find(m => m.exam_type === 'END_SEM');

        return {
          id: curr.code,
          code: curr.code,
          name: curr.name,
          credits: curr.credits,
          cae1: cae1Obj?.marks ?? null,
          max_cae1: curr.max_cae1,
          cae2: cae2Obj?.marks ?? null,
          max_cae2: curr.max_cae2,
          end_sem: endSemObj?.marks ?? null,
          max_end_sem: curr.max_end_sem,
          isCustom: false,
        };
      });

      setCalcSubjects(loadedList);
    } catch (err) {
      console.warn('Error loading marks into calculator:', err);
    } finally {
      setIsLoadingSgpaData(false);
    }
  };

  // =========================================================================
  // CGPA CALCULATOR: LOAD SEMESTER RESULTS FROM DATABASE
  // =========================================================================
  const loadCgpaDataFromDatabase = async (studentId: string) => {
    if (!studentId) return;
    setIsLoadingCgpaData(true);

    try {
      const dbResults = await fetchSemesterResultsFromSupabase(studentId);

      // Construct standard 8 semesters default list
      const defaultSemesters: EditableSemesterCgpaItem[] = [1, 2, 3, 4, 5, 6, 7, 8].map(s => {
        const found = dbResults.find(r => r.semester === s);
        const defaultCredits = s === 8 ? 17 : (s <= 2 ? 19.5 : 22);
        return {
          semester: s,
          sgpa: found ? Number(found.sgpa) : 0,
          credits: found && found.total_credits > 0 ? Number(found.total_credits) : defaultCredits,
          isIncluded: found ? found.sgpa > 0 : s <= (activeSemester || 3),
        };
      });

      setSemesterResults(defaultSemesters);
    } catch (err) {
      console.warn('Error loading CGPA data from database:', err);
    } finally {
      setIsLoadingCgpaData(false);
    }
  };

  // Trigger loads on mount or student/semester changes
  useEffect(() => {
    if (activeStudentId) {
      loadSgpaDataFromMarks(activeStudentId, activeSemester);
      loadCgpaDataFromDatabase(activeStudentId);
    }
  }, [activeStudentId, activeSemester]);

  // Handle temporary mark edit in calculator (without modifying official marks)
  const handleEditSubjectScore = (
    subjectId: string,
    field: 'cae1' | 'cae2' | 'end_sem' | 'credits',
    rawVal: string
  ) => {
    setHasUnsavedChanges(true);
    setCalcSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;

      if (field === 'credits') {
        const cr = Math.max(1, Math.min(20, Number(rawVal) || 1));
        return { ...sub, credits: cr };
      }

      let parsed: number | null = null;
      if (rawVal.trim() !== '') {
        const num = Number(rawVal);
        if (!isNaN(num)) {
          const maxAllowed = field === 'cae1' ? sub.max_cae1 : field === 'cae2' ? sub.max_cae2 : sub.max_end_sem;
          parsed = Math.max(0, Math.min(maxAllowed, num));
        }
      }

      return { ...sub, [field]: parsed };
    }));
  };

  // Add custom course for simulation
  const handleAddCustomSubject = () => {
    setHasUnsavedChanges(true);
    const customId = `CUSTOM-${Date.now().toString().slice(-4)}`;
    setCalcSubjects(prev => [
      ...prev,
      {
        id: customId,
        code: `ELECTIVE-${prev.length + 1}`,
        name: 'Additional Elective / Course',
        credits: 3,
        cae1: null,
        max_cae1: 15,
        cae2: null,
        max_cae2: 15,
        end_sem: null,
        max_end_sem: 50,
        isCustom: true,
      }
    ]);
  };

  // Remove custom subject
  const handleRemoveSubject = (subjectId: string) => {
    setHasUnsavedChanges(true);
    setCalcSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  // Save changes directly back to official Marks Tool (Supabase)
  const handleSaveToOfficialMarks = async () => {
    if (!activeStudentId) return;
    setIsSavingToMarks(true);

    const payload = calcSubjects.map(s => ({
      subject_code: s.code,
      subject_name: s.name,
      credits: s.credits,
      cae1: s.cae1,
      max_cae1: s.max_cae1,
      cae2: s.cae2,
      max_cae2: s.max_cae2,
      end_sem: s.end_sem,
      max_end_sem: s.max_end_sem,
    }));

    const success = await saveBulkMarksInSupabase(activeStudentId, activeSemester, payload);
    
    // Also save SGPA in semester_results
    const summary = calculatedSgpaSummaries;
    const sgpaResult = calculateSgpa(summary);
    if (sgpaResult.hasMarks) {
      await saveSemesterResultInSupabase(
        activeStudentId,
        activeSemester,
        sgpaResult.sgpa,
        sgpaResult.totalCredits,
        sgpaResult.totalGradePoints
      );
    }

    setIsSavingToMarks(false);

    if (success) {
      setHasUnsavedChanges(false);
      showToast('Marks Updated', 'Calculator values have been successfully saved to your official Marks Tool.', 'success');
      loadCgpaDataFromDatabase(activeStudentId);
    } else {
      showToast('Save Error', 'Could not save marks to database.', 'error');
    }
  };

  // Reset to original saved marks
  const handleResetToSaved = () => {
    loadSgpaDataFromMarks(activeStudentId, activeSemester);
    showToast('Reset Complete', 'Reverted simulator back to saved marks from database.', 'info');
  };

  // Computed Subject summaries for SGPA calculation
  const calculatedSgpaSummaries: SubjectMarkSummary[] = useMemo(() => {
    return calcSubjects.map(sub => {
      const item = {
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        max_cae1: sub.max_cae1,
        max_cae2: sub.max_cae2,
        max_end_sem: sub.max_end_sem,
      };
      return computeSubjectMarkSummary(item, {
        cae1: sub.cae1,
        cae2: sub.cae2,
        end_sem: sub.end_sem,
      });
    });
  }, [calcSubjects]);

  // Live SGPA Score
  const liveSgpa = useMemo(() => calculateSgpa(calculatedSgpaSummaries), [calculatedSgpaSummaries]);

  // Handle CGPA Semester Sgpa edit
  const handleEditCgpaItem = (sem: number, field: 'sgpa' | 'credits' | 'isIncluded', val: any) => {
    setSemesterResults(prev => prev.map(item => {
      if (item.semester !== sem) return item;
      if (field === 'isIncluded') {
        return { ...item, isIncluded: Boolean(val) };
      }
      const num = Number(val) || 0;
      if (field === 'sgpa') {
        return { ...item, sgpa: Math.max(0, Math.min(10, num)) };
      }
      return { ...item, credits: Math.max(1, Math.min(50, num)) };
    }));
  };

  // Save CGPA semester results to Supabase
  const handleSaveCgpaResultsToDatabase = async () => {
    if (!activeStudentId) return;
    setIsSavingCgpaResults(true);

    let allSaved = true;
    for (const item of semesterResults) {
      if (item.sgpa > 0) {
        const ok = await saveSemesterResultInSupabase(
          activeStudentId,
          item.semester,
          item.sgpa,
          item.credits,
          item.sgpa * item.credits
        );
        if (!ok) allSaved = false;
      }
    }

    setIsSavingCgpaResults(false);

    if (allSaved) {
      showToast('CGPA Saved', 'Semester SGPA & credit records persisted to Supabase.', 'success');
    } else {
      showToast('Notice', 'Some semester records were saved locally.', 'info');
    }
  };

  // Live CGPA Score
  const liveCgpa = useMemo(() => {
    const includedEntries = semesterResults
      .filter(r => r.isIncluded && r.sgpa > 0)
      .map(r => ({ semester: r.semester, sgpa: r.sgpa, credits: r.credits }));
    return calculateCgpa(includedEntries);
  }, [semesterResults]);

  // Equivalent Percentage calculation (AICTE formula: (CGPA - 0.75) * 10)
  const equivalentPercentage = useMemo(() => {
    if (liveCgpa.cgpa <= 0) return 0;
    return Math.max(0, Math.round(((liveCgpa.cgpa - 0.75) * 10) * 100) / 100);
  }, [liveCgpa]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-900/50 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Calculator className="w-3 h-3 text-indigo-400" />
                Dual Academic Calculator
              </span>
              {hasUnsavedChanges && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[10px] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Simulation Active (Unsaved)
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>🧮 SGPA & CGPA Calculator</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Simulate expected grades, analyze semester credits, and project cumulative performance with official 10-point university grading formulas.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner self-start md:self-auto">
            <button
              onClick={() => setCalculatorMode('sgpa')}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                calculatorMode === 'sgpa'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>SGPA Calculator</span>
            </button>

            <button
              onClick={() => setCalculatorMode('cgpa')}
              className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                calculatorMode === 'cgpa'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>CGPA Calculator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Student & Semester Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300">Target Student:</span>
          <select
            value={activeStudentId}
            onChange={e => setActiveStudentId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name} {currentUser?.id === p.id ? '(You)' : ''}
              </option>
            ))}
          </select>
        </div>

        {calculatorMode === 'sgpa' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-400 mr-1">Semester:</span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <button
                key={s}
                onClick={() => setActiveSemester(s)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  activeSemester === s
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400'
                }`}
              >
                Sem {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. SGPA CALCULATOR VIEW                                                   */}
      {/* ========================================================================= */}
      {calculatorMode === 'sgpa' && (
        <div className="space-y-6">
          {/* Top Score Gauge & Formula Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Main SGPA Number Card */}
            <div className="md:col-span-1 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                  Semester {activeSemester} Projected SGPA
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {liveSgpa.hasMarks ? liveSgpa.sgpa.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/ 10.00</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Credits:</span>
                  <span className="font-bold text-white">{liveSgpa.evaluatedCredits} / {liveSgpa.totalCredits}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Grade Points:</span>
                  <span className="font-bold text-indigo-300">{liveSgpa.totalGradePoints}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-emerald-400">
                    {liveSgpa.sgpa >= 9 ? 'Outstanding (O)' : liveSgpa.sgpa >= 8 ? 'First Class with Distinction' : liveSgpa.sgpa >= 6 ? 'First Class' : 'In Progress'}
                  </span>
                </div>
              </div>
            </div>

            {/* Formula & Notice Card */}
            <div className="md:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                    SGPA Calculation Formula
                  </h4>
                </div>
                <p className="text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  SGPA = Σ (Subject Credits × Grade Point) / Σ (Subject Credits)
                  <br />
                  <span className="text-indigo-400">
                    = {liveSgpa.totalGradePoints} / {liveSgpa.evaluatedCredits || 1} = {liveSgpa.sgpa.toFixed(2)}
                  </span>
                </p>
                <p className="text-[11px] text-slate-400">
                  ⚡ Values are pre-filled from your official Marks Tool. Editing scores here only simulates what-if scenarios and does not change official records unless you click <strong>Save these changes to Marks Tool</strong>.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={handleSaveToOfficialMarks}
                  disabled={isSavingToMarks}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingToMarks ? 'Saving...' : 'Save these changes to Marks Tool'}</span>
                </button>

                <button
                  onClick={handleResetToSaved}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Saved Marks</span>
                </button>

                <button
                  onClick={handleAddCustomSubject}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Subject</span>
                </button>
              </div>
            </div>
          </div>

          {/* Subject Simulator Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Semester {activeSemester} Subject Simulator ({calcSubjects.length} Courses)</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {calcSubjects.map((sub, index) => {
                const summary = calculatedSgpaSummaries[index];
                const hasGrade = summary && summary.grade_point !== null;

                return (
                  <div
                    key={sub.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Subject Meta */}
                    <div className="min-w-0 md:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-indigo-300">
                          {sub.code}
                        </span>
                        {sub.isCustom && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                            Custom
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-sm text-white mt-1">
                        {sub.name}
                      </h5>

                      {/* Live Calculated Output */}
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">Credits:</span>
                          <input
                            type="number"
                            min="1"
                            max="12"
                            value={sub.credits}
                            onChange={e => handleEditSubjectScore(sub.id, 'credits', e.target.value)}
                            className="w-10 bg-slate-950 border border-slate-800 rounded px-1 text-center font-bold text-white text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">Grade:</span>
                          <span className={`font-black ${hasGrade ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {summary?.grade || '—'}
                          </span>
                        </div>
                        {hasGrade && (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">GP:</span>
                            <span className="font-bold text-indigo-300">{summary.grade_point}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Score Simulator Inputs */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 flex-1">
                      {/* CAE 1 */}
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          CAE 1 (/{sub.max_cae1})
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={sub.max_cae1}
                          step="0.5"
                          value={sub.cae1 !== null ? sub.cae1 : ''}
                          onChange={e => handleEditSubjectScore(sub.id, 'cae1', e.target.value)}
                          placeholder="—"
                          className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-white focus:outline-none"
                        />
                      </div>

                      {/* CAE 2 */}
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          CAE 2 (/{sub.max_cae2})
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={sub.max_cae2}
                          step="0.5"
                          value={sub.cae2 !== null ? sub.cae2 : ''}
                          onChange={e => handleEditSubjectScore(sub.id, 'cae2', e.target.value)}
                          placeholder="—"
                          className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-white focus:outline-none"
                        />
                      </div>

                      {/* END SEM */}
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          END SEM (/{sub.max_end_sem})
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={sub.max_end_sem}
                          step="0.5"
                          value={sub.end_sem !== null ? sub.end_sem : ''}
                          onChange={e => handleEditSubjectScore(sub.id, 'end_sem', e.target.value)}
                          placeholder="—"
                          className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-center text-xs font-bold text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Delete button if custom */}
                    {sub.isCustom && (
                      <button
                        onClick={() => handleRemoveSubject(sub.id)}
                        className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/50 transition-colors"
                        title="Remove custom subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CGPA CALCULATOR VIEW                                                   */}
      {/* ========================================================================= */}
      {calculatorMode === 'cgpa' && (
        <div className="space-y-6">
          {/* CGPA Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Big Cumulative CGPA Card */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                  Cumulative CGPA
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {liveCgpa.cgpa > 0 ? liveCgpa.cgpa.toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">/ 10.00</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Total Credits Tracked:</span>
                  <span className="font-bold text-white">{liveCgpa.totalCredits}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Semesters Evaluated:</span>
                  <span className="font-bold text-indigo-300">{liveCgpa.evaluatedSemestersCount} of 8</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Equivalent Percentage:</span>
                  <span className="font-bold text-emerald-400">{equivalentPercentage}%</span>
                </div>
              </div>
            </div>

            {/* CGPA Formula & Conversion Information */}
            <div className="md:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  <h4 className="font-extrabold text-xs text-white uppercase tracking-wider">
                    CGPA & Percentage Conversion Formula
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-[10px]">CGPA Formula</p>
                    <p className="text-white mt-0.5">CGPA = Σ(SGPA × Credits) / Σ(Credits)</p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-slate-400 text-[10px]">AICTE / University Conversion</p>
                    <p className="text-emerald-400 mt-0.5">Percentage = (CGPA - 0.75) × 10</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Toggle on/off semesters below to include or exclude them from your cumulative score. Click <strong>Save Semester Results</strong> to persist these values in the database.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveCgpaResultsToDatabase}
                  disabled={isSavingCgpaResults}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingCgpaResults ? 'Saving...' : 'Save Semester Results to Database'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Semester-by-Semester Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-400" />
              <span>All Semesters Matrix (1 to 8)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {semesterResults.map(item => (
                <div
                  key={item.semester}
                  className={`p-4 rounded-2xl border transition-all ${
                    item.isIncluded && item.sgpa > 0
                      ? 'bg-slate-950 border-indigo-500/40 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs text-white">Semester {item.semester}</span>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-400">
                      <span>Include</span>
                      <input
                        type="checkbox"
                        checked={item.isIncluded}
                        onChange={e => handleEditCgpaItem(item.semester, 'isIncluded', e.target.checked)}
                        className="w-4 h-4 accent-indigo-600 rounded"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">SGPA</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        value={item.sgpa > 0 ? item.sgpa : ''}
                        onChange={e => handleEditCgpaItem(item.semester, 'sgpa', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white text-center focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Credits</label>
                      <input
                        type="number"
                        min="1"
                        max="40"
                        value={item.credits}
                        onChange={e => handleEditCgpaItem(item.semester, 'credits', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white text-center focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveSemester(item.semester);
                      setCalculatorMode('sgpa');
                    }}
                    className="w-full mt-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-indigo-400 hover:text-white transition-colors flex items-center justify-center gap-1"
                  >
                    <span>View / Edit Semester Marks</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
