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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-[#0E1D21] to-[#122E34] rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#622347] to-[#8B3A62] rounded-xl">
                            <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">Import Students</h2>
                            <p className="text-sm text-white/60">Upload CSV file from Google Sheets</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {!preview ? (
                        /* Upload Section */
                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-[#622347]/50 transition-colors">
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="csv-upload"
                                />
                                <label htmlFor="csv-upload" className="cursor-pointer">
                                    <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
                                    <p className="text-white font-bold mb-2">
                                        {file ? file.name : 'Click to upload CSV file'}
                                    </p>
                                    <p className="text-white/60 text-sm">
                                        Export your Google Sheet as CSV and upload here
                                    </p>
                                </label>
                            </div>

                            {/* Instructions */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    CSV Format Requirements
                                </h3>
                                <ul className="text-white/70 text-sm space-y-1 ml-6 list-disc">
                                    <li><strong>Name</strong> (required): Student full name</li>
                                    <li><strong>Phone</strong> (required): 11 digits starting with 01</li>
                                    <li><strong>Date of Birth</strong> (optional): Format YYYY-MM-DD</li>
                                    <li><strong>Gender</strong> (optional): male or female</li>
                                    <li><strong>Coach</strong> (optional): Coach name (must match existing coach)</li>
                                    <li><strong>Subscription Type</strong> (optional): monthly, 3months, 6months, yearly</li>
                                    <li><strong>Start Date</strong> (optional): Format YYYY-MM-DD</li>
                                    <li><strong>Notes</strong> (optional): Additional information</li>
                                </ul>
                            </div>
                        </div>
                    ) : (
                        /* Preview Section */
                        <div className="space-y-4">
                            {/* Summary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                        <span className="text-green-400 font-bold">Valid Rows</span>
                                    </div>
                                    <p className="text-2xl font-black text-white">{validCount}</p>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle className="w-5 h-5 text-red-400" />
                                        <span className="text-red-400 font-bold">Errors</span>
                                    </div>
                                    <p className="text-2xl font-black text-white">{errorCount}</p>
                                </div>
                            </div>

                            {/* Preview Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="text-left text-white/60 text-xs font-bold uppercase p-2">#</th>
                                            <th className="text-left text-white/60 text-xs font-bold uppercase p-2">Name</th>
                                            <th className="text-left text-white/60 text-xs font-bold uppercase p-2">Phone</th>
                                            <th className="text-left text-white/60 text-xs font-bold uppercase p-2">Coach</th>
                                            <th className="text-left text-white/60 text-xs font-bold uppercase p-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedData.map((row, index) => (
                                            <tr key={index} className="border-b border-white/5">
                                                <td className="p-2 text-white/60 text-sm">{index + 1}</td>
                                                <td className="p-2 text-white text-sm font-bold">{row.full_name}</td>
                                                <td className="p-2 text-white/80 text-sm">{row.phone}</td>
                                                <td className="p-2 text-white/80 text-sm">{row.coach_name || '-'}</td>
                                                <td className="p-2">
                                                    {row.errors.length === 0 ? (
                                                        <span className="text-green-400 text-xs flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Valid
                                                        </span>
                                                    ) : (
                                                        <div className="text-red-400 text-xs">
                                                            <div className="flex items-center gap-1 mb-1">
                                                                <AlertCircle className="w-3 h-3" />
                                                                Errors:
                                                            </div>
                                                            <ul className="list-disc ml-4">
                                                                {row.errors.map((err, i) => (
                                                                    <li key={i}>{err}</li>
                                                                ))}
                                                            </ul>
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

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-white/10">
                    <button
                        onClick={handleClose}
                        className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors font-bold"
                    >
                        Cancel
                    </button>
                    {preview && (
                        <button
                            onClick={handleImport}
                            disabled={importing || validCount === 0}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#622347] to-[#8B3A62] text-white font-bold hover:shadow-lg hover:shadow-[#622347]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {importing ? 'Importing...' : `Import ${validCount} Student(s)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
