import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, DollarSign, ChevronDown } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface Student {
    id: string;
    full_name: string;
}

interface AddPaymentFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddPaymentForm({ onClose, onSuccess }: AddPaymentFormProps) {
    const { t } = useTranslation();
    const { currency } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);

    const [formData, setFormData] = useState({
        student_id: '',
        guest_name: '',
        amount: '',
        payment_method: 'cash',
        notes: '',
        date: new Date().toISOString().slice(0, 10),
        is_guest: false
    });

    useEffect(() => {
        const fetchStudents = async () => {
            const { data } = await supabase.from('students').select('id, full_name');
            if (data) setStudents(data);
        };
        fetchStudents();
    }, []);

    // Theme-aware styles to ensure visibility
    const inputStyle = {
        backgroundColor: '#FFFFFF',
        color: '#1F2937',
        borderColor: 'rgb(209, 213, 219)'
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Get student name for notification
            const selectedStudent = !formData.is_guest ? students.find(s => s.id === formData.student_id) : null;
            const finalNotes = formData.is_guest
                ? `Guest - ${formData.guest_name}${formData.notes ? ' - ' + formData.notes : ''}`
                : formData.notes;

            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase.from('payments').insert([
                {
                    student_id: formData.is_guest ? null : formData.student_id,
                    amount: parseFloat(formData.amount),
                    payment_method: formData.payment_method,
                    payment_date: formData.date,
                    notes: finalNotes,
                    created_by: user?.id
                }
            ]);

            if (error) throw error;

            // Create notification for admin + receiver
            if (selectedStudent || formData.is_guest) {
                const payerName = formData.is_guest ? formData.guest_name : (selectedStudent?.full_name || 'Student');
                await supabase.from('notifications').insert({
                    type: 'payment',
                    title: 'Payment Received',
                    message: `Payment: ${parseFloat(formData.amount).toFixed(2)} ${currency.code} from ${payerName}`,
                    target_role: 'admin_reception',
                    is_read: false
                });
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error adding payment:', error);
            toast.error('Error adding payment: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <div
                className="glass-card rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-300"
            >
                {/* Header */}
                <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-xl text-primary">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            Record Payment
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{t('common.student')}</label>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, is_guest: !prev.is_guest, student_id: '', guest_name: '' }))}
                                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border transition-all ${formData.is_guest
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                                    : 'bg-white/5 text-white/40 border-white/10 hover:text-white'
                                    }`}
                            >
                                {formData.is_guest ? 'Guest Student' : 'Switch to Guest'}
                            </button>
                        </div>

                        {!formData.is_guest ? (
                            <div className="relative group/student">
                                <select
                                    required
                                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white appearance-none cursor-pointer pr-12"
                                    value={formData.student_id}
                                    onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                                >
                                    <option value="" className="bg-slate-900">Select Gymnast</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id} className="bg-slate-900">{s.full_name}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none opacity-40 group-hover/student:opacity-100 transition-opacity">
                                    <ChevronDown className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        ) : (
                            <div className="relative group/guest">
                                <input
                                    required
                                    type="text"
                                    placeholder="Enter Guest Name..."
                                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500/50 outline-none transition-all text-white placeholder:text-white/20"
                                    value={formData.guest_name}
                                    onChange={e => setFormData({ ...formData, guest_name: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Amount ({currency.code})</label>
                            <input
                                required
                                type="number"
                                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white placeholder:text-white/20"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                placeholder=""
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Date</label>
                            <input
                                required
                                type="date"
                                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white text-center [color-scheme:dark] cursor-pointer"
                                style={{
                                    colorScheme: 'dark'
                                }}
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Payment Method</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {['cash', 'bank_transfer', 'card'].map(method => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, payment_method: method })}
                                    className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${formData.payment_method === method
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105'
                                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {method.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Notes</label>
                        <textarea
                            className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all h-24 resize-none text-white placeholder:text-white/20"
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder=""
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-4 pt-8 border-t border-white/5 mt-8">
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
                            className="px-10 py-4 bg-gradient-to-r from-primary to-primary/80 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 relative z-10" />
                                    <span className="relative z-10">Save Payment</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
