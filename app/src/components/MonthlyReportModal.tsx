import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { X, Send, FileText, CheckCircle2, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import toast from 'react-hot-toast';

interface MonthlyReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: {
        id: number;
        full_name: string;
        contact_number?: string;
        parent_contact?: string;
    };
    currentUserRole: string; // 'admin' | 'head_coach'
    items?: any;
}

export default function MonthlyReportModal({ isOpen, onClose, student, currentUserRole }: MonthlyReportModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
    const [stats, setStats] = useState({ present: 0, absent: 0, total: 0 });
    const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
    const [monthlyAssessments, setMonthlyAssessments] = useState<any[]>([]);
    const [evaluations, setEvaluations] = useState({
        technical: '',
        behavior: '',
        notes: ''
    });

    // Fetch attendance stats when month or student changes
    useEffect(() => {
        if (isOpen && student?.id) {
            calculateAttendanceStats();
        }
    }, [isOpen, student, selectedMonth]);

    const calculateAttendanceStats = async () => {
        setCalculating(true);
        try {
            const date = new Date(selectedMonth);
            const startStr = startOfMonth(date).toISOString();
            const endStr = endOfMonth(date).toISOString();

            // Fetch attendance records for this student in this month
            const { data, error } = await supabase
                .from('student_attendance')
                .select('status, date')
                .eq('student_id', student.id)
                .gte('date', startStr)
                .lte('date', endStr);

            if (error) throw error;

            const present = data?.filter(r => r.status === 'present' || r.status === 'completed').length || 0;
            const absent = data?.filter(r => r.status === 'absent').length || 0;

            setStats({
                present,
                absent,
                total: present + absent
            });
            setAttendanceRecords(data || []);

            // Fetch assessments for this student in this month
            const { data: assessData, error: assessError } = await supabase
                .from('skill_assessments')
                .select('*')
                .eq('student_id', student.id)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: true });

            if (assessError) throw assessError;
            setMonthlyAssessments(assessData || []);

        } catch (error) {
            console.error('Error calculating stats:', error);
            toast.error('Failed to calculate attendance');
        } finally {
            setCalculating(false);
        }
    };

    const handleSendReport = async () => {
        if (!stats.total && !evaluations.technical) {
            toast.error('Please add some data to the report');
            return;
        }

        setLoading(true);
        try {
            // 1. Save Report to Database
            const { error: saveError } = await supabase
                .from('monthly_reports')
                .insert({
                    student_id: student.id,
                    month_year: selectedMonth,
                    attendance_count: stats.present,
                    absence_count: stats.absent,
                    technical_evaluation: evaluations.technical,
                    behavior_evaluation: evaluations.behavior,
                    is_sent: true
                });

            if (saveError) throw saveError;

            // 2. Prepare WhatsApp Message
            const monthName = format(new Date(selectedMonth), 'MMMM yyyy');

            const message = `
*Epic Gymnastics Academy - Monthly Report* 🤸‍♂️
----------------------------------
📅 *Month:* ${monthName}
👤 *Gymnast:* ${student.full_name}

📊 *Attendance Summary:*
✅ Present: ${stats.present} sessions
${attendanceRecords.filter(r => r.status === 'present' || r.status === 'completed').length > 0 ? `📅 Dates: ${attendanceRecords.filter(r => r.status === 'present' || r.status === 'completed').map(r => format(new Date(r.date), 'dd/MM')).join(', ')}` : ''}

❌ Absent: ${stats.absent} sessions
${attendanceRecords.filter(r => r.status === 'absent').length > 0 ? `📅 Dates: ${attendanceRecords.filter(r => r.status === 'absent').map(r => format(new Date(r.date), 'dd/MM')).join(', ')}` : ''}
----------------------------------

🏆 *Technical Evaluation:*
${evaluations.technical || 'Excellent progress this month.'}

${monthlyAssessments.length > 0 ? `📊 *Assessment Results:*
${monthlyAssessments.map(a => {
                const skillList = Array.isArray(a.skills)
                    ? a.skills.map((s: any) => `  - ${s.name}: ${s.score}/${s.max_score}`).join('\n')
                    : '';
                return `*${a.title.toUpperCase()}*\n${skillList}\n*Total: ${a.total_score}*`;
            }).join('\n\n')}
` : ''}
📝 *Coach Notes:*
${evaluations.behavior || 'Great attitude and focus!'}

----------------------------------
*Best Regards,*
*Epic Gymnastics Team* 🏅
            `.trim();

            // Prioritize the specific "WhatsApp for Reports" field (parent_contact)
            const phoneNumber = student.parent_contact || student.contact_number;

            if (!phoneNumber) {
                toast.error('No WhatsApp number found (Check "WhatsApp for Reports" field)');
                return;
            }

            // Clean phone number (remove spaces, etc, ensure international format if needed)
            const codedMsg = encodeURIComponent(message);
            const waUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${codedMsg}`;

            // Open WhatsApp
            window.open(waUrl, '_blank');

            toast.success('Report saved & WhatsApp opened!');
            onClose();

        } catch (error) {
            console.error('Error sending report:', error);
            toast.error('Failed to save report');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-[#0E1D21] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/20">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-wider">Monthly Progress Report</h2>
                            <p className="text-sm font-medium text-white/40">{student?.full_name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">

                    {/* Month Selection & Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-white/40 ml-1">Select Month</label>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary/50 outline-none transition-colors"
                            />
                        </div>

                        {/* Stats Display */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between">
                            {calculating ? (
                                <div className="flex items-center gap-2 text-white/40 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Calculating...
                                </div>
                            ) : (
                                <>
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-white">{stats.total}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-white/30">Total</div>
                                    </div>
                                    <div className="w-px h-8 bg-white/10"></div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-emerald-400">{stats.present}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-emerald-400/50">Present</div>
                                    </div>
                                    <div className="w-px h-8 bg-white/10"></div>
                                    <div className="text-center">
                                        <div className="text-2xl font-black text-rose-400">{stats.absent}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-rose-400/50">Absent</div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Detailed Attendance Dates */}
                        {!calculating && stats.total > 0 && (
                            <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Attended Days
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendanceRecords.filter(r => r.status === 'present' || r.status === 'completed').length > 0 ? (
                                            attendanceRecords.filter(r => r.status === 'present' || r.status === 'completed').map((r, i) => (
                                                <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-bold">
                                                    {format(new Date(r.date), 'MMM dd')}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[10px] text-white/20 uppercase font-black tracking-tighter">No sessions recorded</span>
                                        )}
                                    </div>
                                </div>
                                <div className="h-px bg-white/5"></div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-3 h-3" />
                                        Missed Days
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {attendanceRecords.filter(r => r.status === 'absent').length > 0 ? (
                                            attendanceRecords.filter(r => r.status === 'absent').map((r, i) => (
                                                <span key={i} className="text-[10px] bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-lg border border-rose-500/20 font-bold">
                                                    {format(new Date(r.date), 'MMM dd')}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-[10px] text-white/20 uppercase font-black tracking-tighter">No absences recorded</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Report Content */}
                    <div className="space-y-6">
                        {monthlyAssessments.length > 0 && (
                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                <div className="px-4 py-2 bg-emerald-500/10 border-b border-white/10 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Found Assessments</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">{monthlyAssessments.length}</span>
                                </div>
                                <div className="p-3 space-y-3">
                                    {monthlyAssessments.map(a => (
                                        <div key={a.id} className="bg-white/[0.02] rounded-lg border border-white/5 overflow-hidden">
                                            <div className="px-3 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">{a.title}</span>
                                                <span className="text-[10px] font-black text-emerald-400">Total: {a.total_score}</span>
                                            </div>
                                            <div className="p-2 grid grid-cols-1 gap-1">
                                                {Array.isArray(a.skills) && a.skills.map((s: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between px-2 py-1 bg-white/[0.01] rounded-md">
                                                        <span className="text-[9px] text-white/50 uppercase font-bold">{s.name}</span>
                                                        <span className="text-[9px] font-black text-emerald-400/80">{s.score}/{s.max_score}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-emerald-400 ml-1">Technical Evaluation</label>
                            <textarea
                                value={evaluations.technical}
                                onChange={(e) => setEvaluations({ ...evaluations, technical: e.target.value })}
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-emerald-500/50 outline-none transition-colors resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-blue-400 ml-1">General Notes & Behavior</label>
                            <textarea
                                value={evaluations.behavior}
                                onChange={(e) => setEvaluations({ ...evaluations, behavior: e.target.value })}
                                className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500/50 outline-none transition-colors resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/10 bg-white/[0.02] flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSendReport}
                        disabled={loading || calculating}
                        className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span className="text-xs font-black uppercase tracking-widest">Send WhatsApp Report</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
