import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, RefreshCw, Calendar, DollarSign, User } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../context/CurrencyContext';

interface RenewPTSubscriptionFormProps {
    subscription: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function RenewPTSubscriptionForm({ subscription, onClose, onSuccess }: RenewPTSubscriptionFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        sessions_to_add: 0,
        renewal_price: 0,
        expiry_date: subscription.expiry_date || format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.sessions_to_add <= 0) {
            toast.error('Please add at least 1 session');
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading('Renewing subscription...');

        try {
            // 1. Update PT Subscription
            const newTotalCount = subscription.sessions_total + formData.sessions_to_add;
            const newRemainingCount = subscription.sessions_remaining + formData.sessions_to_add;
            const newTotalPrice = (Number(subscription.total_price) || 0) + formData.renewal_price;

            const { error: subError } = await supabase
                .from('pt_subscriptions')
                .update({
                    sessions_total: newTotalCount,
                    sessions_remaining: newRemainingCount,
                    total_price: newTotalPrice,
                    expiry_date: formData.expiry_date,
                    status: 'active',
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscription.id);

            if (subError) throw subError;

            // 2. Record Payment
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    student_id: subscription.student_id,
                    amount: formData.renewal_price,
                    payment_date: new Date().toISOString(),
                    payment_method: 'cash',
                    notes: `PT Renewal - ${formData.sessions_to_add} sessions for ${subscription.students?.full_name || subscription.student_name}`
                });

            if (paymentError) throw paymentError;

            // 3. Refresh data
            queryClient.invalidateQueries({ queryKey: ['pt_subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });

            toast.success('Subscription renewed successfully!', { id: loadingToast });
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error renewing PT subscription:', error);
            toast.error(error.message || 'Failed to renew subscription', { id: loadingToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0f]/80 backdrop-blur-md">
            <div className="w-full max-w-lg max-h-[90vh] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl shadow-black/50 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                {/* Decorative gradients */}
                <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                <div className="absolute bottom-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>

                {/* Header */}
                <div className="p-8 border-b border-white/[0.03] flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-accent/40 animate-pulse"></div>
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">
                                Renew PT
                            </h2>
                        </div>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] ml-5">
                            {subscription.students?.full_name || subscription.student_name}
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
                    {/* Coach Display (Read-only) */}
                    <div className="space-y-3 group/field opacity-60">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">Current Specialist</label>
                        <div className="flex items-center gap-3 px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl text-white/40">
                            <User className="w-4 h-4" />
                            <span className="text-sm font-bold tracking-wide">{subscription.coaches?.full_name || 'N/A'}</span>
                        </div>
                    </div>

                    {/* Sessions to Add */}
                    <div className="space-y-6 text-center py-4 bg-white/[0.01] border border-white/[0.03] rounded-[2rem]">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 block">Add Training Volume</label>
                        <div className="flex items-center justify-center gap-8">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, sessions_to_add: Math.max(0, prev.sessions_to_add - 1) }))}
                                className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all text-2xl font-black"
                            >-</button>
                            <input
                                required
                                type="number"
                                className="w-24 bg-transparent border-none text-center text-4xl font-black text-primary outline-none appearance-none"
                                value={formData.sessions_to_add}
                                onChange={e => setFormData({ ...formData, sessions_to_add: parseInt(e.target.value) || 0 })}
                            />
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, sessions_to_add: prev.sessions_to_add + 1 }))}
                                className="w-14 h-14 rounded-full border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all text-2xl font-black"
                            >+</button>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/10">Sessions to be credited</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Renewal Price */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-accent transition-colors">Renewal Cost</label>
                            <div className="relative">
                                <input
                                    required
                                    type="number"
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-accent/40 outline-none transition-all text-white font-black text-sm"
                                    value={formData.renewal_price}
                                    onChange={e => setFormData({ ...formData, renewal_price: parseFloat(e.target.value) || 0 })}
                                />
                                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20 uppercase tracking-widest">{currency.code}</div>
                            </div>
                        </div>

                        {/* New Expiry Date */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-accent transition-colors">Lifecycle Extension</label>
                            <input
                                required
                                type="date"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-accent/40 outline-none transition-all text-white font-black text-sm [color-scheme:dark]"
                                value={formData.expiry_date}
                                onChange={e => setFormData({ ...formData, expiry_date: e.target.value })}
                            />
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
                            disabled={loading || formData.sessions_to_add <= 0}
                            className="px-12 py-4 bg-accent text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-accent/10 hover:shadow-accent/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-500 flex items-center justify-center gap-4 relative overflow-hidden group/btn disabled:opacity-50"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <span className="relative z-10">Complete Extension</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
