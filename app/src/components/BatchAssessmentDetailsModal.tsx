import { useState, useEffect, useRef } from 'react';
import { X, Calendar, User, Users, Trophy, Download, FileText, Edit2, Check, RotateCcw, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

export interface BatchAssessmentDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    batchId: string;
    title: string;
    date: string;
    responsibleCoach?: string;
    assessingCoach?: string;
    onUpdate?: () => void;
}

export default function BatchAssessmentDetailsModal({ isOpen, onClose, batchId, title, date, responsibleCoach, assessingCoach, onUpdate }: BatchAssessmentDetailsModalProps) {
    const [loading, setLoading] = useState(true);
    const [assessments, setAssessments] = useState<any[]>([]);
    const [skillsList, setSkillsList] = useState<string[]>([]);
    const [maxScores, setMaxScores] = useState<Record<string, number>>({});
    const [isEditing, setIsEditing] = useState(false);
    const [tempAssessments, setTempAssessments] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);
    const [availableSkills, setAvailableSkills] = useState<any[]>([]);
    const [showAddSkill, setShowAddSkill] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    const { userProfile } = useTheme();
    const normalizedRole = userProfile?.role?.toLowerCase().trim() || '';
    const canEdit = normalizedRole.includes('admin') || normalizedRole.includes('head') || normalizedRole.includes('master');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            fetchBatchDetails();
            fetchAvailableSkills();
        }
    }, [isOpen, title, date]);

    const fetchAvailableSkills = async () => {
        const { data } = await supabase.from('defined_skills').select('*').order('name');
        if (data) setAvailableSkills(data);
    };

    const fetchBatchDetails = async () => {
        setLoading(true);
        console.log('🚀 Fetching batch details for:', { title, date });
        try {
            const { data, error } = await supabase
                .from('skill_assessments')
                .select('*, students(full_name, coaches(full_name))')
                .eq('title', title)
                .eq('date', date);

            console.log('📦 Batch details response:', { data, error, count: data?.length });

            if (error) {
                console.error('❌ Supabase error:', error);
                throw error;
            }

            if (data && data.length > 0) {
                setAssessments(data);
                setTempAssessments(JSON.parse(JSON.stringify(data))); // Deep copy for editing
                const firstRecord = data[0];
                if (firstRecord.skills && Array.isArray(firstRecord.skills)) {
                    const extractedSkills = firstRecord.skills.map((s: any) => s.name);
                    console.log('✅ Extracted skills:', extractedSkills);
                    setSkillsList(extractedSkills);

                    const scoresMap: Record<string, number> = {};
                    firstRecord.skills.forEach((s: any) => {
                        scoresMap[s.name] = s.max_score;
                    });
                    setMaxScores(scoresMap);
                }
            } else {
                console.warn('⚠️ No data found for this batch!');
            }
        } catch (err) {
            console.error('❌ Error in fetchBatchDetails:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (assessments.length === 0) return;
        const csvRows = [];

        // Add Header Info
        csvRows.push(`Assessment: ${title}`);
        csvRows.push(`Date: ${date}`);
        if (responsibleCoach) csvRows.push(`Responsible Coach: ${responsibleCoach}`);
        if (assessingCoach) csvRows.push(`Assessing Coach: ${assessingCoach}`);
        csvRows.push(''); // Empty line

        const headers = ['Student', ...skillsList, 'Total Score'];
        csvRows.push(headers.join(','));

        assessments.forEach(record => {
            const scoresMap = record.skills.reduce((acc: any, curr: any) => {
                acc[curr.name] = curr.score;
                return acc;
            }, {});

            const coachName = (record.students?.coaches as any)?.full_name || (record.students?.coaches as any)?.[0]?.full_name || '';
            const row = [
                `"${record.students?.full_name || 'Unknown'}${coachName ? ` (${coachName.split(' ')[0]})` : ''}"`,
                ...skillsList.map(skill => scoresMap[skill] || 0),
                record.total_score
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${date}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleScoreChange = (recordId: string, skillName: string, newScore: string) => {
        const score = parseFloat(newScore) || 0;
        const maxScore = maxScores[skillName] || 10;

        if (score > maxScore) {
            toast.error(`Max score for ${skillName} is ${maxScore}`);
            return;
        }

        setTempAssessments(prev => prev.map(rec => {
            if (rec.id === recordId) {
                const updatedSkills = rec.skills.map((s: any) =>
                    s.name === skillName ? { ...s, score } : s
                );
                const totalScore = updatedSkills.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
                return { ...rec, skills: updatedSkills, total_score: totalScore };
            }
            return rec;
        }));
    };

    const handleSaveEdits = async () => {
        setSaving(true);
        const toastId = toast.loading('Saving changes...');
        try {
            for (const record of tempAssessments) {
                const { error } = await supabase
                    .from('skill_assessments')
                    .update({
                        skills: record.skills,
                        total_score: record.total_score
                    })
                    .eq('id', record.id);

                if (error) throw error;
            }

            toast.success('Updated', { id: toastId });
            setIsEditing(false);
            if (onUpdate) onUpdate();
            fetchBatchDetails();
        } catch (err) {
            console.error('Save Edits Error:', err);
            toast.error('Failed to save changes', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    const handleExportPDF = async () => {
        if (!tableRef.current) return;
        const toastId = toast.loading('Generating PDF...');

        try {
            // Use global libraries from CDN
            // @ts-ignore
            const htmlToImage = (window as any).htmlToImage;
            // @ts-ignore
            const jsPDF = (window as any).jspdf?.jsPDF;

            if (!htmlToImage || !jsPDF) {
                throw new Error('PDF Libraries not loaded yet. Please wait a moment and try again.');
            }

            // Create a clone of the table to render full width without scrolling
            const originalElement = tableRef.current;
            const clone = originalElement.cloneNode(true) as HTMLElement;

            // Style the clone to be fully visible and expanded
            clone.style.position = 'absolute';
            clone.style.top = '-9999px';
            clone.style.left = '-9999px';
            clone.style.width = 'fit-content'; // Allow full width
            clone.style.minWidth = '1024px'; // Min width to ensure desktop layout
            clone.style.height = 'auto';
            clone.style.overflow = 'visible';
            clone.style.zIndex = '-1';

            // Adjust styles inside the clone to ensure visibility
            const scrollables = clone.querySelectorAll('.overflow-x-auto, .overflow-auto, .custom-scrollbar');
            scrollables.forEach(el => {
                (el as HTMLElement).style.overflow = 'visible';
                (el as HTMLElement).style.width = 'fit-content';
            });

            // Append clone to body to render it
            document.body.appendChild(clone);

            // Wait a bit for render
            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = await htmlToImage.toPng(clone, {
                backgroundColor: '#16292E',
                cacheBust: true,
                pixelRatio: 2,
                fontEmbedCSS: '',
                style: {
                    borderRadius: '0',
                    letterSpacing: 'normal',
                }
            });

            // Remove clone
            document.body.removeChild(clone);

            // Create a temp PDF instance to calculate image properties safely
            const tempPdf = new jsPDF({ unit: 'px' });
            const imgProps = tempPdf.getImageProperties(dataUrl);

            // Create the final PDF with the exact dimensions of the content
            const finalPdf = new jsPDF({
                orientation: imgProps.width > imgProps.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [imgProps.width, imgProps.height]
            });

            finalPdf.addImage(dataUrl, 'PNG', 0, 0, imgProps.width, imgProps.height);
            finalPdf.save(`${title.replace(/\s+/g, '_')}_${date}.pdf`);

            toast.success('Generated', { id: toastId });
        } catch (err: any) {
            console.error('PDF Export Error:', err);
            toast.error(err.message || 'Failed to generate PDF.', { id: toastId });
        }
    };

    const handleAddSkill = (skillId: string) => {
        const skill = availableSkills.find(s => s.id === parseInt(skillId));
        if (!skill) return;
        if (skillsList.includes(skill.name)) {
            toast.error('Skill already exists');
            return;
        }

        setSkillsList(prev => [...prev, skill.name]);
        setMaxScores(prev => ({ ...prev, [skill.name]: skill.max_score }));
        setTempAssessments(prev => prev.map(rec => ({
            ...rec,
            skills: [...rec.skills, { name: skill.name, score: 0, max_score: skill.max_score }]
        })));
        setShowAddSkill(false);
    };

    const handleRemoveSkill = (skillName: string) => {
        setSkillsList(prev => prev.filter(s => s !== skillName));
        setTempAssessments(prev => prev.map(rec => {
            const updatedSkills = rec.skills.filter((s: any) => s.name !== skillName);
            const totalScore = updatedSkills.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0);
            return { ...rec, skills: updatedSkills, total_score: totalScore };
        }));
    };
    const avgScore = assessments.length > 0
        ? assessments.reduce((acc, curr) => acc + (curr.total_score || 0), 0) / assessments.length
        : 0;

    const isExcellent = avgScore >= 9;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-6xl bg-[#0E1D21] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">

                {/* Main Capture Container for PDF */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0E1D21]" ref={tableRef}>

                    {/* Header - Included in PDF */}
                    <div className="p-6 border-b border-white/10 flex flex-col gap-4 bg-black/20 shrink-0">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                        <Trophy className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span>{title}</span>
                                        <div className="flex items-center gap-4 mt-1.5">
                                            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/40">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {format(new Date(date), 'MMMM dd, yyyy')}
                                            </span>
                                            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white/40">
                                                <Users className="w-3.5 h-3.5" />
                                                {assessments.length} Gymnasts
                                            </span>
                                        </div>
                                    </div>
                                </h2>
                            </div>

                            <div className={`p-4 rounded-[1.5rem] border-2 transition-all duration-700 flex flex-col items-center justify-center min-w-[130px] ${isExcellent ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-pulse' : 'bg-white/5 border-white/10'}`}>
                                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/40 mb-0.5">Performance</span>
                                <span className={`text-2xl font-black tracking-tighter ${isExcellent ? 'text-emerald-400' : 'text-primary'}`}>
                                    {avgScore.toFixed(1)}
                                </span>
                                <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest mt-0.5">Average Score</span>
                            </div>

                            <button
                                onClick={onClose}
                                className="p-3 hover:bg-white/10 rounded-xl transition-colors ml-5 data-[html2canvas-ignore]:hidden"
                                data-html2canvas-ignore="true"
                            >
                                <X className="w-6 h-6 text-white/60" />
                            </button>
                        </div>

                        {/* Coaches Bar */}
                        <div className="flex flex-wrap gap-2.5 pt-3 border-t border-white/5">
                            {responsibleCoach && (
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                                        <Trophy className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[6.5px] font-black text-primary/60 uppercase tracking-widest">Master Respons.</span>
                                        <span className="text-base font-black text-white uppercase tracking-tight">{responsibleCoach}</span>
                                    </div>
                                </div>
                            )}
                            {assessingCoach && (
                                <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                        <User className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[6.5px] font-black text-amber-500/60 uppercase tracking-widest">Assessing Coach</span>
                                        <span className="text-base font-black text-white uppercase tracking-tight">{assessingCoach}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grid Content */}
                    <div className="flex-1 overflow-auto p-6">



                        {loading ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto custom-scrollbar flex-1 border border-white/5 rounded-2xl bg-white/[0.02]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-white/5 text-white/50 text-[9px] uppercase font-black tracking-widest sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="p-3 border-b border-white/10 min-w-[180px] sticky left-0 bg-[#0c181c] z-20">Gymnast</th>
                                            {skillsList.map((skill, i) => (
                                                <th key={i} className="p-6 border-b border-white/10 text-center min-w-[180px] relative group/header">
                                                    <div className="block pt-1 text-center">
                                                        <div className="text-white text-sm font-black uppercase tracking-widest leading-[1.2] whitespace-nowrap mb-1">{skill}</div>
                                                        <div className="text-white/30 text-[9px] font-bold uppercase tracking-tighter leading-[1.2]">max: {maxScores[skill]}</div>
                                                    </div>
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => handleRemoveSkill(skill)}
                                                            title="Remove Skill"
                                                            className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500/40 hover:text-white rounded-lg transition-all border border-red-500/10 active:scale-90 shadow-xl"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}
                                                </th>
                                            ))}
                                            {isEditing && (
                                                <th className="p-4 border-b border-white/10 text-center min-w-[150px]">
                                                    {showAddSkill ? (
                                                        <select
                                                            onChange={(e) => handleAddSkill(e.target.value)}
                                                            onBlur={() => setShowAddSkill(false)}
                                                            autoFocus
                                                            className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none"
                                                        >
                                                            <option value=""></option>
                                                            {availableSkills.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <button
                                                            onClick={() => setShowAddSkill(true)}
                                                            className="flex items-center gap-1.5 mx-auto px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 hover:bg-emerald-500/30 transition-all shadow-[0_5px_15px_rgba(16,185,129,0.1)] active:scale-95"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            Add Skill
                                                        </button>
                                                    )}
                                                </th>
                                            )}
                                            <th className="p-6 border-b border-white/10 text-center min-w-[120px] text-primary">
                                                <div className="block pt-1 text-center">
                                                    <div className="text-primary text-sm font-black uppercase tracking-widest leading-[1.2] whitespace-nowrap mb-1">Total</div>
                                                    <div className="text-primary/30 text-[9px] font-bold uppercase tracking-tighter leading-[1.2]">Points</div>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(isEditing ? tempAssessments : assessments).map(record => {
                                            const recordScoresMap = record.skills.reduce((acc: any, curr: any) => {
                                                acc[curr.name] = curr.score;
                                                return acc;
                                            }, {});
                                            const isAbsent = record.status === 'absent';

                                            return (
                                                <tr key={record.id} className={`hover:bg-white/[0.02] transition-colors ${isAbsent ? 'opacity-50 grayscale' : ''}`}>
                                                    <td className="p-3 sticky left-0 bg-[#0c181c] z-10 flex items-center gap-2.5 border-r border-white/5">
                                                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${isAbsent ? 'from-red-500/20 to-red-900/20 border-red-500/30' : 'from-white/10 to-white/5 border-white/10'} border flex items-center justify-center`}>
                                                            <Users className="w-3.5 h-3.5 text-white/60" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-lg font-black text-white flex items-center gap-2">
                                                                {record.students?.full_name}
                                                                {record.students?.coaches && (
                                                                    <span className="text-xs text-primary/60 font-black italic">
                                                                        @{((record.students.coaches as any)?.full_name?.split(' ')[0] || (record.students.coaches as any)?.[0]?.full_name?.split(' ')[0])}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isAbsent && (
                                                                <div className="text-[8px] uppercase tracking-widest font-black text-red-500 bg-red-500/10 border border-red-500/20 px-1 py-0.5 rounded inline-block mt-0.5">
                                                                    Absent
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {skillsList.map((skill, i) => (
                                                        <td key={i} className="p-3 text-center">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    disabled={isAbsent}
                                                                    value={recordScoresMap[skill] ?? ''}
                                                                    onChange={(e) => handleScoreChange(record.id, skill, e.target.value)}
                                                                    className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-xl font-black text-white text-center focus:border-primary focus:outline-none transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-inner"
                                                                    min="0"
                                                                    max={maxScores[skill]}
                                                                    placeholder={isAbsent ? '-' : ''}
                                                                />
                                                            ) : (
                                                                <span className={`text-xl font-black tracking-tighter ${isAbsent ? 'text-white/30' : (recordScoresMap[skill] >= maxScores[skill] ? 'text-emerald-400' : 'text-white/80')}`}>
                                                                    {isAbsent ? '-' : (recordScoresMap[skill] !== undefined ? recordScoresMap[skill] : '-')}
                                                                </span>
                                                            )}
                                                        </td>
                                                    ))}
                                                    {isEditing && (
                                                        <td className="p-3 text-center border-l border-white/5">
                                                            <span className="text-white/20 text-[9px] italic">Ready</span>
                                                        </td>
                                                    )}
                                                    <td className="p-3 text-center">
                                                        <span className={`font-black text-2xl tracking-tighter ${isAbsent ? 'text-white/30' : 'text-primary drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]'}`}>
                                                            {isAbsent ? '0' : record.total_score}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer - Outside PDF Capture */}
                <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center gap-3 shrink-0">
                    <div className="flex gap-3">
                        {canEdit && !isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-5 py-2.5 rounded-2xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 border-2 border-amber-500/20 shadow-lg shadow-amber-500/10"
                            >
                                <Edit2 className="w-4 h-4" />
                                Modify Scores
                            </button>
                        ) : isEditing ? (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSaveEdits}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 shadow-[0_15px_30px_rgba(16,185,129,0.3)] border-2 border-white/10"
                                >
                                    <Check className="w-4 h-4" />
                                    {saving ? 'Syncing...' : 'Confirm Changes'}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setTempAssessments(JSON.parse(JSON.stringify(assessments)));
                                    }}
                                    className="px-5 py-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white transition-colors font-black uppercase tracking-widest text-[9px] flex items-center gap-2"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Discard
                                </button>
                            </div>
                        ) : null}
                        {isEditing && (
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider ml-4 animate-pulse">
                                Editing Skills & Scores...
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {!isEditing && (
                            <>
                                <button
                                    onClick={handleExportPDF}
                                    className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-black uppercase tracking-widest text-[9px] flex items-center gap-2"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    Download PDF
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
