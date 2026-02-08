

import { X, TrendingUp, Calendar, Wallet, AlertTriangle, DollarSign, Receipt, Dumbbell, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrency } from '../context/CurrencyContext';

interface Payment {
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    notes: string;
    students: {
        full_name: string;
    };
}

interface PayrollEntry {
    coach_name: string;
    salary: number;
    total_earnings: number;
    total_pt_sessions: number;
    pt_rate: number;
}

interface Refund {
    id: string;
    amount: number;
    refund_date: string;
    reason?: string;
    students: {
        full_name: string;
    };
}

interface Expense {
    id: string;
    description: string;
    amount: number;
    category: string;
    expense_date: string;
}

interface ProfitData {
    revenue: number;
    expenses: number;
    profit: number;
}

interface FinanceDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'revenue' | 'income' | 'expenses' | 'profit' | 'refunds' | 'general_expenses' | 'pt_sessions' | null;
    title: string;
    data: Payment[] | PayrollEntry[] | Refund[] | Expense[] | ProfitData | null;
    onDelete?: (id: string, table: string) => void;
}

export default function FinanceDetailModal({ isOpen, onClose, type, title, data, onDelete }: FinanceDetailModalProps) {
    const { currency } = useCurrency();
    if (!isOpen || !type || !data) return null;

    const renderContent = () => {
        switch (type) {
            case 'revenue':
            case 'income':
                const payments = data as Payment[];
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-white/30 font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-6">GYMNAST</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Method</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    {onDelete && <th className="px-6 py-4 w-12"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {payments.length === 0 ? (
                                    <tr><td colSpan={onDelete ? 6 : 5} className="px-6 py-8 text-center text-white/20 font-black uppercase tracking-widest text-[10px]">No records found</td></tr>
                                ) : (
                                    payments.map((p) => {
                                        const isPT = p.notes?.toLowerCase().includes('pt');
                                        return (
                                            <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-white group-hover:text-primary transition-colors">
                                                        {p.students?.full_name || (p.notes?.split(' - ')[1] || 'Guest Gymnast')}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isPT
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        }`}>
                                                        {isPT ? 'Personal Training' : 'Gymnast'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-white/60 text-xs font-mono">{format(new Date(p.payment_date), 'MMM dd, yyyy')}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-wider text-white/40 border border-white/5">
                                                        {p.payment_method.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-6 text-right font-black text-emerald-400 tracking-tighter text-3xl drop-shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                                                    +{Number(p.amount).toLocaleString()} <span className="text-[10px] text-white/10 font-black italic">{currency.code}</span>
                                                </td>
                                                {onDelete && (
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={() => onDelete(p.id, 'payments')}
                                                            className="p-2 bg-white/5 hover:bg-rose-500/10 text-white/20 hover:text-rose-400 rounded-lg transition-all active:scale-95 group/del"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                );

            case 'expenses':
                const payroll = data as PayrollEntry[];
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-white/30 font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4">Coach</th>
                                    <th className="px-6 py-4 text-center">Base Salary</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {payroll.length === 0 ? (
                                    <tr><td colSpan={3} className="px-6 py-8 text-center text-white/20 font-black uppercase tracking-widest text-[10px]">No payroll records</td></tr>
                                ) : (
                                    payroll.map((p, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-white group-hover:text-orange-400 transition-colors">{p.coach_name}</td>
                                            <td className="px-6 py-4 text-center text-white/60 font-bold">{p.salary.toLocaleString()} <span className="text-[9px] text-white/20">{currency.code}</span></td>
                                            <td className="px-6 py-4 text-right font-black text-orange-400 tracking-tight">
                                                -{p.salary.toLocaleString()} <span className="text-[9px] text-white/20">{currency.code}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                );

            case 'pt_sessions':
                const ptPayroll = data as PayrollEntry[];
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-white/30 font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4">Coach</th>
                                    <th className="px-6 py-4 text-center">PT Sessions</th>
                                    <th className="px-6 py-4 text-center">Rate/Session</th>
                                    <th className="px-6 py-4 text-right">Total Earnings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {ptPayroll.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-white/20 font-black uppercase tracking-widest text-[10px]">No PT sessions</td></tr>
                                ) : (
                                    ptPayroll.map((p, i) => {
                                        const ptEarnings = p.total_pt_sessions * (p.pt_rate || 0);
                                        if (ptEarnings === 0) return null;
                                        return (
                                            <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4 font-bold text-white group-hover:text-purple-400 transition-colors">{p.coach_name}</td>
                                                <td className="px-6 py-4 text-center text-white/60 font-bold">{p.total_pt_sessions}</td>
                                                <td className="px-6 py-4 text-center text-white/40 text-xs font-mono">{(p.pt_rate || 0).toLocaleString()} {currency.code}</td>
                                                <td className="px-6 py-4 text-right font-black text-purple-400 tracking-tight">
                                                    -{ptEarnings.toLocaleString()} <span className="text-[9px] text-white/20">{currency.code}</span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                );

            case 'refunds':
                const refunds = data as Refund[];
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-white/30 font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4">Student</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Reason</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    {onDelete && <th className="px-6 py-4 w-12"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {refunds.length === 0 ? (
                                    <tr><td colSpan={onDelete ? 5 : 4} className="px-6 py-8 text-center text-white/20 font-black uppercase tracking-widest text-[10px]">No refunds</td></tr>
                                ) : (
                                    refunds.map((r) => (
                                        <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-white group-hover:text-rose-400 transition-colors">
                                                {r.students?.full_name || 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 text-white/60 text-xs font-mono">{format(new Date(r.refund_date), 'MMM dd, yyyy')}</td>
                                            <td className="px-6 py-4 text-white/40 text-xs">{r.reason || 'No reason provided'}</td>
                                            <td className="px-6 py-4 text-right font-black text-rose-400 tracking-tight">
                                                -{Number(r.amount).toLocaleString()} <span className="text-[9px] text-white/20">{currency.code}</span>
                                            </td>
                                            {onDelete && (
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => onDelete(r.id, 'refunds')}
                                                        className="p-2 bg-white/5 hover:bg-rose-500/10 text-white/20 hover:text-rose-400 rounded-lg transition-all active:scale-95"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                );

            case 'general_expenses':
                const expenses = data as Expense[];
                const categoryLabels: Record<string, string> = {
                    rent: 'Rent',
                    equipment: 'Equipment',
                    utilities: 'Utilities',
                    salaries: 'Salaries',
                    other: 'Other'
                };
                return (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-white/30 font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-6">CATEGORY</th>
                                    <th className="px-6 py-6">DATE</th>
                                    <th className="px-6 py-6 text-right">AMOUNT</th>
                                    {onDelete && <th className="px-6 py-4 w-12"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {expenses.length === 0 ? (
                                    <tr><td colSpan={onDelete ? 5 : 4} className="px-6 py-8 text-center text-white/20 font-black uppercase tracking-widest text-[10px]">No expenses</td></tr>
                                ) : (
                                    expenses.map((e) => (
                                        <tr key={e.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 font-bold text-white group-hover:text-orange-400 transition-colors">
                                                {e.description}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 rounded-lg bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase tracking-wider border border-orange-500/20">
                                                    {categoryLabels[e.category] || e.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-white/60 text-xs font-mono">{format(new Date(e.expense_date), 'MMM dd, yyyy')}</td>
                                            <td className="px-6 py-4 text-right font-black text-orange-400 tracking-tight text-xl">
                                                -{Number(e.amount).toLocaleString()} <span className="text-[10px] text-white/10 uppercase tracking-widest">{currency.code}</span>
                                            </td>
                                            {onDelete && (
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => onDelete(e.id, 'expenses')}
                                                        className="p-2 bg-white/5 hover:bg-rose-500/10 text-white/20 hover:text-rose-400 rounded-lg transition-all active:scale-95"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                );

            case 'profit':
                const profitData = data as ProfitData;
                const isProfitable = profitData.profit >= 0;
                return (
                    <div className="space-y-8 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 rounded-2xl bg-emerald-500/5 border border-white/10 text-center group hover:border-emerald-500/30 transition-all">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400/60 mb-2">Revenue</p>
                                <p className="text-3xl font-black text-white tracking-tighter">{profitData.revenue.toLocaleString()} <span className="text-[10px] text-white/10 italic">{currency.code}</span></p>
                            </div>
                            <div className="p-6 rounded-2xl bg-rose-500/5 border border-white/10 text-center group hover:border-rose-500/30 transition-all">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400/60 mb-2">Expenses</p>
                                <p className="text-3xl font-black text-white tracking-tighter">{profitData.expenses.toLocaleString()} <span className="text-[10px] text-white/10 italic">{currency.code}</span></p>
                            </div>
                        </div>

                        <div className="relative pt-6 flex flex-col items-center justify-center">
                            <div className={`p-6 rounded-[2rem] border-2 ${isProfitable ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]' : 'bg-orange-500/20 border-orange-500 shadow-[0_0_50px_rgba(249,115,22,0.2)]'} transition-all duration-500`}>
                                <div className="text-center">
                                    <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-2 ${isProfitable ? 'text-emerald-300' : 'text-orange-300'}`}>Net Profit</p>
                                    <p className={`text-5xl font-black tracking-tighter ${isProfitable ? 'text-white' : 'text-white'}`}>
                                        {isProfitable ? '+' : ''}{profitData.profit.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] font-black text-white/40 mt-2 uppercase tracking-widest">{currency.code}</p>
                                </div>
                            </div>
                            {isProfitable ? (
                                <div className="mt-6 flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest animate-bounce">
                                    <TrendingUp className="w-4 h-4" /> Excellent Performance
                                </div>
                            ) : (
                                <div className="mt-6 flex items-center gap-2 text-orange-400 text-xs font-black uppercase tracking-widest animate-bounce">
                                    <AlertTriangle className="w-4 h-4" /> Action Needed
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[2.5rem] border border-white/10 shadow-2xl relative animate-in zoom-in-95 duration-300 overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${type === 'expenses' ? 'bg-orange-500/20 text-orange-400' :
                            type === 'profit' ? 'bg-emerald-500/20 text-emerald-400' :
                                type === 'refunds' ? 'bg-rose-500/20 text-rose-400' :
                                    type === 'general_expenses' ? 'bg-orange-500/20 text-orange-400' :
                                        type === 'pt_sessions' ? 'bg-purple-500/20 text-purple-400' :
                                            'bg-primary/20 text-primary'
                            }`}>
                            {type === 'expenses' ? <Wallet className="w-6 h-6" /> :
                                type === 'profit' ? <TrendingUp className="w-6 h-6" /> :
                                    type === 'refunds' ? <DollarSign className="w-6 h-6" /> :
                                        type === 'general_expenses' ? <Receipt className="w-6 h-6" /> :
                                            type === 'pt_sessions' ? <Dumbbell className="w-6 h-6" /> :
                                                <Calendar className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{title}</h2>
                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em]">Institutional Records</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-2xl transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}
