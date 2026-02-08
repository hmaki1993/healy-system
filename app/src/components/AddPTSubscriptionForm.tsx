import { useState, useEffect } from 'react';
import { X, User, Calendar, DollarSign, TrendingUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { format, addMonths } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../context/CurrencyContext';

interface AddPTSubscriptionFormProps {
    onClose: () => void;
    onSuccess: () => void;
    editData?: any;
}

interface Coach {
    id: string;
    full_name: string;
    pt_rate: number;
    role: string;
    profile_id: string;
}

interface Student {
    id: string;
    full_name: string;
}

export default function AddPTSubscriptionForm({ onClose, onSuccess, editData }: AddPTSubscriptionFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [students, setStudents] = useState<Student[]>([]);

    const [isGuest, setIsGuest] = useState(editData ? !editData.student_id : false);
    const [formData, setFormData] = useState({
        student_id: editData?.student_id?.toString() || '',
        student_name: editData?.student_name || '',
        coach_id: editData?.coach_id || '',
        sessions_total: editData?.sessions_total || '',
        start_date: editData?.start_date || format(new Date(), 'yyyy-MM-dd'),
        expiry_date: editData?.expiry_date || format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
        price: editData?.total_price || '',
        student_phone: editData?.student_phone || ''
    });

    const selectedCoach = coaches.find(c => c.id === formData.coach_id);
    const pricePerSession = selectedCoach?.pt_rate || 0;

    useEffect(() => {
        fetchCoaches();
        fetchStudents();
    }, []);

    const fetchCoaches = async () => {
        const { data, error } = await supabase
            .from('coaches')
            .select(`
                id, 
                full_name, 
                pt_rate,
                profile_id,
                profiles:profile_id (role)
            `)
            .order('full_name');

        if (error) {
            console.error('Error fetching coaches:', error);
        } else {
            const enrichedCoaches = (data || []).map((c: any) => ({
                ...c,
                role: c.profiles?.role
            })).filter((c: any) => c.role !== 'reception' && c.role !== 'cleaner');

            setCoaches(enrichedCoaches);
        }
    };

    const fetchStudents = async () => {
        const { data, error } = await supabase
            .from('students')
            .select('id, full_name')
            .order('full_name');

        if (error) {
            console.error('Error fetching students:', error);
        } else {
            setStudents(data || []);
        }
    };

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate: requires coach AND (student_id OR (isGuest AND student_name))
        const hasStudent = isGuest ? !!formData.student_name.trim() : !!formData.student_id;

        if (!hasStudent || !formData.coach_id) {
            toast.error(t('common.fillRequired'));
            return;
        }

        if (formData.sessions_total < 1) {
            toast.error('Number of sessions must be at least 1');
            return;
        }

        setLoading(true);

        try {
            const totalSessions = Number(formData.sessions_total);
            const totalPrice = Number(formData.price);

            const payload = {
                student_id: isGuest ? null : formData.student_id,
                student_name: isGuest ? formData.student_name : null,
                coach_id: formData.coach_id,
                sessions_total: totalSessions,
                sessions_remaining: editData?.id ? (editData.sessions_remaining + (totalSessions - editData.sessions_total)) : totalSessions,
                start_date: formData.start_date,
                expiry_date: formData.expiry_date,
                total_price: totalPrice,
                price_per_session: totalPrice / totalSessions,
                student_phone: formData.student_phone,
                status: 'active'
            };

            if (editData?.id) {
                const { error } = await supabase
                    .from('pt_subscriptions')
                    .update(payload)
                    .eq('id', editData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('pt_subscriptions')
                    .insert(payload);
                if (error) throw error;
            }

            // Record payment for PT Subscription (only for new ones or if specifically requested - let's do only for new for now)
            if (!editData?.id) {
                try {
                    const paymentData: any = {
                        amount: Number(formData.price),
                        payment_date: formData.start_date || format(new Date(), 'yyyy-MM-dd'),
                        payment_method: 'cash',
                        notes: `PT Subscription - ${isGuest ? formData.student_name : (students.find(s => s.id === formData.student_id)?.full_name)} - Coach ${selectedCoach?.full_name}`
                    };

                    if (!isGuest && formData.student_id) {
                        paymentData.student_id = formData.student_id;
                    }

                    const { error: paymentError } = await supabase.from('payments').insert(paymentData);
                    if (paymentError) {
                        console.error('PT Payment record failed:', paymentError);
                        toast.error('Subscription created but payment record failed. Please add it manually in Finance.');
                    } else {
                        console.log('PT Payment recorded successfully');
                    }
                } catch (payErr) {
                    console.error('Payment record failed:', payErr);
                }

                // New Notification for the assigned Coach
                try {
                    if (selectedCoach?.profile_id) {
                        const studentName = isGuest ? formData.student_name : (students.find(s => s.id === formData.student_id)?.full_name);

                        await supabase.from('notifications').insert({
                            type: 'pt_subscription',
                            title: 'New PT Subscription',
                            message: `New PT Student: ${studentName}`,
                            user_id: selectedCoach.profile_id, // Direct to coach
                            is_read: false
                        });
                        console.log('PT Notification sent to coach:', selectedCoach.full_name);
                    }
                } catch (noteErr) {
                    console.error('Coach notification failed:', noteErr);
                }
            }

            // Invalidate queries to update Revenue UI and PT lists
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });

            toast.success(t('common.saveSuccess'));
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error with PT subscription:', error);
            toast.error(error.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0f]/80 backdrop-blur-md">
            <div className="w-full max-w-2xl max-h-[90vh] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl shadow-black/50 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                {/* Decorative gradients */}
                <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                <div className="absolute bottom-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>

                {/* Header */}
                <div className="p-8 border-b border-white/[0.03] flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"></div>
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">
                                {t('pt.addSubscription') || 'PT Subscription'}
                            </h2>
                        </div>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] ml-5">
                            {editData ? 'Update Training Lifecycle' : 'Register New Professional Training'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="group relative p-2 overflow-hidden rounded-full transition-all duration-500"
                    >
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                        <X className="w-5 h-5 text-white/30 group-hover:text-white group-hover:rotate-90 transition-all duration-500 relative z-10" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto flex-1 custom-scrollbar relative z-10">
                    {/* Student Selection */}
                    <div className="space-y-3 group/field">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-focus-within/field:text-primary transition-colors">
                                {t('common.student') || 'Gymnast'}
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsGuest(!isGuest);
                                    setFormData(prev => ({ ...prev, student_id: '', student_name: '', student_phone: '' }));
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
                            >
                                {isGuest ? 'Browse Members' : 'Register External'}
                            </button>
                        </div>

                        {isGuest ? (
                            <input
                                type="text"
                                value={formData.student_name}
                                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm tracking-wide"
                                required
                            />
                        ) : (
                            <div className="relative">
                                <select
                                    value={formData.student_id}
                                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none text-sm tracking-wide cursor-pointer"
                                    required
                                >
                                    <option value="" disabled className="bg-[#0a0a0f]">Select Athlete</option>
                                    {students.map(student => (
                                        <option key={student.id} value={student.id} className="bg-[#0a0a0f]">
                                            {student.full_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                        {/* Personal Phone */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">
                                {t('common.phone') || 'Contact Line'}
                            </label>
                            <input
                                type="tel"
                                placeholder=""
                                value={formData.student_phone}
                                onChange={(e) => setFormData({ ...formData, student_phone: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                            />
                        </div>

                        {/* Coach Selection */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">
                                {t('common.coach') || 'Lead Specialist'}
                            </label>
                            <div className="relative">
                                <select
                                    value={formData.coach_id}
                                    onChange={(e) => setFormData({ ...formData, coach_id: e.target.value })}
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none text-sm tracking-wide cursor-pointer"
                                    required
                                >
                                    <option value="" disabled className="bg-[#0a0a0f]">Assigned Coach</option>
                                    {coaches.map(coach => (
                                        <option key={coach.id} value={coach.id} className="bg-[#0a0a0f]">
                                            {coach.full_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>

                        {/* Sessions Count */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">
                                {t('pt.sessionCount') || 'Training Volume'}
                            </label>
                            <input
                                type="number"
                                min="1"
                                placeholder=""
                                value={formData.sessions_total}
                                onChange={(e) => setFormData({ ...formData, sessions_total: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                required
                            />
                        </div>

                        {/* Date Range */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">
                                {t('common.startDate') || 'Activation Date'}
                            </label>
                            <input
                                type="date"
                                value={formData.start_date}
                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-sm"
                                required
                            />
                        </div>

                        {/* Price Input & Display */}
                        <div className="space-y-3 group/field md:col-span-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">
                                {t('common.price') || 'Investment'}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    placeholder=""
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="w-full px-5 py-6 bg-white/[0.02] border border-white/5 rounded-[2rem] focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-3xl font-black tracking-tight"
                                    required
                                />
                                <div className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20 uppercase tracking-[0.2em] pointer-events-none">
                                    {currency.code}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-6 pt-10 border-t border-white/[0.03] mt-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all duration-500"
                        >
                            {t('common.cancel', 'Discard')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-12 py-4 bg-primary text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-500 flex items-center justify-center gap-4 relative overflow-hidden group/btn disabled:opacity-50"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <span className="relative z-10">{editData ? 'Update Cycle' : 'Confirm Subscription'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
