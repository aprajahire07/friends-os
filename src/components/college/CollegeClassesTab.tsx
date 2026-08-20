import React, { useState } from 'react';
import { 
  GraduationCap, 
  CalendarDays, 
  Check, 
  X, 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  Send, 
  CheckCircle2,
  Minus,
  Calculator,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  BarChart3,
  Award
} from 'lucide-react';
import { appStore, useAppStore } from '../../lib/store';
import { 
  resolveCollegeId, 
  getCollegeName, 
  getAcademicSlotsForDate, 
  getSpecialDateInfo,
  calculateAttendanceSummaries,
  getAcademicSubjectsForCollege,
  TIMETABLES,
  SEMESTER_CONFIG
} from '../../lib/timetables';
import { useToast } from '../ui/Toast';

interface CollegeClassesTabProps {
  onSelectTab?: (tab: string) => void;
}

export const CollegeClassesTab: React.FC<CollegeClassesTabProps> = ({ onSelectTab }) => {
  const { showToast } = useToast();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'today' | 'dashboard' | 'calendar' | 'timetable' | 'assignments' | 'ai_tutor'>('today');

  // Selected date state (Default to 2026-08-13 or Today)
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-13');

  // Target Attendance Calculator adjustment
  const [targetPercent, setTargetPercent] = useState<number>(75);

  // Calendar filter state
  const [calendarFilter, setCalendarFilter] = useState<'week' | 'month' | 'semester'>('month');

  // AI Tutor States
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponses, setAiResponses] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    {
      role: 'ai',
      text: "Hey! I'm your FRIEND OS AI College Tutor. Ask me to explain DSA algorithms, solve DMGT proof problems, or summarize lecture notes! 🎓✨",
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  const store = useAppStore();
  const currentUser = store.currentUser;
  const collegeId = resolveCollegeId(currentUser.college);
  const collegeName = getCollegeName(collegeId);

  // Date Navigation Helpers
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const handleMark = (slotTime: string, subjectCode: string, subjectName: string, status: 'attended' | 'absent' | 'cancelled') => {
    if (status === 'cancelled') {
      appStore.reportGroupCancellation(selectedDate, slotTime, subjectCode, subjectName);
      showToast('Reported Cancellation ⚠️', 'Notified classmates & marked class as cancelled', 'info');
    } else {
      appStore.markDateAttendance(selectedDate, slotTime, subjectCode, subjectName, status);
      showToast(
        status === 'attended' ? 'Marked Attended ✓' : 'Marked Absent ✕',
        `${subjectCode} on ${selectedDate}`,
        status === 'attended' ? 'success' : 'info'
      );
    }
  };

  const handleConfirmCancellation = (reportId: string, confirm: boolean) => {
    appStore.confirmGroupCancellation(reportId, confirm);
    showToast(
      confirm ? 'Cancellation Confirmed' : 'Report Dismissed',
      confirm ? 'Class marked as cancelled' : 'Kept standard status',
      'info'
    );
  };

  // AI Tutor Submit
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    const userText = aiPrompt.trim();
    setAiPrompt('');
    setAiResponses(prev => [...prev, { role: 'user', text: userText }]);
    setAiLoading(true);

    try {
      const res = await fetch('/api/ai/college-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, college: currentUser.college }),
      });

      const data = await res.json();
      setAiResponses(prev => [
        ...prev,
        { role: 'ai', text: data.response || 'Failed to get response from AI.' },
      ]);
    } catch (err) {
      setAiResponses(prev => [
        ...prev,
        { role: 'ai', text: "Sorry, couldn't connect to AI Tutor server right now." },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Data Calculations
  const dateSlots = getAcademicSlotsForDate(collegeId, selectedDate);
  const specialDate = getSpecialDateInfo(collegeId, selectedDate);
  const cancellationReportsForDate = appStore.cancellationReports.filter(
    r => r.college_id === collegeId && r.date === selectedDate
  );

  const summaries = calculateAttendanceSummaries(appStore.dateAttendanceRecords, collegeId);

  // Date formatting helpers
  const formattedDateString = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 md:pb-12">
      {/* College Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-[10px] font-black text-cyan-400 uppercase tracking-wider">
                {collegeName}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Sem 3rd • Sec A</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-1 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-cyan-400" />
              <span>College & Attendance</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold">Overall:</span>
            <span className={`text-base font-black ${
              summaries.overallPercentage >= 80 ? 'text-emerald-400' : summaries.overallPercentage >= 75 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {summaries.overallPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex gap-1.5 p-1.5 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x">
        <button
          onClick={() => setActiveTab('today')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'today' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Today's Classes</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'dashboard' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Attendance</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'calendar' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Calendar</span>
        </button>

        <button
          onClick={() => setActiveTab('timetable')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'timetable' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Timetable</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'assignments' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Assignments</span>
        </button>

        {onSelectTab && (
          <>
            <button
              onClick={() => onSelectTab('marks')}
              className="flex-1 min-w-[115px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 bg-blue-950/70 border border-blue-800/60 hover:bg-blue-900/60 text-blue-300 hover:text-white shrink-0"
              title="Track CAE & End Sem Marks"
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
              <span>📊 Marks</span>
            </button>

            <button
              onClick={() => onSelectTab('calculator')}
              className="flex-1 min-w-[125px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 bg-violet-950/70 border border-violet-800/60 hover:bg-violet-900/60 text-violet-300 hover:text-white shrink-0"
              title="Calculate & Simulate SGPA/CGPA"
            >
              <Award className="w-3.5 h-3.5 text-violet-400" />
              <span>🧮 SGPA / CGPA</span>
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('ai_tutor')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'ai_tutor' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Tutor</span>
        </button>
      </div>

      {/* TAB 1: TODAY'S CLASSES */}
      {activeTab === 'today' && (
        <div className="space-y-5">
          {/* Date Picker Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-xs font-extrabold text-cyan-300 px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
              />
              {selectedDate === '2026-08-13' && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400">
                  TODAY
                </span>
              )}
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 active:scale-95 transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Special Date / Holiday Banner */}
          {specialDate && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex items-center gap-3">
              <PartyPopper className="w-6 h-6 text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-black text-amber-300">{specialDate.title}</p>
                <p className="text-[11px] text-amber-400/80 mt-0.5">
                  No regular academic classes scheduled for this date.
                </p>
              </div>
            </div>
          )}

          {/* Class Cancellation Group Notifications */}
          {cancellationReportsForDate.length > 0 && (
            <div className="space-y-2">
              {cancellationReportsForDate.map(rep => {
                const isConfirmedByMe = rep.confirmed_by_user_ids.includes(currentUser.id);
                return (
                  <div
                    key={rep.id}
                    className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-2xl space-y-2.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-rose-200">
                          {rep.reported_by_name} reported that {rep.subject_name} ({rep.slot_time}) did not happen.
                        </p>
                        <p className="text-[10px] text-rose-300/70 mt-0.5">
                          Confirming this excludes the lecture from total conducted classes for attendance calculation.
                        </p>
                      </div>
                    </div>

                    {!isConfirmedByMe ? (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleConfirmCancellation(rep.id, true)}
                          className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-all"
                        >
                          Confirm Cancellation
                        </button>
                        <button
                          onClick={() => handleConfirmCancellation(rep.id, false)}
                          className="py-1.5 px-3 bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-800 transition-all"
                        >
                          It Happened
                        </button>
                      </div>
                    ) : (
                      <span className="inline-block text-[10px] font-bold text-rose-400 bg-rose-900/50 px-2.5 py-1 rounded-lg">
                        ✓ Confirmed Class Cancelled
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Classes List */}
          {dateSlots.length === 0 && !specialDate ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-300">No Academic Classes Today</p>
              <p className="text-[11px] text-slate-500 mt-1">Enjoy your free time or revise upcoming subjects!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dateSlots.map(slot => {
                const userRecord = appStore.dateAttendanceRecords.find(
                  r => r.user_id === currentUser.id && r.date === selectedDate && r.slot_time === `${slot.start_time}–${slot.end_time}`
                );

                const currentStatus = userRecord?.status;

                return (
                  <div
                    key={slot.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-700"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{slot.subject_name}</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-cyan-400">
                          {slot.subject_code}
                        </span>
                        {slot.subject_code.toLowerCase().includes('practical') && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-950 border border-purple-800 text-purple-300">
                            LAB / PRACTICAL
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-slate-300 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-cyan-400" />
                          {slot.start_time} – {slot.end_time}
                        </span>
                        {slot.room && (
                          <span className="text-slate-500">• {slot.room}</span>
                        )}
                      </div>
                    </div>

                    {/* Attendance Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMark(`${slot.start_time}–${slot.end_time}`, slot.subject_code, slot.subject_name, 'attended')}
                        className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                          currentStatus === 'attended'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-emerald-950 hover:text-emerald-400 hover:border-emerald-800'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Attended</span>
                      </button>

                      <button
                        onClick={() => handleMark(`${slot.start_time}–${slot.end_time}`, slot.subject_code, slot.subject_name, 'absent')}
                        className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                          currentStatus === 'absent'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-800'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Absent</span>
                      </button>

                      <button
                        onClick={() => handleMark(`${slot.start_time}–${slot.end_time}`, slot.subject_code, slot.subject_name, 'cancelled')}
                        title="Mark as Class Didn't Happen"
                        className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                          currentStatus === 'cancelled'
                            ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:bg-amber-950 hover:text-amber-300 hover:border-amber-800'
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Didn't Happen</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ATTENDANCE DASHBOARD & CALCULATOR */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Overall Attendance Stat Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
            <div>
              <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Overall Attendance</p>
              <h3 className={`text-5xl font-black mt-2 ${
                summaries.overallPercentage >= 80 ? 'text-emerald-400' : summaries.overallPercentage >= 75 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {summaries.overallPercentage}%
              </h3>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80">
                <p className="text-[10px] text-slate-400 font-bold">Conducted</p>
                <p className="text-sm font-black text-white mt-0.5">{summaries.totalConducted}</p>
              </div>
              <div className="bg-emerald-950/30 p-2.5 rounded-2xl border border-emerald-900/50">
                <p className="text-[10px] text-emerald-400 font-bold">Attended</p>
                <p className="text-sm font-black text-emerald-300 mt-0.5">{summaries.totalAttended}</p>
              </div>
              <div className="bg-rose-950/30 p-2.5 rounded-2xl border border-rose-900/50">
                <p className="text-[10px] text-rose-400 font-bold">Absent</p>
                <p className="text-sm font-black text-rose-300 mt-0.5">{summaries.totalAbsent}</p>
              </div>
              <div className="bg-amber-950/30 p-2.5 rounded-2xl border border-amber-900/50">
                <p className="text-[10px] text-amber-400 font-bold">Cancelled</p>
                <p className="text-sm font-black text-amber-300 mt-0.5">{summaries.totalCancelled}</p>
              </div>
            </div>
          </div>

          {/* Attendance Calculator Widget */}
          <div className="bg-gradient-to-br from-slate-900 to-cyan-950/50 border border-cyan-800/60 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-cyan-600/20 rounded-xl text-cyan-400">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Attendance Calculator</h4>
                  <p className="text-[10px] text-slate-400">Target Threshold: {targetPercent}%</p>
                </div>
              </div>

              {/* Target Selector */}
              <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {[75, 80, 85].map(tp => (
                  <button
                    key={tp}
                    onClick={() => setTargetPercent(tp)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all ${
                      targetPercent === tp ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tp}%
                  </button>
                ))}
              </div>
            </div>

            {/* Calculator Calculation Output */}
            {summaries.overallPercentage >= targetPercent ? (
              <div className="bg-emerald-950/50 border border-emerald-800/80 p-4 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-200">
                    Safe Zone! You can miss approx{' '}
                    <span className="text-sm underline text-white font-extrabold">
                      {Math.max(0, Math.floor(summaries.totalAttended / (targetPercent / 100) - summaries.totalConducted))}
                    </span>{' '}
                    more class(es) while staying above {targetPercent}%.
                  </p>
                  <p className="text-[10px] text-emerald-300/80 mt-1">
                    Keep logging your classes to maintain safe academic margins.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/50 border border-rose-800/80 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-rose-200">
                    Warning! You need to attend{' '}
                    <span className="text-sm underline text-white font-extrabold">
                      {Math.max(0, Math.ceil(((targetPercent / 100) * summaries.totalConducted - summaries.totalAttended) / (1 - targetPercent / 100)))}
                    </span>{' '}
                    consecutive classes to reach {targetPercent}%.
                  </p>
                  <p className="text-[10px] text-rose-300/80 mt-1">
                    Avoid taking any further unexcused absences in upcoming lectures.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Subject Breakdown Cards */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-300 uppercase mb-3">
              Per-Subject Attendance ({collegeName})
            </h4>

            <div className="space-y-3">
              {summaries.subjects.map(sub => (
                <div key={sub.subject_code} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black text-white">{sub.subject_name}</h5>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-950 text-cyan-400 border border-slate-800">
                          {sub.subject_code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Attended {sub.attended} of {sub.conducted} conducted classes
                        {sub.cancelled > 0 && ` (${sub.cancelled} cancelled)`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`text-base font-black ${
                        sub.percentage >= 80 ? 'text-emerald-400' : sub.percentage >= 75 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {sub.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        sub.percentage >= 80 ? 'bg-emerald-500' : sub.percentage >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, sub.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-cyan-400" />
              <span>Attendance History</span>
            </h4>

            <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
              <button
                onClick={() => setCalendarFilter('week')}
                className={`px-2.5 py-1 rounded-lg ${calendarFilter === 'week' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
              >
                This Week
              </button>
              <button
                onClick={() => setCalendarFilter('month')}
                className={`px-2.5 py-1 rounded-lg ${calendarFilter === 'month' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
              >
                August 2026
              </button>
            </div>
          </div>

          {/* Logged Date Chips Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'].map(dateStr => {
              const dayRecs = appStore.dateAttendanceRecords.filter(
                r => r.user_id === currentUser.id && r.date === dateStr
              );

              const isSelected = selectedDate === dateStr;
              const special = getSpecialDateInfo(collegeId, dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setActiveTab('today');
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500 text-white ring-1 ring-cyan-500'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <p className="text-xs font-black text-white">
                    {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>

                  {special ? (
                    <span className="inline-block mt-2 text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-md">
                      🌴 {special.title}
                    </span>
                  ) : dayRecs.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {dayRecs.map(r => (
                        <span
                          key={r.id}
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                            r.status === 'attended'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : r.status === 'absent'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {r.subject_code}: {r.status === 'attended' ? '✓' : r.status === 'absent' ? '✕' : '—'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="inline-block mt-2 text-[10px] text-slate-500 italic">
                      Tap to view schedule
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: TIMETABLE VIEW */}
      {activeTab === 'timetable' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span>Full Weekly Timetable — {collegeName}</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-1">
              Semester 3rd, Section-A official schedule.
            </p>
          </div>

          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6].map(dayNum => {
              const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum - 1];
              const tt = TIMETABLES[collegeId] || TIMETABLES[resolveCollegeId('GHRCE')];
              const slots = tt.slots.filter(s => s.day_of_week === dayNum);

              return (
                <div key={dayNum} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                  <h5 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider">{dayName}</h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {slots.map(s => (
                      <div
                        key={s.id}
                        className={`p-2.5 rounded-xl border text-xs ${
                          s.is_academic
                            ? 'bg-slate-950 border-slate-800 text-white'
                            : 'bg-slate-950/40 border-slate-900 text-slate-500 italic'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold">{s.subject_name}</span>
                          <span className="text-[10px] text-slate-400">{s.start_time}–{s.end_time}</span>
                        </div>
                        {s.room && <p className="text-[10px] text-slate-400 mt-0.5">{s.room}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Academic Assignments</span>
            </h4>
          </div>

          <div className="space-y-2.5">
            {appStore.assignments.map(ass => (
              <div
                key={ass.id}
                onClick={() => {
                  appStore.toggleAssignment(ass.id);
                  showToast('Updated', 'Assignment status changed', 'success');
                }}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                  ass.is_completed
                    ? 'bg-slate-950/60 border-slate-800/80 text-slate-500 opacity-75'
                    : 'bg-slate-900 border-slate-800 text-white hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase">{ass.subject}</span>
                  <p className={`text-xs font-black ${ass.is_completed ? 'line-through' : 'text-white'}`}>
                    {ass.title}
                  </p>
                  <p className="text-[10px] text-slate-400">Due Date: {ass.due_date}</p>
                </div>

                <div className={`p-2 rounded-xl border ${
                  ass.is_completed ? 'bg-emerald-950 border-emerald-800 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-500'
                }`}>
                  <Check className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AI TUTOR */}
      {activeTab === 'ai_tutor' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles className="w-5 h-5" />
            <h4 className="text-sm font-black text-white">AI College & Study Tutor</h4>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto p-3 bg-slate-950 rounded-2xl border border-slate-800">
            {aiResponses.map((res, i) => (
              <div
                key={i}
                className={`p-3 rounded-2xl text-xs ${
                  res.role === 'user'
                    ? 'bg-purple-950/80 text-purple-100 border border-purple-800 text-right ml-8'
                    : 'bg-slate-900 text-slate-200 border border-slate-800 mr-8'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{res.text}</p>
              </div>
            ))}
            {aiLoading && (
              <p className="text-xs text-purple-400 italic text-center animate-pulse">
                Gemini AI is generating answer...
              </p>
            )}
          </div>

          <form onSubmit={handleAiSubmit} className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Ask about DSA, DMGT proofs, exam notes..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={aiLoading}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
