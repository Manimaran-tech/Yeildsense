import { motion } from "framer-motion";
import { ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

export const HolographicBoard = () => {
    // Fake "Terminal" Logs
    const [logs, setLogs] = useState([
        "> Initializing FHE Protocol...",
        "> Handshake Established.",
        "> Encrypting Liquidity Pool...",
        "> Route: Whirlpool::SOL-USDC",
    ]);

    useEffect(() => {
        const interval = setInterval(() => {
            const actions = [
                "> Optimizing Yield...",
                "> Rebalancing Range...",
                "> Verifying ZK Proof...",
                "> Hiding Wallet Trace...",
                "> Compounding Rewards...",
                "> Syncing Ledger..."
            ];
            const randomAction = actions[Math.floor(Math.random() * actions.length)];
            setLogs(prev => [...prev.slice(-4), randomAction]);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-full min-h-[400px] flex items-center justify-center">
            {/* Holographic Card Container */}
            <motion.div
                className="relative w-full max-w-md bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20"
                initial={{ transform: "perspective(1000px) rotateY(10deg) rotateX(5deg)" }}
                animate={{
                    transform: [
                        "perspective(1000px) rotateY(10deg) rotateX(5deg)",
                        "perspective(1000px) rotateY(-5deg) rotateX(-2deg)",
                        "perspective(1000px) rotateY(10deg) rotateX(5deg)"
                    ]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="text-xs font-mono text-gray-400">LIVE_PREVIEW.exe</div>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-6">
                    {/* Stat Row */}
                    <div className="flex gap-4">
                        <div className="flex-1 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center gap-2 mb-1 text-purple-400 text-xs uppercase font-bold tracking-wider">
                                <ShieldCheck size={12} /> Privacy Level
                            </div>
                            <div className="text-xl font-mono font-bold text-white">MAXIMUM</div>
                        </div>
                        <div className="flex-1 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                            <div className="flex items-center gap-2 mb-1 text-cyan-400 text-xs uppercase font-bold tracking-wider">
                                <TrendingUp size={12} /> APY
                            </div>
                            <div className="text-xl font-mono font-bold text-white">142.5%</div>
                        </div>
                    </div>

                    {/* Animated Graph Area */}
                    <div className="relative h-24 bg-black/40 rounded-lg border border-white/5 overflow-hidden flex items-end px-2 pb-2">
                        {/* Static Grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10px_10px]" />

                        {/* Moving Line */}
                        <svg className="w-full h-full overflow-visible z-10">
                            <motion.path
                                d="M0 80 C 40 70, 80 90, 120 40 C 160 10, 200 60, 240 30 C 280 10, 320 50, 360 20"
                                fill="none"
                                stroke="#00F0FF"
                                strokeWidth="2"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 2, ease: "easeInOut" }}
                            />
                            <motion.path
                                d="M0 80 C 40 70, 80 90, 120 40 C 160 10, 200 60, 240 30 C 280 10, 320 50, 360 20 L 360 100 L 0 100 Z"
                                fill="url(#gradientArea)"
                                stroke="none"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 0.5 }}
                                transition={{ delay: 0.5, duration: 1 }}
                            />
                            <defs>
                                <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(0, 240, 255, 0.3)" />
                                    <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Terminal Logs */}
                    <div className="h-28 bg-black/60 rounded-lg border border-white/10 p-3 font-mono text-xs overflow-hidden flex flex-col justify-end">
                        {logs.map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-green-400/80 mb-1"
                            >
                                {log}
                            </motion.div>
                        ))}
                        <motion.div
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            className="w-2 h-4 bg-green-500 inline-block align-middle ml-1"
                        />
                    </div>
                </div>

                {/* Glare Effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
            </motion.div>
        </div>
    );
};
