import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import '../styles/JumpRope.css';

const MEDIAPIPE_POSE_VERSION = '0.5.1675469404';

// History buffer size for smoothing
const HISTORY_SIZE = 8;

const JumpRopeCounter: React.FC = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- Core State ---
    const [jumpCount, setJumpCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aiStatus, setAiStatus] = useState<'initializing' | 'live' | 'error'>('initializing');
    const [displayStatus, setDisplayStatus] = useState<'READY' | 'JUMPING'>('READY');
    const [movementPct, setMovementPct] = useState(0); // 0-100 for the movement bar

    // --- Detection Refs (not state, avoids stale closures) ---
    const jumpCountRef = useRef(0);
    const jumpStatusRef = useRef<'standing' | 'jumping'>('standing');
    const centroidYHistory = useRef<number[]>([]);
    const baselineY = useRef<number | null>(null);
    const bodyHeightRef = useRef<number>(200);
    const peakY = useRef<number>(0);
    const cooldownRef = useRef(false);
    const lastFrameTime = useRef<number>(Date.now());
    const velocityRef = useRef<number>(0);
    const lastMovementTime = useRef<number>(Date.now());

    const handleVideoLoad = () => {
        setIsLoading(false);
        setError(null);
        setAiStatus('live');
    };

    const handleCameraError = (err: any) => {
        console.error("Webcam Error:", err);
        setError("Camera failed to start. Please check permissions.");
        setIsLoading(false);
        setAiStatus('error');
    };

    // The core detection callback — uses refs only, never stale state
    const onResults = useCallback((results: any) => {
        if (!canvasRef.current || !results.poseLandmarks) return;

        const canvasCtx = canvasRef.current.getContext('2d');
        if (!canvasCtx) return;

        const W = canvasRef.current.width;
        const H = canvasRef.current.height;
        const now = Date.now();
        const deltaTime = (now - lastFrameTime.current) / 1000;
        lastFrameTime.current = now;

        canvasCtx.clearRect(0, 0, W, H);

        // --- Landmark indices ---
        const nose = results.poseLandmarks[0];
        const lShoulder = results.poseLandmarks[11];
        const rShoulder = results.poseLandmarks[12];
        const lHip = results.poseLandmarks[23];
        const rHip = results.poseLandmarks[24];
        const lAnkle = results.poseLandmarks[27];
        const rAnkle = results.poseLandmarks[28];

        if (!lShoulder || !rShoulder || !lHip || !rHip) return;

        // --- CALC CENTROID (The Magic) ---
        // Use an average of shoulders and hips for maximum stability
        const centroidY = ((lShoulder.y + rShoulder.y + lHip.y + rHip.y) / 4) * H;

        // Calibrate scale using shoulder width (distance from camera)
        const shoulderWidth = Math.abs(lShoulder.x - rShoulder.x) * W;
        const scaleFactor = shoulderWidth / 150; // normalized to standard distance

        // Estimate body height
        if (nose && (lAnkle || rAnkle)) {
            const ankleY = (lAnkle && rAnkle) ? (lAnkle.y + rAnkle.y) / 2 * H : (lAnkle?.y ?? rAnkle!.y) * H;
            bodyHeightRef.current = Math.max(100, Math.abs(ankleY - nose.y * H));
        }
        const bodyH = bodyHeightRef.current;

        // --- Smoothing ---
        centroidYHistory.current.push(centroidY);
        if (centroidYHistory.current.length > 4) centroidYHistory.current.shift();
        const smoothY = centroidYHistory.current.reduce((a, b) => a + b, 0) / centroidYHistory.current.length;

        if (baselineY.current === null) {
            baselineY.current = smoothY;
            return;
        }

        // --- Analytics ---
        const displacement = baselineY.current - smoothY; // positive = up
        const newVelocity = (displacement - peakY.current) / deltaTime; // relative velocity
        velocityRef.current = velocityRef.current * 0.7 + newVelocity * 0.3; // low-pass filter

        // Dynamic thresholds based on scale and body height
        const jumpThreshold = bodyH * 0.04;
        const landThreshold = bodyH * 0.015;

        // Movement meter
        const pct = Math.max(0, Math.min(100, (displacement / (bodyH * 0.15)) * 100));
        setMovementPct(Math.round(pct));

        // Auto-reset baseline if idle
        if (Math.abs(newVelocity) < 5) {
            if (now - lastMovementTime.current > 2000) {
                baselineY.current = smoothY;
                lastMovementTime.current = now;
            }
        } else {
            lastMovementTime.current = now;
        }

        // --- Draw Visual Feedback ---
        // 1. Skeleton
        for (const lm of results.poseLandmarks) {
            canvasCtx.beginPath();
            canvasCtx.arc(lm.x * W, lm.y * H, 3, 0, 2 * Math.PI);
            canvasCtx.fillStyle = jumpStatusRef.current === 'jumping' ? '#00f2fe' : '#4affc4';
            canvasCtx.fill();
        }

        // 2. The "Jump Line"
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, baselineY.current - jumpThreshold);
        canvasCtx.lineTo(W, baselineY.current - jumpThreshold);
        canvasCtx.strokeStyle = jumpStatusRef.current === 'jumping' ? 'rgba(0, 242, 254, 0.5)' : 'rgba(74, 255, 196, 0.2)';
        canvasCtx.lineWidth = 2;
        canvasCtx.setLineDash([10, 5]);
        canvasCtx.stroke();
        canvasCtx.setLineDash([]);

        // --- State Machine ---
        if (jumpStatusRef.current === 'standing') {
            // Predict takeoff via velocity + displacement
            if (displacement > jumpThreshold && velocityRef.current > 50) {
                jumpStatusRef.current = 'jumping';
                peakY.current = displacement;
                setDisplayStatus('JUMPING');
            } else if (Math.abs(displacement) < landThreshold) {
                // Micro-adjust baseline while standing
                baselineY.current = baselineY.current * 0.98 + smoothY * 0.02;
            }
        } else {
            if (displacement > peakY.current) peakY.current = displacement;

            // Detect landing via return to baseline or negative velocity
            if (displacement < landThreshold && !cooldownRef.current) {
                jumpStatusRef.current = 'standing';
                setDisplayStatus('READY');

                if (peakY.current > jumpThreshold) {
                    jumpCountRef.current += 1;
                    setJumpCount(jumpCountRef.current);
                    if ('vibrate' in navigator) navigator.vibrate(50);
                }

                peakY.current = 0;
                cooldownRef.current = true;
                setTimeout(() => { cooldownRef.current = false; }, 200);
            }
        }
    }, []);

    useEffect(() => {
        let active = true;
        let pose: any = null;

        const setupPose = async () => {
            try {
                const mpPose = await import('@mediapipe/pose');
                const PoseConstructor = mpPose.Pose || (mpPose as any).default?.Pose || (window as any).Pose;

                if (!PoseConstructor) throw new Error("Pose constructor not found.");

                pose = new PoseConstructor({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MEDIAPIPE_POSE_VERSION}/${file}`,
                });

                pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                pose.onResults(onResults);

                const loop = async () => {
                    const video = webcamRef.current?.video;
                    if (video && video.readyState === 4 && pose) {
                        try { await pose.send({ image: video }); } catch { /* ignore send errors */ }
                    }
                    if (active) requestAnimationFrame(loop);
                };

                loop();
            } catch (err: any) {
                console.error("Pose Setup Error:", err);
                setError(`AI Engine failed: ${err.message || 'Unknown error'}`);
                setIsLoading(false);
                setAiStatus('error');
            }
        };

        setupPose();
        return () => {
            active = false;
            if (pose?.close) pose.close();
        };
    }, [onResults]);

    const resetCounter = () => {
        jumpCountRef.current = 0;
        setJumpCount(0);
        baselineY.current = null;
        centroidYHistory.current = [];
        jumpStatusRef.current = 'standing';
        setDisplayStatus('READY');
        setMovementPct(0);
        velocityRef.current = 0;
    };

    return (
        <div className="jump-counter-container">
            <div className="header-text">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                    AI Jump Counter
                </h2>
                <p className="text-gray-400 text-sm">Stand 2-3 meters away · Full body visible</p>
            </div>

            <div className="video-wrapper">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full p-6 text-center text-rose-400">
                        <span className="text-4xl mb-4">⚠️</span>
                        <p className="font-bold">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-white/10 rounded-xl text-white text-sm"
                        >
                            Refresh Page
                        </button>
                    </div>
                ) : (
                    <>
                        <Webcam
                            ref={webcamRef}
                            className="webcam-feed"
                            mirrored={true}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            onUserMedia={handleVideoLoad}
                            onUserMediaError={handleCameraError}
                            videoConstraints={{
                                facingMode: "user",
                                width: { min: 480, ideal: 640 },
                                height: { min: 360, ideal: 480 },
                                frameRate: { min: 15, ideal: 30 }
                            }}
                        />
                        <canvas
                            ref={canvasRef}
                            className="pose-canvas"
                            width={640}
                            height={480}
                        />
                        {!isLoading && (
                            <div className={`jump-indicator status-${displayStatus === 'JUMPING' ? 'jumping' : 'standing'}`}>
                                {displayStatus}
                            </div>
                        )}
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-white/60 font-bold uppercase tracking-widest text-xs">Initializing AI...</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-value">{jumpCount}</span>
                    <span className="stat-label">Total Jumps</span>
                </div>
                <div className="stat-card relative overflow-hidden">
                    {/* Movement bar */}
                    <div
                        className={`absolute bottom-0 left-0 h-1.5 transition-all duration-75 rounded-full ${movementPct > 70 ? 'bg-cyan-400' : movementPct > 30 ? 'bg-primary' : 'bg-primary/30'}`}
                        style={{ width: `${movementPct}%` }}
                    />
                    <span className="stat-value text-sm">{aiStatus === 'initializing' ? '--' : aiStatus === 'error' ? 'Err' : displayStatus}</span>
                    <span className="stat-label">Status</span>
                </div>
            </div>

            {/* Movement meter label */}
            <div className="w-full bg-white/5 p-3 rounded-2xl border border-white/5 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Movement Meter</p>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-75 ${movementPct > 70 ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]' : movementPct > 30 ? 'bg-primary' : 'bg-primary/30'}`}
                        style={{ width: `${movementPct}%` }}
                    />
                </div>
                <p className="text-[9px] text-white/20 mt-1">Jump until this bar fills to count</p>
            </div>

            {/* Controls */}
            <div className="controls-bar">
                <button className="reset-btn" onClick={resetCounter}>
                    Reset Count
                </button>
            </div>
        </div>
    );
};

export default JumpRopeCounter;
