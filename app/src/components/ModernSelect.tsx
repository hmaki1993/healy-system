import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string | React.ReactNode;
}

interface ModernSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export default function ModernSelect({
    value,
    onChange,
    options,
    placeholder = "Select an option",
    className = "",
    required = false
}: ModernSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Foolproof UUID Detection: Long strings with multiple dashes
    const isUUID = (str: any) => {
        if (!str) return false;
        const s = String(str).trim();
        // Standard UUIDs are 36 chars and have 4 dashes
        return s.length > 20 && (s.match(/-/g) || []).length >= 4;
    };

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div ref={containerRef} className={`relative group/select ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full px-5 py-3 bg-black/40 border-2 border-rose-500 rounded-2xl outline-none
                    flex items-center justify-start text-left relative transition-all
                    ${isOpen ? 'bg-black shadow-[0_0_20px_rgba(244,63,94,0.2)]' : 'border-white/5 hover:border-white/20'}
                `}
            >
                <div className="flex flex-col items-start min-w-0 flex-1">
                    <div className="flex items-center gap-2 w-full">
                        <span className="bg-rose-500 text-white text-[7px] px-1 rounded font-black shrink-0">V3_FIX</span>
                        <span className={`text-[11px] sm:text-xs font-bold truncate ${selectedOption ? 'text-white' : 'text-white/20'}`}>
                            {selectedOption &&
                                selectedOption.label &&
                                !isUUID(selectedOption.label) &&
                                !isUUID(selectedOption.value)
                                ? selectedOption.label
                                : (selectedOption ? 'Coach' : placeholder)}
                        </span>
                    </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 ml-2 transition-transform duration-300 ${isOpen ? 'rotate-180 text-rose-500' : 'text-white/20'}`} />
            </button>

            {/* Hidden Input for Form Validation/Submission */}
            <input
                type="text"
                value={value}
                onChange={() => { }}
                readOnly
                required={required}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                tabIndex={-1}
            />

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-[110] top-[calc(100%+8px)] left-0 w-full bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/10 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300 py-2 origin-top">
                    {/* Inner Shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/[0.05] to-transparent pointer-events-none"></div>

                    <div className="max-h-64 overflow-y-auto custom-scrollbar relative z-10">
                        {options.map((option) => {
                            const isSelected = String(value) === String(option.value);
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`
                                        w-full px-5 py-3 text-left transition-all duration-300 flex items-center justify-between group/opt
                                        ${isSelected
                                            ? 'bg-rose-500/10 text-rose-500'
                                            : 'text-white/40 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    <span className={`text-xs font-bold tracking-wide transition-all duration-300 ${isSelected ? 'translate-x-1' : 'group-hover/opt:translate-x-1'}`}>
                                        {option.label && !isUUID(option.label) ? option.label : `Coach (${String(option.value).substring(0, 4)})`}
                                    </span>
                                    {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-rose-500 animate-in zoom-in duration-300" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
