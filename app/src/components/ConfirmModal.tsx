import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, type = 'danger', confirmText, cancelText }: ConfirmModalProps) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <div
                className="glass-card rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20"
            >
                {/* Header */}
                <div className={`px-8 py-6 flex items-center justify-between border-b ${type === 'danger' ? 'border-red-500/20 bg-red-500/10' : 'border-white/5 bg-white/5'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${type === 'danger' ? 'bg-red-500/20 text-red-500 shadow-lg shadow-red-500/20' : 'bg-primary/20 text-primary shadow-lg shadow-primary/20'}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-white uppercase tracking-tight">{title}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-0.5">{t('common.confirmationRequired')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8">
                    <p className="text-white/70 leading-relaxed font-medium">{message}</p>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white/5 flex justify-end gap-4 border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-2xl"
                    >
                        {cancelText || t('common.cancel', 'Cancel')}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center gap-3 relative overflow-hidden group/btn ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-primary hover:bg-primary/90 shadow-primary/30'
                            }`}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                        <span className="relative z-10">{confirmText || t('common.confirm', 'Confirm')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
