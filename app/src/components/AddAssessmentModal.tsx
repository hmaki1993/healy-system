import { useState, useEffect } from 'react';
import { X, Plus, Save, Settings, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import SkillsManagerModal from './SkillsManagerModal';

interface AddAssessmentModalProps {
    studentId: any;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddAssessmentModal({ studentId, isOpen, onClose, onSuccess }: AddAssessmentModalProps) {
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [availableSkills, setAvailableSkills] = useState<any[]>([]);
    const [selectedSkills, setSelectedSkills] = useState<any[]>([]); // { skill_id, score, name, max_score }
    const [showSkillsManager, setShowSkillsManager] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSkills();
            setTitle('');
            setSelectedSkills([]);
        }
    }, [isOpen]);

    // Re-fetch skills when manager closes in case new ones were added
    useEffect(() => {
        if (!showSkillsManager) fetchSkills();
    }, [showSkillsManager]);

    const fetchSkills = async () => {
        const { data } = await supabase.from('defined_skills').select('*').order('name');
        if (data) setAvailableSkills(data);
    };

    const addSkillRow = () => {
        setSelectedSkills([...selectedSkills, { skill_id: '', score: 0, name: '', max_score: 10 }]);
    };

    const updateRow = (index: number, field: string, value: any) => {
        const newSkills = [...selectedSkills];
        if (field === 'skill_id') {
            const skill = availableSkills.find(s => s.id === parseInt(value));
            newSkills[index] = {
                ...newSkills[index],
                skill_id: value,
                name: skill?.name || '',
                max_score: skill?.max_score || 10,
                score: 0 // reset score on skill change
            };
        } else {
            newSkills[index] = { ...newSkills[index], [field]: value };
        }
        setSelectedSkills(newSkills);
    };

    const removeRow = (index: number) => {
        setSelectedSkills(selectedSkills.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!title.trim()) return toast.error('Enter a title');
        if (selectedSkills.length === 0) return toast.error('Add at least one skill');

        // Validation check
        const invalid = selectedSkills.find(s => !s.skill_id);
        if (invalid) return toast.error('Please select a skill for all rows');

        setLoading(true);
        const totalScore = selectedSkills.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);

        const { error } = await supabase.from('skill_assessments').insert({
            student_id: studentId,
            title,
            skills: selectedSkills,
            total_score: totalScore,
            coach_id: (await supabase.auth.getUser()).data.user?.id
        });

        if (!error) {
            toast.success('Assessment saved');
            onSuccess();
            onClose();
        } else {
            toast.error('Failed to save assessment');
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

                <div className="relative w-full max-w-2xl bg-[#0E1D21] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <h3 className="text-xl font-black text-white uppercase tracking-wider">New Assessment</h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>

                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-1">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 block">Assessment Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Monthly Evaluation / Level 1 Test"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 outline-none"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Skills & Scores</label>
                                <button
                                    onClick={() => setShowSkillsManager(true)}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors flex items-center gap-2"
                                >
                                    <Settings className="w-3 h-3" />
                                    Manage Skills
                                </button>
                            </div>

                            <div className="space-y-3">
                                {selectedSkills.map((row, index) => (
                                    <div key={index} className="flex gap-3 items-start animate-in fade-in slide-in-from-left-4 duration-300">
                                        <div className="flex-1">
                                            <select
                                                value={row.skill_id}
                                                onChange={(e) => updateRow(index, 'skill_id', e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 outline-none appearance-none"
                                            >
                                                <option value="" className="bg-slate-900">Select Skill...</option>
                                                {availableSkills.map(s => (
                                                    <option key={s.id} value={s.id} className="bg-slate-900">{s.name} (Max {s.max_score})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-24 relative">
                                            <input
                                                type="number"
                                                value={row.score}
                                                onChange={(e) => updateRow(index, 'score', parseFloat(e.target.value))}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primary/50 outline-none text-center"
                                                min="0"
                                                max={row.max_score}
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/30">/{row.max_score}</span>
                                        </div>
                                        <button
                                            onClick={() => removeRow(index)}
                                            className="p-3 hover:bg-rose-500/20 text-white/20 hover:text-rose-500 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={addSkillRow}
                                    className="w-full py-3 border border-dashed border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Skill Row
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-6 border-t border-white/10 flex justify-end shrink-0">
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save Assessment'}
                        </button>
                    </div>
                </div>
            </div>

            <SkillsManagerModal
                isOpen={showSkillsManager}
                onClose={() => setShowSkillsManager(false)}
            />
        </>
    );
}
