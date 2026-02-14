import { useState, useRef, useEffect } from 'react';
import { Mic, Radio, Volume2, VolumeX, Loader2, Users, X, CheckSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function WalkieTalkie({ role, userId }: { role: string; userId: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isIncoming, setIsIncoming] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContext = useRef<AudioContext | null>(null);
    const holdTimer = useRef<any>(null);
    const mouseDownTime = useRef<number>(0);
    const isHolding = useRef(false);

    // Recording Start Beep
    const playBeep = (type: 'start' | 'end') => {
        if (!audioContext.current) audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioContext.current.createOscillator();
        const gain = audioContext.current.createGain();
        osc.connect(gain);
        gain.connect(audioContext.current.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(type === 'start' ? 880 : 440, audioContext.current.currentTime);
        gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.1);
        osc.start();
        osc.stop(audioContext.current.currentTime + 0.1);
    };

    const startRecording = async () => {
        if (role !== 'admin') return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks.current = [];

            mediaRecorder.current.ondataavailable = (e: BlobEvent) => {
                if (e.data.size > 0) audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                await uploadBroadcast(audioBlob);
            };

            playBeep('start');
            mediaRecorder.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error('Recording error:', err);
            toast.error('Microphone access denied');
        }
    };

    const stopRecording = () => {
        setIsRecording(false); // Force state reset immediately for UI responsiveness
        if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            try {
                mediaRecorder.current.stop();
                mediaRecorder.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
                playBeep('end');
            } catch (err) {
                console.error('Error stopping recorder:', err);
            }
        }
    };

    const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (role !== 'admin') return;

        // Prevent synthetic mouse events on touch devices
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        mouseDownTime.current = Date.now();
        isHolding.current = true;

        if (holdTimer.current) clearTimeout(holdTimer.current);

        holdTimer.current = setTimeout(() => {
            if (isHolding.current && !isRecording) {
                startRecording();
            }
        }, 250);
    };

    const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isHolding.current) return;
        isHolding.current = false;

        const pressDuration = Date.now() - mouseDownTime.current;

        if (holdTimer.current) {
            clearTimeout(holdTimer.current);
            holdTimer.current = null;
        }

        if (isRecording) {
            // If we were in PTT mode (long press), stop now
            if (pressDuration >= 250) {
                stopRecording();
            }
        } else if (pressDuration < 250) {
            // If it was a short tap and we weren't recording, start toggle mode
            startRecording();
        }
    };

    const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
        // This is only for the "Stop" action in toggle mode 
        // OR if the user just taps the button.
        if (role !== 'admin') return;

        // If we are already recording and it's a tap, stop it
        if (isRecording && (Date.now() - mouseDownTime.current < 250)) {
            stopRecording();
        }
    };

    const [showRecipients, setShowRecipients] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);

    // Fetch users when opening the recipients modal
    const handleOpenRecipients = async () => {
        console.log('👥 handleOpenRecipients clicked', { showRecipients, availableUsersCount: availableUsers.length });
        if (showRecipients) {
            setShowRecipients(false);
            return;
        }

        setShowRecipients(true);
        if (availableUsers.length > 0) return;

        setIsLoadingUsers(true);
        try {
            console.log('🔄 Fetching users...');
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .in('role', ['admin', 'head_coach', 'coach', 'reception'])
                .neq('id', userId) // Exclude self
                .order('role', { ascending: true })
                .order('full_name', { ascending: true });

            console.log('✅ Users fetched:', { data, error });

            if (error) throw error;
            setAvailableUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            toast.error('Failed to load users');
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const toggleUserSelection = (id: string) => {
        setSelectedUserIds(prev =>
            prev.includes(id) ? prev.filter(uid => uid !== id) : [...prev, id]
        );
    };

    const toggleAllUsers = () => {
        if (selectedUserIds.length === availableUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(availableUsers.map(u => u.id));
        }
    };

    const uploadBroadcast = async (blob: Blob) => {
        setIsUploading(true);
        const fileName = `${userId}_${Date.now()}.webm`;

        try {
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('walkie-talkie')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('walkie-talkie')
                .getPublicUrl(fileName);

            const { error: dbError } = await supabase
                .from('voice_broadcasts')
                .insert({
                    sender_id: userId,
                    audio_url: publicUrl,
                    target_users: selectedUserIds.length > 0 ? selectedUserIds : null, // Null means everyone
                    expires_at: new Date(Date.now() + 60000).toISOString() // Expire in 1 min
                });

            if (dbError) throw dbError;
            // toast.success('Broadcast sent!');
        } catch (err: any) {
            console.error('Broadcast error:', err);
            toast.error('Failed to send broadcast');
        } finally {
            setIsUploading(false);
        }
    };

    // Global Listener for Coaches
    useEffect(() => {
        const channel = supabase
            .channel('voice-broadcasts-realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'voice_broadcasts' },
                async (payload) => {
                    const newBroadcast = payload.new as any;
                    console.log('📡 WalkieTalkie: Received broadcast:', newBroadcast);

                    if (newBroadcast.sender_id !== userId && !isMuted) {
                        // Check if this broadcast is targeted to specific users
                        if (newBroadcast.target_users && Array.isArray(newBroadcast.target_users) && newBroadcast.target_users.length > 0) {
                            if (!newBroadcast.target_users.includes(userId)) {
                                return; // Skip if not in target list
                            }
                        }
                        setIsIncoming(true);

                        // Play Beep first
                        playBeep('start');

                        const audio = new Audio(newBroadcast.audio_url);
                        audio.crossOrigin = "anonymous";

                        audio.play().catch(e => {
                            console.error('🚫 WalkieTalkie: Auto-play blocked:', e);
                            toast((t) => (
                                <span className="flex items-center gap-2">
                                    🎙️ Walkie Talkie
                                    <button
                                        onClick={() => {
                                            audio.play();
                                            toast.dismiss(t.id);
                                        }}
                                        className="bg-primary text-black px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Listen
                                    </button>
                                </span>
                            ), { duration: 10000, className: 'premium-toast-vibrant' });
                        });

                        audio.onended = () => {
                            setIsIncoming(false);
                            playBeep('end');
                        };
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isMuted, userId]);

    return (
        <div className="flex items-center gap-2 relative">
            {/* Recipients Selection - ADMIN ONLY */}
            {role === 'admin' && (
                <>
                    <button
                        onClick={handleOpenRecipients}
                        className={`relative w-10 h-10 flex items-center justify-center rounded-full border transition-all ${showRecipients || selectedUserIds.length > 0
                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-500'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                            }`}
                        title="Select who receives this message"
                    >
                        <Users className="w-4 h-4" />
                        {selectedUserIds.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
                                {selectedUserIds.length}
                            </span>
                        )}
                    </button>

                    {showRecipients && (
                        <div className="absolute top-12 left-0 w-64 bg-[#1A1D21] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5">
                                <span className="text-xs font-bold text-white/80">Select Recipients</span>
                                <button
                                    onClick={() => setShowRecipients(false)}
                                    className="text-white/40 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                {isLoadingUsers ? (
                                    <div className="flex justify-center p-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={toggleAllUsers}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-xs font-medium ${selectedUserIds.length === availableUsers.length && availableUsers.length > 0
                                                ? 'bg-amber-500/20 text-amber-500' // Changed to amber for better contrast
                                                : 'hover:bg-white/5 text-white/60'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedUserIds.length === availableUsers.length && availableUsers.length > 0
                                                ? 'bg-amber-500 border-amber-500'
                                                : 'border-white/20'
                                                }`}>
                                                {selectedUserIds.length === availableUsers.length && availableUsers.length > 0 && <CheckSquare className="w-3 h-3 text-black" />}
                                            </div>
                                            Broadcast to All ({availableUsers.length})
                                        </button>

                                        <div className="h-px bg-white/10 my-1 mx-2" />

                                        {availableUsers.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => toggleUserSelection(user.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-xs font-medium ${selectedUserIds.includes(user.id)
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'hover:bg-white/5 text-white/60'
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedUserIds.includes(user.id)
                                                    ? 'bg-emerald-500 border-emerald-500'
                                                    : 'border-white/20'
                                                    }`}>
                                                    {selectedUserIds.includes(user.id) && <CheckSquare className="w-3 h-3 text-black" />}
                                                </div>
                                                <div className="flex flex-col items-start">
                                                    <span>{user.full_name}</span>
                                                    <span className="text-[9px] uppercase opacity-50">{user.role}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            {/* Broadcast Button - ADMIN ONLY */}
            {role === 'admin' && (
                <button
                    onMouseDown={handlePressStart}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={handlePressStart}
                    onTouchEnd={(e) => {
                        e.preventDefault();
                        handlePressEnd(e);
                        handleToggle(e as any);
                    }}
                    onClick={(e) => {
                        if ((Date.now() - mouseDownTime.current) < 50) return;
                        handleToggle(e);
                    }}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 border ${isRecording
                        ? 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] scale-110'
                        : 'bg-white/5 border-white/10 hover:border-primary/50 text-white/70 hover:bg-white/10'
                        }`}
                    title={isRecording ? "Click to Stop" : "Broadcasting Mic (Hold to Talk)"}
                >
                    {isUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : isRecording ? (
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                    ) : (
                        <Mic className="w-4 h-4" />
                    )}
                </button>
            )}

            {/* Speaker Button - ALL AUTHORIZED ROLES */}
            {role !== 'admin' && (
                <button
                    onClick={() => {
                        setIsMuted(!isMuted);
                        if (audioContext.current?.state === 'suspended') {
                            audioContext.current.resume();
                        }
                    }}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-full border transition-all ${isMuted
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        : isIncoming
                            ? 'bg-primary/10 border-primary/50 text-primary animate-bounce shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                    title={isIncoming ? "Admin is Speaking... (Click to Stop)" : "Hoki Toki Speaker (Mute/Unmute)"}
                >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    {isIncoming && !isMuted && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full animate-ping"></span>
                    )}
                </button>
            )}
        </div>
    );
}
