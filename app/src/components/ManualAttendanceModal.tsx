import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, Save, Calendar, Check, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface ManualAttendanceModalProps {
    coach: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ManualAttendanceModal({ coach, onClose, onSuccess }: ManualAttendanceModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [status, setStatus] = useState<'present' | 'absent' | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!status) return toast.error(t('common.selectStatus'));
        setLoading(true);

        try {
            const timestamp = new Date();
            const payload: any = {
                coach_id: coach.id,
                date: date,
                status: status
            };

            if (status === 'present') {
                // If marking for today, use current time. If past, use 9 AM.
                const isToday = date === format(new Date(), 'yyyy-MM-dd');
                const checkInTime = isToday ? timestamp : new Date(`${date}T09:00:00`);

                payload.check_in_time = checkInTime.toISOString();
                payload.check_out_time = null; // Mark as Active
            } else {
                payload.check_in_time = null;
                payload.check_out_time = null;
            }

            const { error } = await supabase
                .from('coach_attendance')
                .upsert(payload, { onConflict: 'coach_id,date' });

            if (error) throw error;
            toast.success(t('common.saved'));
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving attendance:', error);
            toast.error(error.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#1a1f37] rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">
                            {t('coaches.markAttendance')}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-lg">
                                {coach.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-white">{coach.full_name}</h3>
                                <p className="text-xs text-white/40 uppercase tracking-widest">{t(`roles.${coach.role}`)}</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-white/40 uppercase tracking-widest pl-1">{t('common.date')}</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full bg-[#0d1321] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/50 font-bold"
                                />
                                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setStatus('present')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${status === 'present'
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                    }`}
                            >
                                <Check className="w-8 h-8" />
                                <span className="font-black uppercase tracking-widest text-xs">{t('coaches.present')}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatus('absent')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${status === 'absent'
                                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]'
                                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                                    }`}
                            >
                                <XCircle className="w-8 h-8" />
                                <span className="font-black uppercase tracking-widest text-xs">{t('coaches.absent')}</span>
                            </button>
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wide text-xs transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !status}
                            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wide text-xs transition-colors flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? t('common.saving') : t('common.save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
