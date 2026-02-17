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

            <div className="w-full max-w-5xl h-[85vh] bg-black/60 backdrop-blur-3xl rounded-[3.5rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700 relative flex flex-col md:flex-row">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* --- SIDEBAR: PRIMARY IDENTITY --- */}
                <div className="w-full md:w-[320px] bg-primary/5 border-r border-white/5 relative z-10 flex flex-col p-10 flex-shrink-0 overflow-y-auto custom-scrollbar">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

                    <button
                        onClick={onClose}
                        className="md:hidden absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-white/40"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Profile Avatar */}
                    <div className="relative mb-8 self-center">
                        <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-5xl shadow-[0_20px_40px_rgba(var(--primary-rgb),0.2)]">
                            {student.full_name?.[0]}
                        </div>
                        <div className="absolute -bottom-2 -right-2 p-3 bg-white rounded-2xl shadow-xl">
                            <Star className="w-4 h-4 text-primary" />
                        </div>
                    </div>

                    {/* Primary Info */}
                    <div className="text-center space-y-2 mb-10">
                        <h2 className="text-2xl font-black text-white tracking-widest uppercase leading-tight px-2">
                            {student.full_name}
                        </h2>
                        <div className="flex items-center justify-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${student.is_active ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'}`}></div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
                                {student.is_active ? t('common.active') : t('common.inactive')}
                            </span>
                        </div>
                    </div>

                    {/* Vertical Stats Column */}
                    <div className="space-y-6">
                        <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Age</span>
                                <span className="text-sm font-black text-white">{calculateAge(student.birth_date)} <span className="text-[9px] text-white/20">YRS</span></span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Program</span>
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{student.training_type || 'Artistic'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Gender</span>
                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{student.gender || '---'}</span>
                            </div>
                        </div>

                        <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Coach</span>
                                </div>
                                <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[120px]">
                                    {student.coaches?.full_name?.split(' ')[0] || 'UNASSIGNED'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Expiry Date</span>
                                </div>
                                <span className="text-[10px] font-black text-white tracking-widest">
                                    {student.subscription_expiry ? format(new Date(student.subscription_expiry), 'dd/MM/yy') : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer Close (Mobile/Sidebar) */}
                    <div className="mt-auto pt-10 hidden md:block">
                        <button
                            onClick={onClose}
                            className="w-full py-4 rounded-[2rem] bg-white text-black hover:bg-white/90 transition-all font-black uppercase tracking-[0.3em] text-[10px] shadow-xl"
                        >
                            {t('common.dismiss')}
                        </button>
                    </div>
                </div>

                {/* --- MAIN CONTENT AREA --- */}
                <div className="flex-1 flex flex-col relative z-20 overflow-hidden">

                    {/* Header Tabs Navigation */}
                    <div className="px-10 pt-10 flex items-center justify-between border-b border-white/5 flex-shrink-0">
                        <div className="flex gap-10">
                            {[
                                { id: 'overview', label: 'Profile', icon: User },
                                { id: 'tests', label: 'Performance', icon: Award }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`pb-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === tab.id ? 'text-white' : 'text-white/20 hover:text-white/40'}`}
                                >
                                    <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-primary' : ''}`} />
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] animate-in slide-in-from-bottom-2 duration-500"></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500 text-white/40 hover:text-white transition-all border border-white/10 active:scale-90 mb-6 hidden md:block"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-10">

                        {/* --- TAB: OVERVIEW (DOSSIER) --- */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                    {/* Contact Section */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10 ml-1">Contacts</h3>

                                        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-8">
                                            {/* Father Contact */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                                        <User className="w-5 h-5 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">{t('common.father')}</p>
                                                        <p className="text-sm font-black text-white uppercase">{student.father_name || 'NOT REGISTERED'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[14px] font-mono font-black text-white/90 tracking-tighter">{student.contact_number || '---'}</p>
                                                    <a href={`tel:${student.contact_number}`} className="text-[8px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors">Call</a>
                                                </div>
                                            </div>

                                            {/* Mother Contact (WhatsApp) */}
                                            <div className="flex items-center justify-between border-t border-white/[0.03] pt-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                                                        <div className="w-5 h-5 text-emerald-500"><Send className="w-full h-full" /></div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60 mb-1">WhatsApp</p>
                                                        <p className="text-sm font-black text-white uppercase">{student.mother_name || 'NOT REGISTERED'}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[14px] font-mono font-black text-white/90 tracking-tighter">{student.parent_contact || '---'}</p>
                                                    <a href={`https://wa.me/${student.parent_contact?.replace(/\s/g, '')}`} target="_blank" className="text-[8px] font-black uppercase tracking-widest text-emerald-500/60 hover:text-emerald-500 transition-colors">Chat</a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Residency & Meta Section */}
                                    <div className="space-y-6">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/10 ml-1">Location Details</h3>

                                        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 text-white/20">
                                                    <Mail className="w-4 h-4" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Email</span>
                                                </div>
                                                <p className="text-[13px] font-bold text-white/80 break-all">{student.email || 'No institutional email recorded'}</p>
                                            </div>

                                            <div className="space-y-2 border-t border-white/[0.03] pt-6">
                                                <div className="flex items-center gap-3 text-white/20">
                                                    <MapPin className="w-4 h-4" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Address</span>
                                                </div>
                                                <p className="text-[13px] font-bold text-white/80 leading-relaxed uppercase">{student.address || 'Resident Address Not Synchronized'}</p>
                                            </div>
                                        </div>

                                        {/* Status Meta */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 transition-all hover:bg-white/5 group">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-white/10 mb-2 group-hover:text-primary transition-colors">Student ID</p>
                                                <p className="text-[11px] font-mono font-black text-white/60 tracking-widest uppercase">
                                                    {String(student.id).slice(0, 12)}
                                                </p>
                                            </div>
                                            <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 transition-all hover:bg-white/5 group">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-white/10 mb-2 group-hover:text-primary transition-colors">Joined Date</p>
                                                <p className="text-[11px] font-mono font-black text-white/60 tracking-widest">
                                                    {student.created_at ? format(new Date(student.created_at), 'dd/MM/yyyy - HH:mm') : '---'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- TAB: TESTS (PERFORMANCE) --- */}
                        {activeTab === 'tests' && (
                            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700 pb-20">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-baseline gap-4">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white/60">Assessment History</h3>
                                        <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[8px] font-black text-primary uppercase tracking-widest">
                                            {assessments.length} Tests Recorded
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setShowAddAssessment(true)}
                                        className="bg-primary hover:bg-primary/90 text-white text-[9px] font-black uppercase tracking-[0.3em] px-6 py-3 rounded-2xl flex items-center gap-3 transition-all shadow-[0_10px_20px_rgba(var(--primary-rgb),0.3)] active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        New Test
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {loadingAssessments ? (
                                        <div className="col-span-2 py-20 flex flex-col items-center justify-center opacity-20">
                                            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
                                            <p className="text-[10px] font-black uppercase tracking-widest">Fetching Records...</p>
                                        </div>
                                    ) : assessments.length === 0 ? (
                                        <div className="col-span-2 py-20 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-30 text-center px-10">
                                            <FileText className="w-12 h-12 mb-4" />
                                            <p className="text-[11px] font-black uppercase tracking-widest mb-2">No Assessments Found</p>
                                            <p className="text-[9px] font-bold text-white/40 max-w-xs">All skill assessments for this gymnast will appear here once recorded.</p>
                                        </div>
                                    ) : (
                                        assessments.map((test) => (
                                            <div key={test.id} className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] overflow-hidden hover:bg-white/5 transition-all duration-500 group flex flex-col">
                                                {/* Card Header */}
                                                <div className="p-8 border-b border-white/[0.03] space-y-4">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <Award className="w-3 h-3 text-primary" />
                                                                <h4 className="text-[13px] font-black text-white uppercase tracking-wider">{test.title}</h4>
                                                            </div>
                                                            <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-black flex items-center gap-2">
                                                                <Calendar className="w-3 h-3" />
                                                                {format(parseISO(test.date), 'MMM dd, yyyy')}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-3xl font-black text-primary leading-none tracking-tighter shadow-primary/20 drop-shadow-lg">
                                                                {test.total_score}
                                                            </div>
                                                            <span className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-black">Score</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Score Breakdown Body */}
                                                <div className="p-8 space-y-4 bg-black/20 flex-1">
                                                    {test.skills?.map((skill: any, idx: number) => (
                                                        <div key={idx} className="space-y-2">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <span className="text-white/50 font-black uppercase tracking-widest">{skill.name}</span>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-black text-white">{skill.score}</span>
                                                                    <span className="text-white/20 text-[9px]">/ {skill.max_score}</span>
                                                                </div>
                                                            </div>
                                                            <div className="w-full h-1 bg-white/[0.03] rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary/60 shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)] transition-all duration-1000"
                                                                    style={{ width: `${(skill.score / skill.max_score) * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Card Footer Actions */}
                                                <div className="px-8 py-5 flex justify-between items-center bg-white/[0.01] border-t border-white/[0.03]">
                                                    <div className="flex items-center gap-2 opacity-20">
                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                        <span className="text-[7px] font-black uppercase tracking-widest italic">Assessment Record</span>
                                                    </div>
                                                    <button
                                                        onClick={() => setTestToDelete(test.id)}
                                                        className="p-3 text-rose-500/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all active:scale-90"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            <ConfirmModal
                isOpen={!!testToDelete}
                onClose={() => setTestToDelete(null)}
                onConfirm={confirmDeleteTest}
                title="DELETE ASSESSMENT?"
                message="Are you sure you want to delete this assessment record? This action cannot be undone."
                confirmText="DELETE NOW"
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
