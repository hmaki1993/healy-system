import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, RefreshCw, Calendar, DollarSign } from 'lucide-react';
import { parseISO, addMonths, format } from 'date-fns';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useSubscriptionPlans } from '../hooks/useData';
import { useCurrency } from '../context/CurrencyContext';

interface RenewSubscriptionFormProps {
    student: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RenewSubscriptionForm({ student, onClose, onSuccess }: RenewSubscriptionFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const { data: plansData } = useSubscriptionPlans();
    const plans = plansData || [];

    const [formData, setFormData] = useState({
        subscription_plan_id: student.subscription_plan_id || (plans.length > 0 ? plans[0].id : ''),
        start_date: format(new Date(), 'yyyy-MM-dd'),
        expiry_date: ''
    });

    // Auto-calculate expiry when plan or start date changes
    useEffect(() => {
        if (formData.subscription_plan_id && formData.start_date && plans.length > 0) {
            const plan = plans.find(p => p.id === formData.subscription_plan_id);
            if (plan) {
                const startDate = parseISO(formData.start_date);
                const expiryDate = addMonths(startDate, plan.duration_months);
                setFormData(prev => ({ ...prev, expiry_date: format(expiryDate, 'yyyy-MM-dd') }));
            }
        }
    }, [formData.subscription_plan_id, formData.start_date, plans]);

    // Set default plan when plans load
    useEffect(() => {
        if (plans.length > 0 && !formData.subscription_plan_id) {
            setFormData(prev => ({ ...prev, subscription_plan_id: plans[0].id }));
        }
    }, [plans]);

    const selectedPlan = plans.find(p => p.id === formData.subscription_plan_id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Update student subscription
            const { error: updateError } = await supabase
                .from('students')
                .update({
                    subscription_expiry: formData.expiry_date,
                    subscription_plan_id: formData.subscription_plan_id
                })
                .eq('id', student.id);

            if (updateError) throw updateError;

            // 2. Record payment
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    student_id: student.id,
                    amount: selectedPlan?.price || 0,
                    payment_date: formData.start_date,
                    payment_method: 'cash',
                    notes: `Subscription renewal - ${selectedPlan?.name}`
                });

            if (paymentError) throw paymentError;

            // Invalidate queries
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });

            toast.success('Subscription renewed successfully! 🎉', {
                icon: '✅',
                style: {
                    borderRadius: '20px',
                    background: '#10B981',
                    color: '#fff',
                },
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error renewing subscription:', error);
            toast.error(`Error: ${(error as any).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="glass-card rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-accent/20 to-primary/20">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-accent/20 rounded-xl text-accent">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            Renew Subscription
                        </h2>
                        <p className="text-sm text-white/60 mt-1 font-bold">{student.full_name}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Current Status */}
                <div className="px-8 py-4 bg-red-500/10 border-b border-red-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-red-400">Current Expiry</p>
                            <p className="text-sm font-black text-red-500 mt-1">
                                {student.subscription_expiry ? format(parseISO(student.subscription_expiry), 'MMM dd, yyyy') : 'N/A'}
                            </p>
                        </div>
                        <div className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full">
                            <span className="text-xs font-black text-red-500 uppercase">Expired</span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Plan Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">New Plan</label>
                            {selectedPlan && (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                                    <DollarSign className="w-3 h-3 text-primary" />
                                    <span className="text-[10px] font-black text-primary uppercase">{selectedPlan.price} {currency.code}</span>
                                </div>
                            )}
                        </div>
                        <select
                            required
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-accent/20 focus:border-accent outline-none transition-all text-white appearance-none cursor-pointer"
                            value={formData.subscription_plan_id}
                            onChange={e => setFormData({ ...formData, subscription_plan_id: e.target.value })}
                        >
                            {plans.map(plan => (
                                <option key={plan.id} value={plan.id}>
                                    {plan.name} - {plan.price} {currency.code}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Start Date */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            Start Date
                        </label>
                        <input
                            required
                            type="date"
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-accent/20 focus:border-accent outline-none transition-all text-white"
                            value={formData.start_date}
                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                        />
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            New Expiry Date
                            <span className="px-2 py-0.5 bg-accent/10 text-accent text-[8px] rounded-full border border-accent/20">Editable</span>
                        </label>
                        <input
                            required
                            type="date"
                            className="w-full px-4 py-2 bg-accent/5 border border-accent/20 rounded-2xl focus:ring-4 focus:ring-accent/20 focus:border-accent outline-none transition-all text-accent font-black"
                            value={formData.expiry_date}
                            onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                        />
                    </div>

                    {/* Summary */}
                    {selectedPlan && (
                        <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-accent/60">Renewal Summary</p>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-white/60">Plan</span>
                                <span className="text-sm font-black text-white">{selectedPlan.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-white/60">Duration</span>
                                <span className="text-sm font-black text-white">{selectedPlan.duration_months} Month(s)</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                <span className="text-sm font-black text-accent">Total Amount</span>
                                <span className="text-lg font-black text-accent">{selectedPlan.price} {currency.code}</span>
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-2xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-gradient-to-r from-accent to-accent/80 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                            {loading ? (
                                <span className="animate-pulse">Renewing...</span>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 relative z-10" />
                                    <span className="relative z-10">Renew Subscription</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
