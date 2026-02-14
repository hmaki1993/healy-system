import { useNavigate } from 'react-router-dom';
import {
    Mic,
    Users,
    CreditCard,
    Calendar,
    Shield,
    Zap,
    ArrowRight,
    CheckCircle2,
    Globe,
    Sparkles,
    Smartphone,
    BarChart3,
    Bot
} from 'lucide-react';

export default function LandingPage() {
    const navigate = useNavigate();

    const features = [
        {
            title: "Hoki Toki Protocol",
            description: "Military-grade encrypted instant voice communication. Zero latency for elite synchronization.",
            icon: <Mic className="w-5 h-5 text-black" />,
            color: "from-[#D4AF37] via-[#F9E29C] to-[#AA841E]",
            accent: "bg-[#D4AF37]/20"
        },
        {
            title: "Royal Attendance",
            description: "Biometric and occupancy analytics for students and master coaches. Precision tracking reimagined.",
            icon: <Users className="w-5 h-5 text-black" />,
            color: "from-[#F9E29C] via-[#D4AF37] to-[#8B6E23]",
            accent: "bg-[#D4AF37]/20"
        },
        {
            title: "Elite Financials",
            description: "Sophisticated revenue forecasting, payroll automation, and automated institutional reporting.",
            icon: <CreditCard className="w-5 h-5 text-black" />,
            color: "from-[#D4AF37] via-[#AA841E] to-[#5C4D1C]",
            accent: "bg-[#D4AF37]/20"
        },
        {
            title: "Healy AI Oracle",
            description: "Neural-assisted academy optimization. AI that anticipates staff needs and athlete progression.",
            icon: <Bot className="w-5 h-5 text-black" />,
            color: "from-[#AA841E] via-[#D4AF37] to-[#F9E29C]",
            accent: "bg-[#AA841E]/20"
        },
        {
            title: "Unified Logistics",
            description: "Dynamic schedule orchestration across multiple batches, levels, and training arenas.",
            icon: <Calendar className="w-5 h-5 text-black" />,
            color: "from-[#D4AF37] via-[#F9E29C] to-[#AA841E]",
            accent: "bg-[#D4AF37]/20"
        },
        {
            title: "Master Dashboards",
            description: "Cinematic data visualization providing 360-degree visibility into academy operations.",
            icon: <BarChart3 className="w-5 h-5 text-black" />,
            color: "from-[#C5A028] via-[#D4AF37] to-[#8B6E23]",
            accent: "bg-[#C5A028]/20"
        }
    ];

    return (
        <div
            className="min-h-screen bg-[#020202] text-white selection:bg-[#D4AF37]/30 overflow-x-hidden font-inter border-t-2 border-[#D4AF37]/20 origin-top"
            style={{ zoom: '0.9' }}
        >
            {/* Ultra-Premium Noise Texture Overlay */}
            <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] mix-blend-overlay">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <filter id="noiseFilter">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noiseFilter)" />
                </svg>
            </div>

            {/* Cinematic Lighting System */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-[#D4AF37]/5 blur-[160px] rounded-full animate-pulse-slow"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#AA841E]/5 blur-[160px] rounded-full animate-pulse-slow" style={{ animationDelay: '4s' }}></div>
                <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] bg-[#F9E29C]/3 blur-[140px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Navigation - Floating Glassmorphic */}
            <nav className="sticky top-0 z-[100] px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-3 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
                    <div className="flex items-center gap-4 group cursor-pointer">
                        <div className="w-12 h-12 flex items-center justify-center p-1.5 overflow-hidden transition-all duration-700 group-hover:scale-110 shadow-[0_0_20px_rgba(212,175,55,0.15)] rounded-full">
                            <img src="/logo.png" alt="Healy Logo" className="w-full h-full object-contain mix-blend-screen" style={{ clipPath: 'circle(50%)' }} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black tracking-[0.2em] leading-tight">HEALY <span className="text-[#D4AF37] italic">GYMNASTICS</span></span>
                            <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.4em]">Elite Ecosystem</span>
                        </div>
                    </div>

                    <div className="hidden lg:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                        <a href="#features" className="hover:text-[#D4AF37] transition-all relative group">
                            Infrastructure
                            <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#D4AF37] transition-all group-hover:w-full"></span>
                        </a>
                        <a href="#solutions" className="hover:text-[#D4AF37] transition-all relative group">
                            Royal Solutions
                            <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#D4AF37] transition-all group-hover:w-full"></span>
                        </a>
                        <a href="#about" className="hover:text-[#D4AF37] transition-all relative group">
                            Our Legacy
                            <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#D4AF37] transition-all group-hover:w-full"></span>
                        </a>
                    </div>

                    <button
                        onClick={() => navigate('/login')}
                        className="group relative px-8 py-3 bg-[#D4AF37] text-black font-black rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(212,175,55,0.2)]"
                    >
                        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <span className="relative z-10 uppercase tracking-[0.2em] text-[10px]">Portal Login</span>
                    </button>
                </div>
            </nav>

            {/* Hero Section - Majestic */}
            <section className="relative pt-32 pb-48 px-6 max-w-7xl mx-auto text-center flex flex-col items-center">
                <div className="relative inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/[0.03] border border-[#D4AF37]/30 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="absolute inset-0 bg-[#D4AF37]/5 blur-lg rounded-full"></div>
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#D4AF37]/90 relative z-10">Est. 1886 • The Standard of Professionalism</span>
                </div>

                <h1 className="text-6xl md:text-[9rem] font-black tracking-[-0.04em] mb-12 leading-[0.85] max-w-5xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                    THE ELITE <br />
                    <span className="bg-gradient-to-b from-[#D4AF37] via-[#F9E29C] to-[#AA841E] bg-clip-text text-fill-transparent italic">ACADEMY</span>
                    <br /> ECOSYSTEM
                </h1>

                <p className="text-xl md:text-2xl text-white/40 max-w-3xl mb-16 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                    Beyond management. A legacy-driven digital infrastructure crafted for the globally distinguished Healy Gymnastics Academy.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-700">
                    <button
                        onClick={() => navigate('/login')}
                        className="group w-full sm:w-auto px-12 py-5 bg-[#D4AF37] text-black font-black rounded-3xl flex items-center justify-center gap-4 hover:scale-105 transition-all shadow-[0_20px_60px_rgba(212,175,55,0.4)] uppercase tracking-[0.2em] text-xs"
                    >
                        Master Access
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button className="w-full sm:w-auto px-12 py-5 bg-white/5 border border-white/10 hover:bg-white/10 transition-all rounded-3xl font-black text-xs uppercase tracking-[0.2em] text-white/60">
                        Institutional Profile
                    </button>
                </div>

                {/* Majestic Hero Display */}
                <div className="mt-40 relative w-full aspect-video md:aspect-[2.4/1] bg-transparent border border-white/5 rounded-[3rem] overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-[#D4AF37]/5 z-10"></div>
                    <div className="w-full h-full rounded-[2.8rem] relative overflow-hidden flex items-center justify-center">
                        <img src="/logo.png" className="w-[40%] h-[40%] opacity-[0.15] group-hover:opacity-[0.3] transition-all duration-1000 ease-out scale-110 group-hover:scale-100 mix-blend-screen" style={{ clipPath: 'circle(48%)' }} alt="" />

                        {/* Interactive HUD Overlay */}
                        <div className="absolute inset-x-12 top-12 flex justify-between items-start opacity-30 group-hover:opacity-60 transition-opacity">
                            <div className="space-y-4">
                                <div className="h-px w-24 bg-gradient-to-r from-[#D4AF37] to-transparent"></div>
                                <div className="text-[8px] font-black uppercase tracking-[0.5em] text-[#D4AF37]">System Health: Optimal</div>
                            </div>
                            <div className="space-y-4 text-right">
                                <div className="h-px w-24 bg-gradient-to-l from-[#D4AF37] to-transparent inline-block"></div>
                                <div className="text-[8px] font-black uppercase tracking-[0.5em] text-[#D4AF37]">Global Sync: Active</div>
                            </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center z-20">
                            <div
                                onClick={() => navigate('/login')}
                                className="text-center group/enter relative cursor-pointer"
                            >
                                <div className="absolute inset-[-40px] bg-[#D4AF37]/10 blur-[60px] rounded-full scale-0 group-hover/enter:scale-150 transition-transform duration-700"></div>
                                <div className="w-24 h-24 bg-black border border-[#D4AF37]/40 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(212,175,55,0.15)] group-hover/enter:shadow-[0_0_60px_rgba(212,175,55,0.3)] group-hover/enter:border-[#D4AF37] transition-all duration-500 relative bg-black/80 backdrop-blur-xl">
                                    <ArrowRight className="w-8 h-8 text-[#D4AF37] rotate-[-45deg] group-hover/enter:rotate-0 transition-transform duration-500" />
                                </div>
                                <span className="block text-[10px] font-black uppercase tracking-[0.6em] text-[#D4AF37]/60 group-hover/enter:text-[#D4AF37] transition-colors">Enter Virtual Arena</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section - Bento Infused */}
            <section id="features" className="py-48 px-6 max-w-7xl mx-auto relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-[#D4AF37]/50 to-transparent"></div>

                <div className="text-center mb-32">
                    <h2 className="text-4xl md:text-7xl font-black mb-8 tracking-[-0.02em]">ROYAL <span className="text-[#D4AF37] italic">INFRASTRUCTURE</span></h2>
                    <div className="flex items-center justify-center gap-6 opacity-40 italic font-medium tracking-[0.1em]">
                        <span>WORK TO SHINE</span>
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
                        <span>SHINE TO INSPIRE</span>
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]"></div>
                        <span>MANIFEST</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-8">
                    {features.map((f, i) => (
                        <div
                            key={i}
                            className={`group p-12 rounded-[3.5rem] bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08] hover:border-[#D4AF37]/40 transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden backdrop-blur-xl
                                ${i === 0 || i === 3 ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-3 lg:col-span-4'}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            <div className={`w-14 h-14 rounded-[1.5rem] bg-gradient-to-br ${f.color} flex items-center justify-center mb-10 shadow-[0_15px_30px_rgba(0,0,0,0.4)] group-hover:scale-110 transition-all duration-500`}>
                                {f.icon}
                            </div>

                            <h3 className="text-2xl font-black mb-6 tracking-tight text-white/90 group-hover:text-white transition-colors">{f.title}</h3>
                            <p className="text-white/30 text-base leading-relaxed group-hover:text-white/50 transition-colors font-medium">
                                {f.description}
                            </p>

                            <div className="mt-10 pt-10 border-t border-white/[0.05] flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Initialize Protocol</span>
                                <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Legacy Section - Dark & Premium */}
            <section id="solutions" className="py-48 relative overflow-hidden">
                <div className="absolute inset-0 bg-[#020202]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] aspect-square bg-[#D4AF37]/2 blur-[200px] rounded-full"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col lg:flex-row items-center gap-32">
                    <div className="flex-1">
                        <div className="w-12 h-px bg-[#D4AF37] mb-12"></div>
                        <h2 className="text-5xl md:text-8xl font-black tracking-tight mb-12 leading-[1.1]">
                            A DYNASTY <br />
                            <span className="text-[#D4AF37]">EVOLVED</span>.
                        </h2>
                        <div className="space-y-10">
                            {[
                                "Native Synchronization across Institutional Nodes",
                                "End-to-End Cryptographic Communication Architecture",
                                "Predictive Athlete Growth & Performance Modeling",
                                "Algorithmic Logistics & Arena Coordination",
                                "Royal Institutional Financial Forensic Reporting"
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-8 group cursor-default">
                                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#D4AF37] group-hover:bg-[#D4AF37] transition-all duration-500">
                                        <CheckCircle2 className="w-5 h-5 text-white/20 group-hover:text-black transition-colors" />
                                    </div>
                                    <span className="font-bold text-xl text-white/40 group-hover:text-white transition-all duration-500 tracking-tight">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 w-full flex justify-center">
                        <div className="relative w-full max-w-lg aspect-square">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/10 to-transparent blur-3xl opacity-50"></div>
                            <div className="relative z-10 bg-black/40 backdrop-blur-3xl border border-white/10 p-20 rounded-[4rem] flex flex-col items-center justify-center text-center shadow-[0_60px_120px_rgba(0,0,0,0.8)]">
                                <div className="p-8 bg-[#D4AF37]/10 rounded-full mb-12 border border-[#D4AF37]/20">
                                    <Smartphone className="w-16 h-16 text-[#D4AF37]" />
                                </div>
                                <div className="text-8xl font-black mb-4 tracking-tighter text-[#D4AF37]">138+</div>
                                <p className="text-white/30 font-black uppercase tracking-[0.4em] text-[10px]">Years of Unrivaled Excellence</p>
                                <div className="h-[2px] w-48 bg-gradient-to-r from-transparent via-white/10 to-transparent my-16"></div>
                                <div className="text-7xl font-black mb-4 tracking-tighter text-white/80 italic">100%</div>
                                <p className="text-white/30 font-black uppercase tracking-[0.4em] text-[10px]">Digital Sovereignty</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA - The Grand Finale */}
            <section className="py-60 px-6 max-w-6xl mx-auto text-center relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent"></div>

                <div className="group relative bg-[#050505] border border-white/10 p-20 md:p-32 rounded-[5rem] overflow-hidden shadow-[0_100px_200px_rgba(0,0,0,0.9)]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#D4AF37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="absolute -top-48 -right-48 w-96 h-96 bg-[#D4AF37]/10 blur-[140px] rounded-full"></div>

                    <h2 className="text-5xl md:text-[8rem] font-black mb-12 relative z-10 tracking-[-0.05em] leading-[0.9]">
                        JOIN THE <br />
                        <span className="text-[#D4AF37] italic">ELITE.</span>
                    </h2>

                    <p className="text-white/30 mb-20 text-2xl max-w-2xl mx-auto relative z-10 leading-relaxed italic font-medium">
                        "Work to Shine • Shine to Inspire • Manifest"
                    </p>

                    <button
                        onClick={() => navigate('/login')}
                        className="relative z-10 px-20 py-7 bg-[#D4AF37] text-black font-black rounded-[2.5rem] hover:scale-105 transition-all shadow-[0_30px_100px_rgba(212,175,55,0.4)] flex items-center justify-center gap-6 mx-auto uppercase tracking-[0.4em] text-xs hover:bg-white"
                    >
                        Initialize Portal <ArrowRight className="w-7 h-7" />
                    </button>

                    <div className="mt-16 text-[9px] font-black uppercase tracking-[0.6em] text-white/10 relative z-10">
                        The definitive academy ecosystem experience
                    </div>
                </div>
            </section>

            {/* Footer - Minimal & Clean */}
            <footer className="py-24 border-t border-white/5 bg-black">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <div className="flex items-center justify-center gap-4 mb-10 group cursor-pointer transition-all duration-700">
                        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center">
                            <img src="/logo.png" alt="" className="w-full h-full object-contain shadow-[0_0_20px_rgba(212,175,55,0.2)] mix-blend-screen" style={{ clipPath: 'circle(50%)' }} />
                        </div>
                        <span className="text-lg font-black tracking-[0.4em] uppercase text-white/80 group-hover:text-white transition-colors">HEALY <span className="text-[#D4AF37]">SYSTEM</span></span>
                    </div>
                    <div className="space-y-6">
                        <div className="text-white/20 text-[10px] font-black tracking-[0.4em] uppercase flex flex-col items-center gap-4">
                            <span>© 2026 Healy Academy Ecosystem • Designed for Absolute Excellence</span>
                            <div className="w-12 h-[1px] bg-white/10"></div>
                            <span className="text-[#D4AF37]/30 group hover:text-[#D4AF37] transition-colors cursor-default">
                                Handcrafted by <span className="text-[#D4AF37]/60 underline underline-offset-8 decoration-[#D4AF37]/20">Ahmed Hmaki</span>
                            </span>
                        </div>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { opacity: 0.1; transform: scale(1); }
                    50% { opacity: 0.2; transform: scale(1.1); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 8s infinite ease-in-out;
                }
                .text-fill-transparent {
                    -webkit-text-fill-color: transparent;
                }
            `}</style>
        </div>
    );
}
