import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Search, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Award, 
  BookOpen, 
  User, 
  RefreshCw,
  KeyRound,
  GraduationCap
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { Profile, SubjectMarkSummary } from '../../types';
import { 
  fetchMarksFromSupabase, 
  fetchAcademicProfileFromSupabase, 
  setMarksPasswordInSupabase,
  fetchSemesterResultsFromSupabase 
} from '../../services/marks';
import { 
  getCurriculumForCollegeAndSemester, 
  computeSubjectMarkSummary, 
  calculateSgpa,
  calculateCgpa 
} from '../../lib/academicCurriculum';
import { Avatar } from '../ui/Avatar';
import { useToast } from '../ui/Toast';

export const AdminMarksManagementView: React.FC = () => {
  useAppStore();
  const { showToast } = useToast();
  const profiles = appStore.profiles;

  const [selectedStudentId, setSelectedStudentId] = useState<string>(profiles[0]?.id || '');
  const [selectedSemester, setSelectedSemester] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [subjectSummaries, setSubjectSummaries] = useState<SubjectMarkSummary[]>([]);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [cgpaScore, setCgpaScore] = useState<number>(0);

  const selectedStudent = useMemo(() => {
    return profiles.find(p => p.id === selectedStudentId) || profiles[0] || null;
  }, [profiles, selectedStudentId]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return profiles;
    return profiles.filter(p => 
      p.full_name.toLowerCase().includes(q) || 
      p.username.toLowerCase().includes(q) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  }, [profiles, searchQuery]);

  const loadStudentAdminData = async (studentId: string, sem: number) => {
    if (!studentId) return;
    setIsLoading(true);

    try {
      const studentProfile = profiles.find(p => p.id === studentId);
      const [acad, rawMarks, semResults] = await Promise.all([
        fetchAcademicProfileFromSupabase(studentId, studentProfile),
        fetchMarksFromSupabase(studentId, sem),
        fetchSemesterResultsFromSupabase(studentId)
      ]);

      setIsPasswordProtected(acad.is_marks_password_protected);

      const curriculum = getCurriculumForCollegeAndSemester(studentProfile?.college, sem);
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

      const cgpaInfo = calculateCgpa(semResults.map(r => ({ semester: r.semester, sgpa: r.sgpa, credits: r.total_credits })));
      setCgpaScore(cgpaInfo.cgpa);
    } catch (err) {
      console.warn('Error loading student marks for admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentAdminData(selectedStudentId, selectedSemester);
    }
  }, [selectedStudentId, selectedSemester]);

  const handleRemovePasswordProtection = async () => {
    if (!selectedStudentId) return;
    const ok = await setMarksPasswordInSupabase(selectedStudentId, false);
    if (ok) {
      setIsPasswordProtected(false);
      showToast('Protection Removed', 'Student marks password lock cleared by admin master access.', 'success');
    }
  };

  const sgpaInfo = useMemo(() => calculateSgpa(subjectSummaries), [subjectSummaries]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Student Academic Marks & SGPA Master View</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Admin master access grants full visibility over all student marks without requiring individual passwords.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Master Bypass Active
          </span>
        </div>
      </div>

      {/* Student Selector & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Student List Column */}
        <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search student..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
            {filteredStudents.map(student => {
              const isSelected = student.id === selectedStudentId;
              return (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <Avatar
                    profile={student}
                    src={student.avatar_url}
                    name={student.full_name}
                    username={student.username}
                    size="xs"
                    className="border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs truncate">{student.full_name}</p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                      @{student.username} • Sem {student.semester || 3}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Student Details & Marks Column */}
        <div className="md:col-span-2 space-y-4">
          {selectedStudent && (
            <div className="space-y-4">
              {/* Profile Card & Semester Picker */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    profile={selectedStudent}
                    src={selectedStudent.avatar_url}
                    name={selectedStudent.full_name}
                    username={selectedStudent.username}
                    size="md"
                    className="border border-indigo-500"
                  />
                  <div>
                    <h4 className="font-black text-sm text-white">{selectedStudent.full_name}</h4>
                    <p className="text-xs text-slate-400">
                      {selectedStudent.email} • {selectedStudent.college || 'GHRCEMN'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPasswordProtected && (
                    <button
                      onClick={handleRemovePasswordProtection}
                      className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 hover:text-white text-[10px] font-bold transition-colors flex items-center gap-1"
                      title="Clear password protection"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Clear Password Lock</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Semester Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-950 rounded-xl border border-slate-800 no-scrollbar">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSemester(s)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      selectedSemester === s
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sem {s}
                  </button>
                ))}
              </div>

              {/* SGPA & CGPA Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Semester {selectedSemester} SGPA</span>
                  <p className="text-lg font-black text-white mt-0.5">
                    {sgpaInfo.hasMarks ? sgpaInfo.sgpa.toFixed(2) : '—'}
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Cumulative CGPA</span>
                  <p className="text-lg font-black text-indigo-400 mt-0.5">
                    {cgpaScore > 0 ? cgpaScore.toFixed(2) : '—'}
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Evaluated Credits</span>
                  <p className="text-lg font-black text-emerald-400 mt-0.5">
                    {sgpaInfo.evaluatedCredits} / {sgpaInfo.totalCredits}
                  </p>
                </div>
              </div>

              {/* Marks Table */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Subject</th>
                      <th className="p-3 text-center">Credits</th>
                      <th className="p-3 text-center">CAE 1</th>
                      <th className="p-3 text-center">CAE 2</th>
                      <th className="p-3 text-center">End Sem</th>
                      <th className="p-3 text-center">Total</th>
                      <th className="p-3 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-200">
                    {subjectSummaries.map(sub => (
                      <tr key={sub.subject_code} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <p className="font-bold text-white">{sub.subject_name}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{sub.subject_code}</span>
                        </td>
                        <td className="p-3 text-center font-bold text-indigo-300">{sub.credits}</td>
                        <td className="p-3 text-center font-mono">
                          {sub.cae1 !== null ? `${sub.cae1}/${sub.max_cae1}` : '—'}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {sub.cae2 !== null ? `${sub.cae2}/${sub.max_cae2}` : '—'}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {sub.end_sem !== null ? `${sub.end_sem}/${sub.max_end_sem}` : '—'}
                        </td>
                        <td className="p-3 text-center font-bold font-mono">
                          {sub.total_obtained !== null ? `${sub.total_obtained}/${sub.total_max}` : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-black text-[10px] ${
                            sub.grade !== '—' && sub.grade !== 'F' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'text-slate-500'
                          }`}>
                            {sub.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
