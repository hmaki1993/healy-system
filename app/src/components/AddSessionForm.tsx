import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, Calendar, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

interface Coach {
    id: string;
    full_name: string;
}

interface Session {
    id?: string;
    title: string;
    coach_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    capacity: number;
}

interface AddSessionFormProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: Session | null;
}

export default function AddSessionForm({ onClose, onSuccess, initialData }: AddSessionFormProps) {
    const [loading, setLoading] = useState(false);
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        coach_id: '',
        day_of_week: 'Sunday',
        start_time: '16:00',
        end_time: '17:00',
        capacity: 20
    });

    const daysOfWeek = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Theme-aware styles
    const inputStyle = {
        backgroundColor: '#FFFFFF',
        color: '#1F2937',
        borderColor: 'rgba(128, 128, 128, 0.3)'
    };

    useEffect(() => {
        const fetchCoaches = async () => {
            const { data } = await supabase.from('coaches').select('id, full_name');
            if (data) setCoaches(data);
        };
        fetchCoaches();

        if (initialData) {
            setFormData({
                title: initialData.title,
                coach_id: initialData.coach_id,
                day_of_week: initialData.day_of_week,
                start_time: initialData.start_time,
                end_time: initialData.end_time,
                capacity: initialData.capacity
            });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (initialData?.id) {
                // Update
                const { error } = await supabase
                    .from('training_sessions')
                    .update({
                        title: formData.title,
                        coach_id: formData.coach_id,
                        day_of_week: formData.day_of_week,
                        start_time: formData.start_time,
                        end_time: formData.end_time,
                        capacity: formData.capacity
                    })
                    .eq('id', initialData.id);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase.from('training_sessions').insert([
                    {
                        title: formData.title,
                        coach_id: formData.coach_id,
                        day_of_week: formData.day_of_week,
                        start_time: formData.start_time,
                        end_time: formData.end_time,
                        capacity: formData.capacity
                    }
                ]);
                if (error) throw error;
            }

            toast.success(initialData ? 'Class updated successfully' : 'Class added successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving session:', error);
            toast.error('Error saving session: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.from('training_sessions').delete().eq('id', initialData?.id);
            if (error) throw error;
            toast.success('Class deleted successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Error deleting: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <div
                className="glass-card rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-300"
            >
                <div className="px-8 py-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-xl text-primary">
                                <Calendar className="w-6 h-6" />
                            </div>
                            {initialData ? 'Edit Class' : 'Add New Class'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Class Title</label>
                        <input
                            required
                            placeholder=""
                            className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white placeholder:text-white/20"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Coach</label>
                            <div className="relative group/coach">
                                <select
                                    required
                                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white appearance-none cursor-pointer pr-12"
                                    value={formData.coach_id}
                                    onChange={e => setFormData({ ...formData, coach_id: e.target.value })}
                                >
                                    <option value="" className="bg-slate-900">Select Coach</option>
                                    {coaches.map(c => (
                                        <option key={c.id} value={c.id} className="bg-slate-900">{c.full_name}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none opacity-40 group-hover/coach:opacity-100 transition-opacity">
                                    <ChevronDown className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Day</label>
                            <div className="relative group/day">
                                <select
                                    required
                                    className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white appearance-none cursor-pointer pr-12"
                                    value={formData.day_of_week}
                                    onChange={e => setFormData({ ...formData, day_of_week: e.target.value })}
                                >
                                    {daysOfWeek.map(day => (
                                        <option key={day} value={day} className="bg-slate-900">{day}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none opacity-40 group-hover/day:opacity-100 transition-opacity">
                                    <ChevronDown className="w-4 h-4 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Start Time</label>
                            <input
                                required
                                type="time"
                                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">End Time</label>
                            <input
                                required
                                type="time"
                                className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Capacity</label>
                        <input
                            required
                            type="number"
                            className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-white"
                            value={formData.capacity}
                            onChange={e => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                        />
                    </div>

                    <div className="flex justify-between items-center pt-8 border-t border-white/5 mt-8">
                        {initialData ? (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 hover:text-red-400 transition-all bg-red-500/5 hover:bg-red-500/10 rounded-2xl flex items-center gap-3"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Class
                            </button>
                        ) : (
                            <div></div> // Spacer
                        )}
                        <div className="flex gap-4">
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
                                        <span className="relative z-10">Save Class</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Delete Class"
                message="Are you sure you want to delete this training session? This action cannot be undone."
                type="danger"
            />
        </div>
    );
}
