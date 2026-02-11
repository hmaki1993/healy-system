import { useState, useEffect } from 'react';
import { X, User, Calendar, Star, ShieldCheck, Clock, Mail, MapPin, Phone, FileText, Send, Plus, Trash2, ChevronRight, Edit2, Award } from 'lucide-react';
import { format, differenceInYears, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import AddAssessmentModal from './AddAssessmentModal';

interface GymnastProfileModalProps {
    student: any;
    onClose: () => void;
}

export default function GymnastProfileModal({ student, onClose }: GymnastProfileModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'overview' | 'tests'>('overview');
    const [assessments, setAssessments] = useState<any[]>([]);
    const [loadingAssessments, setLoadingAssessments] = useState(false);
    const [testToDelete, setTestToDelete] = useState<any | null>(null);
    const [showAddAssessment, setShowAddAssessment] = useState(false);

    useEffect(() => {
        if (student?.id && activeTab === 'tests') fetchAssessments();
    }, [student?.id, activeTab]);

    const fetchAssessments = async () => {
        setLoadingAssessments(true);
        const { data, error } = await supabase
            .from('skill_assessments')
            .select('*')
            .eq('student_id', student.id)
            .order('date', { ascending: false });
        if (!error && data) setAssessments(data);
        setLoadingAssessments(false);
    };

    const confirmDeleteTest = async () => {
        if (!testToDelete) return;

        // Optimistic update
        const originalAssessments = [...assessments];
        setAssessments(prev => prev.filter(a => a.id !== testToDelete));

        const { error } = await supabase.from('skill_assessments').delete().eq('id', testToDelete);
        if (!error) {
            toast.success('Assessment deleted');
            fetchAssessments(); // Re-fetch to be safe
        } else {
            console.error('Assessment deletion error:', error);
            setAssessments(originalAssessments); // Rollback
            toast.error('Failed to delete assessment');
        }
        setTestToDelete(null);
    };

    const calculateAge = (dob: string) => {
        if (!dob) return 'N/A';
        try {
            const birthDate = parseISO(dob);
            const age = differenceInYears(new Date(), birthDate);

            // Safety guard for invalid or extreme dates (preventing ?? mystery)
            if (age > 100 || age < 0) return '??';
            return age;
        } catch {
            return 'N/A';
        }
    };

    const isSuspiciousDate = (dob: string) => {
        if (!dob) return false;
        try {
            const year = parseISO(dob).getFullYear();
            return year < 1920 || year > new Date().getFullYear();
        } catch {
            return true;
        }
    };

    if (!student) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            {/* Ultra-Neutral Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-1000"
                onClick={onClose}
            />

            <div className="w-full max-w-[380px] bg-black/60 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 pt-8 pb-4 border-b border-white/5 bg-[#0E1D21]">
                    <div className="px-8 flex items-start justify-between mb-6">
                        <div className="flex-1 min-w-0 pr-4">
                            <h2 className="text-2xl font-black text-white tracking-widest uppercase mb-1 drop-shadow-lg truncate">
                                {student.full_name}
                            </h2>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">ID: {String(student.id).slice(0, 8)}</span>
                                <div className="w-1 h-1 rounded-full bg-white/20"></div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${student.is_active ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                                    {student.is_active ? t('common.active') : t('common.inactive')}
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500 text-white/60 hover:text-white transition-all border border-white/10 active:scale-90"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex w-full px-6 border-b border-white/5">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 pb-3 text-[9px] font-black uppercase tracking-widest transition-colors relative whitespace-nowrap text-center ${activeTab === 'overview' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
                        >
                            Overview
                            {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTab('tests')}
                            className={`flex-1 pb-3 text-[9px] font-black uppercase tracking-widest transition-colors relative whitespace-nowrap text-center ${activeTab === 'tests' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
                        >
                            Tests
                            {activeTab === 'tests' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"></div>}
                        </button>
                    </div>
                </div>

                {/* Body Content - Flexible Height */}
                <div className="relative z-10 px-8 pt-6 pb-2">
                    <div className="space-y-6">

                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                {/* Bio Brief */}
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-primary/60 font-black text-xl shadow-xl">
                                            {student.full_name?.[0]}
                                        </div>
                                        <div className="flex flex-col">
                                            <p className="text-[11px] font-black text-white/80 uppercase tracking-tight">{student.gender || 'Male'}</p>
                                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.2em]">{student.training_type || 'Artistic'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-3xl font-black tracking-tighter leading-none ${calculateAge(student.birth_date) === '??' ? 'text-rose-500 animate-pulse' : 'text-white/80'}`}>
                                            {calculateAge(student.birth_date)}
                                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{t('common.yrs')}</span>
                                        </p>
                                        <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isSuspiciousDate(student.birth_date) ? 'text-amber-500/80 animate-pulse' : 'text-white/10'}`}>
                                            {isSuspiciousDate(student.birth_date) && '⚠️ '}{t('common.born')} {student.birth_date || 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Registry Items */}
                                <div className="space-y-4">
                                    <div className="p-5 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4">
                                        {/* Primary Contact */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center opacity-40 shrink-0">
                                                    <User className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{t('common.father')}</span>
                                                    <span className="text-[13px] font-black text-white/90 uppercase truncate">{student.father_name || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <span className="text-[15px] font-mono font-black text-primary tracking-wider shrink-0 ml-4 drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]">
                                                {student.contact_number || '---'}
                                            </span>
                                        </div>

                                        {/* Secondary Contact */}
                                        <div className="flex items-center justify-between border-t border-white/[0.05] pt-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center opacity-60 shrink-0 border border-white/5">
                                                    <User className="w-4 h-4 text-white" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{t('students.whatsapp', 'WhatsApp for Reports')}</span>
                                                    <span className="text-[13px] font-black text-white/90 uppercase truncate">{student.mother_name || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <span className="text-[15px] font-mono font-black text-primary tracking-wider shrink-0 ml-4 drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]">
                                                {student.parent_contact || '---'}
                                            </span>
                                        </div>

                                        {/* Address & Email */}
                                        <div className="border-t border-white/[0.05] pt-4 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <Mail className="w-4 h-4 text-white/30" />
                                                <span className="text-[13px] font-bold text-white/60 truncate tracking-tight">{student.email || 'No email provided'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <MapPin className="w-4 h-4 text-white/30" />
                                                <span className="text-[13px] font-bold text-white/60 truncate tracking-tight">{student.address || 'No address provided'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Coach & Sub Info */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-5 rounded-[1.75rem] bg-white/[0.02] border border-white/10 transition-all">
                                            <div className="flex items-center gap-2 mb-1.5 opacity-60">
                                                <ShieldCheck className="w-4 h-4 text-white" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Coach</span>
                                            </div>
                                            <p className="text-[13px] font-black text-white/80 uppercase truncate">
                                                {student.coaches?.full_name?.split(' ')[0] || 'NONE'}
                                            </p>
                                        </div>
                                        <div className="p-5 rounded-[1.75rem] bg-white/[0.02] border border-white/10 transition-all">
                                            <div className="flex items-center gap-2 mb-1.5 opacity-60">
                                                <Clock className="w-4 h-4 text-white" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white">Expiry</span>
                                            </div>
                                            <p className="text-[13px] font-black text-white/80 tracking-widest">
                                                {student.subscription_expiry ? format(new Date(student.subscription_expiry), 'dd/MM/yy') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TESTS TAB */}
                        {activeTab === 'tests' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white/70">Skill Assessments</h3>
                                    <button
                                        onClick={() => setShowAddAssessment(true)}
                                        className="bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                                    >
                                        <Plus className="w-3 h-3" />
                                        New Test
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {loadingAssessments ? (
                                        <div className="text-center py-10 text-white/20 text-xs">Loading tests...</div>
                                    ) : assessments.length === 0 ? (
                                        <div className="text-center py-10 text-white/20 text-xs">No assessments recorded</div>
                                    ) : (
                                        assessments.map((test) => (
                                            <div key={test.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-colors">
                                                <div className="p-4 flex items-center justify-between border-b border-white/5">
                                                    <div>
                                                        <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">{test.title}</h4>
                                                        <span className="text-[10px] text-white/40 uppercase tracking-widest flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {format(parseISO(test.date), 'MMM dd, yyyy')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <div className="text-2xl font-black text-primary leading-none">
                                                                {test.total_score}
                                                            </div>
                                                            <span className="text-[9px] text-white/30 uppercase tracking-widest">Total Score</span>
                                                        </div>
                                                        <button
                                                            onClick={() => setTestToDelete(test.id)}
                                                            className="p-2 hover:bg-rose-500/10 text-white/40 hover:text-rose-500 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-4 space-y-2">
                                                    {test.skills?.map((skill: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center text-xs">
                                                            <span className="text-white/70 font-medium">{skill.name}</span>
                                                            <div className="flex items-center gap-1">
                                                                <span className="font-bold text-white">{skill.score}</span>
                                                                <span className="text-white/30 text-[10px]">/ {skill.max_score}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Synced Action Footer */}
                <div className="relative z-10 px-8 py-8">
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-3xl bg-white text-black hover:bg-white/90 transition-all duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)] active:scale-95 flex items-center justify-center overflow-hidden"
                    >
                        <span className="font-black uppercase tracking-[0.5em] text-[10px]">
                            {t('common.dismiss')}
                        </span>
                    </button>
                </div>
            </div>


            <ConfirmModal
                isOpen={!!testToDelete}
                onClose={() => setTestToDelete(null)}
                onConfirm={confirmDeleteTest}
                title="Delete Skill Assessment?"
                message="This action cannot be undone. The assessment will be permanently removed from the student's records."
                confirmText="Delete Test"
                type="danger"
            />

            <AddAssessmentModal
                studentId={student.id}
                isOpen={showAddAssessment}
                onClose={() => setShowAddAssessment(false)}
                onSuccess={fetchAssessments}
            />
        </div>
    );
}
