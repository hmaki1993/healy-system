import { useState, useRef, useEffect } from 'react';
import { Mic, Radio, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function WalkieTalkie({ role, userId }: { role: string; userId: string }) {
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);
    const audioContext = useRef<AudioContext | null>(null);

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

            mediaRecorder.current.ondataavailable = (e) => {
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
        if (mediaRecorder.current && isRecording) {
            mediaRecorder.current.stop();
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            playBeep('end');
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
                    expires_at: new Date(Date.now() + 60000).toISOString() // Expire in 1 min
                });

            if (dbError) throw dbError;
            toast.success('Broadcast sent!');
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
                    if (newBroadcast.sender_id !== userId && !isMuted) {
                        const audio = new Audio(newBroadcast.audio_url);
                        audio.play().catch(e => console.error('Auto-play blocked:', e));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isMuted, userId]);

    return (
        <div className="flex items-center gap-3">
            {role === 'admin' && (
                <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`relative w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 border-2 ${isRecording
                            ? 'bg-red-500/20 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] scale-110'
                            : 'bg-primary/5 border-primary/20 hover:border-primary/50 text-primary'
                        }`}
                    title="Push to Talk (Hoki Toki)"
                >
                    {isUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isRecording ? (
                        <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                    ) : (
                        <Mic className="w-5 h-5" />
                    )}
                </button>
            )}

            <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all ${isMuted
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                    }`}
            >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
        </div>
    );
}
