import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { useStudents } from '../hooks/useData';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useCurrency } from '../context/CurrencyContext';

interface AddRefundFormProps {
    onClose: () => void;
    onSuccess: () => void;
    onAdd: (refund: { student_id: string; amount: number; reason?: string; refund_date: string }) => Promise<void>;
}

export default function AddRefundForm({ onClose, onSuccess, onAdd }: AddRefundFormProps) {
    const { currency } = useCurrency();
    const { data: students } = useStudents();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        student_id: '',
        amount: '',
        reason: '',
        refund_date: format(new Date(), 'yyyy-MM-dd')
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.student_id || !formData.amount) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await onAdd({
                student_id: formData.student_id,
                amount: parseFloat(formData.amount),
                reason: formData.reason || undefined,
                refund_date: formData.refund_date
            });

            // Notification: Refund (Admin + Reception)
            const studentName = students?.find((s: any) => s.id === formData.student_id)?.full_name || 'Student';
            await supabase.from('notifications').insert({
                type: 'financial',
                title: 'Refund Issued',
                message: `Refund: ${parseFloat(formData.amount).toFixed(2)} ${currency.code} for ${studentName}`,
                target_role: 'admin_reception',
                is_read: false
            });

            toast.success('Refund added successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error adding refund:', error);
            toast.error(error.message || 'Failed to add refund');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="glass-card max-w-2xl w-full p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-white/10 shadow-2xl relative animate-in zoom-in duration-300 max-h-[90dvh] overflow-y-auto custom-scrollbar">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 md:top-8 md:right-8 p-3 text-white/40 hover:text-white hover:bg-white/10 rounded-xl md:rounded-2xl transition-all"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-10">
                    <div className="p-3 md:p-4 bg-rose-500/20 rounded-xl md:rounded-2xl text-rose-400">
                        <DollarSign className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight">Add Refund</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Student *</label>
                        <select
                            value={formData.student_id}
                            onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-rose-500/50 transition-all font-bold"
                            required
                        >
                            <option value="" className="bg-[#0f172a]">Select Student</option>
                            {students?.map((student: any) => (
                                <option key={student.id} value={student.id} className="bg-[#0f172a] font-bold">
                                    {student.full_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Amount ({currency.code}) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-rose-500/50 transition-all font-bold"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Date *</label>
                            <input
                                type="date"
                                value={formData.refund_date}
                                onChange={e => setFormData({ ...formData, refund_date: e.target.value })}
                                className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-rose-500/50 transition-all font-bold text-center [color-scheme:dark] cursor-pointer"
                                style={{
                                    colorScheme: 'dark',
                                    height: '58px' // Consistent height with text inputs
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Reason (Optional)</label>
                        <textarea
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-rose-500/50 transition-all font-bold resize-none"
                            rows={3}
                            placeholder=""
                        />
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-2xl bg-white/5 text-white/60 font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-4 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add Refund'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
