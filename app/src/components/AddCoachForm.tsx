import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { X, Save, UserPlus, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddCoachFormProps {
    onClose: () => void;
    onSuccess: () => void;
    initialData?: {
        id: string;
        profile_id?: string;
        full_name: string;
        email?: string;
        role?: string;
        specialty: string;
        pt_rate: number;
        salary?: number;
        avatar_url?: string;
        image_pos_x?: number;
        image_pos_y?: number;
    } | null;
}

export default function AddCoachForm({ onClose, onSuccess, initialData }: AddCoachFormProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        full_name: initialData?.full_name || '',
        email: initialData?.email || '',
        password: '',
        role: initialData?.role || 'coach',
        specialty: initialData?.specialty || '',
        pt_rate: initialData?.pt_rate?.toString() || '',
        salary: initialData?.salary?.toString() || '',
        avatar_url: initialData?.avatar_url || '',
        image_pos_x: initialData?.image_pos_x ?? 50,
        image_pos_y: initialData?.image_pos_y ?? 50
    });
    const [uploading, setUploading] = useState(false);


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            const file = e.target.files?.[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('coaches')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('coaches')
                .getPublicUrl(filePath);

            setFormData((prev: any) => ({ ...prev, avatar_url: data.publicUrl }));
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Error uploading image');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let profileId = initialData?.profile_id || null;

            // 1. AUTOMATIC ACCOUNT CREATION
            if (!initialData && formData.email && formData.password) {
                try {
                    const { data: newUserId, error: createError } = await supabase.rpc('create_new_user', {
                        email: formData.email.toLowerCase().trim(),
                        password: formData.password,
                        user_metadata: {
                            full_name: formData.full_name,
                            role: formData.role
                        }
                    });

                    if (createError) {
                        console.error('Account creation failed:', createError);
                        throw new Error('Failed to create login account: ' + createError.message);
                    }

                    if (newUserId) {
                        profileId = newUserId;
                    }
                } catch (err: any) {
                    toast.error(err.message);
                    setLoading(false);
                    return; // Stop if we can't create the login
                }
            }

            // CRITICAL: Ensure we have a profileId.
            // If editing, we use existing. If new, we MUST have one from the RPC above.
            if (!profileId) {
                toast.error('Could not determine Login ID. Please ensure the email is unique.');
                setLoading(false);
                return;
            }

            // 2. Ensure Profile exists (Shadow Profile or Real Profile)
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: profileId,
                    email: formData.email,
                    full_name: formData.full_name,
                    role: formData.role
                }, { onConflict: 'id' });

            if (profileError) {
                console.warn('Could not create/update profile:', profileError);
            }

            const coachData: any = {
                full_name: formData.full_name.trim(),
                email: formData.email.toLowerCase().trim(),
                specialty: formData.specialty,
                role: formData.role,
                pt_rate: parseFloat(formData.pt_rate) || 0,
                salary: parseFloat(formData.salary) || 0,
                avatar_url: formData.avatar_url,
                image_pos_x: formData.image_pos_x,
                image_pos_y: formData.image_pos_y
            };

            if (profileId) {
                coachData.profile_id = profileId;
            }

            let error;

            if (initialData) {
                // Update existing coach record in DB
                const { error: updateError } = await supabase
                    .from('coaches')
                    .update(coachData)
                    .eq('id', initialData.id);
                error = updateError;
            } else {
                // Create or Update coach record in DB
                // We target 'profile_id' as the anchor because it's the source of truth for the account.
                const { error: upsertError } = await supabase
                    .from('coaches')
                    .upsert([coachData], {
                        onConflict: 'profile_id',
                        ignoreDuplicates: false
                    });
                error = upsertError;

                // --- NEW NOTIFICATION TRIGGER ---
                if (!error) {
                    await supabase.from('notifications').insert({
                        title: 'New Staff Member',
                        message: `${formData.full_name} has joined as ${t(`roles.${formData.role}`)}.`,
                        type: 'coach',
                        target_role: 'admin',
                        is_read: false
                    });
                }
            }

            if (error) throw error;
            toast.success(initialData ? t('common.saveSuccess') : 'Coach added successfully (Login active)');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Submit Error:', error);
            toast.error(error.message || 'Error saving coach');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0a0f]/80 backdrop-blur-md">
            <div className="w-full max-w-lg max-h-[90vh] bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] shadow-2xl shadow-black/50 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                {/* Decorative gradients */}
                <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                <div className="absolute bottom-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>

                {/* Header */}
                <div className="p-8 border-b border-white/[0.03] flex items-center justify-between relative z-10">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"></div>
                            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">
                                {initialData ? 'Edit Specialist' : 'Add New Coach'}
                            </h2>
                        </div>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.3em] ml-5">
                            {initialData ? 'Update Staff Credentials' : 'Register New Academy Faculty'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="group relative p-2 overflow-hidden rounded-full transition-all duration-500"
                    >
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                        <X className="w-5 h-5 text-white/30 group-hover:text-white group-hover:rotate-90 transition-all duration-500 relative z-10" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto flex-1 custom-scrollbar relative z-10">
                    <div className="space-y-10">
                        {/* Full Name */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Full Name</label>
                            <input
                                required
                                type="text"
                                className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm tracking-wide"
                                value={formData.full_name}
                                onChange={(e) => {
                                    const newName = e.target.value;
                                    const emailName = newName.toLowerCase().replace(/\s+/g, '');
                                    setFormData(prev => ({
                                        ...prev,
                                        full_name: newName,
                                        email: prev.email === '' || prev.email.includes(`${prev.full_name.toLowerCase().replace(/\s+/g, '')}@healy.com`)
                                            ? (emailName ? `${emailName}@healy.com` : '')
                                            : prev.email
                                    }));
                                }}
                            />
                        </div>

                        {/* Profile Image & Controls */}
                        <div className="space-y-3 group/field">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Profile Image</label>

                            <div className="flex gap-6 items-center">
                                <div className="relative w-24 h-24 rounded-3xl overflow-hidden border border-white/10 bg-white/[0.02] flex-shrink-0 group/img shadow-2xl">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-accent/10 opacity-0 group-hover/img:opacity-100 transition-opacity"></div>
                                    {formData.avatar_url ? (
                                        <img
                                            src={formData.avatar_url}
                                            className="w-full h-full object-cover relative z-10"
                                            style={{ objectPosition: `${formData.image_pos_x}% ${formData.image_pos_y}%` }}
                                            alt="Preview"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/10 font-black text-2xl">?</div>
                                    )}
                                    {uploading && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-4">
                                    <label className="block w-full">
                                        <div className="px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:bg-white/[0.05] hover:text-white hover:border-white/10 cursor-pointer transition-all text-center">
                                            {uploading ? 'Processing Image...' : 'Deploy New Asset'}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            disabled={uploading}
                                        />
                                    </label>

                                    {formData.avatar_url && (
                                        <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl">
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase tracking-widest text-white/10">Axis X</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={formData.image_pos_x}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, image_pos_x: parseInt(e.target.value) }))}
                                                    className="w-full h-px bg-white/10 appearance-none cursor-pointer accent-primary"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[8px] font-black uppercase tracking-widest text-white/10">Axis Y</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={formData.image_pos_y}
                                                    onChange={(e) => setFormData((prev: any) => ({ ...prev, image_pos_y: parseInt(e.target.value) }))}
                                                    className="w-full h-px bg-white/10 appearance-none cursor-pointer accent-primary"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Specialty & Role */}
                        {!['reception', 'cleaner'].includes(formData.role) && (
                            <div className="space-y-3 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Specialization</label>
                                <div className="relative">
                                    <select
                                        required={!['reception', 'cleaner'].includes(formData.role)}
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-sm tracking-wide"
                                        value={formData.specialty}
                                        onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                                    >
                                        <option value="" disabled className="bg-[#0a0a0f]">Select Discipline</option>
                                        <option value="Artistic Gymnastics (Boys)" className="bg-[#0a0a0f]">Artistic Gymnastics (Boys)</option>
                                        <option value="Artistic Gymnastics (Girls)" className="bg-[#0a0a0f]">Artistic Gymnastics (Girls)</option>
                                        <option value="Artistic Gymnastics (Mixed)" className="bg-[#0a0a0f]">Artistic Gymnastics (Mixed)</option>
                                        <option value="Rhythmic Gymnastics" className="bg-[#0a0a0f]">Rhythmic Gymnastics</option>
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* Account Email */}
                            <div className="space-y-3 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Digital Identity</label>
                                <input
                                    required
                                    type="email"
                                    placeholder=""
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-3 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">
                                    {initialData ? 'Reset Credentials' : 'Secure Access Key'}
                                </label>
                                <input
                                    required={!initialData}
                                    type="password"
                                    placeholder=""
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white placeholder:text-white/10 text-sm"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>

                            {/* Role Selection */}
                            <div className="space-y-3 group/field md:col-span-2">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">System Privilege Level</label>
                                <div className="relative">
                                    <select
                                        required
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white appearance-none cursor-pointer pr-12 text-sm tracking-[0.1em] font-black uppercase text-center"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="coach" className="bg-[#0a0a0f]">{t('roles.coach')}</option>
                                        <option value="head_coach" className="bg-[#0a0a0f]">{t('roles.head_coach')}</option>
                                        <option value="admin" className="bg-[#0a0a0f]">{t('roles.admin')}</option>
                                        <option value="reception" className="bg-[#0a0a0f]">{t('roles.reception')}</option>
                                        <option value="cleaner" className="bg-[#0a0a0f]">{t('roles.cleaner')}</option>
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none group-focus-within/field:text-primary transition-colors" />
                                </div>
                            </div>

                            {/* Compensation & Rates */}
                            {!['reception', 'cleaner'].includes(formData.role) && (
                                <div className="space-y-3 group/field">
                                    <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">PT Yield Rate</label>
                                    <input
                                        required={!['reception', 'cleaner'].includes(formData.role)}
                                        type="number"
                                        placeholder=""
                                        className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white text-sm font-bold"
                                        value={formData.pt_rate}
                                        onChange={e => setFormData({ ...formData, pt_rate: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="space-y-3 group/field">
                                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 ml-1 group-focus-within/field:text-primary transition-colors">Monthly Retainer</label>
                                <input
                                    required
                                    type="number"
                                    placeholder=""
                                    className="w-full px-5 py-3 bg-white/[0.02] border border-white/5 rounded-2xl focus:border-primary/40 outline-none transition-all text-white text-sm font-bold"
                                    value={formData.salary}
                                    onChange={e => setFormData({ ...formData, salary: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-6 pt-10 border-t border-white/[0.03] mt-10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-all duration-500"
                        >
                            {t('common.cancel', 'Discard')}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-12 py-4 bg-primary text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-500 flex items-center justify-center gap-4 relative overflow-hidden group/btn disabled:opacity-50"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                            {loading ? (
                                <span className="animate-pulse">Processing...</span>
                            ) : (
                                <span className="relative z-10">{initialData ? 'Update Faculty' : 'Confirm Registration'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

