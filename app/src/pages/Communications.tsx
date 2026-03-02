import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import Cropper from 'react-easy-crop';
import {
    MessageSquare, Search, Phone, Video, MoreVertical, Send,
    Paperclip, Mic, Image as ImageIcon, X, Check, CheckCheck,
    PhoneCall, PhoneOff, PhoneMissed, Volume2, VolumeX,
    Camera, Users, Plus, ArrowLeft, Smile, Play, Pause,
    Loader2, Download, MicOff, VideoOff, Reply, Pin, Trash2,
    Archive, CheckSquare, Maximize2, RotateCcw, Type, Pencil,
    ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID as string;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Profile {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string;
    last_seen?: string;
    is_in_chat?: boolean;
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content?: string;
    type: 'text' | 'image' | 'voice' | 'video' | 'call_event';
    media_url?: string;
    media_duration?: number;
    call_status?: string;
    call_duration?: number;
    call_type?: 'audio' | 'video';
    caller_id?: string;
    created_at: string;
    sender?: Profile;
    reply_to_id?: string;
    reply_to?: Message;
    is_pinned?: boolean;
    is_deleted?: boolean;
    deleted_for_users?: string[];
}

interface Conversation {
    id: string;
    type: 'direct' | 'group';
    name?: string;
    avatar_url?: string;
    otherUser?: Profile;
    lastMessage?: Message;
    unreadCount: number;
    updated_at: string;
    is_hidden?: boolean;
    cleared_at?: string;
}

// ─── Voice Note Player Component ───────────────────────────────────────────────
const VoiceNotePlayer = ({ url, duration }: { url: string; duration?: number }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTime = () => {
            setCurrentTime(audio.currentTime);
            setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        };
        const onEnd = () => setIsPlaying(false);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('ended', onEnd);
        return () => {
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('ended', onEnd);
        };
    }, []);

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <audio ref={audioRef} src={url} preload="metadata" />
            <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all flex-shrink-0"
            >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1">
                <div
                    className="h-1 bg-white/20 rounded-full cursor-pointer relative"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = (e.clientX - rect.left) / rect.width;
                        if (audioRef.current) audioRef.current.currentTime = ratio * audioRef.current.duration;
                    }}
                >
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[10px] opacity-60 mt-0.5 block">{formatTime(currentTime)} / {formatTime(duration || 0)}</span>
            </div>
        </div>
    );
};

// ─── Message Bubble Component ───────────────────────────────────────────────────
const MessageBubble = ({
    msg, isOwn, currentUserId, onReply, onPin, isSelected, isSelectionMode, onSelect, onImageClick
}: {
    msg: Message; isOwn: boolean; currentUserId?: string;
    onReply?: (msg: Message) => void;
    onPin?: (msg: Message) => void;
    isSelected?: boolean;
    isSelectionMode?: boolean;
    onSelect?: (id: string) => void;
    onImageClick?: (url: string) => void;
}) => {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const pressTimer = useRef<NodeJS.Timeout | null>(null);
    const isLongPressActive = useRef(false);
    const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const handleStart = (clientX: number) => {
        startX.current = clientX;
        setIsDragging(true);
        isLongPressActive.current = false;

        // Long press for selection
        if (!isSelectionMode) {
            pressTimer.current = setTimeout(() => {
                onSelect?.(msg.id);
                isLongPressActive.current = true;
            }, 500);
        }
    };

    const handleMove = (clientX: number) => {
        if (!isDragging) return;
        const delta = clientX - startX.current;
        if (Math.abs(delta) > 10 && pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
        // Limit drag to left (max -60px)
        const newX = Math.max(-60, Math.min(delta, 0));
        setDragX(newX);
    };

    const handleEnd = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
        if (dragX < -50) onReply?.(msg);
        setDragX(0);
        setIsDragging(false);
    };

    const handleClick = () => {
        if (isLongPressActive.current) return;
        if (isSelectionMode) onSelect?.(msg.id);
    };

    if (msg.type === 'call_event') {
        const isMissed = msg.call_status === 'missed';
        const isCaller = msg.caller_id === currentUserId;
        const callType = msg.call_type || 'audio';

        let label = '';
        if (isMissed) {
            label = isCaller ? (callType === 'video' ? 'Outgoing Video' : 'Outgoing Voice') : 'Missed Call';
        } else {
            label = isCaller
                ? (callType === 'video' ? 'Outgoing Video' : 'Outgoing Voice')
                : (callType === 'video' ? 'Incoming Video' : 'Incoming Voice');
        }

        const StatusIcon = isMissed
            ? (isCaller ? (callType === 'video' ? Video : Phone) : PhoneMissed)
            : (isCaller ? (callType === 'video' ? Video : Phone) : (callType === 'video' ? Video : PhoneCall));

        return (
            <div
                className={`flex items-center justify-center my-3 gap-3 group/call ${isSelectionMode ? 'cursor-pointer' : ''}`}
                onClick={handleClick}
                onMouseDown={e => handleStart(e.clientX)}
                onMouseMove={e => handleMove(e.clientX)}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={e => handleStart(e.touches[0].clientX)}
                onTouchMove={e => handleMove(e.touches[0].clientX)}
                onTouchEnd={handleEnd}
            >
                {isSelectionMode && (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-white/20'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                )}

                <div
                    className={`
                        flex items-center gap-3 px-4 py-2 rounded-full
                        bg-white/[0.05] border border-white/10 backdrop-blur-md transition-all
                        hover:bg-white/[0.08] active:scale-95
                        ${isMissed && !isCaller ? 'border-red-500/20 bg-red-500/5' : ''}
                        ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''}
                    `}
                    style={{ transform: `translateX(${dragX}px)` }}
                >
                    <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center
                        ${isMissed && !isCaller ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/50'}
                    `}>
                        <StatusIcon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex flex-col leading-none">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-white">
                                {label}
                            </span>
                            {isCaller ? (
                                <ArrowUpRight className="w-3 h-3 text-primary" />
                            ) : (
                                <ArrowDownLeft className={`w-3 h-3 ${isMissed ? 'text-red-400' : 'text-emerald-400'}`} />
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[8px] font-black uppercase tracking-wider text-white/30">
                            <span>{timeStr}</span>
                            {msg.call_duration && (
                                <>
                                    <span>•</span>
                                    <span>{Math.floor(msg.call_duration / 60)}:{String(msg.call_duration % 60).padStart(2, '0')}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const bubbleRadius = isOwn
        ? 'rounded-2xl rounded-br-sm'
        : 'rounded-2xl rounded-bl-sm';

    return (
        <div
            className={`flex items-end gap-2 mb-4 transition-all duration-300 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isSelectionMode ? 'cursor-pointer' : ''}`}
            onClick={handleClick}
            onMouseDown={e => handleStart(e.clientX)}
            onMouseMove={e => handleMove(e.clientX)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={e => handleStart(e.touches[0].clientX)}
            onTouchMove={e => handleMove(e.touches[0].clientX)}
            onTouchEnd={handleEnd}
        >
            {/* Selection Checkbox */}
            {isSelectionMode && (
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mb-4 ${isSelected ? 'bg-primary border-primary' : 'border-white/20'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
            )}

            {/* Avatar */}
            <div className="w-7 h-7 flex-shrink-0">
                {!isOwn && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-[10px] font-black text-white">
                        {msg.sender?.full_name?.[0] || '?'}
                    </div>
                )}
            </div>
            {/* Bubble */}
            <div className={`relative max-w-[75%] group ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>

                {/* Reply Preview */}
                {msg.reply_to && (
                    <div className={`mb-1 p-2 rounded-xl text-[11px] border-l-4 bg-white/5 border-primary/50 max-w-[200px] truncate ${isOwn ? 'mr-1' : 'ml-1'}`}>
                        <p className="font-black text-primary uppercase text-[8px] mb-0.5 tracking-widest">Replying to</p>
                        <p className="text-white/60 italic truncate">
                            {msg.reply_to.type === 'text' ? msg.reply_to.content : `[${msg.reply_to.type}] icon`}
                        </p>
                    </div>
                )}

                <div
                    className="relative flex items-center group/bubble transition-transform"
                    style={{ transform: `translateX(${dragX}px)` }}
                >
                    {/* Swipe Reply Icon Behind */}
                    <div
                        className="absolute left-full ml-4 opacity-0 transition-opacity flex items-center justify-center"
                        style={{ opacity: Math.abs(dragX) / 60 }}
                    >
                        <Reply className="w-5 h-5 text-primary" />
                    </div>

                    {/* Hover Actions */}
                    <div className={`
                        absolute top-1/2 -translate-y-1/2 flex items-center gap-1 transition-all opacity-0 group-hover/bubble:opacity-100 z-10
                        ${isOwn ? 'right-full mr-2 flex-row-reverse' : 'left-full ml-2'}
                    `}>
                        <button
                            onClick={() => onReply?.(msg)}
                            className="w-7 h-7 rounded-full bg-white/10 text-white/40 hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-all"
                            title="Reply"
                        >
                            <Reply className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {msg.type === 'text' && (
                        <div className={`px-4 py-2.5 text-sm leading-normal font-medium shadow-lg relative break-words [overflow-wrap:anywhere] break-all transition-all duration-300 ${isOwn
                            ? 'bg-gradient-to-br from-primary to-accent text-white'
                            : 'bg-white/[0.06] text-white border border-white/10'
                            } ${bubbleRadius}`}>
                            {msg.content}
                            {msg.is_pinned && (
                                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg transform rotate-12">
                                    <Pin className="w-2 h-2 text-white fill-current" />
                                </div>
                            )}
                        </div>
                    )}
                    {msg.type === 'image' && msg.media_url && (
                        <div
                            className={`overflow-hidden shadow-xl max-w-[260px] relative transition-all duration-300 cursor-pointer ${bubbleRadius}`}
                            onClick={(e) => {
                                if (isSelectionMode) return;
                                e.stopPropagation();
                                onImageClick?.(msg.media_url!);
                            }}
                        >
                            <img src={msg.media_url} alt="Shared image" className="w-full h-auto object-cover block transition-transform duration-500" loading="lazy" />
                            {msg.is_pinned && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-yellow-500/80 backdrop-blur-md flex items-center justify-center shadow-lg">
                                    <Pin className="w-3 h-3 text-white fill-current" />
                                </div>
                            )}
                        </div>
                    )}
                    {msg.type === 'voice' && msg.media_url && (
                        <div className={`px-4 py-3 relative text-white transition-all duration-300 ${isOwn ? 'bg-gradient-to-br from-primary to-accent' : 'bg-white/[0.06] border border-white/10'} ${bubbleRadius}`}>
                            <VoiceNotePlayer url={msg.media_url} duration={msg.media_duration} />
                            {msg.is_pinned && (
                                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg">
                                    <Pin className="w-2 h-2 text-white fill-current" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <span className={`text-[9px] text-white/20 font-black uppercase tracking-widest mt-1 animate-premium-in ${isOwn ? 'flex items-center gap-1.5 ml-auto' : 'mr-auto'}`}>
                    {timeStr}
                    {isOwn && <CheckCheck className="w-3.5 h-3.5 text-primary/40" />}
                </span>
            </div>
        </div>
    );
};

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
const DeleteConfirmationModal = ({
    count,
    onCancel,
    onDeleteForMe,
    onDeleteForEveryone,
    canDeleteForEveryone
}: {
    count: number;
    onCancel: () => void;
    onDeleteForMe: () => void;
    onDeleteForEveryone: () => void;
    canDeleteForEveryone: boolean;
}) => {
    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-[#1a2634] border border-white/10 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl animate-premium-in">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                        <Trash2 className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-black text-white mb-2">Delete {count} {count === 1 ? 'Message' : 'Messages'}?</h3>
                    <p className="text-white/40 text-sm mb-8">Choose how you want to remove these messages.</p>

                    <div className="flex flex-col gap-3 w-full">
                        <button
                            onClick={onDeleteForMe}
                            className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all border border-white/5 active:scale-95"
                        >
                            Delete for Me
                        </button>
                        {canDeleteForEveryone && (
                            <button
                                onClick={onDeleteForEveryone}
                                className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95"
                            >
                                Delete for Everyone
                            </button>
                        )}
                        <button
                            onClick={onCancel}
                            className="w-full py-4 mt-2 text-white/40 hover:text-white font-bold transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Incoming Call Modal ───────────────────────────────────────────────────────
const IncomingCallModal = ({
    callerName, callType, onAccept, onReject
}: { callerName: string; callType: 'audio' | 'video'; onAccept: () => void; onReject: () => void }) => {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />
            <div className="relative z-10 flex flex-col items-center gap-6 p-10 rounded-[3rem] bg-white/5 border border-white/10 shadow-2xl backdrop-blur-2xl w-80 animate-in zoom-in-95 duration-300">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-3xl font-black text-white shadow-2xl">
                        {callerName[0]}
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary/40 animate-ping" />
                </div>
                <div className="text-center">
                    <p className="text-white/50 text-xs font-black uppercase tracking-widest">Incoming {callType} call</p>
                    <h3 className="text-white text-xl font-black mt-1">{callerName}</h3>
                </div>
                <div className="flex items-center gap-6">
                    <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-xl shadow-red-500/30 transition-all active:scale-95">
                        <PhoneOff className="w-6 h-6 text-white" />
                    </button>
                    <button onClick={onAccept} className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-all active:scale-95 animate-bounce">
                        <Phone className="w-6 h-6 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Active Call Modal ─────────────────────────────────────────────────────────
const ActiveCallModal = ({
    callType, otherUserName, duration, onHangup, isMuted, toggleMute, isCameraOff, toggleCamera, otherUserAvatar
}: {
    callType: 'audio' | 'video';
    otherUserName: string;
    duration: number;
    onHangup: () => void;
    isMuted: boolean;
    toggleMute: () => void;
    isCameraOff: boolean;
    toggleCamera: () => void;
    otherUserAvatar?: string;
}) => {
    const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden animate-in fade-in duration-500">
            {/* Immersive Blurred Background */}
            <div className="absolute inset-0 bg-[#050505]">
                {otherUserAvatar ? (
                    <img src={otherUserAvatar} alt="" className="w-full h-full object-cover opacity-20 blur-[100px] scale-150" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0A1A1E] via-[#050505] to-[#1A0A10]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />
            </div>

            {/* Video Canvas (Remote) */}
            {callType === 'video' && (
                <div id="agora-remote-video" className="absolute inset-0 z-0">
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                        <div className="text-white/40 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">
                            Establishing encrypted connection...
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="relative z-10 flex flex-col items-center justify-between h-full py-20 px-6 w-full max-w-lg">
                {/* Header Info */}
                <div className="text-center space-y-4 animate-in slide-in-from-top-12 duration-1000">
                    <div className="flex flex-col items-center mb-6">
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Live Connection</span>
                        </div>

                        {callType === 'audio' && (
                            <div className="relative mb-10 group">
                                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-1000 animate-pulse" />
                                <div className="relative w-40 h-40 rounded-[3rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                                    {otherUserAvatar ? (
                                        <img src={otherUserAvatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-6xl font-black text-white">{otherUserName[0]}</span>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-primary rounded-2xl flex items-center justify-center border-4 border-[#050505] shadow-xl">
                                    <Mic className="w-5 h-5 text-white" />
                                </div>
                            </div>
                        )}
                    </div>

                    <h3 className="text-white text-4xl font-black tracking-tight drop-shadow-2xl">{otherUserName}</h3>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-white/30 text-[11px] font-black uppercase tracking-[0.4em]">{callType === 'video' ? 'Secure Video Session' : 'Encrypted Voice Call'}</p>
                        <p className="text-primary text-2xl font-black tabular-nums tracking-tighter mt-2 bg-primary/10 px-4 py-1 rounded-full border border-primary/20">{formatDuration(duration)}</p>
                    </div>
                </div>

                {/* Animated Audio Visualizer (Mock for Premium Feel) */}
                {callType === 'audio' && (
                    <div className="flex items-end justify-center gap-1.5 h-16 w-full opacity-40">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1].map((h, i) => (
                            <div
                                key={i}
                                className="w-1.5 bg-primary rounded-full animate-bounce"
                                style={{
                                    height: `${h * 15 + Math.random() * 20}%`,
                                    animationDelay: `${i * 0.1}s`,
                                    animationDuration: '1.2s'
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Control Tray - Premium Glassmorphism */}
                <div className="flex items-center gap-6 p-6 bg-white/[0.03] backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-12 duration-1000">
                    <button
                        onClick={toggleMute}
                        className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center transition-all duration-500 group ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 hover:border-white/20'}`}
                    >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                    </button>

                    <button
                        onClick={onHangup}
                        className="w-20 h-20 rounded-[2rem] bg-rose-600 hover:bg-rose-500 flex items-center justify-center shadow-[0_15px_40px_rgba(225,29,72,0.4)] transition-all hover:scale-105 active:scale-95 group"
                    >
                        <PhoneOff className="w-8 h-8 text-white group-hover:rotate-[135deg] transition-transform duration-500" />
                    </button>

                    {callType === 'video' && (
                        <button
                            onClick={toggleCamera}
                            className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center transition-all duration-500 group ${isCameraOff ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40' : 'bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 hover:border-white/20'}`}
                        >
                            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Local Video - Floating Premium Panel */}
            {callType === 'video' && (
                <div className="absolute top-10 right-10 z-20 animate-in zoom-in-95 duration-700">
                    <div className="relative group/local">
                        <div className="absolute -inset-2 bg-primary/10 rounded-[2rem] blur-xl opacity-0 group-hover/local:opacity-100 transition-opacity duration-500" />
                        <div id="agora-local-video" className="relative w-48 h-64 rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-md">
                            {isCameraOff && (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-black/60">
                                    <VideoOff className="w-8 h-8 text-white/20 mb-2" />
                                    <span className="text-[10px] font-black text-white/10 uppercase tracking-widest">Privacy Active</span>
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md py-2 px-4 rounded-2xl border border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">You</span>
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Voice Recorder Component ──────────────────────────────────────────────────
const VoiceRecorder = ({ onRecordingComplete }: { onRecordingComplete: (blob: Blob, duration: number) => void }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            chunksRef.current = [];
            recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const dur = Math.floor((Date.now() - startTimeRef.current) / 1000);
                onRecordingComplete(blob, dur);
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start(100);
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();
            setIsRecording(true);
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        } catch {
            toast.error('Microphone access denied');
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    if (isRecording) {
        return (
            <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-red-400 text-sm font-black">
                    {String(Math.floor(duration / 60)).padStart(2, '0')}:{String(duration % 60).padStart(2, '0')}
                </span>
                <button onClick={stopRecording} className="ml-2 p-1 rounded-full bg-red-500 hover:bg-red-400 text-white transition-all">
                    <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); setDuration(0); }} className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition-all">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={startRecording}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
            title="Record voice note"
        >
            <Mic className="w-5 h-5" />
        </button>
    );
};

// ─── Image Editor Utilities ────────────────────────────────────────────────────
const getCroppedImg = async (imageSrc: string, pixelCrop: any, rotation = 0): Promise<Blob> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', (error) => reject(error));
        img.setAttribute('crossOrigin', 'anonymous');
        img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    const rotRad = (rotation * Math.PI) / 180;
    const { width: bWidth, height: bHeight } = {
        width: Math.abs(Math.cos(rotRad) * image.width) + Math.abs(Math.sin(rotRad) * image.height),
        height: Math.abs(Math.sin(rotRad) * image.width) + Math.abs(Math.cos(rotRad) * image.height)
    };

    canvas.width = bWidth;
    canvas.height = bHeight;

    ctx.translate(bWidth / 2, bHeight / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);

    const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.putImageData(data, 0, 0);

    return new Promise((resolve) => {
        canvas.toBlob((file) => resolve(file!), 'image/jpeg', 0.95);
    });
};

// ─── Image Editor Modal ────────────────────────────────────────────────────────
const ImageEditorModal = ({
    image, onCancel, onSave, isProcessing
}: {
    image: string; onCancel: () => void; onSave: (blob: Blob) => void; isProcessing: boolean
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [mode, setMode] = useState<'crop' | 'draw'>('crop');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const handleSave = async () => {
        if (!croppedAreaPixels) return;
        try {
            const blob = await getCroppedImg(image, croppedAreaPixels, rotation);
            // In a real scenario, we could also merge the drawing canvas here.
            // For now, let's keep it simple with cropping as requested.
            onSave(blob);
        } catch (e) {
            toast.error('Failed to process image');
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] flex flex-col bg-black/95 backdrop-blur-xl animate-premium-in">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-white font-black">Edit Image</h3>
                        <p className="text-white/30 text-[10px] uppercase font-black tracking-widest">Crop and refine before sending</p>
                    </div>
                </div>
                <button onClick={onCancel} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 relative bg-[#050505]">
                {mode === 'crop' ? (
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={undefined}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center p-10">
                        <div className="relative max-w-full max-h-full">
                            <img src={image} alt="Drawing preview" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full cursor-crosshair"
                                onMouseDown={() => setIsDrawing(true)}
                                onMouseUp={() => setIsDrawing(false)}
                            // Simplified drawing logic would go here
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="p-8 border-t border-white/10 bg-black/40 backdrop-blur-md">
                <div className="max-w-md mx-auto flex flex-col gap-6">
                    <div className="flex items-center justify-center gap-8">
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">Zoom</span>
                            <input
                                type="range"
                                min={1} max={3} step={0.1}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-32 accent-primary transition-all"
                            />
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">Rotation</span>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setRotation(r => r - 90)} className="text-white/40 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
                                <span className="text-xs font-black text-white w-8 text-center">{rotation}°</span>
                                <button onClick={() => setRotation(r => r + 90)} className="text-white/40 hover:text-white"><RotateCcw className="w-4 h-4 scale-x-[-1]" /></button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-8 py-4 rounded-[1.5rem] bg-white/5 text-white/60 font-black uppercase tracking-tighter hover:bg-white/10 transition-all border border-white/5 active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isProcessing}
                            className="flex-[2] px-8 py-4 rounded-[1.5rem] bg-primary text-white font-black uppercase tracking-tighter hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3"
                        >
                            {isProcessing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Send Image</span>
                                    <Send className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Image Viewer Modal (Full Screen) ──────────────────────────────────────────
const ImageViewerModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
    const [zoom, setZoom] = useState(1);
    const [panning, setPanning] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(prev => Math.max(1, Math.min(5, prev + delta)));
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        lastPos.current = { x: clientX, y: clientY };
    };

    const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging || zoom === 1) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const dx = clientX - lastPos.current.x;
        const dy = clientY - lastPos.current.y;

        setPanning(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPos.current = { x: clientX, y: clientY };
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-2xl flex flex-col p-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/40">
                        <Maximize2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-black">Multimedia View</h3>
                        <p className="text-white/30 text-[9px] uppercase font-black tracking-widest">Pinch to zoom • Drag to pan</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href={url}
                        download
                        className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
                        title="Download"
                    >
                        <Download className="w-5 h-5" />
                    </a>
                    <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all shadow-xl active:scale-95">
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div
                className="flex-1 relative flex items-center justify-center overflow-hidden cursor-move"
                onWheel={handleWheel}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={() => setIsDragging(false)}
            >
                <img
                    src={url}
                    alt="Full view"
                    className="max-w-full max-h-full object-contain shadow-[0_50px_100px_rgba(0,0,0,0.5)] transition-transform duration-75 select-none"
                    style={{
                        transform: `scale(${zoom}) translate(${panning.x / zoom}px, ${panning.y / zoom}px)`,
                        pointerEvents: 'none'
                    }}
                />
            </div>

            <div className="flex justify-center p-6 z-10">
                <div className="flex items-center gap-8 bg-white/5 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10 shadow-2xl">
                    <button onClick={() => { setZoom(1); setPanning({ x: 0, y: 0 }); }} className="text-white/40 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Zoom</span>
                        <div className="w-32 h-1.5 bg-white/10 rounded-full relative">
                            <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${((zoom - 1) / 4) * 100}%` }} />
                        </div>
                        <span className="text-[11px] font-black text-white min-w-[30px]">{Math.round(zoom * 100)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main Communications Page ──────────────────────────────────────────────────
export default function Communications() {
    const { userProfile } = useTheme();
    const currentUserId = userProfile?.id;

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [text, setText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showNewChat, setShowNewChat] = useState(false);
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [imageToView, setImageToView] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Call state
    const [activeCall, setActiveCall] = useState<{ type: 'audio' | 'video'; otherUser: Profile; channelId: string; conversationId: string } | null>(null);
    const [incomingCall, setIncomingCall] = useState<{ callId: string; type: 'audio' | 'video'; caller: Profile; channelId: string; conversationId: string } | null>(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const agoraClientRef = useRef<IAgoraRTCClient | null>(null);
    const localAudioRef = useRef<ILocalAudioTrack | null>(null);
    const localVideoRef = useRef<ILocalVideoTrack | null>(null);
    const callTimerRef = useRef<NodeJS.Timeout | null>(null);
    const activeCallRef = useRef<{ type: 'audio' | 'video'; otherUser: Profile; channelId: string; conversationId: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ─── Presence Section Tracking ───────────────────────────────────────────────
    useEffect(() => {
        if (!currentUserId) return;

        const setInChat = async (status: boolean) => {
            await supabase
                .from('profiles')
                .update({
                    is_in_chat: status,
                    last_seen: new Date().toISOString()
                })
                .eq('id', currentUserId);
        };

        setInChat(true);

        // Update when tab becomes visible again
        const handleVisibilityChange = () => {
            setInChat(document.visibilityState === 'visible');
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', () => setInChat(false));

        return () => {
            setInChat(false);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', () => setInChat(false));
        };
    }, [currentUserId]);

    // ─── Auto-resize textarea ───────────────────────────────────────────────────
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }, [text]);

    // ─── Selection Actions ────────────────────────────────────────────────────────
    const toggleMessageSelection = (id: string) => {
        const next = new Set(selectedMessageIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedMessageIds(next);
    };

    const handleDeleteClick = () => {
        if (selectedMessageIds.size === 0) return;
        setShowDeleteModal(true);
    };

    const deleteForMe = async () => {
        try {
            const ids = Array.from(selectedMessageIds);

            // Get current messages to update their arrays
            const msgsToUpdate = messages.filter(m => selectedMessageIds.has(m.id));

            for (const msg of msgsToUpdate) {
                const currentDeleted = msg.deleted_for_users || [];
                const updatedDeleted = [...new Set([...currentDeleted, currentUserId])];

                const { error } = await supabase
                    .from('messages')
                    .update({ deleted_for_users: updatedDeleted })
                    .eq('id', msg.id);

                if (error) throw error;
            }

            setMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)));
            setSelectedMessageIds(new Set());
            setShowDeleteModal(false);
            toast.success('Deleted for you');
        } catch (err) {
            toast.error('Failed to delete messages');
        }
    };

    const deleteForEveryone = async () => {
        try {
            const ids = Array.from(selectedMessageIds);
            const { error } = await supabase
                .from('messages')
                .update({ is_deleted: true })
                .in('id', ids);

            if (error) throw error;

            setMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)));
            setSelectedMessageIds(new Set());
            setShowDeleteModal(false);
            toast.success('Deleted for everyone');
        } catch (err) {
            toast.error('Failed to delete messages');
        }
    };

    const deleteSelectedMessages = async () => {
        // This is now replaced by handleDeleteClick and the modal choices
        handleDeleteClick();
    };

    const togglePinForSelected = async () => {
        if (selectedMessageIds.size === 0) return;
        const firstId = Array.from(selectedMessageIds)[0];
        const firstMsg = messages.find(m => m.id === firstId);
        if (!firstMsg) return;

        const nextState = !firstMsg.is_pinned;
        try {
            const { error } = await supabase.from('messages').update({ is_pinned: nextState }).in('id', Array.from(selectedMessageIds));
            if (error) throw error;

            setMessages(prev => prev.map(m => selectedMessageIds.has(m.id) ? { ...m, is_pinned: nextState } : m));
            toast.success(nextState ? 'Messages pinned' : 'Messages unpinned');
        } catch (err) {
            toast.error('Failed to update pin state');
        }
    };

    const handleForwardMessages = async (targetConvoId: string) => {
        if (selectedMessageIds.size === 0) return;
        setIsSending(true);
        try {
            const selectedMsgs = messages.filter(m => selectedMessageIds.has(m.id))
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            const newMessages = selectedMsgs.map(m => ({
                conversation_id: targetConvoId,
                sender_id: currentUserId,
                content: m.content,
                type: m.type,
                media_url: m.media_url,
                media_duration: m.media_duration,
                reply_to_id: null,
            }));

            const { error } = await supabase.from('messages').insert(newMessages);
            if (error) throw error;

            toast.success(`Forwarded to conversation`);
            setSelectedMessageIds(new Set());
            setShowForwardModal(false);
        } catch (err) {
            toast.error('Failed to forward messages');
        } finally {
            setIsSending(false);
        }
    };

    // ─── Click outside to close menu ───────────────────────────────────────────────
    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null);
        if (menuOpenId) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [menuOpenId]);

    // ─── Agora RTC Actions ────────────────────────────────────────────────────────
    const fetchAgoraToken = async (channelName: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('agora-token', {
                body: { channelName, userAccount: currentUserId }
            });
            if (error) throw error;
            return data.token;
        } catch (err) {
            console.error('Error fetching Agora token:', err);
            return null;
        }
    };

    const joinAgoraChannel = async (channelId: string, callType: 'audio' | 'video') => {
        // Clear any existing timer and reset duration
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        setCallDuration(0);

        try {
            const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
            agoraClientRef.current = client;

            // Start timer immediately so user sees responsiveness
            callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);

            client.on('user-published', async (user, mediaType) => {
                await client.subscribe(user, mediaType);
                if (mediaType === 'video') {
                    const remoteEl = document.getElementById('agora-remote-video');
                    if (remoteEl) user.videoTrack?.play(remoteEl);
                }
                if (mediaType === 'audio') {
                    user.audioTrack?.play();
                }
            });

            client.on('user-unpublished', (user, mediaType) => {
                if (mediaType === 'video') {
                    user.videoTrack?.stop();
                }
            });

            client.on('user-left', () => {
                hangupCall(false);
                toast('Call ended — other user left', { icon: '📞' });
            });

            const token = await fetchAgoraToken(channelId);
            if (!token) {
                toast.error('Failed to get security token for call');
                // Cleanup on failure
                if (callTimerRef.current) clearInterval(callTimerRef.current);
                setCallDuration(0);
                setActiveCall(null);
                activeCallRef.current = null;
                return;
            }

            await client.join(AGORA_APP_ID, channelId, token, currentUserId || undefined);

            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localAudioRef.current = audioTrack;

            if (callType === 'video') {
                try {
                    const videoTrack = await AgoraRTC.createCameraVideoTrack();
                    localVideoRef.current = videoTrack;
                    await client.publish([audioTrack, videoTrack]);
                    const localEl = document.getElementById('agora-local-video');
                    if (localEl) videoTrack.play(localEl);
                } catch (videoErr: any) {
                    console.error('Camera access failed:', videoErr);
                    // Handle missing camera device gracefully
                    if (videoErr.name === 'NotFoundError' || videoErr.message?.includes('DEVICE_NOT_FOUND')) {
                        toast.error('No camera detected. Switching to audio call.', { icon: '📷' });
                        await client.publish([audioTrack]);
                    } else {
                        throw videoErr;
                    }
                }
            } else {
                await client.publish([audioTrack]);
            }
        } catch (err: any) {
            if (callTimerRef.current) clearInterval(callTimerRef.current);
            setCallDuration(0);
            setActiveCall(null);
            activeCallRef.current = null;
            toast.error('Failed to join call: ' + (err?.message || 'Unknown error'));
        }
    };

    const leaveAgoraChannel = async () => {
        try {
            localAudioRef.current?.stop();
            localAudioRef.current?.close();
            localAudioRef.current = null;
            localVideoRef.current?.stop();
            localVideoRef.current?.close();
            localVideoRef.current = null;
            if (agoraClientRef.current) {
                await agoraClientRef.current.leave();
                agoraClientRef.current = null;
            }
        } catch (err) {
            console.error('Agora leave error:', err);
        }
    };

    const hangupCall = async (isInitiator = false) => {
        if (callTimerRef.current) clearInterval(callTimerRef.current);
        const dur = callDuration;
        const callSnapshot = activeCallRef.current || activeCall;

        await leaveAgoraChannel();

        setActiveCall(null);
        activeCallRef.current = null;
        setCallDuration(0);
        setIsMuted(false);
        setIsCameraOff(false);

        if (callSnapshot && isInitiator) {
            // Check if WE were the caller by checking if we still have an activeConvo.otherUser 
            // set in initiateCall. Actually, a better way: 
            // In initiating: we set activeCall.conversationId.
            // Let's use the call_record to be certain who the caller was.
            const { data: callRec } = await supabase.from('call_records')
                .select('caller_id')
                .eq('agora_channel_id', callSnapshot.channelId)
                .single();

            await supabase.from('call_records')
                .update({ status: 'ended', ended_at: new Date().toISOString() })
                .eq('agora_channel_id', callSnapshot.channelId);

            // Always insert a message to record the call event
            await supabase.from('messages').insert({
                conversation_id: callSnapshot.conversationId,
                sender_id: currentUserId,
                type: 'call_event',
                call_status: dur > 0 ? 'answered' : 'missed',
                call_duration: dur > 0 ? dur : undefined,
                call_type: callSnapshot.type,
                caller_id: callRec?.caller_id // Now correctly identify the original caller
            });
        }
    };

    const initiateCall = async (callType: 'audio' | 'video') => {
        if (!activeConvo || !currentUserId || !activeConvo.otherUser) return;
        const channelId = `call_${activeConvo.id}_${Date.now()}`;

        const { error } = await supabase.from('call_records').insert({
            conversation_id: activeConvo.id,
            caller_id: currentUserId,
            call_type: callType,
            status: 'ringing',
            agora_channel_id: channelId
        });

        if (error) { toast.error('Failed to start call'); return; }

        setActiveCall({ type: callType, otherUser: activeConvo.otherUser, channelId, conversationId: activeConvo.id });
        activeCallRef.current = { type: callType, otherUser: activeConvo.otherUser, channelId, conversationId: activeConvo.id };
        toast(`Calling ${activeConvo.otherUser.full_name}...`, { icon: callType === 'video' ? '🎥' : '📞' });

        await joinAgoraChannel(channelId, callType);
    };

    const acceptCall = async () => {
        if (!incomingCall) return;
        const call = incomingCall;

        await supabase.from('call_records')
            .update({ status: 'answered' })
            .eq('id', call.callId);

        setActiveCall({ type: call.type, otherUser: call.caller, channelId: call.channelId, conversationId: call.conversationId });
        activeCallRef.current = { type: call.type, otherUser: call.caller, channelId: call.channelId, conversationId: call.conversationId };
        setIncomingCall(null);

        await joinAgoraChannel(call.channelId, call.type);
    };

    const rejectCall = async () => {
        if (!incomingCall) return;

        await supabase.from('call_records')
            .update({ status: 'rejected' })
            .eq('id', incomingCall.callId);

        await supabase.from('messages').insert({
            conversation_id: incomingCall.conversationId,
            sender_id: currentUserId,
            type: 'call_event',
            call_status: 'missed',
            call_type: incomingCall.type,
            caller_id: incomingCall.caller.id
        });
        setIncomingCall(null);
    };

    const handleToggleMute = async () => {
        if (localAudioRef.current) {
            const newMuted = !isMuted;
            await localAudioRef.current.setMuted(newMuted);
            setIsMuted(newMuted);
        }
    };

    const handleToggleCamera = async () => {
        if (localVideoRef.current) {
            const newOff = !isCameraOff;
            await localVideoRef.current.setMuted(newOff);
            setIsCameraOff(newOff);
        }
    };

    // ─── Load conversations ──────────────────────────────────────────────────────
    const loadConversations = useCallback(async () => {
        if (!currentUserId) return;

        // Step 1: Get all conversation IDs for this user
        const { data: participations, error: pErr } = await supabase
            .from('conversation_participants')
            .select('conversation_id, last_read_at, is_hidden, cleared_at')
            .eq('user_id', currentUserId);

        if (pErr || !participations?.length) return;
        const convoIds = participations.map(p => p.conversation_id);

        // Step 2: Get all conversations (flat, no joins)
        const { data: convos, error: cErr } = await supabase
            .from('conversations')
            .select('id, type, name, avatar_url, updated_at, created_by')
            .in('id', convoIds)
            .order('updated_at', { ascending: false });

        if (cErr || !convos?.length) return;

        // Step 3: Get all participants for these conversations (flat)
        const { data: allParticipants } = await supabase
            .from('conversation_participants')
            .select('conversation_id, user_id')
            .in('conversation_id', convoIds);

        // Step 4: Get profile details for all participant user IDs
        const allUserIds = [...new Set((allParticipants || []).map(p => p.user_id))];
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role, avatar_url, last_seen, is_in_chat')
            .in('id', allUserIds);

        const profileMap: Record<string, Profile> = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });

        // Step 5: Get last message per conversation (flat)
        const { data: lastMsgs } = await supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, type, media_url, media_duration, call_status, call_duration, created_at')
            .in('conversation_id', convoIds)
            .order('created_at', { ascending: false })
            .limit(convoIds.length * 2);

        // Step 6: Count unread messages per conversation
        const { data: unreadMsgs } = await supabase
            .from('messages')
            .select('conversation_id, id')
            .in('conversation_id', convoIds)
            .neq('sender_id', currentUserId)
            .gt('created_at', new Date(Date.now() - 86400000 * 7).toISOString());

        // Step 7: Assemble everything in JavaScript with de-duplication
        const seenDirectUsers = new Set<string>();
        const uniqueEnriched = (convos || []).map(c => {
            const myParticipantsForConvo = (allParticipants || []).filter(p => p.conversation_id === c.id);
            const otherParticipant = myParticipantsForConvo.find(p => p.user_id !== currentUserId);
            const otherUser = otherParticipant ? profileMap[otherParticipant.user_id] : undefined;

            // De-duplicate direct chats: show only the most recent one with each person
            if (c.type === 'direct' && otherUser) {
                if (seenDirectUsers.has(otherUser.id)) return null;
                seenDirectUsers.add(otherUser.id);
            }

            const myParticipation = (participations || []).find(p => p.conversation_id === c.id);
            if (myParticipation?.is_hidden) return null;

            const lastMsg = (lastMsgs || []).find(m => m.conversation_id === c.id);
            const unread = (unreadMsgs || []).filter(m => m.conversation_id === c.id).length;

            return {
                id: c.id,
                type: c.type as 'direct' | 'group',
                name: c.name,
                avatar_url: c.avatar_url,
                otherUser,
                lastMessage: lastMsg as Message | undefined,
                unreadCount: unread,
                updated_at: c.updated_at,
                is_hidden: myParticipation?.is_hidden,
                cleared_at: myParticipation?.cleared_at
            } as Conversation;
        }).filter((c): c is Conversation => c !== null);

        setConversations(uniqueEnriched);
    }, [currentUserId]);

    // ─── Load messages ────────────────────────────────────────────────────────────
    const loadMessages = useCallback(async (convoId: string) => {
        const convo = conversations.find(c => c.id === convoId);
        let query = supabase
            .from('messages')
            .select('id, conversation_id, sender_id, content, type, media_url, media_duration, call_status, call_duration, created_at, is_deleted, reply_to_id, is_pinned, deleted_for_users')
            .eq('conversation_id', convoId);

        if (convo?.cleared_at) {
            query = query.gt('created_at', convo.cleared_at);
        }

        const { data: msgs, error } = await query
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) { toast.error('Failed to load messages'); return; }

        if (msgs) {
            // Fetch senders and reply messages
            const senderIds = [...new Set(msgs.map(m => m.sender_id))];
            const replyIds = [...new Set(msgs.filter(m => m.reply_to_id).map(m => m.reply_to_id))];

            const [sendersRes, repliesRes] = await Promise.all([
                supabase.from('profiles').select('id, full_name, role, avatar_url, last_seen, is_in_chat').in('id', senderIds),
                replyIds.length > 0
                    ? supabase.from('messages').select('id, content, type, media_url, sender_id').in('id', replyIds)
                    : Promise.resolve({ data: [], error: null })
            ]);

            const senderMap: Record<string, Profile> = {};
            (sendersRes.data || []).forEach(s => senderMap[s.id] = s);

            const replyMap: Record<string, Message> = {};
            (repliesRes.data || []).forEach(r => replyMap[r.id] = r as Message);

            const enrichedMsgs = msgs
                .filter(m => !m.is_deleted && !(m.deleted_for_users || []).includes(currentUserId || ''))
                .map(m => ({
                    ...m,
                    sender: senderMap[m.sender_id],
                    reply_to: m.reply_to_id ? replyMap[m.reply_to_id] : undefined
                }));

            setMessages(enrichedMsgs as Message[]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }

        // Mark as read
        await supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', convoId)
            .eq('user_id', currentUserId);
    }, [currentUserId, conversations]);

    const togglePinMessage = async (msgId: string, isPinned: boolean) => {
        const { error } = await supabase.from('messages').update({ is_pinned: !isPinned }).eq('id', msgId);
        if (error) toast.error('Failed to update pin');
        else if (activeConvo) loadMessages(activeConvo.id);
    };

    const deleteConversation = async (convoId: string) => {
        const { error } = await supabase
            .from('conversation_participants')
            .update({ is_hidden: true })
            .eq('conversation_id', convoId)
            .eq('user_id', currentUserId);

        if (error) toast.error('Failed to delete chat');
        else {
            setActiveConvo(null);
            loadConversations();
        }
    };

    const clearConversation = async (convoId: string) => {
        const { error } = await supabase
            .from('conversation_participants')
            .update({ cleared_at: new Date().toISOString() })
            .eq('conversation_id', convoId)
            .eq('user_id', currentUserId);

        if (error) toast.error('Failed to clear chat');
        else loadMessages(convoId);
    };


    // ─── Load all users for new chat ──────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, role, avatar_url, last_seen, is_in_chat')
                .neq('id', currentUserId || '');
            setAllUsers(data || []);
        };
        if (currentUserId) load();
    }, [currentUserId]);

    useEffect(() => { loadConversations(); }, [loadConversations]);

    useEffect(() => {
        if (activeConvo) loadMessages(activeConvo.id);
    }, [activeConvo, loadMessages]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    // ─── Realtime subscriptions ────────────────────────────────────────────────────
    useEffect(() => {
        if (!activeConvo) return;

        const channel = supabase
            .channel(`messages:${activeConvo.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvo.id}` },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).single();
                        const newMsg = { ...payload.new, sender } as Message;
                        setMessages(prev => [...prev, newMsg]);
                        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                    } else if (payload.eventType === 'UPDATE') {
                        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
                    } else if (payload.eventType === 'DELETE') {
                        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
                    }
                    loadConversations();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeConvo, loadConversations]);

    // ─── Incoming call subscription ────────────────────────────────────────────────
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`calls:${currentUserId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_records' },
                async (payload) => {
                    const call = payload.new as any;
                    if (call.caller_id === currentUserId) return;

                    // Check if we're in the conversation
                    const { data: isParticipant } = await supabase
                        .from('conversation_participants')
                        .select('id')
                        .eq('conversation_id', call.conversation_id)
                        .eq('user_id', currentUserId)
                        .maybeSingle();

                    if (!isParticipant) return;

                    const { data: caller } = await supabase.from('profiles').select('*').eq('id', call.caller_id).single();
                    if (caller) {
                        setIncomingCall({
                            callId: call.id,
                            type: call.call_type,
                            caller,
                            channelId: call.agora_channel_id,
                            conversationId: call.conversation_id
                        });
                    }
                }
            )
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_records' },
                (payload) => {
                    const call = payload.new as any;
                    if (call.status === 'ended' || call.status === 'rejected') {
                        setIncomingCall(null);
                        if (activeCall) hangupCall(false);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUserId, activeCall]);

    // ─── Profile changes subscription ─────────────────────────────────────────────
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel('public_profiles_presence')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
                (payload) => {
                    const updatedProfile = payload.new as Profile;

                    // Update in conversations
                    setConversations(prev => prev.map(c => {
                        if (c.otherUser?.id === updatedProfile.id) {
                            return { ...c, otherUser: { ...c.otherUser, ...updatedProfile } };
                        }
                        return c;
                    }));

                    // Update active conversation if it matches
                    if (activeConvo?.otherUser?.id === updatedProfile.id) {
                        setActiveConvo(prev => prev ? {
                            ...prev,
                            otherUser: { ...prev.otherUser, ...updatedProfile }
                        } : null);
                    }

                    // Update in messages sender info
                    setMessages(prev => prev.map(m => {
                        if (m.sender_id === updatedProfile.id) {
                            return { ...m, sender: { ...m.sender, ...updatedProfile } };
                        }
                        return m;
                    }));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUserId, activeConvo?.otherUser?.id]);

    // ─── Send text message ─────────────────────────────────────────────────────────
    const sendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!text.trim() || !activeConvo || !currentUserId) return;
        setIsSending(true);
        const content = text.trim();
        const msgReplyToId = replyTo?.id;
        setText('');
        setReplyTo(null);

        // Reset textarea height after sending
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        await supabase.from('messages').insert({
            conversation_id: activeConvo.id,
            sender_id: currentUserId,
            content,
            type: 'text',
            reply_to_id: msgReplyToId
        });

        await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvo.id);
        setIsSending(false);
    };

    // ─── Send image ────────────────────────────────────────────────────────────────
    const sendImage = async (file: Blob | File) => {
        if (!activeConvo || !currentUserId) return;
        setIsUploading(true);
        try {
            // Compress image if it's a File (raw upload)
            let finalImage: Blob | File = file;
            if (file instanceof File) {
                finalImage = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: true });
            }

            const ext = 'jpg';
            const path = `${currentUserId}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, finalImage, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);

            await supabase.from('messages').insert({
                conversation_id: activeConvo.id,
                sender_id: currentUserId,
                type: 'image',
                media_url: publicUrl,
                media_size: finalImage.size
            });
            await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvo.id);
            setPendingImage(null);
        } catch (err) {
            toast.error('Failed to send image');
        }
        setIsUploading(false);
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setPendingImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    // ─── Send voice note ───────────────────────────────────────────────────────────
    const sendVoiceNote = async (blob: Blob, duration: number) => {
        if (!activeConvo || !currentUserId) return;
        setIsUploading(true);
        try {
            const path = `${currentUserId}/voice_${Date.now()}.webm`;
            const { error } = await supabase.storage.from('chat-media').upload(path, blob, { contentType: 'audio/webm', upsert: true });
            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(path);
            await supabase.from('messages').insert({
                conversation_id: activeConvo.id,
                sender_id: currentUserId,
                type: 'voice',
                media_url: publicUrl,
                media_duration: duration
            });
            await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConvo.id);
        } catch {
            toast.error('Failed to send voice note');
        }
        setIsUploading(false);
    };

    // ─── Start a new conversation ──────────────────────────────────────────────────
    const startConversation = async (otherUser: Profile) => {
        if (!currentUserId) return;

        // Check if conversation already exists
        const existing = conversations.find(c => c.type === 'direct' && c.otherUser?.id === otherUser.id);
        if (existing) { setActiveConvo(existing); setShowNewChat(false); return; }

        // Pre-generate the UUID client-side to avoid the RLS conflict
        // that happens when chaining .select() after .insert() on conversations
        // (SELECT policy requires conversation_participants to exist, which they don't yet)
        const newConvoId = crypto.randomUUID();
        const now = new Date().toISOString();

        const { error: insertError } = await supabase
            .from('conversations')
            .insert({ id: newConvoId, type: 'direct', created_by: currentUserId, updated_at: now });

        if (insertError) { toast.error('Failed to start conversation: ' + insertError.message); return; }

        const { error: participantsError } = await supabase
            .from('conversation_participants')
            .insert([
                { conversation_id: newConvoId, user_id: currentUserId },
                { conversation_id: newConvoId, user_id: otherUser.id }
            ]);

        if (participantsError) { toast.error('Failed to add participants'); return; }

        const newConvo: Conversation = {
            id: newConvoId,
            type: 'direct',
            otherUser,
            unreadCount: 0,
            updated_at: now
        };

        setConversations(prev => [newConvo, ...prev]);
        setActiveConvo(newConvo);
        setShowNewChat(false);
        toast.success(`Chat started with ${otherUser.full_name}!`);
    };



    const filteredUsers = allUsers.filter(u =>
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredConvos = conversations.filter(c => {
        const name = c.type === 'direct' ? c.otherUser?.full_name : c.name;
        return name?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // ─── Render ────────────────────────────────────────────────────────────────────
    return (
        <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-background -m-4 sm:-m-6">

            {/* ── Image Editor Overlay ── */}
            {pendingImage && (
                <ImageEditorModal
                    image={pendingImage}
                    onCancel={() => setPendingImage(null)}
                    onSave={sendImage}
                    isProcessing={isUploading}
                />
            )}

            {/* ── Image Viewer Overlay ── */}
            {imageToView && (
                <ImageViewerModal
                    url={imageToView}
                    onClose={() => setImageToView(null)}
                />
            )}

            {/* ── Incoming Call Overlay ── */}
            {incomingCall && (
                <IncomingCallModal
                    callerName={incomingCall.caller.full_name}
                    callType={incomingCall.type}
                    onAccept={acceptCall}
                    onReject={rejectCall}
                />
            )}

            {/* ── Active Call Overlay ── */}
            {activeCall && (
                <ActiveCallModal
                    callType={activeCall.type}
                    otherUserName={activeCall.otherUser.full_name}
                    otherUserAvatar={activeCall.otherUser.avatar_url}
                    duration={callDuration}
                    onHangup={() => hangupCall(true)}
                    isMuted={isMuted}
                    toggleMute={handleToggleMute}
                    isCameraOff={isCameraOff}
                    toggleCamera={handleToggleCamera}
                />
            )}

            {/* ─────────────── LEFT: Conversation List ─────────────── */}
            <div className={`
        w-full md:w-80 lg:w-96 flex-shrink-0 
        border-r border-white/5 flex flex-col
        ${activeConvo ? 'hidden md:flex' : 'flex'}
      `}>
                {/* Panel header */}
                <div className="p-5 border-b border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-white font-black text-lg tracking-tight">Messages</h1>
                            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Communication Center</p>
                        </div>
                        <button
                            onClick={() => setShowNewChat(true)}
                            className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center hover:bg-primary/20 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder=""
                            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20 font-medium focus:outline-none focus:border-primary/30 transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {showNewChat ? (
                        // New Chat: Show all users
                        <div>
                            <div className="px-4 py-2 flex items-center gap-2">
                                <button onClick={() => setShowNewChat(false)} className="text-white/40 hover:text-white transition-all">
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Start new chat</span>
                            </div>
                            {filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => startConversation(user)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-all group"
                                >
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-white text-sm flex-shrink-0 shadow-lg">
                                        {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover rounded-full" alt="" /> : user.full_name[0]}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-white font-black text-sm">{user.full_name}</p>
                                        <p className="text-primary/60 text-[10px] font-black uppercase tracking-widest">{user.role}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        // Conversation list
                        filteredConvos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                    <MessageSquare className="w-7 h-7 text-white/20" />
                                </div>
                                <div>
                                    <p className="text-white/40 font-black text-sm">No conversations yet</p>
                                    <p className="text-white/20 text-xs mt-1">Click + to start a new chat</p>
                                </div>
                            </div>
                        ) : (
                            filteredConvos.map(convo => {
                                const name = convo.type === 'direct' ? convo.otherUser?.full_name : convo.name;
                                const lastText = convo.lastMessage?.type === 'text'
                                    ? convo.lastMessage.content
                                    : convo.lastMessage?.type === 'image' ? '📷 Photo'
                                        : convo.lastMessage?.type === 'voice' ? '🎤 Voice note'
                                            : convo.lastMessage?.type === 'call_event' ? '📞 Call'
                                                : '';
                                const isActive = activeConvo?.id === convo.id;

                                return (
                                    <button
                                        key={convo.id}
                                        onClick={() => setActiveConvo(convo)}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all ${isActive ? 'bg-primary/10 border-r-2 border-primary' : 'hover:bg-white/[0.03]'}`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-white text-base shadow-lg overflow-hidden">
                                                {convo.otherUser?.avatar_url
                                                    ? <img src={convo.otherUser.avatar_url} className="w-full h-full object-cover" alt="" />
                                                    : (name || 'U')[0]
                                                }
                                            </div>
                                            {(() => {
                                                const prof = convo.otherUser;
                                                if (!prof) return null;
                                                const lastSeenDate = prof.last_seen ? new Date(prof.last_seen) : null;
                                                const isRecentlyActive = lastSeenDate && (new Date().getTime() - lastSeenDate.getTime()) < 6000;
                                                const isOnline = prof.is_in_chat && isRecentlyActive;
                                                const isAway = !prof.is_in_chat && isRecentlyActive;

                                                return (
                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background transition-colors ${isOnline ? 'bg-emerald-400' : isAway ? 'bg-amber-400' : 'bg-white/10'}`} />
                                                );
                                            })()}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 text-left min-w-0 overflow-hidden">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-white font-black text-sm truncate flex-1 min-w-0">{name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white/25 text-[9px] font-bold flex-shrink-0 ml-2">
                                                        {convo.lastMessage ? new Date(convo.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                    {/* Premium Options Menu */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setMenuOpenId(menuOpenId === convo.id ? null : convo.id);
                                                            }}
                                                            className={`p-1.5 rounded-xl hover:bg-white/10 transition-all shadow-lg ${menuOpenId === convo.id ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white'}`}
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                        {menuOpenId === convo.id && (
                                                            <div className="absolute right-0 top-full mt-2 bg-[#1A1D21]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] p-2 min-w-[190px] backdrop-blur-2xl animate-premium-in origin-top-right sm:right-0 max-sm:-right-4">
                                                                <div className="px-3 py-2 border-b border-white/5 mb-1.5">
                                                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Chat Options</p>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); clearConversation(convo.id); setMenuOpenId(null); }}
                                                                    className="w-full text-left px-3 py-2.5 text-[11px] font-bold tracking-wide text-white/60 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-3 transition-all group/item"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/item:bg-primary/20 group-hover/item:text-primary transition-all">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </div>
                                                                    Clear History
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); setMenuOpenId(null); }}
                                                                    className="w-full text-left px-3 py-2.5 text-[11px] font-bold tracking-wide text-red-400/70 hover:text-red-400 hover:bg-red-400/5 rounded-xl flex items-center gap-3 transition-all group/item"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-red-400/10 flex items-center justify-center group-hover/item:bg-red-400/20 transition-all">
                                                                        <Archive className="w-4 h-4" />
                                                                    </div>
                                                                    Hide Conversation
                                                                </button>
                                                                {isActive && messages.length > 0 && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setSelectedMessageIds(new Set([messages[0].id])); }}
                                                                        className="w-full text-left px-3 py-2.5 text-[11px] font-bold tracking-wide text-white/60 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-3 transition-all group/item"
                                                                    >
                                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/item:bg-primary/20 group-hover/item:text-primary transition-all">
                                                                            <CheckSquare className="w-4 h-4" />
                                                                        </div>
                                                                        Select Messages
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between gap-2 mt-0.5 overflow-hidden">
                                                <p className="text-white/35 text-xs truncate flex-1 min-w-0">{lastText}</p>
                                                {convo.unreadCount > 0 && (
                                                    <span className="min-w-[20px] h-5 px-1.5 bg-primary rounded-full text-[10px] font-black text-white flex items-center justify-center flex-shrink-0">
                                                        {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )
                    )}
                </div>
            </div>

            {/* ─────────────── CENTER: Chat Window ─────────────── */}
            {activeConvo ? (
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Chat header */}
                    <div className={`sticky top-0 z-20 h-16 flex items-center justify-between px-5 border-b border-white/5 transition-all duration-300 bg-background/50 backdrop-blur-xl flex-shrink-0`}>
                        {/* LEFT: Contact Info */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setActiveConvo(null)}
                                className="md:hidden w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all mr-1"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-white text-sm overflow-hidden shadow-lg">
                                    {activeConvo.otherUser?.avatar_url
                                        ? <img src={activeConvo.otherUser.avatar_url} className="w-full h-full object-cover" alt="" />
                                        : (activeConvo.otherUser?.full_name || 'G')[0]
                                    }
                                </div>
                                {(() => {
                                    const prof = activeConvo.otherUser;
                                    if (!prof) return null;
                                    const lastSeenDate = prof.last_seen ? new Date(prof.last_seen) : null;
                                    const isRecentlyActive = lastSeenDate && (new Date().getTime() - lastSeenDate.getTime()) < 6000;
                                    const isOnline = prof.is_in_chat && isRecentlyActive;
                                    const isAway = !prof.is_in_chat && isRecentlyActive;

                                    return (
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background transition-colors ${isOnline ? 'bg-emerald-400' : isAway ? 'bg-amber-400' : 'bg-white/10'}`} />
                                    );
                                })()}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-white font-black text-sm">
                                    {activeConvo.type === 'direct' ? activeConvo.otherUser?.full_name : activeConvo.name}
                                </p>
                                {(() => {
                                    const prof = activeConvo.otherUser;
                                    if (!prof) return null;
                                    const lastSeenDate = prof.last_seen ? new Date(prof.last_seen) : null;
                                    const now = new Date();
                                    const isRecentlyActive = lastSeenDate && (now.getTime() - lastSeenDate.getTime()) < 6000;

                                    if (prof.is_in_chat && isRecentlyActive) {
                                        return <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Online</p>;
                                    }
                                    if (isRecentlyActive) {
                                        return <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">Away</p>;
                                    }
                                    if (lastSeenDate) {
                                        const timeStr = lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        const isToday = lastSeenDate.toDateString() === now.toDateString();
                                        return <p className="text-white/30 text-[10px] font-black uppercase tracking-widest">
                                            Last seen {isToday ? timeStr : lastSeenDate.toLocaleDateString()}
                                        </p>;
                                    }
                                    return <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Offline</p>;
                                })()}
                            </div>
                        </div>

                        {/* MIDDLE: Selection Actions (Visible in middle space) */}
                        {selectedMessageIds.size > 0 && (
                            <div className="absolute inset-x-0 top-0 h-full flex items-center justify-center pointer-events-none">
                                <div className="bg-primary px-4 py-1.5 rounded-2xl flex items-center gap-2 shadow-2xl animate-premium-up pointer-events-auto border border-white/20">
                                    <button
                                        onClick={() => setSelectedMessageIds(new Set())}
                                        className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-all flex items-center gap-2"
                                    >
                                        <X className="w-4 h-4" />
                                        <span className="text-[10px] font-black">{selectedMessageIds.size}</span>
                                    </button>

                                    <div className="w-px h-6 bg-white/10 mx-1" />

                                    <button
                                        onClick={() => setShowForwardModal(true)}
                                        className="p-2 rounded-xl hover:bg-white/10 text-white transition-all flex items-center justify-center group"
                                        title="Forward"
                                    >
                                        <Reply className="w-4 h-4 group-hover:scale-110 transition-transform -scale-x-100" />
                                    </button>
                                    <button
                                        onClick={togglePinForSelected}
                                        className="p-2 rounded-xl hover:bg-white/10 text-white transition-all flex items-center justify-center group"
                                        title="Toggle Pin"
                                    >
                                        <Pin className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    </button>
                                    <button
                                        onClick={deleteSelectedMessages}
                                        className="p-2 rounded-xl hover:bg-white/10 text-red-400 hover:text-white transition-all flex items-center justify-center group"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                    </button>

                                    <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

                                    <button
                                        onClick={() => {
                                            const allIds = new Set(messages.map(m => m.id));
                                            setSelectedMessageIds(allIds);
                                        }}
                                        className="px-3 py-1.5 rounded-lg hover:bg-white/10 text-white/90 text-[9px] font-black uppercase tracking-widest transition-all hidden sm:block"
                                    >
                                        All
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* RIGHT: Call Buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => initiateCall('audio')}
                                className="w-9 h-9 rounded-full bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-primary/15 hover:border-primary/20 flex items-center justify-center transition-all"
                            >
                                <Phone className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => initiateCall('video')}
                                className="w-9 h-9 rounded-full bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-primary/15 hover:border-primary/20 flex items-center justify-center transition-all"
                            >
                                <Video className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-0.5">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center opacity-40">
                                <MessageSquare className="w-10 h-10 text-white/20" />
                                <p className="text-white/30 font-bold text-sm">Start the conversation!</p>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                isOwn={msg.sender_id === currentUserId}
                                currentUserId={currentUserId || undefined}
                                onReply={setReplyTo}
                                onPin={m => togglePinMessage(m.id, !!m.is_pinned)}
                                isSelected={selectedMessageIds.has(msg.id)}
                                isSelectionMode={selectedMessageIds.size > 0}
                                onSelect={toggleMessageSelection}
                                onImageClick={setImageToView}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Forward Modal */}
                    {showForwardModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForwardModal(false)} />
                            <div className="relative bg-[#0F1115] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden animate-premium-up shadow-2xl">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-lg font-black text-white px-2">Forward to...</h3>
                                    <button onClick={() => setShowForwardModal(false)} className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin">
                                    {conversations.map(convo => {
                                        const otherUser = convo.otherUser;
                                        const name = convo.type === 'direct' ? otherUser?.full_name : convo.name;
                                        if (!name) return null;
                                        return (
                                            <button
                                                key={convo.id}
                                                onClick={() => handleForwardMessages(convo.id)}
                                                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-all text-left group"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-black text-white">
                                                    {(name || '?')[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white font-bold truncate">{name}</p>
                                                    <p className="text-white/30 text-[10px] uppercase tracking-widest">{convo.type === 'direct' ? (otherUser?.role || 'User') : 'Group'}</p>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                    <Send className="w-3.5 h-3.5 text-primary" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delete Confirmation Modal */}
                    {showDeleteModal && (
                        <DeleteConfirmationModal
                            count={selectedMessageIds.size}
                            onCancel={() => setShowDeleteModal(false)}
                            onDeleteForMe={deleteForMe}
                            onDeleteForEveryone={deleteForEveryone}
                            canDeleteForEveryone={Array.from(selectedMessageIds).every(id => {
                                const m = messages.find(msg => msg.id === id);
                                return m?.sender_id === currentUserId && !!currentUserId;
                            })}
                        />
                    )}

                    {/* Input bar */}
                    <div className="sticky bottom-0 z-20 flex-shrink-0 p-4 border-t border-white/5 bg-background/50 backdrop-blur-xl">
                        {/* Reply Preview */}
                        {replyTo && (
                            <div className="mb-3 p-3 rounded-2xl bg-[#1A1D21]/80 border border-white/10 flex items-center justify-between group animate-premium-up shadow-xl backdrop-blur-xl">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-1 h-8 rounded-full bg-primary" />
                                    <div className="min-w-0">
                                        <p className="text-primary font-black text-[10px] uppercase tracking-widest leading-none mb-1">Replying to {replyTo.sender?.full_name}</p>
                                        <p className="text-white/40 text-xs truncate">
                                            {replyTo.type === 'text' ? replyTo.content : `[${replyTo.type}]`}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setReplyTo(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white flex items-center justify-center transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <form onSubmit={sendMessage} className="flex items-center gap-2">
                            {/* File input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={e => e.target.files?.[0] && sendImage(e.target.files[0])}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                            >
                                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                            </button>

                            {/* Voice recorder */}
                            <VoiceRecorder onRecordingComplete={sendVoiceNote} />

                            {/* Text input */}
                            <textarea
                                ref={textareaRef}
                                value={text}
                                onChange={e => setText(e.target.value)}
                                placeholder="Type a message..."
                                rows={1}
                                className="flex-1 px-4 pr-12 py-3 bg-white/[0.04] border border-white/5 rounded-2xl text-sm text-white placeholder:text-white/20 font-medium focus:outline-none focus:border-primary/30 transition-all resize-none overflow-hidden"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        sendMessage(e as any);
                                    }
                                }}
                            />

                            {/* Send button */}
                            <button
                                type="submit"
                                disabled={!text.trim() || isSending}
                                className="w-10 h-10 rounded-full bg-primary hover:bg-primary/80 disabled:opacity-30 text-white flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-primary/20"
                            >
                                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                // Empty state
                <div className="hidden md:flex flex-1 items-center justify-center">
                    <div className="text-center space-y-4">
                        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                            <MessageSquare className="w-10 h-10 text-white/15" />
                        </div>
                        <div>
                            <h3 className="text-white/40 font-black text-lg">Select a conversation</h3>
                            <p className="text-white/20 text-sm mt-1">Choose a chat on the left to start messaging</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
