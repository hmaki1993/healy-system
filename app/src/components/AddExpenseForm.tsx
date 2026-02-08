import { useState } from 'react';
import { X, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useCurrency } from '../context/CurrencyContext';

interface AddExpenseFormProps {
    onClose: () => void;
    onSuccess: () => void;
    onAdd: (expense: { description: string; amount: number; category: string; expense_date: string }) => Promise<void>;
}

export default function AddExpenseForm({ onClose, onSuccess, onAdd }: AddExpenseFormProps) {
    const { currency } = useCurrency();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: 'other',
        expense_date: format(new Date(), 'yyyy-MM-dd')
    });

    const categories = [
        { value: 'rent', label: 'Rent' },
        { value: 'equipment', label: 'Equipment' },
        { value: 'utilities', label: 'Utilities (Electric, Water, etc.)' },
        { value: 'salaries', label: 'Salaries & Bonuses' },
        { value: 'other', label: 'Other' }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            await onAdd({
                description: formData.description,
                amount: parseFloat(formData.amount),
                category: formData.category,
                expense_date: formData.expense_date
            });

            // Notification: Expense (Admin + Reception)
            await supabase.from('notifications').insert({
                type: 'financial',
                title: 'Expense Recorded',
                message: `Expense: ${parseFloat(formData.amount).toFixed(2)} ${currency.code} - ${formData.description}`,
                target_role: 'admin_reception',
                is_read: false
            });

            toast.success('Expense added successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error adding expense:', error);
            toast.error(error.message || 'Failed to add expense');
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
                    <div className="p-3 md:p-4 bg-orange-500/20 rounded-xl md:rounded-2xl text-orange-400">
                        <Receipt className="w-6 h-6 md:w-7 md:h-7" />
                    </div>
                    <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight">Add Expense</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Description *</label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-orange-500/50 transition-all font-bold"
                            placeholder=""
                            required
                        />
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
                                className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-orange-500/50 transition-all font-bold"
                                placeholder=""
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Date *</label>
                            <input
                                type="date"
                                value={formData.expense_date}
                                onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                                className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-orange-500/50 transition-all font-bold text-center [color-scheme:dark] cursor-pointer"
                                style={{
                                    colorScheme: 'dark',
                                    height: '58px' // Enforce consistent height with text inputs
                                }}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Category *</label>
                        <select
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-6 py-4 rounded-2xl border border-white/10 bg-white/5 text-white outline-none focus:border-orange-500/50 transition-all font-bold"
                            required
                        >
                            {categories.map(cat => (
                                <option key={cat.value} value={cat.value} className="bg-[#0f172a] font-bold">
                                    {cat.label}
                                </option>
                            ))}
                        </select>
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
                            className="flex-1 px-6 py-4 rounded-2xl bg-orange-500 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add Expense'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
