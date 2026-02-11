import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ImportStudentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface CSVRow {
    Name: string;
    Phone: string;
    'Date of Birth'?: string;
    Gender?: string;
    Coach?: string;
    'Subscription Type'?: string;
    'Start Date'?: string;
    Notes?: string;
}

interface ParsedStudent {
    full_name: string;
    phone: string;
    date_of_birth?: string;
    gender?: string;
    coach_name?: string;
    subscription_type?: string;
    subscription_start?: string;
    notes?: string;
    errors: string[];
}

export default function ImportStudentsModal({ isOpen, onClose, onSuccess }: ImportStudentsModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<ParsedStudent[]>([]);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState(false);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.csv')) {
                toast.error('Please select a CSV file');
                return;
            }
            setFile(selectedFile);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file: File) => {
        Papa.parse<CSVRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Filter out completely empty rows (all fields are empty or whitespace)
                const nonEmptyRows = results.data.filter(row => {
                    return Object.values(row).some(value => value && value.trim() !== '');
                });

                if (nonEmptyRows.length === 0) {
                    toast.error('CSV file is empty or contains no valid data');
                    setFile(null);
                    return;
                }

                const validated = nonEmptyRows.map((row, index) => validateRow(row, index));
                setParsedData(validated);
                setPreview(true);
            },
            error: (error) => {
                toast.error(`Error parsing CSV: ${error.message}`);
            }
        });
    };

    const validateRow = (row: CSVRow, index: number): ParsedStudent => {
        const errors: string[] = [];

        // Required fields
        if (!row.Name?.trim()) errors.push('Name is required');
        if (!row.Phone?.trim()) errors.push('Phone is required');

        // Phone validation (Egyptian format)
        const phone = row.Phone?.trim();
        if (phone && !/^01[0-9]{9}$/.test(phone)) {
            errors.push('Invalid phone format (should be 11 digits starting with 01)');
        }

        // Date validation
        const dateOfBirth = row['Date of Birth']?.trim();
        if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
            errors.push('Date of Birth should be YYYY-MM-DD format');
        }

        const startDate = row['Start Date']?.trim();
        if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            errors.push('Start Date should be YYYY-MM-DD format');
        }

        // Gender validation
        const gender = row.Gender?.toLowerCase().trim();
        if (gender && !['male', 'female'].includes(gender)) {
            errors.push('Gender should be "male" or "female"');
        }

        // Subscription type validation
        const subType = row['Subscription Type']?.toLowerCase().trim();
        if (subType && !['monthly', '3months', '6months', 'yearly'].includes(subType)) {
            errors.push('Invalid subscription type');
        }

        return {
            full_name: row.Name?.trim() || '',
            phone: phone || '',
            date_of_birth: dateOfBirth,
            gender: gender,
            coach_name: row.Coach?.trim(),
            subscription_type: subType,
            subscription_start: startDate,
            notes: row.Notes?.trim(),
            errors
        };
    };

    const handleImport = async () => {
        const validRows = parsedData.filter(row => row.errors.length === 0);

        if (validRows.length === 0) {
            toast.error('No valid rows to import');
            return;
        }

        setImporting(true);
        let successCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Get all coaches for matching
            const { data: coaches } = await supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'coach');

            // Get all existing students to check for duplicates
            const { data: existingStudents } = await supabase
                .from('students')
                .select('full_name, contact_number, parent_contact');

            for (const student of validRows) {
                try {
                    // Check for duplicates based on name and phone
                    const isDuplicate = existingStudents?.some(existing =>
                        existing.full_name?.toLowerCase().trim() === student.full_name?.toLowerCase().trim() &&
                        existing.contact_number?.trim() === student.phone?.trim()
                    );

                    if (isDuplicate) {
                        console.log(`Skipping duplicate: ${student.full_name} (${student.phone})`);
                        duplicateCount++;
                        continue; // Skip this student
                    }

                    // Match coach by name if provided
                    let coachId = null;
                    if (student.coach_name && coaches) {
                        const coach = coaches.find(c =>
                            c.full_name?.toLowerCase() === student.coach_name?.toLowerCase()
                        );
                        coachId = coach?.id;
                    }

                    // Insert student
                    const { error } = await supabase
                        .from('students')
                        .insert({
                            full_name: student.full_name,
                            contact_number: student.phone,
                            date_of_birth: student.date_of_birth || null,
                            gender: student.gender || null,
                            coach_id: coachId,
                            subscription_type: student.subscription_type || null,
                            subscription_start: student.subscription_start || null,
                            notes: student.notes || null,
                            created_by: user.id
                        });

                    if (error) throw error;
                    successCount++;
                } catch (err) {
                    console.error('Error importing student:', err);
                    errorCount++;
                }
            }

            // Show results
            if (successCount > 0) {
                toast.success(`Successfully imported ${successCount} student(s)`);
            }
            if (duplicateCount > 0) {
                toast(`Skipped ${duplicateCount} duplicate(s)`, { icon: 'ℹ️' });
            }
            if (errorCount > 0) {
                toast.error(`Failed to import ${errorCount} student(s)`);
            }

            if (successCount > 0) {
                onSuccess();
                handleClose();
            }
        } catch (error: any) {
            console.error('Import error:', error);
            toast.error(error.message || 'Error importing students');
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setParsedData([]);
        setPreview(false);
        onClose();
    };

    const validCount = parsedData.filter(row => row.errors.length === 0).length;
    const errorCount = parsedData.filter(row => row.errors.length > 0).length;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            {/* Ultra-Premium Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-1000"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-5xl bg-black/60 backdrop-blur-3xl border border-white/5 rounded-[3.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700">
                {/* Dynamic Glass Shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none"></div>

                {/* Header Section */}
                <div className="relative z-10 px-10 pt-10 pb-6 flex items-center justify-between border-b border-white/5 bg-[#0E1D21]/50">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg">
                            <FileSpreadsheet className="w-7 h-7" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-1">
                                Import Students
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                Select CSV file to upload
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-rose-500 text-white/40 hover:text-white transition-all border border-white/10 active:scale-90"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative z-10 p-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {!preview ? (
                        /* Upload Section */
                        <div className="space-y-10">
                            <div className="relative group">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="csv-upload"
                                />
                                <label
                                    htmlFor="csv-upload"
                                    className="cursor-pointer block border-2 border-dashed border-white/10 rounded-[3rem] p-16 text-center hover:border-primary/40 hover:bg-white/[0.02] transition-all duration-700 relative overflow-hidden group/label"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover/label:opacity-100 transition-opacity"></div>
                                    <Upload className="w-16 h-16 text-white/10 mx-auto mb-6 group-hover/label:text-primary/60 group-hover/label:scale-110 transition-all duration-700" />
                                    <p className="text-xl font-black text-white/80 mb-2 uppercase tracking-widest">
                                        {file ? file.name : 'Upload CSV'}
                                    </p>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
                                        Select CSV File
                                    </p>
                                </label>
                            </div>

                            {/* Requirements */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-6">
                                    <div className="flex items-center gap-3 text-primary/60">
                                        <AlertCircle className="w-4 h-4" />
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Required Fields</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Name</span>
                                            <span className="text-[9px] font-bold text-white/20 italic">Full Name</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Phone</span>
                                            <span className="text-[9px] font-bold text-white/20 italic">11 Digits</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/5 space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-2">Optional Fields</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {['Birth Date', 'Gender', 'Coach', 'Subscription', 'Notes'].map((tag) => (
                                            <span key={tag} className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5 text-[8px] font-black uppercase tracking-widest text-white/40">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-[9px] font-medium text-white/20 leading-relaxed pt-2">
                                        Optional fields help create a more complete profile.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Preview Section */
                        <div className="space-y-10 animate-in fade-in duration-700">
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-8">
                                <div className="p-8 rounded-[2.5rem] bg-emerald-500/[0.02] border border-emerald-500/10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/[0.05] blur-3xl rounded-full"></div>
                                    <div className="flex items-center gap-3 mb-4 text-emerald-500/60">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Valid Entries</span>
                                    </div>
                                    <p className="text-4xl font-black text-white leading-none">{validCount}</p>
                                </div>
                                <div className="p-8 rounded-[2.5rem] bg-rose-500/[0.02] border border-rose-500/10 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/[0.05] blur-3xl rounded-full"></div>
                                    <div className="flex items-center gap-3 mb-4 text-rose-500/60">
                                        <AlertCircle className="w-5 h-5" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Invalid Entries</span>
                                    </div>
                                    <p className="text-4xl font-black text-white leading-none">{errorCount}</p>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="rounded-[2.5rem] bg-white/[0.01] border border-white/5 overflow-hidden">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-white/[0.03]">
                                            <th className="px-8 py-5 text-left text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">ID</th>
                                            <th className="px-8 py-5 text-left text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Gymnast Name</th>
                                            <th className="px-8 py-5 text-left text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Phone Number</th>
                                            <th className="px-8 py-5 text-left text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {parsedData.map((row, index) => (
                                            <tr key={index} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-8 py-5 text-[11px] font-black text-white/30">{index + 1}</td>
                                                <td className="px-8 py-5">
                                                    <div className="text-[13px] font-black text-white/80 group-hover:text-white transition-colors uppercase tracking-wider">{row.full_name}</div>
                                                    <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{row.coach_name || 'Unassigned'}</div>
                                                </td>
                                                <td className="px-8 py-5 text-[11px] font-black text-white/60 font-mono tracking-tighter">{row.phone}</td>
                                                <td className="px-8 py-5">
                                                    {row.errors.length === 0 ? (
                                                        <span className="inline-flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                                                            Ready
                                                        </span>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <span className="inline-flex items-center gap-2 text-rose-500 text-[9px] font-black uppercase tracking-widest bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20">
                                                                Invalid Data
                                                            </span>
                                                            <div className="pl-4 text-[8px] font-bold text-rose-500/60 uppercase tracking-widest">
                                                                {row.errors[0]}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="relative z-10 px-10 py-10 border-t border-white/5 bg-[#0E1D21]/50 flex items-center justify-between gap-8">
                    <button
                        onClick={handleClose}
                        className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all duration-500 active:scale-95"
                    >
                        Cancel
                    </button>

                    {preview && (
                        <button
                            onClick={handleImport}
                            disabled={importing || validCount === 0}
                            className="flex-1 py-5 rounded-3xl bg-primary text-white hover:bg-primary/90 transition-all duration-500 shadow-[0_20px_40px_rgba(var(--primary-rgb),0.3)] active:scale-95 flex items-center justify-center gap-4 group/btn disabled:opacity-30 disabled:pointer-events-none"
                        >
                            {importing ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform" />
                            )}
                            <span className="font-black uppercase tracking-[0.4em] text-[10px]">
                                {importing ? 'Processing...' : `Import ${validCount} Students`}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
