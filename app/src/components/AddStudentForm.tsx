import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, Save, UserPlus, Upload, ChevronDown } from 'lucide-react';
import { parseISO, addMonths, format } from 'date-fns';
import toast from 'react-hot-toast';

import { useQueryClient } from '@tanstack/react-query';
import { useSubscriptionPlans, useCoaches } from '../hooks/useData';
import { useCurrency } from '../context/CurrencyContext';

interface AddStudentFormProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: any;
}

export default function AddStudentForm({ onClose, onSuccess, initialData }: AddStudentFormProps) {
    const { t, i18n } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const { data: plansData, isLoading: isLoadingPlans } = useSubscriptionPlans();
    const plans = plansData || [];

    const [formData, setFormData] = useState({
        full_name: initialData?.full_name || '',
        father_name: initialData?.father_name || '',
        mother_name: initialData?.mother_name || '',
        email: initialData?.email || '',
        address: initialData?.address || '',
        birth_date: initialData?.birth_date || '',
        gender: initialData?.gender || 'male',
        training_type: initialData?.training_type || '',
        contact_number: initialData?.contact_number || '',
        parent_contact: initialData?.parent_contact || '',
        subscription_type: initialData?.subscription_type || '', // Initialize empty, will be set by effect
        subscription_start: format(new Date(), 'yyyy-MM-dd'),
        subscription_expiry: initialData?.subscription_expiry || '', // Manual expiry date
        training_days: initialData?.training_days || [],
        training_schedule: initialData?.training_schedule || [],
        coach_id: initialData?.coach_id || '',
        notes: initialData?.notes || ''
    });

    // Update subscription_type when plans are loaded
    useEffect(() => {
        if (plans.length > 0 && (!formData.subscription_type || formData.subscription_type === '') && !initialData) {
            setFormData(prev => ({ ...prev, subscription_type: plans[0].id }));
        }
    }, [plans, initialData]);


    // Auto-calculate expiry date when plan or start date changes
    useEffect(() => {
        if (formData.subscription_start && formData.subscription_type && plans.length > 0) {
            const calculatedExpiry = calculateExpiry(formData.subscription_start, formData.subscription_type);
            // Always update to calculated expiry when plan or start date changes
            // User can manually edit after if needed
            setFormData(prev => ({ ...prev, subscription_expiry: calculatedExpiry }));
        }
    }, [formData.subscription_start, formData.subscription_type, plans]);

    const { data: coaches } = useCoaches();

    const daysOfWeek = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

    const toggleDay = (day: string) => {
        setFormData(prev => {
            const isAlreadyActive = prev.training_days.includes(day);
            if (isAlreadyActive) {
                return {
                    ...prev,
                    training_days: prev.training_days.filter((d: string) => d !== day),
                    training_schedule: prev.training_schedule.filter((s: any) => s.day !== day)
                };
            } else {
                return {
                    ...prev,
                    training_days: [...prev.training_days, day],
                    training_schedule: [...prev.training_schedule, { day, start: '16:00', end: '18:00' }]
                };
            }
        });
    };

    const updateTime = (day: string, type: 'start' | 'end', value: string) => {
        setFormData(prev => ({
            ...prev,
            training_schedule: prev.training_schedule.map((s: any) =>
                s.day === day ? { ...s, [type]: value } : s
            )
        }));
    };

    const calculateAge = (birthDate: string) => {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };


    const calculateExpiry = (start: string, planId: string) => {
        if (!start || !plans || plans.length === 0) return format(addMonths(new Date(), 1), 'yyyy-MM-dd');

        const date = parseISO(start);
        const plan = plans.find(p => p.id === planId) || plans[0];

        if (!plan) return format(addMonths(date, 1), 'yyyy-MM-dd');

        const monthsToAdd = plan.duration_months || 1;
        return format(addMonths(date, monthsToAdd), 'yyyy-MM-dd');
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
        setLoading(true);

        try {
            if (plans.length === 0) {
                toast.error("No subscription plans found. Please create a plan first.");
                setLoading(false);
                return;
            }

            // Use manual expiry date from form (already calculated by useEffect or manually edited)
            // Ensure we don't send empty string - fallback to calculated expiry
            const expiry = (formData.subscription_expiry && formData.subscription_expiry.trim() !== '')
                ? formData.subscription_expiry
                : calculateExpiry(formData.subscription_start, formData.subscription_type);

            // 1. Determine Group (Auto-Grouping Logic Disabled)
            const trainingGroupId = null;

            const studentData = {
                full_name: formData.full_name,
                father_name: formData.father_name,
                mother_name: formData.mother_name,
                email: formData.email,
                address: formData.address,
                birth_date: formData.birth_date,
                gender: formData.gender,
                training_type: formData.training_type,
                age: calculateAge(formData.birth_date),
                contact_number: formData.contact_number,
                parent_contact: formData.parent_contact,
                subscription_expiry: expiry,
                training_days: formData.training_days,
                training_schedule: formData.training_schedule,
                coach_id: formData.coach_id && formData.coach_id.trim() !== '' ? formData.coach_id : null,
                subscription_plan_id: formData.subscription_type && formData.subscription_type.trim() !== '' ? formData.subscription_type : null,
                notes: formData.notes,
                training_group_id: trainingGroupId || null // Assign to Training Group
            };

            let error;
            let studentId = initialData?.id;

            if (initialData) {
                // Update existing student
                ({ error } = await supabase
                    .from('students')
                    .update(studentData)
                    .eq('id', initialData.id));
            } else {
                // Insert new student and get the ID
                const { data, error: insertError } = await supabase
                    .from('students')
                    .insert([studentData])
                    .select('id')
                    .single();
                error = insertError;
                studentId = data?.id;

                // Record initial payment for new student
                if (studentId && formData.subscription_type) {
                    const selectedPlan = plans.find(p => p.id === formData.subscription_type);
                    if (selectedPlan && selectedPlan.price > 0) {
                        try {
                            const { error: paymentError } = await supabase.from('payments').insert({
                                student_id: studentId,
                                amount: Number(selectedPlan.price),
                                payment_date: formData.subscription_start || format(new Date(), 'yyyy-MM-dd'),
                                payment_method: 'cash', // Default to cash
                                notes: `New Registration - ${selectedPlan.name}`
                            });

                            if (paymentError) {
                                console.error('Initial payment record failed:', paymentError);
                                toast.error('Gymnast added but payment record failed. Please add it manually in Finance.');
                            } else {
                                console.log('Initial payment recorded successfully');
                            }
                        } catch (payErr) {
                            console.error('Payment insertion error:', payErr);
                            toast.error('Payment record failed due to a system error.');
                        }
                    }
                }
            }

            if (error) throw error;

            // Handle training schedule and auto-create training sessions
            if (studentId && formData.training_schedule.length > 0) {
                // First, clear existing schedule for updates, or just insert for new students
                if (initialData) {
                    await supabase.from('student_training_schedule').delete().eq('student_id', studentId);
                }

                const trainingInserts = formData.training_schedule.map((s: any) => ({
                    student_id: studentId,
                    day_of_week: s.day,
                    start_time: s.start,
                    end_time: s.end
                }));

                const { error: trainingError } = await supabase
                    .from('student_training_schedule')
                    .insert(trainingInserts);

                if (trainingError) throw trainingError;

                // --- AUTO-CREATE CLASS LOGIC ---
                if (formData.coach_id) {
                    const dayMapping: { [key: string]: string } = {
                        'sat': 'Saturday',
                        'sun': 'Sunday',
                        'mon': 'Monday',
                        'tue': 'Tuesday',
                        'wed': 'Wednesday',
                        'thu': 'Thursday',
                        'fri': 'Friday'
                    };

                    for (const schedule of formData.training_schedule) {
                        const { day, start, end } = schedule as { day: string, start: string, end: string };
                        const fullDayName = dayMapping[day];

                        // Check if session exists using Full Day Name
                        const { data: sessions } = await supabase
                            .from('training_sessions')
                            .select('id')
                            .eq('coach_id', formData.coach_id)
                            .eq('day_of_week', fullDayName)
                            .eq('start_time', start)
                            .eq('end_time', end)
                            .limit(1);

                        // If NOT exists, create it
                        if (!sessions || sessions.length === 0) {
                            await supabase
                                .from('training_sessions')
                                .insert([{
                                    coach_id: formData.coach_id,
                                    day_of_week: fullDayName,
                                    start_time: start,
                                    end_time: end,
                                    title: 'Group Training', // Default Title
                                    capacity: 20             // Default Capacity
                                }]);
                        }
                    }

                }
            }

            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
            if (formData.coach_id) queryClient.invalidateQueries({ queryKey: ['training_groups'] }); // Invalidate groups too

            toast.success(initialData ? 'Gymnast updated successfully' : 'Gymnast added successfully', {
                icon: '🎉',
                style: {
                    borderRadius: '20px',
                    background: '#10B981',
                    color: '#fff',
                },
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving gymnast:', error);
            const msg = (error as any).message || 'Unknown error';
            toast.error(`Error saving gymnast: ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0f]/80 backdrop-blur-md">
            <div className="w-full max-w-4xl max-h-[90vh] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl shadow-black/50 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                {/* Decorative gradients */}
                <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                <div className="absolute bottom-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>

                {/* Header */}
                <div className="p-8 border-b border-white/[0.03] flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"></div>
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">
                                {initialData ? 'Edit Gymnast' : t('dashboard.addStudent', 'Add New Gymnast')}
                            </h2>
                        </div>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] ml-5">{initialData ? 'Update registration details' : 'Register a new athlete'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="group relative p-2 overflow-hidden rounded-full transition-all duration-500"
                    >
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                        <X className="w-5 h-5 text-white/30 group-hover:text-white group-hover:rotate-90 transition-all duration-500 relative z-10" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto flex-1 custom-scrollbar relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                        {/* Name Field */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('common.fullName', 'Full Name')}</label>
                            <input
                                required
                                type="text"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:ring-0 focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm tracking-wide"
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            />
                        </div>

                        {/* Birth Date */}
                        <div className="space-y-3 group/field">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-focus-within/field:text-primary transition-colors">{t('students.birthDate', 'Birth Date')}</label>
                                {formData.birth_date && (
                                    <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">
                                        {calculateAge(formData.birth_date)} {i18n.language === 'ar' ? 'سنة' : 'Years Old'}
                                    </span>
                                )}
                            </div>
                            <input
                                required
                                type="date"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-sm"
                                value={formData.birth_date}
                                onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                            />
                        </div>

                        {/* Gender Toggle */}
                        <div className="space-y-3">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Gender Identity</label>
                            <div className="flex bg-white/[0.02] rounded-2xl p-1.5 border border-white/5 relative">
                                {['male', 'female'].map(g => (
                                    <button key={g} type="button" onClick={() => setFormData({ ...formData, gender: g })}
                                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 relative z-10 ${formData.gender === g ? 'text-white' : 'text-white/20 hover:text-white/40'}`}>
                                        {g}
                                    </button>
                                ))}
                                <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-500 ease-out shadow-lg ${formData.gender === 'male' ? 'left-1.5 bg-blue-600/20 border border-blue-500/30' : 'left-[calc(50%+3px)] bg-pink-600/20 border border-pink-500/30'}`}></div>
                            </div>
                        </div>

                        {/* Training Type */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Specialization</label>
                            <div className="relative">
                                <select
                                    value={formData.training_type}
                                    onChange={e => setFormData({ ...formData, training_type: e.target.value })}
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none text-sm tracking-wide cursor-pointer"
                                    required
                                >
                                    <option value="" disabled className="bg-[#0a0a0f]">Select Sport</option>
                                    <option value="Artistic Gymnastics" className="bg-[#0a0a0f]">Artistic Gymnastics</option>
                                    <option value="Rhythmic Gymnastics" className="bg-[#0a0a0f]">Rhythmic Gymnastics</option>
                                    <option value="Parkour" className="bg-[#0a0a0f]">Parkour</option>
                                    <option value="Fitness" className="bg-[#0a0a0f]">Fitness</option>
                                </select>
                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>

                        {/* Father Details */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Primary Guardian</label>
                            <input
                                type="text"
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                value={formData.father_name}
                                onChange={e => setFormData({ ...formData, father_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">{t('common.fatherPhone', "Guardian Contact")}</label>
                            <input
                                required
                                type="tel"
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                value={formData.contact_number}
                                onChange={e => setFormData({ ...formData, contact_number: e.target.value })}
                            />
                        </div>

                        {/* Secondary Guardian */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Secondary Guardian</label>
                            <input
                                type="text"
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                value={formData.mother_name}
                                onChange={e => setFormData({ ...formData, mother_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Secondary Contact</label>
                            <input
                                type="tel"
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                value={formData.parent_contact}
                                onChange={e => setFormData({ ...formData, parent_contact: e.target.value })}
                            />
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-3 group/field text-sm">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Email Address</label>
                            <input
                                type="email"
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3 group/field text-sm">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Physical Address</label>
                            <input
                                type="text"
                                placeholder=""
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-6 pt-10 border-t border-white/[0.03]">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">
                            {t('students.trainingDays', 'Attendance Cycle')}
                        </label>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-wrap gap-2">
                                {daysOfWeek.map(day => {
                                    const isActive = formData.training_days.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`px-4 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${isActive
                                                ? 'bg-primary/20 border-primary/40 text-primary shadow-lg shadow-primary/5'
                                                : 'bg-white/[0.02] border-white/5 text-white/20 hover:bg-white/[0.05] hover:border-white/10'
                                                }`}
                                        >
                                            {t(`students.days.${day}`)}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Time Inputs for Active Days */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                {formData.training_schedule.map((schedule: any) => (
                                    <div
                                        key={schedule.day}
                                        className="p-5 bg-white/[0.02] border border-white/5 rounded-[2rem] flex flex-col gap-4 animate-in zoom-in-95 duration-500"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase text-primary tracking-[0.3em]">
                                                {t(`students.days.${schedule.day}`)}
                                            </span>
                                            <div className="h-px flex-1 bg-white/[0.03] mx-4"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 group/time">
                                                <label className="text-[8px] font-black uppercase text-white/20 ml-1 group-focus-within/time:text-primary transition-colors">{t('students.startTime')}</label>
                                                <input
                                                    type="time"
                                                    value={schedule.start}
                                                    onChange={(e) => updateTime(schedule.day, 'start', e.target.value)}
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2 text-[10px] text-white focus:border-primary/40 focus:bg-white/[0.05] transition-all outline-none [color-scheme:dark]"
                                                />
                                            </div>
                                            <div className="space-y-2 group/time">
                                                <label className="text-[8px] font-black uppercase text-white/20 ml-1 group-focus-within/time:text-primary transition-colors">{t('students.endTime')}</label>
                                                <input
                                                    type="time"
                                                    value={schedule.end}
                                                    onChange={(e) => updateTime(schedule.day, 'end', e.target.value)}
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2 text-[10px] text-white focus:border-primary/40 focus:bg-white/[0.05] transition-all outline-none [color-scheme:dark]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8 pt-10 border-t border-white/[0.03]">
                        <div className="flex items-center gap-3 ml-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
                            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
                                Subscription Architecture
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-3 group/field">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 group-focus-within/field:text-primary transition-colors">Plan Type</label>
                                    {plans.find(p => p.id === formData.subscription_type)?.price > 0 && (
                                        <div className="px-3 py-1 bg-primary/5 border border-primary/20 rounded-full">
                                            <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                                {plans.find(p => p.id === formData.subscription_type)?.price} {currency.code}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="relative">
                                    <select
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 focus:bg-white/[0.04] text-sm tracking-wide"
                                        value={formData.subscription_type}
                                        onChange={e => setFormData({ ...formData, subscription_type: e.target.value })}
                                    >
                                        {plans.map(plan => (
                                            <option key={plan.id} value={plan.id} className="bg-[#0a0a0f]">{plan.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute inset-y-0 right-5 my-auto w-4 h-4 text-white/10 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Activation</label>
                                    <input
                                        type="date"
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-sm"
                                        value={formData.subscription_start}
                                        onChange={e => setFormData({ ...formData, subscription_start: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Deactivation</label>
                                    <input
                                        type="date"
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white [color-scheme:dark] text-sm"
                                        value={formData.subscription_expiry}
                                        onChange={e => setFormData({ ...formData, subscription_expiry: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Assigned Specialist</label>
                            <div className="relative">
                                <select
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 focus:bg-white/[0.04] text-sm tracking-wide"
                                    value={formData.coach_id}
                                    onChange={e => setFormData({ ...formData, coach_id: e.target.value })}
                                >
                                    <option value="" className="bg-[#0a0a0f]">{t('students.selectCoach')}</option>
                                    {coaches?.filter(c => c.role !== 'reception' && c.role !== 'cleaner').map(coach => (
                                        <option key={coach.id} value={coach.id} className="bg-[#0a0a0f]">
                                            {coach.full_name} ({t(`roles.${coach.role}`)})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute inset-y-0 right-5 my-auto w-4 h-4 text-white/10 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 group/field">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Additional Insights</label>
                        <textarea
                            placeholder="Performance notes, medical flags, or personal requests..."
                            className="w-full px-5 py-4 bg-white/[0.02] border border-white/5 rounded-[2rem] focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm min-h-[120px] resize-none"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-6 pt-10 border-t border-white/[0.03] mt-10">
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
                                <>
                                    <span className="relative z-10">{initialData ? 'Update Profile' : 'Confirm Registration'}</span>
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
